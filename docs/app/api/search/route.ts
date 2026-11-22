import { source } from '@/lib/source';
import { createFromSource } from 'fumadocs-core/search/server';

export const revalidate = false;

// The build writes the search index to a file, and the browser searches it.
export const { staticGET: GET } = createFromSource(source, {
  language: 'english',
});
