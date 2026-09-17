# RASI STATUS — Research Fleet Control Tower

Generated: 13/09/2026, 05:19:38 (2026-09-13T00:19:38.779Z)

**HEALTH VERDICT: YELLOW** — capture-daemon stale 5.5h (crash-loop, 17 restarts)

## Gateway :9701

| up | healthy | total | cooling | uptime_s |
|---|---|---|---|---|
| UP | 28 | 30 | 0 | 6255 |

## Daemon Liveness (watchdog-state.json)

| daemon | last_seen | age | restarts | last_restart |
|---|---|---|---|---|
| drain | 2026-09-13T00:19:07.861Z | 1m | 1 | 2026-09-12T22:35:31.506Z |
| topic-forge | 2026-09-13T00:19:07.861Z | 1m | 1 | 2026-09-12T22:35:33.100Z |
| honeypot | 2026-09-13T00:19:07.861Z | 1m | 1 | 2026-09-12T22:35:35.166Z |
| jwt-treadmill | 2026-09-13T00:19:07.861Z | 1m | 1 | 2026-09-12T22:35:37.398Z |
| capture-daemon | 2026-09-12T18:46:53.405Z | 5.5h | 17 | 2026-09-13T00:19:07.861Z |
| auto-loop | 2026-09-13T00:19:09.183Z | 0m | 1 | 2026-09-12T22:35:41.536Z |
| gateway | 2026-09-13T00:19:09.186Z | 0m | 0 | - |

## Queue & Digests

| queue total | pending | fired | done | approved | digests total | verified | today (local) |
|---|---|---|---|---|---|---|---|
| 996 | 505 | 6 | 485 | 996 | 488 | 430 | 15 |

## Drain (rolling window)

| started | succeeded | failed | challenges | cap_signatures | success_rate | spacing_s | daily_cap |
|---|---|---|---|---|---|---|---|
| 514 | 483 | 19 | 0 | 1 | 96.2% | 58 | 924 |

## Soak Math (anchor 2026-09-12 09:30 local)

| hours elapsed | digests in window | digests/hour | projected/day |
|---|---|---|---|
| 19.83 | 483 | 24.36 | 585 |

## Capability Lanes

| lane | queue depth | jobs (events) | jobs done | results | notes |
|---|---|---|---|---|---|
| sandbox | 0 | 19 | 3 | 3 | code_interpreter t2t |
| agent | 4 | 14 | 4 | 4 | eligible (flag 1/5): 9 / ready 28 |
| VM | - | - | - | - | VM-first decision; no production lane yet |

Agent flag distribution: 2:19, 5:9

## QA Lane

| scores | avg overall |
|---|---|
| 3 | 9.00 |

## Alarms & Incidents

- Honeypot alarm (fleet\alarm.json): none
- Drain kill_switch_at: null
- Last 5 notifications:

  - 2026-09-12T23:36:25.130Z watchdog_restart capture-daemon (process_missing)
  - 2026-09-12T23:47:20.784Z watchdog_restart capture-daemon (process_missing)
  - 2026-09-12T23:57:50.565Z watchdog_restart capture-daemon (process_missing)
  - 2026-09-13T00:08:30.605Z watchdog_restart capture-daemon (process_missing)
  - 2026-09-13T00:19:07.861Z watchdog_restart capture-daemon (process_missing)

## Hermes Supervisor

| ticks | last tick | age | model | incidents |
|---|---|---|---|---|
| 15 | 2026-09-12T19:21:12.168Z | 5.0h | zai-org/GLM-5.3-Flash | 8 |

## Run Keys (HKCU ...\Run)

- Opera Stable
- Discord
- MicrosoftEdgeAutoLaunch_82F35C22434AA2088352C3FB0C347607
- OneDrive
- oxalpha-fleet-gateway
- oxalpha-capture-daemon
- oxalpha-watchdog
- oxalpha-topic-forge
- oxalpha-honeypot
- oxalpha-drain
- oxalpha-auto-loop
- oxalpha-jwt-treadmill
- oxalpha-sandbox-jobs
- com.squirrel.slack.slack
- oxalpha-agent-jobs
- MicrosoftEdgeAutoLaunch_F072E8F080C5A31FE150A3CA4B35FB6A

