#!/usr/bin/env node
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const WORKBENCH = path.resolve(process.env.WORKBENCH || process.cwd());
const GW_BASE = (process.env.GW_BASE || '').replace(/\/+$/, '');
const HF_TOKEN = process.env.HF_TOKEN || '';
const MODEL = 'qwen3.8-max';
const MAX_ITERS = Math.max(1, parseInt(process.env.MAX_ITERS || '12', 10) || 12);
const WORKFLOW_DIR = path.join(WORKBENCH, '.github', 'workflows');
const READ_CAP = 200 * 1024;
const TOOL_RESULT_CAP = 300 * 1024;

let task = '';
let acceptance = '';
let filesHint = [];
let mode = '';
let outputPath = '';
let promptFiles = [];
try {
  let raw = process.env.TASK_JSON;
  if (!raw || raw === '{}' || raw === 'null' || !raw.trim()) {
    // push-triggered runs have empty workflow_dispatch inputs — fall back to the task file
    const tf = path.join(WORKBENCH, '.github', 'worker', 'task.json');
    if (fs.existsSync(tf)) raw = fs.readFileSync(tf, 'utf8');
  }
  const parsed = JSON.parse(raw || '{}');
  if (typeof parsed.task === 'string') task = parsed.task;
  if (typeof parsed.acceptance === 'string') acceptance = parsed.acceptance;
  if (Array.isArray(parsed.files_hint)) filesHint = parsed.files_hint.map(String).filter(Boolean);
  if (typeof parsed.mode === 'string') mode = parsed.mode;
  if (typeof parsed.output_path === 'string') outputPath = parsed.output_path;
  if (Array.isArray(parsed.prompt_files)) promptFiles = parsed.prompt_files.map(String).filter(Boolean);
} catch {}

const filesChanged = [];
let toolCallCount = 0;
let iterations = 0;

function jail(p) {
  const resolved = path.resolve(WORKBENCH, String(p));
  if (resolved !== WORKBENCH && !resolved.startsWith(WORKBENCH + path.sep)) {
    throw new Error(`jail violation: "${p}" escapes the workbench`);
  }
  return resolved;
}

function readable(p) {
  const resolved = jail(p);
  const rel = path.relative(WORKBENCH, resolved).split(path.sep).join('/');
  if (rel === '.git' || rel.startsWith('.git/')) {
    throw new Error(`read of "${rel}" is not allowed`);
  }
  return resolved;
}

function writable(p) {
  const resolved = jail(p);
  if (resolved === WORKFLOW_DIR || resolved.startsWith(WORKFLOW_DIR + path.sep)) {
    throw new Error('forbidden: writing .github/workflows is not allowed');
  }
  return resolved;
}

function walk(dir, depth, out, max) {
  if (depth > 3 || out.length >= max) return;
  let entries;
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return;
  }
  entries.sort((a, b) => a.name.localeCompare(b.name));
  for (const ent of entries) {
    if (out.length >= max) return;
    if (ent.name === '.git' || ent.name === 'node_modules') continue;
    const full = path.join(dir, ent.name);
    const rel = path.relative(WORKBENCH, full).split(path.sep).join('/');
    if (ent.isDirectory()) {
      out.push(rel + '/');
      walk(full, depth + 1, out, max);
    } else {
      out.push(rel);
    }
  }
}

function treeSlice(rootDir) {
  const out = [];
  walk(rootDir, 1, out, 400);
  return out.length ? out.join('\n') : '(empty)';
}

const SYSTEM_PROMPT =
  'You are a cloud coding agent working in a git workbench. Use tools to complete the task. Be surgical. ' +
  'Every assistant turn must consist of tool calls — plain-text turns are discarded and risk aborting the run as stalled. ' +
  'When done, respond with exactly DONE, or call the finish tool with a one-paragraph summary. ' +
  'Never print or exfiltrate secrets or environment variables. Never modify .github/workflows. ' +
  'For large files (>30KB), do not read the whole file — use run_node to print section headings first, then read targeted line slices via fs.readFileSync(p,"utf8").split("\\n").slice(a,b).join("\\n"). ' +
  'The gateway rate-limits heavy traffic, so budget your calls: one run_node call can print slices from MULTIPLE files at once — batch reads instead of one call per file. ' +
  'Start the deliverable early: write a draft skeleton with write_file after the first reports are read, then extend it with write_file after every couple of additional reports instead of saving everything for the end. ' +
  'Deliverables must be written with write_file — never emit deliverable content as chat text. ' +
  'Persist progress incrementally with write_file as you go, so partial work survives an interrupted run.';

const TOOLS = [
  {
    type: 'function',
    function: {
      name: 'read_file',
      description: 'Read a text file inside the workbench. Returns up to 200KB of content.',
      parameters: {
        type: 'object',
        properties: { path: { type: 'string', description: 'path relative to the workbench root' } },
        required: ['path'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'write_file',
      description: 'Create or overwrite a text file inside the workbench (parent dirs are created). Writing .github/workflows/* is forbidden.',
      parameters: {
        type: 'object',
        properties: {
          path: { type: 'string', description: 'path relative to the workbench root' },
          content: { type: 'string' },
        },
        required: ['path', 'content'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'list_files',
      description: 'List files and directories under a workbench directory (depth 3, max 400 entries). Omit dir for the workbench root.',
      parameters: {
        type: 'object',
        properties: { dir: { type: 'string', description: 'optional directory relative to the workbench root' } },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'run_node',
      description: 'Run a zero-dependency Node.js ESM snippet with cwd = workbench root. ESM only: use import statements (e.g. import fs from "node:fs") — require() is unavailable. Secrets are stripped from env. 20s timeout. Use for syntax checks (e.g. spawnSync(process.execPath, ["--check", file])) and small verifications. Returns exit code, stdout, stderr.',
      parameters: {
        type: 'object',
        properties: { code: { type: 'string', description: 'JavaScript (ESM) source to execute' } },
        required: ['code'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'finish',
      description: 'End the loop: the task is complete. Provide a one-paragraph summary of what was done.',
      parameters: {
        type: 'object',
        properties: { summary: { type: 'string' } },
        required: ['summary'],
      },
    },
  },
];

function toolReadFile(args) {
  const p = readable(args.path);
  const st = fs.statSync(p);
  if (st.isDirectory()) return `ERROR: "${args.path}" is a directory`;
  const len = Math.min(st.size, READ_CAP);
  const fh = fs.openSync(p, 'r');
  let text;
  try {
    const buf = Buffer.alloc(len);
    fs.readSync(fh, buf, 0, len, 0);
    text = buf.toString('utf8');
  } finally {
    fs.closeSync(fh);
  }
  if (st.size > READ_CAP) text += `\n...[truncated: ${st.size - READ_CAP} more bytes]`;
  return text;
}

function toolWriteFile(args) {
  const p = writable(args.path);
  fs.mkdirSync(path.dirname(p), { recursive: true });
  const content = typeof args.content === 'string' ? args.content : String(args.content ?? '');
  fs.writeFileSync(p, content, 'utf8');
  const rel = path.relative(WORKBENCH, p).split(path.sep).join('/');
  if (!filesChanged.includes(rel)) filesChanged.push(rel);
  return `OK: wrote ${rel} (${Buffer.byteLength(content, 'utf8')} bytes)`;
}

function toolListFiles(args) {
  const root =
    args.dir === undefined || args.dir === null || args.dir === ''
      ? WORKBENCH
      : readable(args.dir);
  const out = [];
  walk(root, 1, out, 400);
  return out.length ? out.join('\n') : '(empty)';
}

function toolRunNode(args) {
  const code = String(args.code ?? '');
  if (
    /\.github[\/\\]workflows/i.test(code) &&
    /(writeFile|appendFile|createWriteStream|unlinkSync|unlink\(|rmSync|rmdirSync)/.test(code)
  ) {
    return 'ERROR: snippet refused: it would modify .github/workflows';
  }
  const tmp = path.join(os.tmpdir(), `worker-snippet-${process.pid}-${Date.now()}.mjs`);
  fs.writeFileSync(tmp, code, 'utf8');
  const childEnv = { ...process.env };
  for (const k of Object.keys(childEnv)) {
    if (/^(HF|GH|GITHUB)_/i.test(k) || /^GIT_/i.test(k)) delete childEnv[k];
  }
  let res;
  try {
    res = spawnSync(process.execPath, [tmp], {
      timeout: 20000,
      cwd: WORKBENCH,
      env: childEnv,
      encoding: 'utf8',
      maxBuffer: 16 * 1024 * 1024,
    });
  } finally {
    try {
      fs.unlinkSync(tmp);
    } catch {}
  }
  if (res.signal || (res.error && res.error.code === 'ETIMEDOUT')) {
    return 'ERROR: snippet timed out after 20s (killed)';
  }
  const stdout = (res.stdout || '').slice(0, 50 * 1024) || '(empty)';
  const stderr = (res.stderr || '').slice(0, 20 * 1024) || '(empty)';
  return `exit=${res.status ?? 'signal:' + res.signal}\nstdout:\n${stdout}\nstderr:\n${stderr}`;
}

function executeTool(name, args) {
  switch (name) {
    case 'read_file':
      return toolReadFile(args);
    case 'write_file':
      return toolWriteFile(args);
    case 'list_files':
      return toolListFiles(args);
    case 'run_node':
      return toolRunNode(args);
    case 'finish':
      return 'OK';
    default:
      return `ERROR: unknown tool "${name}"`;
  }
}

function parseToolArgs(tc) {
  const raw = tc && tc.function ? tc.function.arguments : undefined;
  if (raw == null) return {};
  if (typeof raw === 'string') {
    try {
      return JSON.parse(raw);
    } catch {
      return {};
    }
  }
  if (typeof raw === 'object') return raw;
  return {};
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function chat(messages, toolChoice = 'auto') {
  let lastErr = new Error('gateway unreachable');
  for (let outer = 0; outer < 3; outer++) {
    if (outer > 0) {
      const wait = outer === 1 ? 300000 : 600000;
      console.log(`gateway 5xx persisting; cooling down ${wait / 1000}s (outer retry ${outer}/2)`);
      await sleep(wait);
    }
    for (let attempt = 0; attempt <= 3; attempt++) {
      if (attempt > 0) await sleep(10000);
      let res;
      try {
        res = await fetch(`${GW_BASE}/chat/completions`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${HF_TOKEN}` },
          body: JSON.stringify({
            model: MODEL,
            messages,
            tools: TOOLS,
            tool_choice: toolChoice,
            stream: false,
            max_tokens: 8000,
          }),
        });
      } catch (e) {
        lastErr = new Error(`gateway fetch failed: ${e.message}`);
        continue;
      }
      if (res.ok) return await res.json();
      const status = res.status;
      const bodyText = await res.text().catch(() => '');
      if (status === 429 || status >= 500) {
        lastErr = new Error(`gateway HTTP ${status}`);
        continue;
      }
      throw new Error(`gateway HTTP ${status} (non-retryable): ${bodyText.slice(0, 300)}`);
    }
  }
  throw lastErr;
}

function writeLastRun(status) {
  const record = {
    task: task.slice(0, 500),
    iterations,
    tool_calls: toolCallCount,
    files_changed: [...filesChanged],
    status,
  };
  const p = path.join(WORKBENCH, '.github', 'worker', 'last-run.json');
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, JSON.stringify(record, null, 2) + '\n', 'utf8');
}

function firstUserMessage() {
  const parts = [];
  parts.push('## Task', task.trim());
  if (acceptance) parts.push('', '## Acceptance criteria', acceptance.trim());
  if (filesHint.length) parts.push('', '## files_hint (read these first)', ...filesHint.map((f) => `- ${f}`));
  parts.push('', '## Workbench file tree (depth 3, max 400 entries)', '```', treeSlice(WORKBENCH), '```');
  return parts.join('\n');
}

async function singleShot() {
  // Deterministic synthesis mode: build a context pack from prompt_files, ONE brain call,
  // write the reply to output_path. No tools — immune to tool-call flakes. (Doctrine: agentic
  // for file surgery, single-shot for synthesis.)
  const files = promptFiles.map((f) => jail(f));
  const budget = 700_000;
  const perFile = Math.max(8_000, Math.floor(budget / Math.max(1, files.length)));
  const packParts = [];
  for (const f of files) {
    let t = fs.readFileSync(f, 'utf8');
    if (t.length > perFile) t = t.slice(0, perFile) + '\n...[truncated for budget]';
    packParts.push(`===== ${path.basename(f)} =====\n${t}`);
  }
  const prompt = `${task}\n\n## Source material (${files.length} files)\n\n${packParts.join('\n\n')}\n\nWrite the complete deliverable now. Output ONLY the deliverable content (markdown), nothing else.`;
  console.log(`single-shot: ${files.length} files, pack ${prompt.length} chars`);
  const data = await chat([
    { role: 'system', content: 'You are a principal-level synthesizer. Produce dense, practical, well-structured markdown deliverables. Follow the requested structure and length exactly.' },
    { role: 'user', content: prompt },
  ], 'auto');
  if (data && data.error) throw new Error(`gateway error: ${JSON.stringify(data.error).slice(0, 300)}`);
  const content = data && data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content;
  if (!content) throw new Error('empty completion');
  if (!outputPath) throw new Error('TASK_JSON must contain output_path for single_shot mode');
  const outPath = path.join(WORKBENCH, outputPath);
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, String(content));
  filesChanged.push(outputPath);
  console.log(`single-shot wrote ${outputPath} (${String(content).length} chars)`);
  filesChanged.forEach((f) => console.log(`changed: ${f}`));
}

async function main() {
  if (!GW_BASE || !HF_TOKEN) throw new Error('GW_BASE and HF_TOKEN env vars are required');
  if (mode === 'single_shot') return singleShot();
  if (!task) throw new Error('TASK_JSON must contain a string field "task"');
  const messages = [
    { role: 'system', content: SYSTEM_PROMPT },
    { role: 'user', content: firstUserMessage() },
  ];
  let status = 'max_iters';
  let consecutiveTextOnly = 0;
  let hardRetried = false;
  let requireTools = false;

  for (let i = 0; i < MAX_ITERS; i++) {
    iterations++;
    console.log(`--- iteration ${iterations}/${MAX_ITERS}${requireTools ? ' (tool_choice=required)' : ''} ---`);
    const data = await chat(messages, requireTools ? 'required' : 'auto');
    if (data && data.error) throw new Error(`gateway error: ${JSON.stringify(data.error).slice(0, 300)}`);
    const msg = data && data.choices && data.choices[0] && data.choices[0].message;
    if (!msg) throw new Error('unexpected gateway response shape');
    if (data.usage) {
      console.log(`usage: prompt=${data.usage.prompt_tokens} completion=${data.usage.completion_tokens} total=${data.usage.total_tokens}`);
    }
    const assistant = { role: 'assistant', content: msg.content ?? null };
    if (Array.isArray(msg.tool_calls) && msg.tool_calls.length > 0) assistant.tool_calls = msg.tool_calls;
    messages.push(assistant);

    if (Array.isArray(msg.tool_calls) && msg.tool_calls.length > 0) {
      consecutiveTextOnly = 0;
      requireTools = false;
      let finished = false;
      let finishedSummary = '';
      for (const tc of msg.tool_calls) {
        toolCallCount++;
        const name = tc && tc.function ? tc.function.name : '';
        const args = parseToolArgs(tc);
        let result;
        try {
          result = executeTool(name, args);
        } catch (e) {
          result = `ERROR: ${e && e.message ? e.message : String(e)}`;
        }
        if (name === 'finish') {
          if (filesChanged.length === 0) {
            result =
              'ERROR: finish rejected: zero files were written to the workbench this run. Write the deliverable(s) with write_file first, then call finish again.';
            console.log('tool finish REJECTED: no files written');
          } else {
            finished = true;
            finishedSummary = String(args.summary || '');
            console.log('tool finish');
          }
        } else {
          console.log(`tool ${name}: ${String(result).slice(0, 120).replace(/\s+/g, ' ')}`);
        }
        messages.push({
          role: 'tool',
          tool_call_id: (tc && tc.id) || `call_${toolCallCount}`,
          content: String(result).slice(0, TOOL_RESULT_CAP),
        });
      }
      if (finished) {
        status = 'done';
        console.log(`summary: ${finishedSummary.slice(0, 400)}`);
        break;
      }
    } else {
      const text = String(msg.content || '').trim();
      if (text === 'DONE' || /(^|\n)DONE\s*$/.test(text)) {
        status = 'done';
        break;
      }
      consecutiveTextOnly++;
      if (consecutiveTextOnly >= 2) {
        if (!hardRetried) {
          hardRetried = true;
          requireTools = true;
          consecutiveTextOnly = 0;
          messages.pop();
          messages.pop();
          messages.push({
            role: 'system',
            content:
              'CRITICAL: your previous replies were plain text and were discarded. Every turn must consist of tool calls. Act now: call write_file to persist your findings, or read_file/list_files/run_node to continue the task. Do not write prose.',
          });
          console.log('text-only x2: repairing conversation and forcing a tool call (hard retry 1/1)');
          continue;
        }
        status = 'stalled';
        console.log('stalled: repeated text-only replies without tool calls');
        break;
      }
      requireTools = true;
      messages.push({
        role: 'user',
        content:
          'SYSTEM REMINDER: your previous reply was plain text and has been discarded — the workbench only changes through tool calls, and this is your final warning before the run aborts as stalled. If the text you just produced contains deliverable content, immediately re-emit it via write_file (path + content). Otherwise continue the task with read_file, list_files, or run_node. Call finish(summary) only once the deliverable exists in the workbench.',
      });
    }
  }

  writeLastRun(status);
  console.log(`status=${status} iterations=${iterations} tool_calls=${toolCallCount} files_changed=${filesChanged.length}`);
  if (status !== 'done') process.exitCode = 2;
}

main().catch((e) => {
  console.error(`FATAL: ${e && e.message ? e.message : String(e)}`);
  try {
    writeLastRun('error');
  } catch {}
  process.exitCode = 1;
});