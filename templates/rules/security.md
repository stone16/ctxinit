---
id: security-guidelines
description: Security best practices and requirements
domain: security
globs:
  - "**/*.ts"
  - "**/*.js"
priority: 100
tags:
  - security
  - critical
always_apply: true
---

# Security Guidelines

## Input Validation

Always validate and sanitize user input:

```typescript
// Good: Validate before use
function createUser(input: unknown): User {
  const validated = userSchema.parse(input); // throws on invalid
  return processUser(validated);
}

// Avoid: Trust user input
function createUser(input: any): User {
  return processUser(input); // dangerous!
}
```

## Authentication & Authorization

- Never store passwords in plain text
- Use secure session management
- Implement proper RBAC (Role-Based Access Control)
- Validate permissions on every protected operation

## Secrets Management

- Never commit secrets to version control
- Use environment variables for configuration
- Rotate secrets regularly
- Use secret management services in production

```typescript
// Good: Use environment variables
const apiKey = process.env.API_KEY;

// Avoid: Hardcoded secrets
const apiKey = 'sk_live_abc123'; // NEVER DO THIS
```

## Security Do NOTs

- Do NOT log sensitive data (passwords, tokens, PII)
- Do NOT expose stack traces in production
- Do NOT use eval() or Function constructor with user input
- Do NOT disable CORS without understanding implications
- Do NOT store sensitive data in localStorage

## SQL/NoSQL Injection Prevention

```typescript
// Good: Parameterized queries
const user = await db.query('SELECT * FROM users WHERE id = ?', [userId]);

// Avoid: String concatenation
const user = await db.query(`SELECT * FROM users WHERE id = '${userId}'`);
```

## Dependency Security

- Keep dependencies updated
- Run security audits: `npm audit`
- Review new dependencies before adding
- Use lockfiles to ensure reproducible builds
