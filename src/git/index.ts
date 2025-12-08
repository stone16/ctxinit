/**
 * Git Integration Module
 *
 * Provides Husky hook setup, gitignore management, and pre-commit integration.
 */

export { HuskyManager, type HuskyStatus } from './husky';
export { GitignoreManager, type GitignoreOptions } from './gitignore';
export { generatePreCommitHook, type PreCommitOptions } from './hooks';
