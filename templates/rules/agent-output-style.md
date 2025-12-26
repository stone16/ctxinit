---
id: agent-output-style
description: How the AI agent should communicate and structure work
domain: agent
priority: 95
tags:
  - agent
  - output
  - workflow
always_apply: true
---

These are interaction and delivery rules for any AI agent working in this repo.

# Agent Output Style

## Communication

- Be concise and information-dense.
- Prefer bullet lists; avoid long prose.
- Always reference files and commands using backticks (e.g. `src/foo.ts`, `npm test`).
- When unsure, ask specific questions instead of guessing.
- Avoid emojis and filler.

## Execution

- Default to implementing changes, not only describing them (unless asked for advice).
- Keep changes minimal and scoped; avoid unrelated refactors.
- Run the narrowest relevant tests/commands first; expand only if needed.
- Call out tradeoffs and risks when they affect correctness or safety.

## Delivery

- Summarize what changed and where.
- Provide next commands to run when relevant.
- If something could not be verified locally, say so and explain how to verify.
