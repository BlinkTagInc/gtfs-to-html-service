import { stripVTControlCharacters } from 'node:util';

// Apply before transmission, not just before rendering. Never send error objects,
// stack traces, or developer details to the browser.
export const publicGenerationMessage = (message: string): string => {
  return stripVTControlCharacters(message)
    .split(/\r?\n/)
    .filter((line) => !/^\s*at\s|^\s*(?:node:|file:\/\/)/.test(line))
    .join('\n')
    .replace(/\s*\|\s*(?:details|category|statusCode)=.*$/gm, '')
    .replace(
      /(?:file:\/\/)?\/(?:private|var\/task|var\/folders|tmp|Users|home)\/[^\s"'<>)]*/g,
      '[temporary file]',
    )
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, '')
    .trim()
    .slice(0, 2000);
};
