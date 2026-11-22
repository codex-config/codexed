import type { ReactNode } from 'react';

const bare = String.raw`[A-Za-z0-9_-]+`;
const quoted = String.raw`"(?:\\.|[^"\\\n])*"|'[^'\n]*'`;
const key = `(?:${bare}|${quoted})`;
const header = String.raw`\[\[?[ \t]*${key}(?:[ \t]*\.[ \t]*${key})*[ \t]*\]\]?(?=[ \t]*(?:#|$))`;
// An unclosed string runs to the end of the line, or to the end of the text for a multi-line one.
const string = String.raw`"""[\s\S]*?(?:"""|(?![\s\S]))|'''[\s\S]*?(?:'''|(?![\s\S]))|"(?:\\.|[^"\\\n])*"?|'[^'\n]*'?`;
const date = String.raw`\d{4}-\d{2}-\d{2}(?:[Tt ]\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?(?:[Zz]|[+-]\d{2}:\d{2})?)?|\d{2}:\d{2}:\d{2}(?:\.\d+)?`;
const number = String.raw`[+-]?(?:0x[\dA-Fa-f_]+|0o[0-7_]+|0b[01_]+|\d[\d_]*(?:\.\d[\d_]*)?(?:[eE][+-]?\d+)?)`;

// Keys come first, so that a quoted key is not colored as a string.
const token = new RegExp(
  `(${key}(?:[ \\t]*\\.[ \\t]*${key})*)([ \\t]*=)|^([ \\t]*)(${header})|(${string})|(#.*)|\\b(true|false)\\b|(${date}|${number})`,
  'gm',
);

// Colors TOML text: table headers, keys, strings, comments, and numbers or literals.
export function highlightTOML(text: string): ReactNode[] {
  const parts: ReactNode[] = [];
  let last = 0;
  for (const match of text.matchAll(token)) {
    const index = match.index ?? 0;
    if (index > last) parts.push(text.slice(last, index));
    const [whole, name, equals, indent, table, value, comment, literal] = match;
    if (name) {
      parts.push(
        <span key={index} className="text-sky-700 dark:text-sky-300">
          {name}
        </span>,
        equals,
      );
    } else if (table) {
      parts.push(
        indent,
        <span key={index} className="font-semibold text-[#2f5fd6] dark:text-[#8cb4ff]">
          {table}
        </span>,
      );
    } else if (value) {
      parts.push(
        <span key={index} className="text-emerald-700 dark:text-emerald-300">
          {value}
        </span>,
      );
    } else if (comment) {
      parts.push(
        <span key={index} className="text-fd-muted-foreground">
          {comment}
        </span>,
      );
    } else {
      parts.push(
        <span key={index} className={literal ? 'text-violet-700 dark:text-violet-300' : 'text-amber-700 dark:text-amber-300'}>
          {whole}
        </span>,
      );
    }
    last = index + whole.length;
  }
  if (last < text.length) parts.push(text.slice(last));
  return parts;
}
