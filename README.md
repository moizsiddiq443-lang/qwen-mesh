# qwen-mesh — remote Qwen deep-research pods on GitHub Actions

PUBLIC runner repo (free unlimited minutes) → PRIVATE research repo (reports
never leave a private repo). One `workflow_dispatch` = one headless chromium
pod = one logged-in Qwen account = one deep research. Fire N dispatches with
distinct `account_index` (1-25) for a true N-way parallel wave. Runs on
GitHub's runners — zero local RAM.

## Architecture (public runner → private storage)

- `moizsiddiq443-lang/qwen-mesh` — PUBLIC. Runs workflows (free unlimited
  minutes, 20-concurrent). Holds only JWT secrets (masked). Public artifacts
  are metadata (`result.json`) ONLY — never the report body.
- `moizsiddiq443-lang/qwen-research` — PRIVATE. Every completed report is
  committed+ pushed here (`reports/qwen-research-<TS>-acct<N>.md/.pdf`).
  Proprietary research is never public.
- The local agent pulls reports from the private repo via `GH_TOKEN`
  (PAT has `repo` scope; stored as `PRIVATE_REPO_TOKEN` secret in the runner).

## Protocol

Ported byte-for-byte from `services/bridges/qwen/src/global.js` (verified live
2026-08-11): JWT → `localStorage.token` → CDP in-origin fetch (WAF-safe) →
`chat_type: "deep_research"` + `research_mode: "advance"` → notice stream →
poll `GET /api/v2/chats/<id>?direction=up&limit=10` → answer phase + refs +
`PdfMdGen` md/pdf links → push to private repo.

## Usage (agent path — one PAT with Actions:write + repo scope)

```powershell
# single research (fire + collect + pull report from PRIVATE repo)
.\qwen-mesh.ps1 "<topic>" -Account 1 -Wait

# parallel wave
$topics = @("t1","t2","t3")
.\qwen-mesh.ps1 -Wave $topics -Wait
```

Inputs: `topic` (required — use the scoping template), `focus`, `audience`,
`max_wait_seconds` (default 1500), `account_index` (1-25), `mode`
(`research` | `spike` | `collect` | `auth-test`), `chat_id` (hybrid collect).

Concurrency: runs sharing an `account_index` queue behind each other
(`qwen-account-<n>` group) — never double-fires one JWT. Distinct indices run
in parallel (free plan allows 20 concurrent jobs).

## Secrets

`QWEN_JWT_1..25` — chat.qwen.ai JWTs (encrypted, write-only, auto-masked in
logs). Rotation: re-harvest locally, then `gh secret set QWEN_JWT_<n>`.
`PRIVATE_REPO_TOKEN` + `PRIVATE_REPO_NAME` — push access to the private repo.
Never commit a JWT or a report — the runner repo is public.

## Auth-test

`mode: auth-test` = fastest account health check (login + create chat, ~10s).
Use it to verify credentials without burning research quota.

## Failure semantics (field-verified 2026-09-05 — same doctrine as the local mesh)

| exit/symptom | meaning | fix |
|---|---|---|
| 401 | JWT expired | re-harvest → `gh secret set` |
| 403 | WAF punish from Azure IP | CN plain-HTTP route or VPS fallback |
| 429 | per-account burst | space runs; retry later |
| 504 empty report | still running / cap hit | retry with higher `max_wait_seconds`; never trust a 200-with-empty-report |
| 502 CDP/session lost | pod died mid-run | retry on another account_index |
| "pending activation" (acct N) | email never verified | verify email in browser, re-harvest token |
| `landed=false` (chat stays EMPTY) | deep-research POST was WAF-dropped — the account is in the RGV587 punish window (`FAIL_SYS_USER_VALIDATE / RGV587_ERROR::SM::哎哟喂…`). **Chat still works during this window** — only the deep-research pattern is punished. | pace fires ≥5-10 min apart, retry in 30-60 min, or mature the account via normal bridge chats. Fire-local now gates collect dispatch on `landed` so a dropped fire never wastes a runner. |
| research never starts on new accts | **not a static "maturity"** — it's the WAF risk-score punishing bursts of research POSTs from one IP across low-trust (fresh) accounts. Accounts 1-5 survive because they have weeks of trusted session history; 6-25 get flagged after 1-3 fires in a burst (2026-09-05: acct 7 landed on first contact, then got punished after 8 fires in 90 min from this IP). | space fires (wave gap ≥5-10 min), rotate accounts, keep pod profiles stable, and warm accounts with normal chat (passes even while research is punished). |

## Health mapping

`powershell -File local\mesh-health.ps1 -From 7 -To 25 -GapSeconds 300`
probe-fires every account, records `landed`/`punished`, and writes
`F:\qwenmesh\mesh-health.json` with the current working set — run it before a
big wave so the wave only uses accounts that can start research today.