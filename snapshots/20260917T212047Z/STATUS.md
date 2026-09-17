# RASI STATUS — Research Fleet Control Tower

Generated: 17/09/2026, 12:37:27 (2026-09-17T07:37:27.020Z)

**HEALTH VERDICT: GREEN** — all gates nominal

## Gateway :9701

| up | healthy | total | cooling | uptime_s |
|---|---|---|---|---|
| UP | 28 | 30 | 0 | 92538 |

## Daemon Liveness (watchdog-state.json)

| daemon | last_seen | age | restarts | last_restart |
|---|---|---|---|---|
| drain | 2026-09-17T07:36:25.182Z | 1m | 1 | 2026-09-12T22:35:31.506Z |
| honeypot | 2026-09-17T07:36:25.182Z | 1m | 2 | 2026-09-14T21:57:00.795Z |
| gateway | 2026-09-17T07:36:26.661Z | 1m | 0 | - |
| forge | 2026-09-17T07:36:25.182Z | 1m | 0 | - |
| jwt | 2026-09-17T07:36:25.182Z | 1m | 0 | - |
| capture | 2026-09-17T07:36:25.182Z | 1m | 0 | - |
| autoloop | 2026-09-17T07:36:25.182Z | 1m | 0 | - |

## Queue & Digests

| queue total | pending | fired | done | approved | digests total | verified | today (local) |
|---|---|---|---|---|---|---|---|
| 1850 | 1377 | 5 | 373 | 1850 | 1726 | 1425 | 292 |

## Drain (rolling window)

| started | succeeded | failed | challenges | cap_signatures | success_rate | spacing_s | daily_cap |
|---|---|---|---|---|---|---|---|
| 403 | 392 | 6 | 0 | 1 | 98.5% | 52 | 924 |

## Soak Math (anchor 2026-09-12 09:30 local)

| hours elapsed | digests in window | digests/hour | projected/day |
|---|---|---|---|
| 123.12 | 1721 | 13.98 | 335 |

## Capability Lanes

| lane | queue depth | jobs (events) | jobs done | results | notes |
|---|---|---|---|---|---|
| sandbox | 1 | 27 | 4 | 4 | code_interpreter t2t |
| agent | 4 | 14 | 4 | 4 | eligible (flag 1/5): 9 / ready 28 |
| VM | - | - | - | - | VM-first decision; no production lane yet |

Agent flag distribution: 2:19, 5:9

## QA Lane

| scores | avg overall |
|---|---|
| 802 | 9.26 |

## Alarms & Incidents

- Honeypot alarm (fleet\alarm.json): none
- Drain kill_switch_at: 2026-09-14T22:14:50.471Z
- Last 5 notifications:

  - 2026-09-17T01:31:22.290Z gate_bypass_attempt (missing fields)
  - 2026-09-17T01:35:34.830Z hermes_notify
  - 2026-09-17T01:36:21.713Z hermes_notify
  - 2026-09-17T03:48:37.173Z hermes_notify
  - 2026-09-17T05:26:54.391Z account_unfenced

## Hermes Supervisor

| ticks | last tick | age | model | incidents |
|---|---|---|---|---|
| 63 | 2026-09-17T07:00:18.868Z | 37m | zai-org/GLM-5.3-Flash | 20 |

## Run Keys (HKCU ...\Run)

- oxalpha-fleet-gateway
- oxalpha-capture-daemon
- oxalpha-watchdog
- oxalpha-topic-forge
- oxalpha-honeypot
- oxalpha-drain
- oxalpha-auto-loop
- oxalpha-jwt-treadmill
- oxalpha-sandbox-jobs
- oxalpha-agent-jobs
- oxalpha-hermes
- Opera Stable
- OneDrive
- RASIFleetBoot

