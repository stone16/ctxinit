---
id: git-workflow
description: Branch, commit, and PR workflow conventions
domain: workflow
priority: 70
tags:
  - git
  - workflow
always_apply: true
---

Default git workflow expectations for changes in this repo.

# Git Workflow

## Branching

- Work on a feature branch; do not commit directly to `main`/`master`.
- Use short, descriptive branch names: `feature/<topic>`, `fix/<topic>`, `chore/<topic>`.

## Commits

- Keep commits small and self-contained.
- Use imperative commit messages: "Add X", "Fix Y", "Refactor Z".
- Do NOT include "Co-authored-by" lines unless explicitly requested.

## PRs

- Prefer PRs over direct pushes for reviewability.
- Include: what changed, why, and how to test.
- Run relevant tests/lint before requesting review.
