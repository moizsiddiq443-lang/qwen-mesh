# Lessons Index — alpha-research `lessons.json` (A-001 … A-021)

> Generated from `.opencode/skills/alpha-research/lessons.json` (append-only; same symptom increments `evidence_count`). One line each; read the full entry before relying on it.

| ID | Date | Essence |
|----|------|---------|
| A-001 | 2026-09-11 | Dead model pins broke task/swarm/dsh workers; removing agent model pins lets subagents inherit the orchestrator model — task tool verified READY. |
| A-002 | 2026-09-11 | The mesh API strips inline URLs from report bodies; count `[[N]]` citation markers and use max(http, cites) as n_refs. |
| A-003 | 2026-09-11 | Subagents must clean only their own tmp dirs — a selftest cleanup deleted a mined topic file; harness fails closed (ENOENT) by design. |
| A-004 | 2026-09-11 | First evolve run: judge's strict shape-checking killed 67% of questions; retuned judge to ling-3.0-flash-fin-free via guarded auto-evolve. |
| A-005 | 2026-09-11 | Firing without contamination checks is blind — prefire-gate.mjs (C1/C2/C3) now wired into cmdFire for G0–G3. |
| A-006 | 2026-09-11 | Shape-only mining over-kills; add tier cascade + 3-dimension rubric + falsifier gate to the mine judge. |
| A-007 | 2026-09-11 | Three research generations had three queues/digests; consolidated via --queue redirect, corpus-index dedup, collect status sync. |
| A-008 | 2026-09-11 | Wave planning was static GAP_SEEDS; now dynamically composed from machine-seeds + Elo-lite leaderboard recursion. |
| A-009 | 2026-09-10 | Convergence (C) needs independence: pairwise Jaccard > 0.6 among supports downgrades C→P (low-divergence). |
| A-010 | 2026-09-10 | Method library never reached METHOD_REGISTRY; method-intake.mjs preps spec + snippet, but registration stays human-mandated. |
| A-011 | 2026-09-11 | Never mass-kill node processes by name-substring (took down gateways 9700/9701/9720); kill by port or exact PID only; WMI-spawned gateways need manual restart via their start-*.cmd. |
| A-012 | 2026-09-11 | CDP flatten-mode: pass the target sessionId on EVERY call, parse result.value (fallback result.result.value), call process.exit(0) explicitly, JWT lives in localStorage key `token`. |
| A-013 | 2026-09-11 | Auth 200 ≠ usable account: gate = /auths/ role===user + chats/new success; the existing JWT survives activation (no re-harvest); never mass-test auth endpoints. |
| A-014 | 2026-09-12 | A 256MB memory cap silently kills SSE-heavy node services (gateway died 5x); bump to 1024, watchdog 2-strike restart, fleet-safe-restart waits for inflight==0. |
| A-015 | 2026-09-12 | Capacity engine: 28 desynced heartbeats x 33/day = 924/day; cap-signature = HOLLOW-REPORT (<1000B/no sections), never n_refs==0. |
| A-016 | 2026-09-12 | `opencode run` hangs >300s on Windows; drive GLM-5.3-Flash supervision via direct HTTP POST to the provider baseURL (9790, no-auth); keys only from .env.freecode. |
| A-017 | 2026-09-12 | Multiple `qwen-mesh-api*` processes are usually LIVE MCP bridges, not zombie gateways — verify cmdline + netstat port ownership before any kill (refines A-011). |
| A-018 | 2026-09-12 | Qwen Agent Mode is a chat_type (flag 0/1/2/5), NOT a VM; real compute = code_interpreter over t2t SSE: internet on, pandas/numpy preinstalled, no pip, 20s/call, per-chat 20MB OSS workspace. |
| A-019 | 2026-09-12 | Sandbox fleet pattern verified 13/13: ≤20s chunks, ###RESULT###+JSON state handoff, LRU ≥5s spacing ≤30 t2t/h/acct; QA re-read needs JSON retry + anti-lazy quote-check (clean JSON only 1/3 first-attempt). |
| A-020 | 2026-09-13 | Agent Mode is fully drivable over HTTP (chat_type agent_mode + sub_chat_type lite + output_schema phase): flag 5 = usable logged-in, flag 2 = server-blocked; omitting sub_chat_type silently degrades to t2t. |
| A-021 | 2026-09-13 | RE method that works: client gate ≠ server gate (probe anyway), de-minify the bundle, drop-one-field variant matrix, distinguish WAF-hang vs instant-200 JSON reject, write probe artifacts incrementally. |

| A-026 | 2026-09-17 | New-Space creation is hard 402 PRO-gated even for Gradio SDK (extends L-042): valid fine-grained oxmoiz token + `create_repo(space, sdk=gradio, private=True)` returned 402, no partial repo created; fallback = PRO (~$9/mo) or extend `oxmoiz/qwen-mesh-agent`. (Full entry in lessons.json A-026 — the generated table above lags the JSON source.) |

## Top lessons for new agents (5 lines)

1. **A-011** — Never kill processes by name substring; kill by port or exact PID only, or you take down every gateway on the box.
2. **A-012** — CDP needs the target sessionId on every call; parse result.value with fallback; exit the process explicitly when done.
3. **A-017** — Before killing anything, verify cmdline + port ownership: what looks like a zombie is usually a live MCP bridge.
4. **A-018** — Agent Mode is a chat_type, not a VM; the only real compute lane is code_interpreter (20s/call, no pip, per-chat workspace).
5. **A-020** — Drive the agent lane over HTTP: chat_type agent_mode + sub_chat_type lite is the trigger; flag 5 works logged-in, flag 2 is server-blocked; without sub_chat_type you silently get plain t2t.
## L-043 (2026-09-17) 402-fallback onto a live multi-sidecar HF space
- NEVER replace app.py on a live multi-surface space (oxmoiz/qwen-mesh-agent: /v1 zen-router, /qwen 9701, /qwen/glm 9721, /qwen/admin). Requires subdir + port-offset merge (rasi-core/ subdir, QWEN_API_PORT=9702, one prewarm Popen line, /rasi/metrics proxy). Rollback = push captured original app.py back (rollback-space-app.py, sha256 92E0690E...).
- Capture byte-identical rollback BEFORE any push (HF raw API). Space HEAD 21650140743cbe98be11b78ee37dff50bb70ba1c.

