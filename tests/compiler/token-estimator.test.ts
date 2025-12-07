import {
  detectContentType,
  estimateTokens,
  estimateTokensWithType,
  applyBudgetMargin,
  wouldExceedBudget,
  getRatio,
} from '../../src/compiler/token-estimator';

describe('Token Estimator', () => {
  describe('detectContentType', () => {
    it('should detect prose content (README text)', () => {
      const proseContent = `
# Welcome to the Project

This is a comprehensive guide to help you get started with our application.
Follow the steps below to set up your development environment.

## Prerequisites

- Node.js 18 or higher
- npm or yarn package manager
- A text editor of your choice

## Getting Started

First, clone the repository and install dependencies.
`;
      expect(detectContentType(proseContent)).toBe('prose');
    });

    it('should detect code content (TypeScript file)', () => {
      const codeContent = `
import { useState, useEffect } from 'react';
import { fetchData } from './api';

export const DataComponent = () => {
  const [data, setData] = useState(null);

  useEffect(() => {
    async function loadData() {
      const result = await fetchData();
      setData(result);
    }
    loadData();
  }, []);

  return <div>{data}</div>;
};

export function calculateTotal(items) {
  return items.reduce((sum, item) => sum + item.price, 0);
}
`;
      expect(detectContentType(codeContent)).toBe('code');
    });

    it('should detect mixed content', () => {
      const mixedContent = `
Some text here without much formatting.
Another line of plain text.
`;
      expect(detectContentType(mixedContent)).toBe('mixed');
    });

    it('should detect CJK content (Chinese)', () => {
      const cjkContent = `
这是一个项目的说明文档。
本项目使用最新的技术栈开发，包括 React 和 TypeScript。
请按照以下步骤进行安装和配置。
`;
      expect(detectContentType(cjkContent)).toBe('cjk');
    });

    it('should detect CJK content (Japanese)', () => {
      const japaneseContent = `
このプロジェクトへようこそ。
こちらはドキュメントです。
インストール手順に従ってください。
`;
      expect(detectContentType(japaneseContent)).toBe('cjk');
    });

    it('should detect CJK content (Korean)', () => {
      const koreanContent = `
이 프로젝트에 오신 것을 환영합니다.
설치 지침을 따르십시오.
문서를 주의 깊게 읽어주세요.
`;
      expect(detectContentType(koreanContent)).toBe('cjk');
    });

    it('should handle empty content', () => {
      expect(detectContentType('')).toBe('mixed');
    });

    it('should identify code with arrow functions', () => {
      const arrowCode = `
const add = (a, b) => a + b;
const multiply = (a, b) => a * b;
const fetchUser = async (id) => {
  const response = await fetch(\`/users/\${id}\`);
  return response.json();
};
`;
      expect(detectContentType(arrowCode)).toBe('code');
    });
  });

  describe('estimateTokens', () => {
    it('should use 3.5 ratio for prose content', () => {
      const prose = `# Welcome to the Project

This is a comprehensive guide to help you get started.

## Getting Started

Follow these steps carefully.

## Prerequisites

- Node.js 18 or higher
- npm or yarn package manager
- A text editor

## Installation

First, clone the repository.`;

      const result = estimateTokens(prose);
      expect(result.contentType).toBe('prose');
      expect(result.ratio).toBe(3.5);
      expect(result.tokens).toBe(Math.ceil(prose.length / 3.5));
    });

    it('should use 2.5 ratio for code content', () => {
      const code = `
import { useState } from 'react';

export function Component() {
  const [value, setValue] = useState(0);
  return <div>{value}</div>;
}
`;
      const result = estimateTokens(code);
      expect(result.contentType).toBe('code');
      expect(result.ratio).toBe(2.5);
      expect(result.tokens).toBe(Math.ceil(code.length / 2.5));
    });

    it('should use 3.0 ratio for mixed content', () => {
      const mixed = 'Just a simple line of text.';
      const result = estimateTokens(mixed);
      expect(result.contentType).toBe('mixed');
      expect(result.ratio).toBe(3.0);
      expect(result.tokens).toBe(Math.ceil(mixed.length / 3.0));
    });

    it('should use 1.5 ratio for CJK content', () => {
      const cjk = '这是一段中文文本用于测试令牌估算功能';
      const result = estimateTokens(cjk);
      expect(result.contentType).toBe('cjk');
      expect(result.ratio).toBe(1.5);
      expect(result.tokens).toBe(Math.ceil(cjk.length / 1.5));
    });

    it('should return 0 tokens for empty content', () => {
      const result = estimateTokens('');
      expect(result.tokens).toBe(0);
      expect(result.characters).toBe(0);
    });

    it('should include character count', () => {
      const content = 'Hello world!';
      const result = estimateTokens(content);
      expect(result.characters).toBe(12);
    });
  });

  describe('estimateTokensWithType', () => {
    it('should use specified content type', () => {
      const content = 'Some content here';
      const result = estimateTokensWithType(content, 'code');
      expect(result.contentType).toBe('code');
      expect(result.ratio).toBe(2.5);
      expect(result.tokens).toBe(Math.ceil(content.length / 2.5));
    });

    it('should override auto-detection', () => {
      const proseContent = '# This is a heading\n\nWith some prose content.';
      const result = estimateTokensWithType(proseContent, 'cjk');
      expect(result.contentType).toBe('cjk');
      expect(result.ratio).toBe(1.5);
    });
  });

  describe('applyBudgetMargin', () => {
    it('should reserve 5% margin by default', () => {
      expect(applyBudgetMargin(1000)).toBe(950);
      expect(applyBudgetMargin(4000)).toBe(3800);
      expect(applyBudgetMargin(10000)).toBe(9500);
    });

    it('should apply custom margin percentage', () => {
      expect(applyBudgetMargin(1000, 10)).toBe(900);
      expect(applyBudgetMargin(1000, 20)).toBe(800);
      expect(applyBudgetMargin(1000, 0)).toBe(1000);
    });

    it('should floor the result', () => {
      expect(applyBudgetMargin(999, 5)).toBe(949);
      expect(applyBudgetMargin(101, 5)).toBe(95);
    });
  });

  describe('wouldExceedBudget', () => {
    it('should return true when budget would be exceeded', () => {
      // 100 tokens used, adding 1000 chars (~333 tokens), budget 400
      const result = wouldExceedBudget(100, 'x'.repeat(1000), 400);
      expect(result).toBe(true);
    });

    it('should return false when within budget', () => {
      // 100 tokens used, adding 100 chars (~33 tokens), budget 4000
      const result = wouldExceedBudget(100, 'x'.repeat(100), 4000);
      expect(result).toBe(false);
    });

    it('should account for margin', () => {
      // Budget 100, margin 5% = 95 effective
      // 90 used + 10 chars (~3 tokens) = 93, within 95 budget
      expect(wouldExceedBudget(90, 'x'.repeat(10), 100, 5)).toBe(false);

      // 90 used + 30 chars (~10 tokens) = 100, exceeds 95 budget
      expect(wouldExceedBudget(90, 'x'.repeat(30), 100, 5)).toBe(true);
    });
  });

  describe('getRatio', () => {
    it('should return correct ratios', () => {
      expect(getRatio('prose')).toBe(3.5);
      expect(getRatio('code')).toBe(2.5);
      expect(getRatio('mixed')).toBe(3.0);
      expect(getRatio('cjk')).toBe(1.5);
    });
  });
});
