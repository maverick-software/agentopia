# Token Budgeting Strategies

Objectives
- Prevent context_length_exceeded errors
- Maintain response quality while controlling cost/latency

Components
- ModelInfo: { maxContextTokens, maxOutputTokens }
- Counters: provider counters or conservative heuristic estimators
- Policy: role‑priority trimming (keep system/identity > latest user > latest assistant > older)

Algorithm
1) Count tokens for planned output: budget = maxContextTokens − safetyMargin − maxOutput
2) Build prompt; if overflow, trim oldest by role priority
3) If still overflow, summarize oldest block into compact summary (fast model) and retry
4) Optional: escalate model if agent allows (e.g., 8k → 128k)

Notes
- Streamed responses still respect maxOutputTokens
- Persist summaries to working memory for reuse
- Log pre/post token counts for observability
