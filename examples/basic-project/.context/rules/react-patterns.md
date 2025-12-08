---
id: react-patterns
description: React component patterns and conventions
priority: 8
always_apply: false
globs:
  - "**/*.tsx"
  - "**/*.jsx"
tags:
  - react
  - frontend
domain: frontend
---

# React Patterns

## Component Structure

```tsx
// 1. Imports
import React from 'react';
import styles from './Component.module.css';

// 2. Types
interface Props {
  title: string;
  onAction: () => void;
}

// 3. Component
export function Component({ title, onAction }: Props) {
  // 4. Hooks
  const [state, setState] = useState(false);

  // 5. Effects
  useEffect(() => {
    // side effects
  }, []);

  // 6. Handlers
  const handleClick = () => {
    onAction();
  };

  // 7. Render
  return (
    <div className={styles.container}>
      <h1>{title}</h1>
      <button onClick={handleClick}>Action</button>
    </div>
  );
}
```

## Best Practices

- Use functional components with hooks
- Prefer composition over inheritance
- Keep components small and focused
- Use React.memo for expensive renders
- Extract custom hooks for reusable logic
