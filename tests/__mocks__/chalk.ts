/**
 * Mock chalk module for Jest
 *
 * Chalk v5+ is ESM-only and doesn't work well with Jest's CommonJS transform.
 * This mock provides a simple passthrough for all chalk methods.
 */

const passthrough = (str: string) => str;

// Create a chainable mock that returns the input string
const createChalk = (): Record<string, (str: string) => string> => {
  const chalk: Record<string, (str: string) => string> = {};

  const methods = [
    'reset', 'bold', 'dim', 'italic', 'underline', 'inverse', 'hidden', 'strikethrough',
    'visible', 'black', 'red', 'green', 'yellow', 'blue', 'magenta', 'cyan', 'white', 'gray',
    'grey', 'blackBright', 'redBright', 'greenBright', 'yellowBright', 'blueBright',
    'magentaBright', 'cyanBright', 'whiteBright', 'bgBlack', 'bgRed', 'bgGreen', 'bgYellow',
    'bgBlue', 'bgMagenta', 'bgCyan', 'bgWhite', 'bgGray', 'bgGrey', 'bgBlackBright',
    'bgRedBright', 'bgGreenBright', 'bgYellowBright', 'bgBlueBright', 'bgMagentaBright',
    'bgCyanBright', 'bgWhiteBright',
  ];

  for (const method of methods) {
    chalk[method] = passthrough;
  }

  return chalk;
};

const chalk = createChalk();

export default chalk;
export const { red, green, blue, yellow, gray, cyan, bold, white, magenta } = chalk;
