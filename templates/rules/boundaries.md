---
id: boundaries
description: Hard constraints and safety boundaries for any change
domain: general
priority: 100
tags:
  - boundaries
  - safety
  - security
always_apply: true
---

Hard non-negotiable constraints for any work in this repo.

# Boundaries

## Safety

- Do NOT commit secrets (tokens, private keys, passwords). Use env vars / secret managers.
- Do NOT exfiltrate proprietary code or data to third-party services without approval.
- Do NOT run destructive commands (e.g. `rm -rf`, `git reset --hard`, database drops) without explicit confirmation.

## Generated outputs

- Do NOT edit generated files directly: `AGENTS.md`, `CLAUDE.md`, `.cursor/rules/*.mdc`.
- Instead, edit `.context/project.md`, `.context/architecture.md`, and `.context/rules/**/*.md`, then run `ctx build`.

## Dependencies

- Do NOT add/upgrade dependencies without explicit approval.
- Prefer using existing dependencies and patterns first.

## Scope discipline

- Fix the root cause; avoid opportunistic refactors.
- Keep PRs small and cohesive (one concern per PR).
- Preserve public APIs unless change is explicitly requested.
