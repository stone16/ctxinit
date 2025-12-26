# Bootstrap Guidance (ctxinit defaults)

This file influences `ctx bootstrap` (and the LLM bootstrap step of `ctx init`).
These defaults are intentionally opinionated — edit or delete this file if you don’t want them applied.

## Goals (default)

- Produce *useful* agent context on first bootstrap (not placeholders).
- Prefer **project-specific facts** over generic advice.
- Keep outputs small; use progressive disclosure instead of long walls of text.

## Output expectations

- `.context/project.md`: mission, stack, repo map, common commands, non-negotiables, “read next” links.
- `.context/architecture.md`: system overview, key components, data flow, testing strategy, key decisions.
- `.context/rules/*.md`: 5–12 dense rule files with YAML frontmatter (id/description/globs/priority/tags).

## Non‑negotiables (default)

- Do not invent commands/paths; only reference what exists or what you can infer from manifests/docs.
- Do not add dependencies unless explicitly requested.
- Do not modify generated outputs (`AGENTS.md`, `CLAUDE.md`, `.cursor/rules/*.mdc`) directly — modify `.context/` sources.
- Never commit secrets; prefer env vars and documented config mechanisms.
- If something is ambiguous, ask concise clarifying questions via `suggestions` (instead of guessing).

## Writing style (default)

- Follow the predominant language in existing repo docs; otherwise use English.
- Prefer bullet points and short sections; avoid long prose.
- Prefer concrete commands in backticks over narrative.
- Use progressive disclosure: point to deeper docs rather than inlining everything.
