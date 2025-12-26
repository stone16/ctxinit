import { buildBootstrapUserPrompt } from '../../src/llm/prompts';
import { CodebaseAnalysis } from '../../src/cli/bootstrap';

describe('buildBootstrapUserPrompt', () => {
  it('includes bootstrap guidance and scaffold override hints', () => {
    const analysis: CodebaseAnalysis = {
      projectName: 'demo-project',
      languages: [{ name: 'TypeScript', extensions: ['.ts'], fileCount: 10, percentage: 100 }],
      frameworks: ['React'],
      buildTools: ['Vite'],
      testingTools: ['Jest'],
      structure: {
        topLevel: ['src', 'tests'],
        srcStructure: ['components'],
        hasTests: true,
        hasDocs: false,
        hasConfig: false,
      },
      sampleFiles: [],
      packageInfo: {
        name: 'demo-project',
        type: 'npm',
        dependencies: [],
        devDependencies: [],
        scripts: { test: 'jest' },
      },
      existingDocs: [],
      gitInfo: { branch: 'main', hasUncommitted: false },
    };

    const prompt = buildBootstrapUserPrompt(analysis, {
      bootstrapGuidance: '- TDD required\n- Output rules in Chinese',
      scaffolds: ['project.md', 'rules/code-style.md'],
      existingRules: [
        {
          path: 'rules/custom.md',
          content: '---\nid: custom\n---\n# Custom\n\nDo X.',
        },
      ],
    });

    expect(prompt).toContain('## Bootstrap Guidance (USER-PROVIDED)');
    expect(prompt).toContain('- TDD required');
    expect(prompt).toContain('## Unedited ctx init scaffolds (SAFE TO OVERWRITE)');
    expect(prompt).toContain('`.context/project.md`');
    expect(prompt).toContain('`.context/rules/code-style.md`');
    expect(prompt).toContain('## Existing Context Files (PRESERVE USER EDITS)');
    expect(prompt).toContain('#### rules/custom.md');
    expect(prompt).toContain('project.md is an unedited scaffold; rewrite freely');
  });
});

