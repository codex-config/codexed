'use client';

import { BookOpen, Brackets } from 'lucide-react';
import { useEffect, useState } from 'react';
import { cn } from '@/lib/cn';
import { type KeyTree, setAt, type Settings } from './fields';
import { SettingsBrowser } from './settings-browser';
import type { Category } from './settings-data';
import { formatTOML, readTOML } from './toml';
import { TOMLEditor } from './toml-editor';

type Mode = 'browse' | 'toml';

// Keeps the file for the tab, so that it is still there after a visit to a setting page.
const storageKey = 'config.toml';
const remember = (text: string) => sessionStorage.setItem(storageKey, text);

// One file, edited in two ways: setting by setting in Browse, or as text in TOML.
// Links to #toml open the TOML view, and links such as #settings-mcp open a group.
export function Configuration({ categories, known }: { categories: Category[]; known: KeyTree }) {
  const [mode, setMode] = useState<Mode>('browse');
  const [tab, setTab] = useState<string>(categories[0].id);
  const [file, setFile] = useState<Settings>({});
  const [text, setText] = useState(() => formatTOML({}));
  const count = Object.keys(file).length;

  useEffect(() => {
    const saved = sessionStorage.getItem(storageKey);
    if (saved !== null) edit(saved);
  }, []);

  useEffect(() => {
    const follow = () => {
      const hash = window.location.hash;
      if (hash === '#toml') setMode('toml');
      if (hash === '#settings') setMode('browse');
      const group = categories.find((category) => hash === `#settings-${category.id}`);
      if (group) {
        setMode('browse');
        setTab(group.id);
      }
    };
    follow();
    window.addEventListener('hashchange', follow);
    return () => window.removeEventListener('hashchange', follow);
  }, [categories]);

  function choose(next: Mode) {
    setMode(next);
    window.history.replaceState(null, '', next === 'toml' ? '#toml' : `#settings-${tab}`);
  }

  function chooseTab(id: string) {
    setTab(id);
    window.history.replaceState(null, '', `#settings-${id}`);
  }

  function change(path: string[], value: unknown) {
    const next = setAt(file, path, value);
    setFile(next);
    setText(formatTOML(next));
    remember(formatTOML(next));
  }

  // Invalid text stays in the editor, and Browse keeps the last valid file.
  function edit(next: string) {
    setText(next);
    remember(next);
    const read = readTOML(next);
    if ('file' in read) setFile(read.file);
  }

  function reset() {
    setFile({});
    setText(formatTOML({}));
    remember(formatTOML({}));
  }

  return (
    <section id="settings" className="scroll-mt-20">
      <span id="toml" className="block scroll-mt-20" />
      {categories.map((category) => (
        <span key={category.id} id={`settings-${category.id}`} className="block scroll-mt-20" />
      ))}
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <h2 className="text-2xl font-bold tracking-tight">Configuration</h2>
        <div role="radiogroup" aria-label="View" className="flex self-start rounded-lg border bg-fd-card p-1">
          {(
            [
              { value: 'browse', label: 'Browse', icon: BookOpen },
              { value: 'toml', label: 'TOML', icon: Brackets },
            ] as const
          ).map(({ value, label, icon: Icon }) => (
            <button
              key={value}
              type="button"
              role="radio"
              aria-checked={mode === value}
              onClick={() => choose(value)}
              className={cn(
                'flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
                mode === value ? 'bg-fd-primary text-fd-primary-foreground' : 'text-fd-muted-foreground hover:text-fd-foreground',
              )}
            >
              <Icon className="size-4" />
              {label}
              {value === 'toml' && count > 0 && (
                <span className="rounded-full bg-[#3b6ff0] px-1.5 text-[11px] leading-4 font-semibold text-white tabular-nums">
                  {count}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>
      {mode === 'browse' ? (
        <SettingsBrowser categories={categories} active={tab} onActive={chooseTab} file={file} onChange={change} />
      ) : (
        <TOMLEditor text={text} file={file} known={known} onText={edit} onReset={reset} />
      )}
    </section>
  );
}
