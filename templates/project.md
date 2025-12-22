# Project Context

<!-- Replace with your project name and description -->

A brief description of what this project does and its purpose.

## Stack

- **Language**: TypeScript / JavaScript
- **Framework**: <!-- e.g., React, Next.js, Express, NestJS -->
- **Database**: <!-- e.g., PostgreSQL, MongoDB, SQLite -->
- **Build**: npm / yarn
- **Testing**: Jest

## Architecture

```text
project/
├── src/               # Application source code
│   ├── components/    # UI components (if applicable)
│   ├── services/      # Business logic
│   ├── utils/         # Shared utilities
│   └── types/         # TypeScript type definitions
├── tests/             # Test files
├── docs/              # Documentation
└── config/            # Configuration files
```

## Commands

```bash
# Development
npm run dev            # Start development server

# Testing
npm test               # Run tests
npm run test:watch     # Run tests in watch mode
npm run test:coverage  # Run tests with coverage

# Build & Quality
npm run build          # Build for production
npm run lint           # Run linter
npm run format         # Format code
```

## Key Patterns

### Error Handling

```typescript
// Use Result type for operations that can fail
type Result<T, E = Error> = { success: true; data: T } | { success: false; error: E };

function parseConfig(input: string): Result<Config> {
  try {
    return { success: true, data: JSON.parse(input) };
  } catch (e) {
    return { success: false, error: e as Error };
  }
}
```

### Naming Conventions

- Files: `kebab-case.ts` (e.g., `user-service.ts`)
- Classes: `PascalCase` (e.g., `UserService`)
- Functions: `camelCase` (e.g., `getUserById`)
- Constants: `SCREAMING_SNAKE_CASE` (e.g., `MAX_RETRIES`)

## Do NOT

- Do NOT commit secrets or API keys to the repository
- Do NOT use `any` type unless absolutely necessary
- Do NOT skip error handling for async operations
- Do NOT modify auto-generated files directly
- Do NOT import from parent directories (`../../../`)

## Progressive Disclosure

| Task | Reference |
|------|-----------|
| Architecture details | `.context/architecture.md` |
| Coding standards | `.context/rules/` |
| API documentation | `docs/api/` |
| Contributing guide | `CONTRIBUTING.md` |
