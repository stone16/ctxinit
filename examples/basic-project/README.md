# Basic Project Example

This is an example project demonstrating ctxinit usage.

## Setup

1. Navigate to the ctxinit root directory
2. Build and link the CLI:
   ```bash
   npm run build
   npm link
   ```

3. Return to this example directory and build:
   ```bash
   cd examples/basic-project
   ctx build
   ```

## Generated Files

After building, you'll have:

- `CLAUDE.md` - Context file for Claude Code
- `AGENTS.md` - Context file for general AI agents
- `.cursor/rules/*.mdc` - Individual rule files for Cursor

## Verification

Verify the integrity of generated files:

```bash
ctx verify
```

## Rules Included

This example includes three rules:

1. **coding-standards** - General coding standards (always applied)
2. **react-patterns** - React-specific patterns (applied to .tsx/.jsx files)
3. **testing-guidelines** - Testing conventions (applied to test files)
