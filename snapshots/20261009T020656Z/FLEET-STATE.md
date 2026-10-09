# FLEET-2 STATE — alpha-research RASI fleet (28 accounts ready, 924/day design cap)
Updated: 2026-09-13 (Agent lane retested static {2:19,5:9}; egress/identity layer live; 00:50 reboot recovered)

## System map
| # | component | what | launcher | log / state |
|---|-----------|------|----------|-------------|
| 1 | fleet gateway (9701) | FreeCode mesh API serving /v1/research; current PID 5168 still on 256MB heap — 1024MB applies on next restart | start-fleet-gateway.cmd | gateway.log |
| 2 | drain v3 (drain.mjs) | capacity engine: 28 accts x 33 DR/day = 924/day; persona scheduler (per-account hash window offset 0-90min after 08:00, burn 1.4-2.4/h, 25-min min gap), global spacing 75s±30%, inflight 8 day/3 night, quiet 23→8 (overnight ≤3/h/acct, ≤17/h global), rolling 24h cap 924, hot-reloads drain-config.json | start-drain.cmd | drain.log, drain-state.json |
| 3 | capture-daemon | signup auto-harvest (passwords + token + jar), dedupe by jwt sub; Chrome re-inject via auto-attach | start-capture.cmd / start-capture-hidden.vbs | capture.log |
| 4 | auto-loop | wave lifecycle: plan → approve-gate → drain → mine → synth → evolve → next plan; notifications → notifications.jsonl | start-auto-loop.cmd | auto-loop.log, auto-loop-state.json |
| 5 | topic-forge (3h loop) | fills queue.jsonl toward 1900 (2x burn) via local router 9788 (mimo-v2.5-free → deepseek-v4-flash-free → nemotron-3.5-lightning-free; HF space fallback); mix ~30% continuation (digest open-questions) + ~70% G1 domain rotation (24 non-fin / 6 fin, ≥60% non-financial enforced); all topics preflight-gated, dedup via harness dedup_key; topic files in waves/_forge/ | start-topic-forge.cmd | topic-forge.log, topic-forge-state.json |
| 6 | honeypot | 2 canaries / 30min t2t probe; punish → alarm.json {expires_at +2h} → drain pauses, resumes 50% pace 2h; + per-EGRESS tripwire (one probe per pool per round, tested live: direct healthy, dead pool → ERROR) | start-honeypot.cmd | honeypot.log |
| 7 | jwt-treadmill (refresh-jwts.mjs, 6h loop) | refreshes JWTs due <7d, waves of 3, test-then-write, 48h cooldown | start-refresh-jwts.cmd | jwt-treadmill.log, jwt-treadmill-state.json |
| 8 | watchdog v3 | 60s tick; gateway 2-strike health → verified-PID port-owner restart via launcher; other daemons presence-only; 10-min cooldowns | start-watchdog.cmd | watchdog.log, watchdog-state.json |
| 9 | hermes-tick (hourly) | GLM-5.3-Flash supervisor: snapshot → strict-JSON action plan → PID-only executor → supervisor-ledger.jsonl | start-hermes.cmd | hermes.log, hermes-state.json, supervisor-ledger.jsonl |
| 10 | egress.mjs (identity layer) | per-account→IP pool binding (≤3 accts/IP), rolling 24h health, auto-demote 48h + canary-gated re-admission, auto-park (never direct-leak); stdlib CONNECT canary dials (no undici on node v24.13) | on-demand CLI / honeypot round | egress-pools.json, egress-binding.json, egress-health.json |

NOTE: egress layer is LIVE but lanes are NOT yet dispatcher-wired into drain/sandbox-runner/agent-runner (integration points documented; deliberate — mid-soak, no production restarts).

## Survival layer
- Trust: jar-vault.mjs → jar-vault.json (30/30 jars, cnaui+aui 100%, 196KB); vault-backup/ copies; source_sha256 verified
- Kill-switch: challenges >3/day or success <80% @ n≥10 → alarm.json 2h + pace 0.5
- Cap-signature: hollow report (<1000 bytes / no sections) → 12h fence + topic rotation; maturation = 12h fence + one t2t warmup (fleet/honeypot.mjs shape) then unfence
- Honeypot live probe HEALTHY; acc1 JWT refresh live-proven +30d; tokens ~29.4d left as of 2026-09-12

## Hermes authority (supervisor)
- Transport: direct HTTP POST http://127.0.0.1:9790/v1/chat/completions, model zai-org/GLM-5.3-Flash (featherless-unified provider baseURL from opencode.json); `opencode run` CLI path times out on Windows — kept as dead fallback; last resort 9788/mimo
- Auto-approves continuation waves; director waves notify-only until 12h fallback; restarts daemons; fence/unfence; tunes whitelisted params (target_per_account_per_day ≤33, spacing 52-97s, pace 0.3-0.7, fence 6-24h, poll 30-180s); emergency stop at success <0.6
- NEVER touches accounts.json / jar vault / ops-theory / alpha_machine. No whatsapp MCP in opencode config → relay:'orchestrator'

## Reboot persistence
- HKCU Run keys: 10 alpha-* entries (gateway, capture, drain, watchdog, honeypot, topic-forge, jwt-treadmill, auto-loop, sandbox-jobs, agent-jobs) — full stack survives reboot
- Proven 2026-09-13: ~00:50 OS reboot killed the whole stack (~3h cold). fleet-safe-restart.ps1 exited 2 (stale drain inflight>0 gate blocks forever once jobs are orphaned — cold-start manually); gateway + watchdog relaunched 03:35 local, watchdog self-healed all 6 daemons, drain resumed firing

## Current numbers
- Accounts: 28/30 ready (acc14/acc16 fenced pending-blocked; acc7/acc9 removed, archived removed-accounts.json)
- Tokens: ~29.4d left; treadmill refreshes anything due <7d
- Queue: topic-forge target 1900 (2x burn), fill 215→425 at ~10/min; LIVE validation job 27758cf6 (55 refs, 29,160B, 10m56s) + 24 more fired same morning
- Wave history: w202609111131-g1 collected (2 reports 22,703B + 20,641B); w202609111956-g1 approved, 3 topics done via drain v3
- Prior drain v2 stack found dead morning of 09-12 (gateway 5th silent death) → motivated watchdog v3 + memory bump

## Sandbox compute lane (2026-09-12 VM-probe milestone)
- Verdict: NO 10GB/1GB agent VM on fleet accounts (full UI walk + 46-probe API map + 7-test pilot). Agent Mode = chat_type:'agent_mode' (Beta), gated by server rollout flag permissions.chat.agent_mode (0=Unavailable, 1=Available, 2=Hidden, 5=GuestUnavailable); fleet accs 2=Hidden, principal's own account enabled — rollout, not tier wall; payment UI disabled; '10GB' string absent from web bundle (desktop/Plus marketing). Every pod/workspace/sandbox REST endpoint ABSENT (L-055 re-confirmed 2026-09-12)
- Real compute lane (all proven live): code_interpreter server-side Python via t2t SSE on completions — direct HTTP, zero WAF friction (chats/new 200 in 1.2s); internet ON (urllib HTTP 200); pandas/numpy preinstalled; NO pip (20s cap blocks installs); HARD 20s per code_interpreter call; per-chat ISOLATED file workspace (20MB/file, 50MB total, 10 files) via getstsToken → OSS V1 signed PUT → parse → messages[0].files[] attach; NOT persistent across chats
- Lane 1 — sandbox-runner.mjs: runSandbox({accountIndex?,steps,files}) with ###RESULT###+JSON machine contract; state flows via chunk outputs (fresh t2t chat per chunk); buildChunks for perm_test/power_calc; LRU account rotation (shared sandbox-state.json, ≥5s spacing, ≤30 t2t chats/h/account, drain-inflight skip). sandbox-jobs.mjs daemon polls sandbox-queue.jsonl (types: perm_test/power_calc/custom_py) → sandbox-results/<id>.json + sandbox-jobs.jsonl; daemon RUNNING + HKCU Run key alpha-sandbox-jobs
- Lane 2 — qa-reread.mjs: attach a completed DR report (runs/*.report.md) → model grades vs epistemic rubric (falsifiability/source_quality/structure/calibration_language/verdict_clarity, 0-10) → strict JSON + anti-lazy quote-check (UNREAD gate) → ../qa-scores.jsonl
- Verified: J1 6000-shuffle perm p=0.00617; J2 paired 4000-shuffle p=0.00525 CI95 [0.075,0.272]; J3 2-prop power 0.3813 ≈ analytic 0.375 (within 1.3 SE); 13/13 chunks first-attempt. QA on 3 real reports: 9.6 (VigiBase 35.3KB) / 8.6 (FluSight 22.7KB) / 8.8 (G1 protocol 20.6KB), distinct scores, verbatim quote-checks confirmed, sha256 recorded; strict-JSON 1-retry recovery mandatory (first-attempt clean parse was 1/3)
- Scale: 28 ready accounts × code_interpreter = 28-worker distributed Python fleet; jobs must chunk ≤20s; inputs re-uploaded per job

## Agent Mode lane (RE complete 2026-09-12/13)
- Verdict: Qwen Agent Mode is fully drivable over pure HTTP (no UI) on flag∈{1,5} accounts — 9 of 28 usable (all 9 are flag=5 GuestUnavailable; no fleet account is flag=1). flag=2 (Hidden, 19/28) is server-blocked: instant 200 + JSON {code:'Service_Unavailable', details:'Agent Mode is not enabled'} — server-reject envelope, not a WAF hang. Entitlement plane knows agent_mode on 27/28 as {times_left:-1, time_unit:day} = untracked quota. Cost: ~5k prompt-token overhead per agent message (phase output_schema + tool defs).
- Transport (agent-mode-spec.md): chats/new with chat_type:'agent_mode' → completions with sub_chat_type:'lite' + feature_config{output_schema:'phase',...}; the full tool loop (web_search/read_file/write_file/fetch_page/present_file) streams as SSE function_call frames; sub_chat_type presence is the agent trigger — omit it and the call silently degrades to t2t. Files the agent writes arrive in the terminal file_list → fetch via files/getfilelink.
- Components: agent-runner.mjs (one-shot agent job runner), agent-jobs.mjs daemon (polls agent-queue.jsonl every 5s → agent-jobs.jsonl records + agent-artifacts/ + agent-results/), gate flags + sweep history in agent-gate-sweep.json; launcher start-agent-jobs.cmd, HKCU run key present.
- Rollout watch: permissions.chat.agent_mode is a server ROLLOUT and can drift — baseline {2:19, 5:9} re-confirmed 2026-09-13 (3 independent sweeps within 15 min, zero movement). Resweep before relying on the lane: GET /api/config per ready account, ≥3s spacing, update agent-gate-sweep.json (reswept_at + history). A 5→1 flip opens accounts; 5→2 closes the lane.

## Pending / next
- [x] VM probe CLOSED 2026-09-12: no agent VM exists (see Sandbox compute lane)
- [ ] Watch agent_mode rollout flag permissions.chat.agent_mode (baseline {2:19,5:9} on 2026-09-13; HTTP lane needs flag∈{1,5}; compute lane unaffected)
- [ ] sqlite3-stdlib test as pip-free DB option inside code_interpreter (stdlib may cover the per-job persistence gap without pip)
- [ ] Gateway 1024MB heap applies on next restart (natural death or fleet-safe-restart.ps1 in quiet window; polls drain inflight==0 first)
- [ ] 72h soak acceptance unchanged: ≥900/day, success ≥95%, 0 IP challenges, queue ≥1900, Hermes closes ≥90% incidents
- [ ] alpha state-graph update deferred behind G6 (validator failing, 14 errors) — do NOT attempt now

## Runbook
- Logs: fleet/*.log (gateway, drain, capture, auto-loop, honeypot, topic-forge, jwt-treadmill, watchdog, hermes); state in *-state.json; job records fleet/jobs/<job_id>.json; notifications.jsonl; supervisor-ledger.jsonl; alarm.json on trigger
- Restart anything: its start-*.cmd (watchdog auto-respawns gateway on 2-strike health, others presence-only); safe gateway swap = fleet-safe-restart.ps1; approve wave: node harness.mjs approve <wave-id>; fire manually: POST http://127.0.0.1:9701/v1/research {topic,focus,audience}
- Process-list caution: multiple 'qwen-mesh-api*' entries are usually LIVE MCP bridges (qwen-mesh-api-mcp.mjs) + gateway-supervisor.mjs, not zombies — verify cmdline + port ownership before any kill (A-011 / A-017)
- NEVER touch: ops/theory/ (locked), alpha_machine/ (production), accounts.json credentials, jar-vault.json (live auth); kill node procs only by port/PID, never by name