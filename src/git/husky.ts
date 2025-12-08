/**
 * Husky Manager
 *
 * Manages Husky installation and configuration for git hooks.
 */

import * as fs from 'fs';
import * as path from 'path';
import { execSync, spawnSync } from 'child_process';

/**
 * Husky installation status
 */
export interface HuskyStatus {
  /** Whether Husky is installed as a dependency */
  installed: boolean;
  /** Whether Husky is initialized (.husky directory exists) */
  initialized: boolean;
  /** Husky version if installed */
  version?: string;
  /** Whether pre-commit hook exists */
  hasPreCommitHook: boolean;
  /** Whether our ctx hook is already configured */
  hasCtxHook: boolean;
}

/**
 * Husky Manager class
 */
export class HuskyManager {
  private projectRoot: string;

  constructor(projectRoot: string) {
    this.projectRoot = projectRoot;
  }

  /**
   * Check Husky installation status
   */
  async checkStatus(): Promise<HuskyStatus> {
    const status: HuskyStatus = {
      installed: false,
      initialized: false,
      hasPreCommitHook: false,
      hasCtxHook: false,
    };

    // Check if Husky is in package.json dependencies
    const packageJsonPath = path.join(this.projectRoot, 'package.json');
    if (fs.existsSync(packageJsonPath)) {
      try {
        const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));
        const deps = {
          ...packageJson.dependencies,
          ...packageJson.devDependencies,
        };
        if (deps.husky) {
          status.installed = true;
          status.version = deps.husky.replace(/[\^~]/g, '');
        }
      } catch {
        // Ignore JSON parse errors
      }
    }

    // Check if .husky directory exists
    const huskyDir = path.join(this.projectRoot, '.husky');
    status.initialized = fs.existsSync(huskyDir);

    // Check if pre-commit hook exists
    const preCommitPath = path.join(huskyDir, 'pre-commit');
    status.hasPreCommitHook = fs.existsSync(preCommitPath);

    // Check if our ctx hook is configured
    if (status.hasPreCommitHook) {
      try {
        const hookContent = fs.readFileSync(preCommitPath, 'utf-8');
        status.hasCtxHook = hookContent.includes('ctx build');
      } catch {
        // Ignore read errors
      }
    }

    return status;
  }

  /**
   * Install Husky as a dev dependency
   */
  async install(): Promise<boolean> {
    try {
      // Detect package manager
      const packageManager = this.detectPackageManager();

      // Install Husky
      const installCmd =
        packageManager === 'yarn'
          ? 'yarn add -D husky'
          : packageManager === 'pnpm'
            ? 'pnpm add -D husky'
            : 'npm install -D husky';

      execSync(installCmd, {
        cwd: this.projectRoot,
        stdio: 'pipe',
      });

      return true;
    } catch {
      return false;
    }
  }

  /**
   * Initialize Husky (create .husky directory)
   */
  async initialize(): Promise<boolean> {
    try {
      // Run husky init or husky install depending on version
      const result = spawnSync('npx', ['husky', 'init'], {
        cwd: this.projectRoot,
        stdio: 'pipe',
      });

      if (result.status !== 0) {
        // Try older husky install command
        const legacyResult = spawnSync('npx', ['husky', 'install'], {
          cwd: this.projectRoot,
          stdio: 'pipe',
        });
        return legacyResult.status === 0;
      }

      return true;
    } catch {
      return false;
    }
  }

  /**
   * Add pre-commit hook
   */
  async addPreCommitHook(hookContent: string): Promise<boolean> {
    try {
      const huskyDir = path.join(this.projectRoot, '.husky');

      // Ensure .husky directory exists
      if (!fs.existsSync(huskyDir)) {
        await fs.promises.mkdir(huskyDir, { recursive: true });
      }

      const preCommitPath = path.join(huskyDir, 'pre-commit');

      // Check if pre-commit already exists
      if (fs.existsSync(preCommitPath)) {
        const existingContent = await fs.promises.readFile(preCommitPath, 'utf-8');

        // If ctx build is already there, don't duplicate
        if (existingContent.includes('ctx build')) {
          return true;
        }

        // Append to existing hook
        const updatedContent = existingContent.trim() + '\n\n' + hookContent;
        await fs.promises.writeFile(preCommitPath, updatedContent, { mode: 0o755 });
      } else {
        // Create new hook
        await fs.promises.writeFile(preCommitPath, hookContent, { mode: 0o755 });
      }

      return true;
    } catch {
      return false;
    }
  }

  /**
   * Remove ctx hook from pre-commit
   */
  async removeCtxHook(): Promise<boolean> {
    try {
      const preCommitPath = path.join(this.projectRoot, '.husky', 'pre-commit');

      if (!fs.existsSync(preCommitPath)) {
        return true;
      }

      const content = await fs.promises.readFile(preCommitPath, 'utf-8');

      // Remove ctx-related lines
      const lines = content.split('\n');
      const filteredLines = lines.filter(
        (line) => !line.includes('ctx build') && !line.includes('# ctx pre-commit')
      );

      const newContent = filteredLines.join('\n').trim();

      if (newContent === '#!/usr/bin/env sh' || newContent === '#!/bin/sh') {
        // Hook is now empty, remove the file
        await fs.promises.unlink(preCommitPath);
      } else {
        await fs.promises.writeFile(preCommitPath, newContent + '\n', { mode: 0o755 });
      }

      return true;
    } catch {
      return false;
    }
  }

  /**
   * Detect which package manager is being used
   */
  private detectPackageManager(): 'npm' | 'yarn' | 'pnpm' {
    if (fs.existsSync(path.join(this.projectRoot, 'pnpm-lock.yaml'))) {
      return 'pnpm';
    }
    if (fs.existsSync(path.join(this.projectRoot, 'yarn.lock'))) {
      return 'yarn';
    }
    return 'npm';
  }
}
