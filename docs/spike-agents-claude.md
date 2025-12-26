# Spike: Opinionated Baseline for `AGENTS.md` and `CLAUDE.md`

Goal: define a **minimum, opinionated** set of project guidance that should exist in `AGENTS.md` (Codex) and `CLAUDE.md` (Claude Code), with a repeatable structure and clear layering rules for monorepos/modules.

This is a spike only: **no existing files modified**.

---

## 1) What’s in YesWelder today (local scan)

We found `CLAUDE.md` used at multiple directory layers (monorepo root → per-project → per-area modules → deep “how-to” docs).

**Top-level files**
- `/Users/stometa/dev/YesWelder/CLAUDE.md`: monorepo identity, architecture map, commands, “Do Not”, progressive disclosure, plan-mode requirement.
- `/Users/stometa/dev/YesWelder/yesWelderBackend/CLAUDE.md`, `/Users/stometa/dev/YesWelder/yesWelderMobile/CLAUDE.md`, `/Users/stometa/dev/YesWelder/yes-welder-admin/CLAUDE.md`: per-project identity, architecture map, commands, key patterns, “Do Not”, progressive disclosure, maintenance.

**Deeper “area” docs (backend)**
- `yesWelderBackend/src/main/java/org/springblade/modules/CLAUDE.md`: modules index + module template + “how to create a module”.
- `yesWelderBackend/src/main/java/org/springblade/core/secure/CLAUDE.md`: deep JWT/auth internals + troubleshooting + best practices.
- `yesWelderBackend/src/main/java/org/springblade/modules/*/CLAUDE.md`: module-specific docs (endpoints, key classes, testing pointers).
- `yesWelderBackend/src/test/CLAUDE.md`: very large testing/TDD guide (1,500+ lines).

**Also present**
- `/Users/stometa/dev/YesWelder/openspec/AGENTS.md`: OpenSpec workflow instructions (proposal/tasks/spec deltas).

### Patterns that work well
- **Consistent headings**: “Identity”, “Architecture Map”, “Commands”, “Do Not”, “Progressive Disclosure”.
- **Concrete commands**: copy/paste commands for run/test/lint.
- **Progressive disclosure**: a small index that points to deeper docs (`agent_docs/`, module docs).
- **Layering**: root → project → module keeps local context near the code.

### Gaps / friction observed
- **Docs are sometimes too large for “agent memory”** (risk: truncation or low signal-to-noise).
- **Mixing roles**: some files read like human onboarding docs, some like “agent rules”; separation isn’t always clear.
- **Duplication risk** across layers (same “Do Not” lists repeated) and across worktrees (multiple copies).

---

## 2) Current “official” best practices (online)

### `AGENTS.md` (Codex)
- Codex discovers instructions top-down: global (`~/.codex/AGENTS*.md`) then repo-root → cwd, with `AGENTS.override.md` taking priority at each level; large instruction sets should be split across directories because combined size is capped by default (`project_doc_max_bytes`, 32KiB).  
  Sources: OpenAI Codex docs on discovery and limits:
  - https://github.com/openai/codex/blob/main/docs/agents_md.md
  - https://github.com/openai/codex/blob/main/docs/config.md#project_doc_max_bytes
- Codex can be configured to treat other filenames (e.g., `CLAUDE.md`) as fallbacks, but OpenAI recommends migrating instructions to `AGENTS.md` for best performance.  
  Source: https://github.com/openai/codex/blob/main/docs/config.md#project_doc_fallback_filenames
- Codex’s `/init` prompt suggests an **optimal 200–400 word** “Repository Guidelines” doc with: structure, commands, style, testing, PR expectations.  
  Source: https://github.com/openai/codex/blob/main/codex-rs/tui/prompt_for_init_command.md
- `AGENTS.md` is positioned as a “README for agents”.  
  Source: https://github.com/agentsmd/agents.md

### `CLAUDE.md` (Claude Code)
- Claude Code memory locations are hierarchical: enterprise policy → project memory (`./CLAUDE.md` or `./.claude/CLAUDE.md`) → modular project rules (`./.claude/rules/*.md`) → user memory (`~/.claude/CLAUDE.md`) → project-local personal memory (`./CLAUDE.local.md`, auto-gitignored).  
  Source: https://code.claude.com/docs/en/memory
- `CLAUDE.md` supports `@path/to/file` imports (up to 5 hops), which is a useful way to avoid duplication (e.g., import `README.md`, `package.json`, or a shared standards doc).  
  Source: https://code.claude.com/docs/en/memory#claude-md-imports
- Best practices from Claude Code docs: **be specific**, **use structure + bullets**, **review periodically**.  
  Source: https://code.claude.com/docs/en/memory#memory-best-practices

---

## 3) Opinionated baseline (what “must exist”)

The minimum useful content for both `AGENTS.md` and `CLAUDE.md` should answer, quickly:

1. **What is this repo?** (1–2 lines: purpose + stack)
2. **How do I run/build/test it?** (copy/paste commands)
3. **Where is the code?** (short repo map)
4. **What are the non-negotiables?** (testing expectations, safety/security, no secrets, conventions)
5. **Where do I read more?** (links to deeper docs; don’t inline walls of text)

**House style**
- Prefer bullet points + short headings.
- Prefer *commands* over prose.
- Keep the root file short (target: ~200–400 words if possible; split into deeper files/rules when it grows).
- Avoid “vibes”: make rules testable and concrete (“Run `pnpm test`” > “ensure tests pass”).

---

## 4) Layering rules (monorepo + modules)

### Recommended structure
- **Repo root**: global overview + cross-cutting rules + “how to run any project”.
- **Project root** (e.g., `backend/`, `mobile/`): project-specific commands, architecture map, local conventions.
- **Hotspot directories** (auth, database, build tooling): add a scoped file only when the area has *unique* rules.

### Keep “rules” separate from “reference docs”
- Use the context file for **instructions + guardrails**.
- Put long explanations, API examples, diagrams in `docs/` or `agent_docs/`, and link to them.

### Cross-tool compatibility (Codex + Claude Code)
Pick one canonical approach:
- **Option A (recommended)**: canonical `AGENTS.md`; `CLAUDE.md` imports it (Claude supports imports).
- **Option B**: canonical `CLAUDE.md`; configure Codex `project_doc_fallback_filenames = ["CLAUDE.md"]` during migration.
- **Option C**: symlink one to the other (works locally but can be annoying on Windows tooling).

---

## 5) Templates (starter skeletons)

### Root `AGENTS.md` (Codex) — “Repository Guidelines”
```markdown
# Repository Guidelines

## Project Overview
- Purpose: <what this repo does>
- Stack: <lang/frameworks>

## Quickstart (copy/paste)
- Install: `<cmd>`
- Dev: `<cmd>`
- Test: `<cmd>`
- Lint/Format: `<cmd>`

## Repo Map
- `src/` <what lives here>
- `tests/` <how tests are organized>
- `docs/` <deeper docs>

## Non‑Negotiables
- Tests required for changes in: <areas>
- Do not commit secrets (tokens/keys); use `<env mechanism>`
- Follow existing patterns in: `<paths>`

## Where To Read Next
- `<doc link 1>` (when working on X)
- `<doc link 2>` (when working on Y)
```

### Root `CLAUDE.md` (Claude Code) — minimal + imports
```markdown
@AGENTS.md

# Claude Code Notes (project memory)
- Personal, non-committed overrides: use `CLAUDE.local.md`
- Prefer modular rules for large repos: `.claude/rules/*.md`
```

### Example `.claude/rules/` file (scoped rules)
```markdown
---
paths: src/**/*.ts, tests/**/*.test.ts
---

# TypeScript rules
- Use strict types; avoid `any` except in <cases>.
- Run `pnpm test` and `pnpm lint` before finishing.
```

---

## 6) Suggested next steps (if we decide to implement)

1. Decide canonical source (`AGENTS.md` vs `CLAUDE.md`) and enforce cross-import/fallback.
2. Add a generator “minimum baseline” for new repos: overview + commands + map + non-negotiables + doc links.
3. Add a size guard (warn when root files exceed ~32KiB; suggest splitting by directory / `.claude/rules/`).

