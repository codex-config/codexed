import { parse, stringify, TomlError } from 'smol-toml';
import { isPlainObject, type Settings } from './fields';

// Editors such as VS Code read this comment, check the file and complete the keys.
const schema = '#:schema https://developers.openai.com/codex/config-schema.json';

export function formatTOML(file: Settings) {
  const body = stringify(file).trim();
  return body === '' ? `${schema}\n` : `${schema}\n\n${body}\n`;
}

export function readTOML(text: string): { file: Settings } | { error: string } {
  try {
    return { file: parse(text) };
  } catch (problem) {
    return { error: messageOf(problem) };
  }
}

// "Invalid TOML document: invalid value" and a code frame become "Line 3: invalid value."
function messageOf(problem: unknown) {
  if (!(problem instanceof Error)) return 'This is not valid TOML.';
  const message = problem.message.split('\n')[0].replace(/^Invalid TOML document:\s*/i, '').replace(/\.$/, '');
  return problem instanceof TomlError ? `Line ${problem.line}: ${message}.` : `${message}.`;
}

// The TOML of one setting, with the tables above it, as in "[tui]\ntheme = ...".
export function snippetOf(path: string[], value: unknown) {
  return stringify(path.reduceRight<unknown>((inner, key) => ({ [key]: inner }), value)).trim();
}

// The value of one setting in its snippet. undefined when the snippet is empty.
export function readSnippet(text: string, path: string[]): { value: unknown } | { error: string } {
  const read = readTOML(text);
  if ('error' in read) return read;
  let node: unknown = read.file;
  for (const key of path) {
    if (node === undefined) break;
    if (!isPlainObject(node) || Object.keys(node).some((other) => other !== key)) {
      return { error: `Only set ${path.join('.')} here.` };
    }
    node = node[key];
  }
  return { value: node };
}
