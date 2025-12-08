/**
 * Performance Benchmarks
 *
 * Tests for performance targets:
 * - 100 rules compile in <3 seconds
 * - Change detection <100ms for 100 files
 * - Incremental build with 1 change <500ms
 * - Token estimation <10ms per file
 */

import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { parseAllRules, ParseOptions } from '../../src/parser/rule-parser';
import { loadConfig } from '../../src/config/loader';
import { BuildOrchestrator, BuildOptions } from '../../src/build/orchestrator';
import { estimateTokens } from '../../src/compiler/token-estimator';
import { detectChanges, readManifest } from '../../src/build/manifest';

describe('Performance Benchmarks', () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ctxinit-perf-'));
  });

  afterEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  function createTestProject(ruleCount: number) {
    const contextDir = path.join(tempDir, '.context');
    const rulesDir = path.join(contextDir, 'rules');
    fs.mkdirSync(rulesDir, { recursive: true });

    // Config
    fs.writeFileSync(
      path.join(contextDir, 'config.yaml'),
      'version: "1.0"\nproject:\n  name: perf-test\n  description: Performance test project\ncompile:\n  claude:\n    max_tokens: 50000\n    strategy: all\n  cursor:\n    strategy: all\n  agents:\n    max_tokens: 100000\n'
    );

    // Project.md
    fs.writeFileSync(
      path.join(contextDir, 'project.md'),
      '# Performance Test Project\n\nA project for benchmarking compilation performance.'
    );

    // Generate rules
    for (let i = 0; i < ruleCount; i++) {
      const content = generateRuleContent(i);
      fs.writeFileSync(path.join(rulesDir, `rule-${i.toString().padStart(3, '0')}.md`), content);
    }

    return { contextDir, rulesDir };
  }

  function generateRuleContent(index: number): string {
    // Generate realistic rule content (~500-1000 chars per rule)
    const description = `Rule ${index} for testing performance`;
    const content = `
# Rule ${index}

This is rule number ${index} generated for performance testing.

## Purpose

This rule demonstrates typical rule content that would be used in a real project.
It includes multiple sections and formatting to simulate real-world usage.

## Guidelines

1. First guideline for rule ${index}
2. Second guideline with more details
3. Third guideline explaining best practices

## Examples

\`\`\`typescript
// Example code for rule ${index}
function example${index}() {
  console.log('Rule ${index} example');
  return { id: ${index}, status: 'active' };
}
\`\`\`

## Notes

- Important note about rule ${index}
- Additional considerations
- Final remarks
`.trim();

    return `---
id: rule-${index.toString().padStart(3, '0')}
description: ${description}
priority: ${50 + (index % 50)}
always_apply: ${index % 10 === 0}
tags:
  - performance
  - test
  - rule-${index}
---

${content}`;
  }

  describe('10.1 Baseline Benchmarks', () => {
    it('should compile 100 rules in <3 seconds', async () => {
      createTestProject(100);

      const configResult = loadConfig(tempDir);
      const orchestrator = new BuildOrchestrator(tempDir, configResult.config, { quiet: true });
      const buildOptions: BuildOptions = {
        projectRoot: tempDir,
        targets: ['claude'],
        force: true,
        quiet: true,
      };

      const startTime = performance.now();
      const result = await orchestrator.build(buildOptions);
      const duration = performance.now() - startTime;

      expect(result.success).toBe(true);
      expect(duration).toBeLessThan(3000); // 3 seconds
      console.log(`100 rules compile time: ${duration.toFixed(2)}ms`);
    }, 10000);

    it('should detect changes in <100ms for 100 files', async () => {
      createTestProject(100);

      // First build to create manifest
      const configResult = loadConfig(tempDir);
      const orchestrator = new BuildOrchestrator(tempDir, configResult.config, { quiet: true });
      await orchestrator.build({
        projectRoot: tempDir,
        targets: ['claude'],
        force: true,
        quiet: true,
      });

      // Read manifest
      const manifest = await readManifest(tempDir);
      expect(manifest).toBeDefined();

      // Get all rule files
      const rulesDir = path.join(tempDir, '.context', 'rules');
      const ruleFiles = fs.readdirSync(rulesDir).map(f => path.join(rulesDir, f));

      // Measure change detection
      const startTime = performance.now();
      await detectChanges(tempDir, ruleFiles, manifest!);
      const duration = performance.now() - startTime;

      expect(duration).toBeLessThan(100); // 100ms
      console.log(`Change detection time (100 files): ${duration.toFixed(2)}ms`);
    }, 10000);

    it('should perform incremental build with 1 change in <500ms', async () => {
      createTestProject(100);

      // First build
      const configResult = loadConfig(tempDir);
      const orchestrator1 = new BuildOrchestrator(tempDir, configResult.config, { quiet: true });
      await orchestrator1.build({
        projectRoot: tempDir,
        targets: ['claude'],
        force: true,
        quiet: true,
      });

      // Modify one rule
      const ruleFile = path.join(tempDir, '.context', 'rules', 'rule-050.md');
      const content = fs.readFileSync(ruleFile, 'utf-8');
      fs.writeFileSync(ruleFile, content + '\n\n## Modified\nThis rule was modified.');

      // Measure incremental build
      const orchestrator2 = new BuildOrchestrator(tempDir, configResult.config, { quiet: true });
      const startTime = performance.now();
      const result = await orchestrator2.build({
        projectRoot: tempDir,
        targets: ['claude'],
        force: false,
        quiet: true,
      });
      const duration = performance.now() - startTime;

      expect(result.success).toBe(true);
      expect(duration).toBeLessThan(500); // 500ms
      console.log(`Incremental build time (1 change): ${duration.toFixed(2)}ms`);
    }, 15000);

    it('should estimate tokens in <10ms per file', async () => {
      const content = generateRuleContent(0);
      const iterations = 100;

      const startTime = performance.now();
      for (let i = 0; i < iterations; i++) {
        estimateTokens(content);
      }
      const duration = performance.now() - startTime;
      const perFile = duration / iterations;

      expect(perFile).toBeLessThan(10); // 10ms per file
      console.log(`Token estimation time per file: ${perFile.toFixed(2)}ms`);
    });
  });

  describe('10.2 Scale Testing', () => {
    const scaleCounts = [10, 50, 100, 500];

    for (const ruleCount of scaleCounts) {
      it(`should handle ${ruleCount} rules`, async () => {
        // Skip 500 rule test in CI to avoid timeouts
        if (ruleCount === 500 && process.env.CI) {
          console.log('Skipping 500 rule test in CI');
          return;
        }

        createTestProject(ruleCount);

        const configResult = loadConfig(tempDir);
        const orchestrator = new BuildOrchestrator(tempDir, configResult.config, { quiet: true });
        const buildOptions: BuildOptions = {
          projectRoot: tempDir,
          targets: ['claude'],
          force: true,
          quiet: true,
        };

        // Measure memory before
        const memBefore = process.memoryUsage();

        const startTime = performance.now();
        const result = await orchestrator.build(buildOptions);
        const duration = performance.now() - startTime;

        // Measure memory after
        const memAfter = process.memoryUsage();
        const heapUsed = (memAfter.heapUsed - memBefore.heapUsed) / 1024 / 1024;

        expect(result.success).toBe(true);

        console.log(`${ruleCount} rules:`);
        console.log(`  Time: ${duration.toFixed(2)}ms`);
        console.log(`  Heap delta: ${heapUsed.toFixed(2)}MB`);
        console.log(`  Rules processed: ${result.stats.rulesProcessed}`);
        console.log(`  Files generated: ${result.stats.filesGenerated}`);
      }, ruleCount === 500 ? 30000 : 15000);
    }
  });

  describe('10.3 Memory Profiling', () => {
    it('should not leak memory over multiple builds', async () => {
      createTestProject(50);

      const configResult = loadConfig(tempDir);
      const memoryReadings: number[] = [];

      // Run multiple builds
      for (let i = 0; i < 5; i++) {
        // Force garbage collection if available
        if (global.gc) {
          global.gc();
        }

        const orchestrator = new BuildOrchestrator(tempDir, configResult.config, { quiet: true });
        await orchestrator.build({
          projectRoot: tempDir,
          targets: ['claude'],
          force: true,
          quiet: true,
        });

        memoryReadings.push(process.memoryUsage().heapUsed);
      }

      // Check that memory doesn't grow significantly
      const firstReading = memoryReadings[0];
      const lastReading = memoryReadings[memoryReadings.length - 1];
      const growth = (lastReading - firstReading) / firstReading;

      // Allow up to 50% growth (some variance is expected without manual GC)
      expect(growth).toBeLessThan(0.5);

      console.log('Memory readings over 5 builds:');
      memoryReadings.forEach((mem, i) => {
        console.log(`  Build ${i + 1}: ${(mem / 1024 / 1024).toFixed(2)}MB`);
      });
      console.log(`  Growth: ${(growth * 100).toFixed(2)}%`);
    }, 30000);

    it('should track peak memory during full build', async () => {
      createTestProject(100);

      const configResult = loadConfig(tempDir);

      // Force GC if available
      if (global.gc) {
        global.gc();
      }

      const memBefore = process.memoryUsage();

      const orchestrator = new BuildOrchestrator(tempDir, configResult.config, { quiet: true });
      await orchestrator.build({
        projectRoot: tempDir,
        targets: ['claude', 'cursor', 'agents'],
        force: true,
        quiet: true,
      });

      const memAfter = process.memoryUsage();

      console.log('Memory profile (100 rules, 3 targets):');
      console.log(`  Heap before: ${(memBefore.heapUsed / 1024 / 1024).toFixed(2)}MB`);
      console.log(`  Heap after: ${(memAfter.heapUsed / 1024 / 1024).toFixed(2)}MB`);
      console.log(`  Heap delta: ${((memAfter.heapUsed - memBefore.heapUsed) / 1024 / 1024).toFixed(2)}MB`);
      console.log(`  RSS delta: ${((memAfter.rss - memBefore.rss) / 1024 / 1024).toFixed(2)}MB`);

      // Peak memory should be reasonable (< 300MB for 100 rules, accounting for Jest overhead)
      expect(memAfter.heapUsed).toBeLessThan(300 * 1024 * 1024);
    }, 15000);
  });

  describe('10.4 CI Performance', () => {
    it('should complete pre-commit equivalent check in <2 seconds', async () => {
      createTestProject(50);

      // Simulate pre-commit: parse + analyze only (no compile)
      const startTime = performance.now();

      const parseOptions: ParseOptions = {
        projectRoot: tempDir,
        rulesDir: path.join(tempDir, '.context', 'rules'),
      };
      const { rules, errors } = parseAllRules(parseOptions);

      const duration = performance.now() - startTime;

      expect(errors).toHaveLength(0);
      expect(rules.length).toBe(50);
      expect(duration).toBeLessThan(2000); // 2 seconds

      console.log(`Pre-commit check time (50 rules): ${duration.toFixed(2)}ms`);
    });

    it('should complete full build in <10 seconds', async () => {
      createTestProject(100);

      const configResult = loadConfig(tempDir);
      const orchestrator = new BuildOrchestrator(tempDir, configResult.config, { quiet: true });
      const buildOptions: BuildOptions = {
        projectRoot: tempDir,
        targets: ['claude', 'cursor', 'agents'],
        force: true,
        quiet: true,
      };

      const startTime = performance.now();
      const result = await orchestrator.build(buildOptions);
      const duration = performance.now() - startTime;

      expect(result.success).toBe(true);
      expect(duration).toBeLessThan(10000); // 10 seconds

      console.log(`Full build time (100 rules, 3 targets): ${duration.toFixed(2)}ms`);
    }, 15000);
  });
});

/**
 * Benchmark Summary Generator
 * Call this separately to generate a performance report
 */
export async function generateBenchmarkReport(): Promise<string> {
  const lines: string[] = [
    '# Performance Benchmark Results',
    '',
    `Generated: ${new Date().toISOString()}`,
    '',
    '## Summary',
    '',
    '| Metric | Target | Status |',
    '|--------|--------|--------|',
    '| 100 rules compile | <3s | TBD |',
    '| Change detection (100 files) | <100ms | TBD |',
    '| Incremental build (1 change) | <500ms | TBD |',
    '| Token estimation | <10ms/file | TBD |',
    '| Pre-commit check | <2s | TBD |',
    '| Full build (CI) | <10s | TBD |',
    '',
  ];

  return lines.join('\n');
}
