/**
 * Bootstrap Module
 *
 * Deep codebase analysis and LLM prompt generation for intelligent
 * rule bootstrapping. Supports any LLM (Claude, Cursor, Codex).
 */

import * as fs from 'fs';
import * as path from 'path';
import fg from 'fast-glob';
import chalk from 'chalk';

/**
 * Get path to templates directory
 */
function getTemplatesDir(): string {
  // In development: templates/ relative to project root
  // In production: relative to dist/
  const devPath = path.join(__dirname, '..', '..', 'templates');
  const prodPath = path.join(__dirname, '..', '..', '..', 'templates');

  if (fs.existsSync(devPath)) {
    return devPath;
  }
  return prodPath;
}

/**
 * Read template file content
 */
function readTemplate(templateName: string): string {
  const templatesDir = getTemplatesDir();
  const templatePath = path.join(templatesDir, templateName);
  try {
    return fs.readFileSync(templatePath, 'utf-8');
  } catch (error) {
    throw new Error(`Failed to read template "${templateName}" at ${templatePath}: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Analysis result for codebase
 */
export interface CodebaseAnalysis {
  projectName: string;
  languages: LanguageInfo[];
  frameworks: string[];
  buildTools: string[];
  testingTools: string[];
  structure: DirectoryStructure;
  sampleFiles: SampleFile[];
  packageInfo: PackageInfo | null;
  existingDocs: ExistingDoc[];
  gitInfo: GitInfo | null;
}

export interface LanguageInfo {
  name: string;
  extensions: string[];
  fileCount: number;
  percentage: number;
}

export interface DirectoryStructure {
  topLevel: string[];
  srcStructure: string[];
  hasTests: boolean;
  hasDocs: boolean;
  hasConfig: boolean;
}

export interface SampleFile {
  path: string;
  content: string;
  language: string;
}

export interface PackageInfo {
  name: string;
  description?: string;
  type: 'npm' | 'python' | 'rust' | 'go' | 'other';
  dependencies: string[];
  devDependencies: string[];
  scripts: Record<string, string>;
}

export interface ExistingDoc {
  path: string;
  type: 'readme' | 'contributing' | 'cursorrules' | 'claude' | 'agents' | 'other';
  excerpt: string;
}

export interface GitInfo {
  remoteUrl?: string;
  branch: string;
  hasUncommitted: boolean;
}

/**
 * Analyze the codebase deeply
 */
export async function analyzeCodebase(projectRoot: string): Promise<CodebaseAnalysis> {
  console.log(chalk.blue('\n🔍 Analyzing codebase...\n'));

  const [
    languages,
    structure,
    packageInfo,
    existingDocs,
    gitInfo,
  ] = await Promise.all([
    detectLanguages(projectRoot),
    analyzeStructure(projectRoot),
    detectPackageInfo(projectRoot),
    findExistingDocs(projectRoot),
    getGitInfo(projectRoot),
  ]);

  const frameworks = detectFrameworks(packageInfo);
  const buildTools = detectBuildTools(packageInfo, structure);
  const testingTools = detectTestingTools(packageInfo);
  const sampleFiles = await getSampleFiles(projectRoot, languages);
  const projectName = packageInfo?.name || path.basename(projectRoot);

  return {
    projectName,
    languages,
    frameworks,
    buildTools,
    testingTools,
    structure,
    sampleFiles,
    packageInfo,
    existingDocs,
    gitInfo,
  };
}

/**
 * Detect programming languages used
 */
async function detectLanguages(projectRoot: string): Promise<LanguageInfo[]> {
  const languageMap: Record<string, { name: string; extensions: string[] }> = {
    ts: { name: 'TypeScript', extensions: ['.ts', '.tsx'] },
    js: { name: 'JavaScript', extensions: ['.js', '.jsx', '.mjs', '.cjs'] },
    py: { name: 'Python', extensions: ['.py'] },
    rs: { name: 'Rust', extensions: ['.rs'] },
    go: { name: 'Go', extensions: ['.go'] },
    java: { name: 'Java', extensions: ['.java'] },
    rb: { name: 'Ruby', extensions: ['.rb'] },
    php: { name: 'PHP', extensions: ['.php'] },
    cs: { name: 'C#', extensions: ['.cs'] },
    cpp: { name: 'C++', extensions: ['.cpp', '.cc', '.cxx', '.hpp', '.h'] },
    swift: { name: 'Swift', extensions: ['.swift'] },
    kt: { name: 'Kotlin', extensions: ['.kt', '.kts'] },
  };

  const counts: Record<string, number> = {};
  let total = 0;

  for (const [key, info] of Object.entries(languageMap)) {
    const patterns = info.extensions.map(ext => `**/*${ext}`);
    const files = await fg(patterns, {
      cwd: projectRoot,
      ignore: ['node_modules/**', '.git/**', 'dist/**', 'build/**', 'vendor/**', '__pycache__/**'],
      onlyFiles: true,
    });
    if (files.length > 0) {
      counts[key] = files.length;
      total += files.length;
    }
  }

  return Object.entries(counts)
    .map(([key, count]) => ({
      name: languageMap[key].name,
      extensions: languageMap[key].extensions,
      fileCount: count,
      percentage: Math.round((count / total) * 100),
    }))
    .sort((a, b) => b.fileCount - a.fileCount);
}

/**
 * Analyze directory structure
 */
async function analyzeStructure(projectRoot: string): Promise<DirectoryStructure> {
  const entries = await fs.promises.readdir(projectRoot, { withFileTypes: true });
  const topLevel = entries
    .filter(e => e.isDirectory() && !e.name.startsWith('.') && e.name !== 'node_modules')
    .map(e => e.name);

  // Analyze src structure if exists
  let srcStructure: string[] = [];
  const srcPath = path.join(projectRoot, 'src');
  if (fs.existsSync(srcPath)) {
    const srcEntries = await fs.promises.readdir(srcPath, { withFileTypes: true });
    srcStructure = srcEntries
      .filter(e => e.isDirectory())
      .map(e => e.name);
  }

  return {
    topLevel,
    srcStructure,
    hasTests: topLevel.some(d => ['test', 'tests', '__tests__', 'spec'].includes(d)),
    hasDocs: topLevel.some(d => ['docs', 'documentation', 'doc'].includes(d)),
    hasConfig: fs.existsSync(path.join(projectRoot, '.config')) ||
               fs.existsSync(path.join(projectRoot, 'config')),
  };
}

/**
 * Detect package info from manifest files
 */
async function detectPackageInfo(projectRoot: string): Promise<PackageInfo | null> {
  // Try package.json (Node.js)
  const packageJsonPath = path.join(projectRoot, 'package.json');
  if (fs.existsSync(packageJsonPath)) {
    try {
      const pkg = JSON.parse(await fs.promises.readFile(packageJsonPath, 'utf-8'));
      return {
        name: pkg.name || 'unknown',
        description: pkg.description,
        type: 'npm',
        dependencies: Object.keys(pkg.dependencies || {}),
        devDependencies: Object.keys(pkg.devDependencies || {}),
        scripts: pkg.scripts || {},
      };
    } catch {
      // Ignore parse errors - package.json is invalid or unreadable
      // Fall through to try other package managers
    }
  }

  // Try pyproject.toml (Python)
  const pyprojectPath = path.join(projectRoot, 'pyproject.toml');
  if (fs.existsSync(pyprojectPath)) {
    const content = await fs.promises.readFile(pyprojectPath, 'utf-8');
    const nameMatch = content.match(/name\s*=\s*"([^"]+)"/);
    return {
      name: nameMatch?.[1] || 'unknown',
      type: 'python',
      dependencies: [],
      devDependencies: [],
      scripts: {},
    };
  }

  // Try Cargo.toml (Rust)
  const cargoPath = path.join(projectRoot, 'Cargo.toml');
  if (fs.existsSync(cargoPath)) {
    const content = await fs.promises.readFile(cargoPath, 'utf-8');
    const nameMatch = content.match(/name\s*=\s*"([^"]+)"/);
    return {
      name: nameMatch?.[1] || 'unknown',
      type: 'rust',
      dependencies: [],
      devDependencies: [],
      scripts: {},
    };
  }

  // Try go.mod (Go)
  const goModPath = path.join(projectRoot, 'go.mod');
  if (fs.existsSync(goModPath)) {
    const content = await fs.promises.readFile(goModPath, 'utf-8');
    const moduleMatch = content.match(/module\s+(\S+)/);
    return {
      name: moduleMatch?.[1] || 'unknown',
      type: 'go',
      dependencies: [],
      devDependencies: [],
      scripts: {},
    };
  }

  return null;
}

/**
 * Find existing documentation files
 */
async function findExistingDocs(projectRoot: string): Promise<ExistingDoc[]> {
  const docs: ExistingDoc[] = [];
  const maxExcerptLength = 500;

  const docFiles: Array<{ pattern: string; type: ExistingDoc['type'] }> = [
    { pattern: 'README.md', type: 'readme' },
    { pattern: 'README.MD', type: 'readme' },
    { pattern: 'readme.md', type: 'readme' },
    { pattern: 'CONTRIBUTING.md', type: 'contributing' },
    { pattern: '.cursorrules', type: 'cursorrules' },
    { pattern: 'CLAUDE.md', type: 'claude' },
    { pattern: 'AGENTS.md', type: 'agents' },
  ];

  for (const { pattern, type } of docFiles) {
    const filePath = path.join(projectRoot, pattern);
    if (fs.existsSync(filePath)) {
      const content = await fs.promises.readFile(filePath, 'utf-8');
      docs.push({
        path: pattern,
        type,
        excerpt: content.slice(0, maxExcerptLength) + (content.length > maxExcerptLength ? '...' : ''),
      });
    }
  }

  return docs;
}

/**
 * Get git information
 */
async function getGitInfo(projectRoot: string): Promise<GitInfo | null> {
  const gitDir = path.join(projectRoot, '.git');
  if (!fs.existsSync(gitDir)) {
    return null;
  }

  try {
    const headPath = path.join(gitDir, 'HEAD');
    const headContent = await fs.promises.readFile(headPath, 'utf-8');
    const branchMatch = headContent.match(/ref: refs\/heads\/(.+)/);
    const branch = branchMatch?.[1]?.trim() || 'unknown';

    let remoteUrl: string | undefined;
    const configPath = path.join(gitDir, 'config');
    if (fs.existsSync(configPath)) {
      const configContent = await fs.promises.readFile(configPath, 'utf-8');
      const urlMatch = configContent.match(/url\s*=\s*(.+)/);
      remoteUrl = urlMatch?.[1]?.trim();
    }

    return {
      branch,
      remoteUrl,
      hasUncommitted: false, // Would need git command to check
    };
  } catch {
    return null;
  }
}

/**
 * Detect frameworks from dependencies
 */
function detectFrameworks(packageInfo: PackageInfo | null): string[] {
  if (!packageInfo) return [];

  const allDeps = [...packageInfo.dependencies, ...packageInfo.devDependencies];
  const frameworks: string[] = [];

  const frameworkMap: Record<string, string> = {
    'react': 'React',
    'next': 'Next.js',
    'vue': 'Vue.js',
    'nuxt': 'Nuxt.js',
    'angular': 'Angular',
    'svelte': 'Svelte',
    'express': 'Express.js',
    'fastify': 'Fastify',
    'nestjs': 'NestJS',
    '@nestjs/core': 'NestJS',
    'koa': 'Koa',
    'hono': 'Hono',
    'django': 'Django',
    'flask': 'Flask',
    'fastapi': 'FastAPI',
    'rails': 'Ruby on Rails',
    'laravel': 'Laravel',
    'spring': 'Spring',
    'gin': 'Gin',
    'actix-web': 'Actix Web',
    'electron': 'Electron',
    'tauri': 'Tauri',
  };

  for (const dep of allDeps) {
    const baseDep = dep.toLowerCase().split('/')[0];
    if (frameworkMap[baseDep]) {
      frameworks.push(frameworkMap[baseDep]);
    }
  }

  return [...new Set(frameworks)];
}

/**
 * Detect build tools
 */
function detectBuildTools(packageInfo: PackageInfo | null, _structure: DirectoryStructure): string[] {
  const tools: string[] = [];

  if (packageInfo?.type === 'npm') {
    const allDeps = [...packageInfo.dependencies, ...packageInfo.devDependencies];

    if (allDeps.includes('vite')) tools.push('Vite');
    if (allDeps.includes('webpack')) tools.push('Webpack');
    if (allDeps.includes('esbuild')) tools.push('esbuild');
    if (allDeps.includes('rollup')) tools.push('Rollup');
    if (allDeps.includes('parcel')) tools.push('Parcel');
    if (allDeps.includes('turbo')) tools.push('Turborepo');
    if (allDeps.includes('nx')) tools.push('Nx');
    if (allDeps.includes('typescript')) tools.push('TypeScript');
  }

  return tools;
}

/**
 * Detect testing tools
 */
function detectTestingTools(packageInfo: PackageInfo | null): string[] {
  if (!packageInfo) return [];

  const allDeps = [...packageInfo.dependencies, ...packageInfo.devDependencies];
  const tools: string[] = [];

  const testToolMap: Record<string, string> = {
    'jest': 'Jest',
    'vitest': 'Vitest',
    'mocha': 'Mocha',
    'jasmine': 'Jasmine',
    'ava': 'AVA',
    'tap': 'TAP',
    'playwright': 'Playwright',
    '@playwright/test': 'Playwright',
    'cypress': 'Cypress',
    'puppeteer': 'Puppeteer',
    '@testing-library/react': 'React Testing Library',
    '@testing-library/vue': 'Vue Testing Library',
    'pytest': 'pytest',
    'unittest': 'unittest',
  };

  for (const dep of allDeps) {
    if (testToolMap[dep]) {
      tools.push(testToolMap[dep]);
    }
  }

  return [...new Set(tools)];
}

/**
 * Get sample files for analysis
 */
async function getSampleFiles(
  projectRoot: string,
  languages: LanguageInfo[]
): Promise<SampleFile[]> {
  const samples: SampleFile[] = [];
  const maxSamples = 5;
  const maxFileSize = 2000; // characters

  // Get top language extensions
  const topLanguages = languages.slice(0, 3);

  for (const lang of topLanguages) {
    const patterns = lang.extensions.map(ext => `src/**/*${ext}`);
    const files = await fg(patterns, {
      cwd: projectRoot,
      ignore: ['**/*.test.*', '**/*.spec.*', '**/__tests__/**', '**/node_modules/**'],
      onlyFiles: true,
    });

    // Take first few files
    for (const file of files.slice(0, Math.ceil(maxSamples / topLanguages.length))) {
      try {
        const fullPath = path.join(projectRoot, file);
        const content = await fs.promises.readFile(fullPath, 'utf-8');
        samples.push({
          path: file,
          content: content.slice(0, maxFileSize) + (content.length > maxFileSize ? '\n// ... truncated' : ''),
          language: lang.name,
        });
      } catch {
        // Skip unreadable files
      }
    }
  }

  return samples;
}

/**
 * Generate the universal LLM prompt using the template
 */
export function generateBootstrapPrompt(analysis: CodebaseAnalysis): string {
  // Read the template
  let template = readTemplate('bootstrap-prompt.md');

  // Replace simple placeholders
  template = template.replace(/\{\{projectName\}\}/g, analysis.projectName);
  template = template.replace(
    /\{\{languages\}\}/g,
    analysis.languages.map(l => `${l.name} (${l.percentage}%)`).join(', ') || 'Unknown'
  );
  template = template.replace(
    /\{\{frameworks\}\}/g,
    analysis.frameworks.join(', ') || 'None detected'
  );
  template = template.replace(
    /\{\{buildTools\}\}/g,
    analysis.buildTools.join(', ') || 'None detected'
  );
  template = template.replace(
    /\{\{testingTools\}\}/g,
    analysis.testingTools.join(', ') || 'None detected'
  );

  // Directory structure
  template = template.replace(
    /\{\{topLevelDirs\}\}/g,
    analysis.structure.topLevel.join(', ') || 'None'
  );
  template = template.replace(
    /\{\{srcStructure\}\}/g,
    analysis.structure.srcStructure.length > 0
      ? `src/${analysis.structure.srcStructure.join(', src/')}`
      : 'Flat or no src/'
  );
  template = template.replace(
    /\{\{hasTests\}\}/g,
    analysis.structure.hasTests ? 'Yes' : 'No'
  );
  template = template.replace(
    /\{\{hasDocs\}\}/g,
    analysis.structure.hasDocs ? 'Yes' : 'No'
  );

  // Handle package info section
  if (analysis.packageInfo) {
    const pkg = analysis.packageInfo;
    // Keep the section and replace placeholders
    template = template.replace(/\{\{#packageInfo\}\}/g, '');
    template = template.replace(/\{\{\/packageInfo\}\}/g, '');
    template = template.replace(/\{\{type\}\}/g, pkg.type);
    template = template.replace(/\{\{description\}\}/g, pkg.description || 'None');
    template = template.replace(
      /\{\{dependencies\}\}/g,
      pkg.dependencies.slice(0, 15).join(', ') + (pkg.dependencies.length > 15 ? '...' : '')
    );
    template = template.replace(
      /\{\{scripts\}\}/g,
      Object.keys(pkg.scripts).join(', ') || 'None'
    );
  } else {
    // Remove the entire package info section
    template = template.replace(/\{\{#packageInfo\}\}[\s\S]*?\{\{\/packageInfo\}\}/g, '');
  }

  // Handle existing docs section
  if (analysis.existingDocs.length > 0) {
    template = template.replace(/\{\{#existingDocs\}\}/g, '');
    template = template.replace(/\{\{\/existingDocs\}\}/g, '');

    // Build docs content
    let docsContent = '';
    for (const doc of analysis.existingDocs) {
      docsContent += `### ${doc.path}\n\`\`\`\n${doc.excerpt}\n\`\`\`\n\n`;
    }

    // Replace the docs template block
    template = template.replace(
      /\{\{#docs\}\}[\s\S]*?\{\{\/docs\}\}/g,
      docsContent.trim()
    );
  } else {
    // Remove the entire existing docs section
    template = template.replace(/\{\{#existingDocs\}\}[\s\S]*?\{\{\/existingDocs\}\}/g, '');
  }

  // Handle sample files section
  if (analysis.sampleFiles.length > 0) {
    template = template.replace(/\{\{#sampleFiles\}\}/g, '');
    template = template.replace(/\{\{\/sampleFiles\}\}/g, '');

    // Build sample files content
    let filesContent = '';
    for (const sample of analysis.sampleFiles) {
      filesContent += `### ${sample.path} (${sample.language})\n\`\`\`${sample.language.toLowerCase()}\n${sample.content}\n\`\`\`\n\n`;
    }

    // Replace the files template block
    template = template.replace(
      /\{\{#files\}\}[\s\S]*?\{\{\/files\}\}/g,
      filesContent.trim()
    );
  } else {
    // Remove the entire sample files section
    template = template.replace(/\{\{#sampleFiles\}\}[\s\S]*?\{\{\/sampleFiles\}\}/g, '');
  }

  return template;
}

/**
 * Print analysis summary to console
 */
export function printAnalysisSummary(analysis: CodebaseAnalysis): void {
  console.log(chalk.green('✅ Analysis complete!\n'));

  console.log(chalk.bold('Project: ') + analysis.projectName);
  console.log(chalk.bold('Languages: ') +
    analysis.languages.map(l => `${l.name} (${l.percentage}%)`).join(', '));

  if (analysis.frameworks.length > 0) {
    console.log(chalk.bold('Frameworks: ') + analysis.frameworks.join(', '));
  }

  if (analysis.buildTools.length > 0) {
    console.log(chalk.bold('Build Tools: ') + analysis.buildTools.join(', '));
  }

  if (analysis.testingTools.length > 0) {
    console.log(chalk.bold('Testing: ') + analysis.testingTools.join(', '));
  }

  console.log(chalk.bold('Structure: ') + analysis.structure.topLevel.join(', '));
  console.log(chalk.bold('Sample Files: ') + analysis.sampleFiles.length + ' analyzed');
  console.log(chalk.bold('Existing Docs: ') + analysis.existingDocs.length + ' found');
}

/**
 * Run the bootstrap process
 */
export async function runBootstrap(projectRoot: string): Promise<{ analysis: CodebaseAnalysis; prompt: string }> {
  const analysis = await analyzeCodebase(projectRoot);
  printAnalysisSummary(analysis);

  const prompt = generateBootstrapPrompt(analysis);

  return { analysis, prompt };
}
