---
id: testing-guidelines
description: Testing standards and patterns
priority: 7
always_apply: false
globs:
  - "**/*.test.ts"
  - "**/*.test.tsx"
  - "**/*.spec.ts"
tags:
  - testing
  - quality
domain: testing
---

# Testing Guidelines

## Test Structure

Use the AAA pattern: Arrange, Act, Assert

```typescript
describe('Calculator', () => {
  describe('add', () => {
    it('should add two positive numbers', () => {
      // Arrange
      const calculator = new Calculator();

      // Act
      const result = calculator.add(2, 3);

      // Assert
      expect(result).toBe(5);
    });
  });
});
```

## Naming Conventions

- Describe blocks: noun (the thing being tested)
- It blocks: should + expected behavior
- Test files: `*.test.ts` or `*.spec.ts`

## Coverage Requirements

- Minimum 80% line coverage
- 100% coverage for critical paths
- Focus on behavior, not implementation

## Mocking

- Mock external dependencies
- Use dependency injection for testability
- Prefer spies over mocks when possible
