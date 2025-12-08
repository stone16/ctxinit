---
id: coding-standards
description: Project coding standards and best practices
priority: 10
always_apply: true
globs: []
tags:
  - code-quality
  - standards
domain: general
---

# Coding Standards

## TypeScript Guidelines

- Use strict TypeScript settings
- Prefer `interface` over `type` for object shapes
- Always specify return types for functions
- Use `const` by default, `let` when mutation is needed

## Naming Conventions

- Use camelCase for variables and functions
- Use PascalCase for classes and interfaces
- Use SCREAMING_SNAKE_CASE for constants
- Prefix interfaces with `I` only if it improves clarity

## Code Organization

- Keep files under 300 lines
- One component/class per file
- Co-locate related files (component, test, styles)
- Use barrel exports (index.ts) for modules
