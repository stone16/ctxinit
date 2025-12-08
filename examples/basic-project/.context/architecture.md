# Architecture

## Project Structure

```
src/
  components/    # React components
  utils/         # Utility functions
  services/      # API services
  hooks/         # Custom React hooks
tests/
  unit/          # Unit tests
  integration/   # Integration tests
```

## Key Design Decisions

### Component Architecture

We use a flat component structure with co-located tests and styles.

### State Management

React Context is used for global state with local state for component-specific data.

### API Layer

All API calls go through the services layer which handles authentication and error handling.
