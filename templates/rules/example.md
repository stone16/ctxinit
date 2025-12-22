---
id: code-style
description: Core coding standards and conventions for this project
domain: general
globs:
  - "**/*.ts"
  - "**/*.tsx"
  - "**/*.js"
  - "**/*.jsx"
priority: 90
tags:
  - code-quality
  - standards
always_apply: true
---

# Code Style Standards

## Formatting

- Use 2-space indentation
- Maximum line length: 100 characters
- Use single quotes for strings
- Always use trailing commas in multiline structures
- Add semicolons at end of statements

## Functions

- Keep functions under 50 lines
- Single responsibility per function
- Use descriptive names that explain what the function does
- Prefer pure functions when possible

```typescript
// Good: Clear, focused function
function calculateOrderTotal(items: OrderItem[]): number {
  return items.reduce((sum, item) => sum + item.price * item.quantity, 0);
}

// Avoid: Vague name, multiple responsibilities
function process(data: any): any {
  // validation + transformation + side effects...
}
```

## Types

- Prefer explicit types over `any`
- Use interfaces for object shapes
- Use type aliases for unions and primitives
- Export types from dedicated type files

```typescript
// Good: Explicit, reusable types
interface User {
  id: string;
  email: string;
  createdAt: Date;
}

type UserId = string;
type UserRole = 'admin' | 'user' | 'guest';
```

## Imports

- Group imports: external → internal → relative
- Use absolute imports for cross-module references
- Avoid circular dependencies
- Prefer named exports over default exports
