# Deep Research Utilization Doctrine

## 1. Topic Crafting Rules
* **Multi-Component Prompting**: Never use monolithic queries. Structure prompts with four explicit blocks: Primary Question, Context/Stakeholder Perspective, Constraints (e.g., "prioritize primary research"), and Output Format. *(meta-best-practices-for-getting-maximum-value-from-llm-deep-research-tools-topic-formulation-de.md)*
* **Scope Bounds & Decomposition**: For multi-hop questions, decompose into atomic sub-queries (e.g., AtomRAG/QDRAG). Avoid decomposition for single-hop queries, as it introduces irrelevant noise and latency. *(meta-best-practices-for-getting-maximum-value-from-llm-deep-research-tools-topic-formulation-de.md)*
* **Time Windows & Recency**: Explicitly bound temporal scopes to prevent "temporal hallucination" caused by model training cutoffs. Treat recency as a first-class ranking factor in retrieval pipelines. *(meta-research-quality-validation-science-automated-checks-for-llm-generated-research-reports-ci.md)*
* **Assertive Technical Specificity**: When researching code or engineering specs, use assertive language ("must" vs "should") and explicitly define pre-conditions, post-conditions, and I/O edge cases. *(meta-best-practices-for-getting-maximum-value-from-llm-deep-research-tools-topic-formulation-de.md)*

## 2. Execution Strategy Decision Table

| Strategy | Best For | Architecture | Latency/Cost |
| :--- | :--- | :--- | :--- |
| **Single (Direct)** | Single-hop factoids, simple definitions. | Naive RAG or direct LLM call. Avoid complex decomposition. | Low |
| **Parallel** | Predictable comparisons, multi-part requests, hybrid search. | Query Decomposition (independent sub-queries) + concurrent Sparse (BM25) & Dense (Vector) retrieval fused via RRF. | Moderate |
| **Sprint (Iterative)** | Ambiguous, multi-hop, or high-stakes analysis. | ReAct, STORM (multi-perspective debate), or Chain-of-Verification (Draft $\rightarrow$ Verify $\rightarrow$ Revise). | High |

*(Sources: meta-best-practices-for-getting-maximum-value-from-llm-deep-research-tools-topic-formulation-de.md, meta-building-searchable-knowledge-bases-from-llm-research-corpora-local-rag-inverted-indexes-f.md, meta-multi-report-research-synthesis-architectures-storm-autosurvey-and-agentic-survey-generati.md)*

## 3. Synthesis Patterns
* **Pre-Writing Multi-Perspective Outlining (STORM)**: Before drafting, simulate a debate among diverse expert personas to build a comprehensive outline. This proactively resolves bias and prevents superficial summaries. *(meta-multi-report-research-synthesis-architectures-storm-autosurvey-and-agentic-survey-generati.md)*
* **Hybrid Knowledge Graphs**: For persistent knowledge bases, abandon monolithic text. Map synthesized facts to RDF triples/JSON-LD. This natively preserves conflicting evidence as separate edges with distinct provenance. *(meta-multi-report-research-synthesis-architectures-storm-autosurvey-and-agentic-survey-generati.md)*
* **Manifest-Driven Ingestion**: Use YAML frontmatter as a schema for all research reports. Chunk documents structurally via Markdown headers (not fixed windows) and track changes via content hashing (xxHash) and `corpus_version` stamps. *(meta-building-searchable-knowledge-bases-from-llm-research-corpora-local-rag-inverted-indexes-f.md)*
* **Specification-Driven Translation**: Convert research findings into machine-readable `spec.md` contracts. Use these specs to auto-generate scaffolding and enforce bidirectional traceability matrices (RTM) down to the code level. *(meta-from-research-to-implementation-workflows-that-convert-research-reports-into-engineering-s.md)*

## 4. Quality Gates
* **CI/CD Performance Gates**: Integrate LLM evaluations into CI pipelines. Block deployment if a new prompt/model fails to meet baseline thresholds (e.g., >90% factual accuracy) on a golden dataset. *(meta-research-quality-validation-science-automated-checks-for-llm-generated-research-reports-ci.md)*
* **Citation Verification Cascades**: Implement multi-stage auditing (e.g., CiteAudit). Start with fast structured API lookups (Crossref), fallback to LLM web search, and escalate to OCR/Scholar agents for high-stakes validation. *(meta-research-quality-validation-science-automated-checks-for-llm-generated-research-reports-ci.md)*
* **Adversarial Multi-Model Councils**: Route critical synthesis through a "Model Council" where independent frontier models generate outputs, and a separate judge model highlights disagreements and unique contributions. *(meta-best-practices-for-getting-maximum-value-from-llm-deep-research-tools-topic-formulation-de.md, meta-llm-deep-research-real-world-use-cases-2026-due-diligence-competitive-intelligence-academi.md)*
* **Structural Diffing**: For domain monitoring, use Tree Edit Distance (TED) algorithms to structurally diff JSON/YAML/API specs rather than relying on naive text diffs, ensuring semantic changes are accurately captured. *(meta-diff-monitoring-research-patterns-scheduled-re-research-of-a-domain-with-change-extraction.md)*

## 5. Failure Modes and Mitigations

| Failure Mode | Mitigation Strategy | Source |
| :--- | :--- | :--- |
| **Temporal Hallucination** | Ground responses in live-web search; track Dataset Drift Score (DDS) to detect aging benchmarks. | `meta-research-quality-validation-science-automated-checks-for-llm-generated-research-reports-ci.md` |
| **Noisy-TV Infinite Loops** | In self-refueling loops, reward "Learning Progress" (rate of error reduction) rather than pure prediction error to stop agents from chasing random noise. | `meta-self-refueling-research-loops-how-agentic-systems-generate-follow-up-research-questions-fr.md` |
| **Context Window Bloat** | Apply semantic deduplication (cosine similarity) and self-referential history compression to maintain state across long agentic research cycles. | `meta-self-refueling-research-loops-how-agentic-systems-generate-follow-up-research-questions-fr.md` |
| **False Consensus / Over-citation** | Use cross-encoder rerankers to prune distractors; store contradictory evidence in Knowledge Graphs rather than forcing a single narrative. | `meta-best-practices-for-getting-maximum-value-from-llm-deep-research-tools-topic-formulation-de.md`, `meta-multi-report-research-synthesis-architectures-storm-autosurvey-and-agentic-survey-generati.md` |
| **Specification Drift** | Treat specs as immutable, version-controlled code. Use ADRs (Architecture Decision Records) to log trade-offs and prevent AI coding agents from drifting from intent. | `meta-from-research-to-implementation-workflows-that-convert-research-reports-into-engineering-s.md` |