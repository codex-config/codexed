'use client';

import { Search, X } from 'lucide-react';
import { type ReactNode, useState } from 'react';
import { cn } from '@/lib/cn';
import { type Change, SettingRow } from './controls';
import type { Setting, Settings } from './fields';
import type { Category } from './settings-data';

export function SettingsBrowser({
  categories,
  active,
  onActive,
  file,
  onChange,
}: {
  categories: Category[];
  active: string;
  onActive: (id: string) => void;
  file: Settings;
  onChange: Change;
}) {
  const [query, setQuery] = useState('');
  const search = query.trim().toLowerCase();
  const current = categories.find((category) => category.id === active) ?? categories[0];
  const isSet = (setting: Setting) => file[setting.key] !== undefined;

  const results = search
    ? categories.flatMap((category) =>
        category.settings
          .filter((setting) => setting.key.toLowerCase().includes(search) || setting.description.toLowerCase().includes(search))
          .map((setting) => ({ setting, category: category.label })),
      )
    : [];

  const row = (setting: Setting, category?: string) => (
    <SettingRow
      key={setting.key}
      setting={setting}
      path={[setting.key]}
      value={file[setting.key]}
      onChange={onChange}
      category={category}
    />
  );

  const inFile = current.settings.filter(isSet);
  const others = current.settings.filter((setting) => !isSet(setting));

  return (
    <div className="flex flex-col gap-5">
      <div role="tablist" aria-label="Groups of settings" className="flex flex-wrap gap-1">
        {categories.map((category) => {
          const selected = !search && category.id === current.id;
          const set = category.settings.filter(isSet).length;
          return (
            <button
              key={category.id}
              type="button"
              role="tab"
              aria-selected={selected}
              onClick={() => {
                onActive(category.id);
                setQuery('');
              }}
              className={cn(
                'flex shrink-0 items-center gap-2 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors',
                selected
                  ? 'bg-fd-primary text-fd-primary-foreground'
                  : 'text-fd-muted-foreground hover:bg-fd-accent hover:text-fd-accent-foreground',
              )}
            >
              {category.label}
              {set > 0 ? (
                <span className="rounded-full bg-[#3b6ff0] px-1.5 text-[11px] leading-4 font-semibold text-white tabular-nums">
                  {set}
                </span>
              ) : (
                <span className={cn('text-xs tabular-nums', selected ? 'opacity-70' : 'opacity-60')}>
                  {category.settings.length}
                </span>
              )}
            </button>
          );
        })}
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <label className="relative flex shrink-0 items-center sm:w-64">
          <Search className="pointer-events-none absolute left-3 size-4 text-fd-muted-foreground" />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search settings"
            aria-label="Search settings"
            className="h-9 w-full rounded-lg border bg-fd-background pr-8 pl-9 text-sm outline-none placeholder:text-fd-muted-foreground focus-visible:ring-2 focus-visible:ring-fd-ring"
          />
          {query && (
            <button
              type="button"
              onClick={() => setQuery('')}
              aria-label="Clear the search"
              className="absolute right-2 text-fd-muted-foreground hover:text-fd-foreground"
            >
              <X className="size-4" />
            </button>
          )}
        </label>
        <p className="text-sm text-fd-muted-foreground sm:text-right">
          {search
            ? results.length === 0
              ? 'No setting matches your search.'
              : `${results.length} ${results.length === 1 ? 'setting matches' : 'settings match'} your search.`
            : current.intro}
        </p>
      </div>

      {search ? (
        results.length > 0 && <Section>{results.map(({ setting, category }) => row(setting, category))}</Section>
      ) : inFile.length > 0 ? (
        <>
          <Section title="In your file" count={inFile.length}>
            {inFile.map((setting) => row(setting))}
          </Section>
          {others.length > 0 && <Section title="More settings">{others.map((setting) => row(setting))}</Section>}
        </>
      ) : (
        <Section>{others.map((setting) => row(setting))}</Section>
      )}
    </div>
  );
}

function Section({ title, count, children }: { title?: string; count?: number; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-3">
      {title && (
        <div className="flex items-center gap-2 px-1">
          <h3 className="text-xs font-bold tracking-wider text-fd-muted-foreground uppercase">{title}</h3>
          {count !== undefined && (
            <span className="rounded-full bg-[#3b6ff0]/15 px-1.5 text-[11px] leading-4 font-semibold text-[#2f5fd6] tabular-nums dark:text-[#8cb4ff]">
              {count}
            </span>
          )}
        </div>
      )}
      <ul className="divide-y rounded-xl border bg-fd-card">{children}</ul>
    </section>
  );
}
