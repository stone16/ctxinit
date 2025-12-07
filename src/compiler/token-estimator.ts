/**
 * Content-aware token estimation for AI context budget control
 *
 * Uses character-to-token ratios based on content type:
 * - Prose (English text): 3.5 chars/token
 * - Code (programming languages): 2.5 chars/token
 * - Mixed content: 3.0 chars/token
 * - CJK (Chinese, Japanese, Korean): 1.5 chars/token
 */

/**
 * Content type for token estimation
 */
export type ContentType = 'prose' | 'code' | 'mixed' | 'cjk';

/**
 * Token estimation result
 */
export interface TokenEstimation {
  /** Estimated token count */
  tokens: number;
  /** Detected content type */
  contentType: ContentType;
  /** Character count */
  characters: number;
  /** Ratio used for estimation */
  ratio: number;
}

/**
 * Character-to-token ratios by content type
 */
const TOKEN_RATIOS: Record<ContentType, number> = {
  prose: 3.5,
  code: 2.5,
  mixed: 3.0,
  cjk: 1.5,
};

/**
 * Code indicators for content type detection
 */
const CODE_INDICATORS = [
  /\bimport\s+/,
  /\bexport\s+/,
  /\bfunction\s+/,
  /\bclass\s+/,
  /\bconst\s+/,
  /\blet\s+/,
  /\bvar\s+/,
  /\bdef\s+/,
  /\basync\s+/,
  /=>/,
  /\breturn\s+/,
  /\bif\s*\(/,
  /\bfor\s*\(/,
  /\bwhile\s*\(/,
  /\bswitch\s*\(/,
  /\{\s*$/m,
  /^\s*\}/m,
];

/**
 * CJK Unicode ranges
 * - CJK Unified Ideographs: U+4E00-U+9FFF
 * - CJK Extension A: U+3400-U+4DBF
 * - Hiragana: U+3040-U+309F
 * - Katakana: U+30A0-U+30FF
 * - Hangul Syllables: U+AC00-U+D7AF
 */
const CJK_PATTERN = /[\u4E00-\u9FFF\u3400-\u4DBF\u3040-\u309F\u30A0-\u30FF\uAC00-\uD7AF]/g;

/**
 * Threshold for content type detection (percentage of content)
 */
const CODE_INDICATOR_THRESHOLD = 3;  // Minimum matches to consider code
const CJK_RATIO_THRESHOLD = 0.3;     // 30% CJK characters

/**
 * Detect content type from text content
 *
 * @param content - Text content to analyze
 * @returns Detected content type
 */
export function detectContentType(content: string): ContentType {
  if (!content || content.length === 0) {
    return 'mixed';
  }

  // Check for CJK content first
  const cjkMatches = content.match(CJK_PATTERN) || [];
  const cjkRatio = cjkMatches.length / content.length;

  if (cjkRatio >= CJK_RATIO_THRESHOLD) {
    return 'cjk';
  }

  // Count code indicators
  let codeIndicatorCount = 0;
  for (const indicator of CODE_INDICATORS) {
    const matches = content.match(new RegExp(indicator, 'g')) || [];
    codeIndicatorCount += matches.length;
  }

  // If enough code indicators, consider it code
  if (codeIndicatorCount >= CODE_INDICATOR_THRESHOLD) {
    return 'code';
  }

  // Check if it looks like markdown prose
  const lines = content.split('\n');
  const proseIndicators = [
    /^#+\s+/,     // Markdown headers
    /^\s*[-*]\s+/, // Bullet points
    /^\d+\.\s+/,   // Numbered lists
    /\*\*[^*]+\*\*/, // Bold text
    /\*[^*]+\*/,     // Italic text
  ];

  let proseCount = 0;
  for (const line of lines) {
    for (const indicator of proseIndicators) {
      if (indicator.test(line)) {
        proseCount++;
        break;
      }
    }
  }

  // If significant prose indicators and low code indicators
  if (proseCount >= 3 && codeIndicatorCount < CODE_INDICATOR_THRESHOLD) {
    return 'prose';
  }

  // Default to mixed
  return 'mixed';
}

/**
 * Estimate token count for content
 *
 * @param content - Text content to estimate
 * @returns Token estimation with count, type, and ratio
 */
export function estimateTokens(content: string): TokenEstimation {
  const characters = content.length;

  if (characters === 0) {
    return {
      tokens: 0,
      contentType: 'mixed',
      characters: 0,
      ratio: TOKEN_RATIOS.mixed,
    };
  }

  const contentType = detectContentType(content);
  const ratio = TOKEN_RATIOS[contentType];
  const tokens = Math.ceil(characters / ratio);

  return {
    tokens,
    contentType,
    characters,
    ratio,
  };
}

/**
 * Estimate tokens with a specific content type override
 *
 * @param content - Text content to estimate
 * @param contentType - Override content type
 * @returns Token estimation
 */
export function estimateTokensWithType(content: string, contentType: ContentType): TokenEstimation {
  const characters = content.length;
  const ratio = TOKEN_RATIOS[contentType];
  const tokens = Math.ceil(characters / ratio);

  return {
    tokens,
    contentType,
    characters,
    ratio,
  };
}

/**
 * Apply budget margin for metadata overhead
 *
 * @param budget - Original token budget
 * @param marginPercent - Margin percentage (default: 5%)
 * @returns Effective budget after margin
 */
export function applyBudgetMargin(budget: number, marginPercent: number = 5): number {
  return Math.floor(budget * (1 - marginPercent / 100));
}

/**
 * Check if adding content would exceed budget
 *
 * @param currentTokens - Current token count
 * @param additionalContent - Content to add
 * @param budget - Token budget
 * @param marginPercent - Margin percentage (default: 5%)
 * @returns true if budget would be exceeded
 */
export function wouldExceedBudget(
  currentTokens: number,
  additionalContent: string,
  budget: number,
  marginPercent: number = 5
): boolean {
  const effectiveBudget = applyBudgetMargin(budget, marginPercent);
  const additionalTokens = estimateTokens(additionalContent).tokens;
  return currentTokens + additionalTokens > effectiveBudget;
}

/**
 * Get the character-to-token ratio for a content type
 *
 * @param contentType - Content type
 * @returns Character-to-token ratio
 */
export function getRatio(contentType: ContentType): number {
  return TOKEN_RATIOS[contentType];
}
