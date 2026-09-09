# agent-loop: free-tier LLM gateway reliability patterns

- **Date (UTC):** 2026-09-09
- **Model:** qwen3.8-max via oxmoiz/qwen-mesh-agent cloud gateway
- **GitHub query:** `llm gateway reliability patterns free-tier in:name,description,readme topic:llm topic:gateway fallback retry circuit-breaker rate-limit`
- **Repos found:** 0

---

## Landscape
The exact GitHub query returned no repositories, indicating that “free-tier LLM gateway reliability” is not yet a well-labeled niche. In practice, reliability patterns are embedded in broader LLM gateways and proxies that handle provider fallback, retry/backoff, budget-aware routing, quota tracking, and circuit breaking for rate-limited free endpoints.

## Top 3 repositories
- `BerriAI/litellm` — Best general reference for provider abstraction, retries, and fallback routing across many LLM APIs.
- `Portkey-AI/gateway` — Useful gateway pattern for request routing, provider fallback, and policy enforcement without locking into one vendor.
- `songquanpeng/one-api` — Relevant for quota/channel management and multi-provider aggregation, especially where free-tier budget and account limits matter.

## Actionable insight for a free-compute LLM mesh
Treat every free endpoint as a degraded dependency: wrap each provider with a circuit breaker, token-bucket rate limiter, and exponential backoff queue, then route requests through a priority table that prefers local/free models first and paid endpoints only when SLO violation is likely. Include idempotency keys and request fingerprints so retries are safe, and emit per-route metrics for latency, 429 rates, quota exhaustion, and completion quality fallbacks.

---

Proves GHA runners as free agent-compute hours (2,000 min/mo) with zero account farming.
