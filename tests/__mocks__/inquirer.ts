/**
 * Mock inquirer module for Jest
 *
 * Inquirer has ESM issues with Jest. This mock provides
 * a simple implementation that can be configured per test.
 */

let mockAnswers: Record<string, unknown> = {};

export const setMockAnswers = (answers: Record<string, unknown>): void => {
  mockAnswers = answers;
};

export const resetMockAnswers = (): void => {
  mockAnswers = {};
};

const inquirer = {
  prompt: async <T extends Record<string, unknown>>(
    _questions: unknown[]
  ): Promise<T> => {
    return mockAnswers as T;
  },
};

export default inquirer;
