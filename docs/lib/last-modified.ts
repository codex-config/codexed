import { execFileSync } from 'node:child_process';

// The date of the last commit that changed a file, for the sitemap. Paths are from the docs folder.
// It needs the full git history. Files that are not committed have no date.
export function lastModified(file: string): Date | undefined {
  try {
    const date = execFileSync('git', ['log', '-1', '--format=%cI', '--', file], { encoding: 'utf8' }).trim();
    return date ? new Date(date) : undefined;
  } catch {
    return undefined;
  }
}
