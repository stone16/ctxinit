---
id: testing-standards
description: Testing conventions and requirements
domain: testing
globs:
  - "**/*.test.ts"
  - "**/*.spec.ts"
  - "**/tests/**"
  - "**/__tests__/**"
priority: 80
tags:
  - testing
  - quality
---

# Testing Standards

## Test Structure

Use the Arrange-Act-Assert pattern:

```typescript
describe('UserService', () => {
  describe('createUser', () => {
    it('should create a user with valid input', () => {
      // Arrange
      const input = { email: 'test@example.com', name: 'Test' };

      // Act
      const result = userService.createUser(input);

      // Assert
      expect(result.email).toBe(input.email);
    });
  });
});
```

## Naming Conventions

- Test files: `{filename}.test.ts` or `{filename}.spec.ts`
- Describe blocks: Use the class/function name
- It blocks: Start with "should" and describe the expected behavior

## Coverage Requirements

- Minimum 80% code coverage for new code
- Critical paths must have 100% coverage
- Edge cases and error paths must be tested

## Testing Do NOTs

- Do NOT test implementation details
- Do NOT rely on test order (tests must be independent)
- Do NOT use production data in tests
- Do NOT skip flaky tests without fixing them
- Do NOT mock what you don't own (wrap third-party APIs)

## Mocking Guidelines

```typescript
// Good: Mock at boundaries
const mockDatabase = {
  findUser: jest.fn().mockResolvedValue({ id: '1', email: 'test@example.com' }),
};

// Avoid: Over-mocking internal implementation
```
