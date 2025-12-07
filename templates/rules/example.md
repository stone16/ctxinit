---
id: example-rule
description: An example rule demonstrating the frontmatter format
domain: general
globs:
  - "**/*.ts"
  - "**/*.js"
priority: 50
tags:
  - example
  - template
---

# Example Rule

This is an example rule file. Replace this content with your actual coding guidelines.

## Guidelines

1. **Code Style**: Follow consistent formatting
2. **Naming**: Use descriptive variable and function names
3. **Documentation**: Add comments for complex logic

## Examples

```typescript
// Good: Descriptive function name
function calculateTotalPrice(items: Item[]): number {
  return items.reduce((sum, item) => sum + item.price, 0);
}

// Avoid: Unclear naming
function calc(i: any[]): number {
  return i.reduce((s, x) => s + x.p, 0);
}
```
