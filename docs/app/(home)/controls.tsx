'use client';

import { ChevronDown, X } from 'lucide-react';
import { type ComponentProps, type KeyboardEvent, useEffect, useId, useRef, useState } from 'react';
import { cn } from '@/lib/cn';
import { type Field, fits, isPlainObject, type Setting } from './fields';
import type { Preset } from './presets';
import { readSnippet, snippetOf } from './toml';

// undefined removes the setting from the file.
export type Change = (path: string[], value: unknown) => void;

const input =
  'h-9 w-full min-w-0 rounded-lg border bg-fd-background px-3 text-sm outline-none placeholder:text-fd-muted-foreground/60 focus-visible:ring-2 focus-visible:ring-fd-ring';
const smallButton =
  'flex h-9 shrink-0 items-center justify-center rounded-lg border px-3 text-sm font-medium transition-colors hover:bg-fd-accent disabled:opacity-50';
const iconButton =
  'grid size-9 shrink-0 place-items-center rounded-lg text-fd-muted-foreground transition-colors hover:bg-fd-accent hover:text-fd-foreground';

export function SettingRow({
  setting,
  path,
  value,
  onChange,
  category,
}: {
  setting: Setting;
  path: string[];
  value: unknown;
  onChange: Change;
  // Shown next to the name in search results.
  category?: string;
}) {
  const [expanded, setExpanded] = useState(false);
  const field: Field = fits(setting.field, value) ? setting.field : { kind: 'toml' };
  const set = (next: unknown) => onChange(path, next);

  // Unset settings take one line. Larger editors open on demand or when there is a value.
  const collapsible = field.kind === 'toml' || field.kind === 'object' || field.kind === 'map';
  const open = value !== undefined || expanded;
  // Lists with presets need the width for their chips.
  const block = collapsible
    ? open
    : field.kind === 'list' && ((Array.isArray(value) && value.length > 0) || (setting.presets?.length ?? 0) > 0);

  const control =
    collapsible && !open ? (
      <button type="button" onClick={() => setExpanded(true)} className={smallButton}>
        {field.kind === 'object' ? `Show ${field.settings.length} settings` : field.kind === 'map' ? 'Add entry' : 'Edit TOML'}
      </button>
    ) : (
      <Control setting={setting} field={field} value={value} path={path} set={set} onChange={onChange} />
    );

  return (
    <li className="px-5 py-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:gap-6">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            {value !== undefined && path.length > 1 && (
              <span aria-label="Set in your file" className="size-1.5 shrink-0 rounded-full bg-[#4a7bf5]" />
            )}
            <code className="font-mono text-sm font-semibold break-all">{setting.key}</code>
            {category && <span className="text-xs text-fd-muted-foreground">in {category}</span>}
            {value !== undefined && (
              <button
                type="button"
                title="Remove it from the file, so that Codex uses its default"
                aria-label={`Remove ${setting.key}`}
                onClick={() => set(undefined)}
                className="text-xs font-medium text-fd-muted-foreground hover:text-red-500"
              >
                Remove
              </button>
            )}
          </div>
          {setting.description && <Description text={setting.description} />}
        </div>
        {!block && <div className="flex shrink-0 sm:w-64 sm:justify-end">{control}</div>}
      </div>
      {block && <div className="mt-3">{control}</div>}
    </li>
  );
}

// Shows three lines, and a toggle only when the text is cut off.
function Description({ text }: { text: string }) {
  const ref = useRef<HTMLParagraphElement>(null);
  const [expanded, setExpanded] = useState(false);
  const [clipped, setClipped] = useState(false);

  useEffect(() => {
    const element = ref.current;
    if (!element || expanded) return;
    const observer = new ResizeObserver(() => setClipped(element.scrollHeight > element.clientHeight + 1));
    observer.observe(element);
    return () => observer.disconnect();
  }, [expanded]);

  return (
    <>
      <p ref={ref} className={cn('mt-1.5 text-sm leading-relaxed text-fd-muted-foreground', !expanded && 'line-clamp-3')}>
        {withCode(text)}
      </p>
      {(clipped || expanded) && (
        <button
          type="button"
          onClick={() => setExpanded(!expanded)}
          className="mt-1 text-xs font-medium text-[#2f5fd6] hover:underline dark:text-[#8cb4ff]"
        >
          {expanded ? 'Show less' : 'Show more'}
        </button>
      )}
    </>
  );
}

// Text in backticks, as in "Defaults to `true`", shows as code.
function withCode(text: string) {
  return text.split(/`([^`\n]+)`/).map((part, index) =>
    index % 2 === 1 ? (
      <code key={index} className="rounded bg-fd-muted px-1 py-px font-mono text-[0.8125rem] text-fd-foreground/80">
        {part}
      </code>
    ) : (
      part
    ),
  );
}

function Control({
  setting,
  field,
  value,
  path,
  set,
  onChange,
}: {
  setting: Setting;
  field: Field;
  value: unknown;
  path: string[];
  set: (value: unknown) => void;
  onChange: Change;
}) {
  const example = parse(setting.example);

  switch (field.kind) {
    case 'boolean':
      return (
        <div className="flex items-center gap-2.5">
          {value === undefined && (
            <span className="text-xs text-fd-muted-foreground">{setting.fallback === undefined ? 'Not set' : 'Default'}</span>
          )}
          <Switch checked={(value ?? setting.fallback ?? false) as boolean} onChange={set} label={setting.key} />
        </div>
      );
    case 'enum': {
      const hints = new Map(setting.presets?.map((preset) => [preset.value, preset.hint]));
      return (
        <Picker
          options={field.options.map((option) => ({ value: option, hint: hints.get(option) }))}
          value={value as string | undefined}
          onSelect={set}
          label={setting.key}
        />
      );
    }
    case 'string':
      if (setting.presets?.length) {
        return (
          <PresetInput
            presets={setting.presets}
            value={value as string | undefined}
            onChange={set}
            label={setting.key}
          />
        );
      }
      return (
        <DraftInput
          value={(value as string | undefined) ?? ''}
          onCommit={(text) => set(text === '' ? undefined : text)}
          suggestions={field.suggestions}
          placeholder={typeof example === 'string' ? example : 'Not set'}
          aria-label={setting.key}
        />
      );
    case 'number':
      return (
        <DraftInput
          type="number"
          step={field.integer ? 1 : 'any'}
          min={field.min}
          max={field.max}
          value={value === undefined ? '' : String(value)}
          onCommit={(text) => {
            const number = Number(text);
            if (text.trim() === '') set(undefined);
            else if (Number.isFinite(number)) set(number);
          }}
          placeholder={typeof example === 'number' ? String(example) : 'Not set'}
          aria-label={setting.key}
        />
      );
    case 'list':
      return (
        <ListControl
          items={(value as string[] | undefined) ?? []}
          options={field.options}
          onChange={(items) => set(items.length > 0 ? items : undefined)}
          label={setting.key}
          placeholder={Array.isArray(example) && typeof example[0] === 'string' ? example[0] : 'Add an entry'}
          presets={setting.presets ?? []}
        />
      );
    case 'map':
      return (
        <MapControl
          entries={(value as Record<string, string> | undefined) ?? {}}
          onChange={(entries) => set(Object.keys(entries).length > 0 ? entries : undefined)}
          label={setting.key}
          example={isPlainObject(example) ? Object.entries(example)[0] : undefined}
          names={setting.presets ?? []}
        />
      );
    case 'object':
      return (
        <ul className="divide-y rounded-xl border bg-fd-background/40">
          {field.settings.map((child) => (
            <SettingRow
              key={child.key}
              setting={child}
              path={[...path, child.key]}
              value={isPlainObject(value) ? value[child.key] : undefined}
              onChange={onChange}
            />
          ))}
        </ul>
      );
    case 'toml':
      return <TOMLControl value={value} path={path} onChange={set} label={setting.key} example={example} />;
  }
}

function parse(text: string | undefined): unknown {
  return text === undefined ? undefined : JSON.parse(text);
}

function Switch({ checked, onChange, label }: { checked: boolean; onChange: (checked: boolean) => void; label: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className={cn(
        'relative h-6 w-10 shrink-0 rounded-full transition-colors focus-visible:ring-2 focus-visible:ring-fd-ring focus-visible:outline-none',
        checked ? 'bg-[#3b6ff0]' : 'bg-fd-muted ring-1 ring-fd-border ring-inset',
      )}
    >
      <span
        className={cn(
          'absolute top-1 left-1 size-4 rounded-full bg-white shadow transition-transform',
          checked && 'translate-x-4',
        )}
      />
    </button>
  );
}

type DraftInputProps = Omit<ComponentProps<'input'>, 'value' | 'onChange'> & {
  value: string;
  onCommit: (text: string) => void;
  suggestions?: string[];
};

// Saves when the field loses focus or on Enter. Escape restores the saved text.
function DraftInput({ value, onCommit, suggestions = [], className, ...props }: DraftInputProps) {
  const [draft, setDraft] = useState(value);
  const [saved, setSaved] = useState(value);
  const listId = useId();
  if (value !== saved) {
    setSaved(value);
    setDraft(value);
  }

  function onKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'Enter') event.currentTarget.blur();
    if (event.key === 'Escape') setDraft(value);
  }

  return (
    <>
      <input
        {...props}
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
        onBlur={() => draft !== value && onCommit(draft)}
        onKeyDown={onKeyDown}
        list={suggestions.length > 0 ? listId : undefined}
        className={cn(input, className)}
      />
      {suggestions.length > 0 && (
        <datalist id={listId}>
          {suggestions.map((suggestion) => (
            <option key={suggestion} value={suggestion} />
          ))}
        </datalist>
      )}
    </>
  );
}

type Item = { value: string | undefined; hint?: string; custom?: boolean };

// A list of choices that shows a short hint under each value. It works like a native select:
// arrows move, Enter picks, Escape closes.
function Picker({
  options,
  value,
  onSelect,
  label,
  placeholder = 'Not set',
  shown,
  onCustom,
}: {
  options: Preset[];
  value: string | undefined;
  onSelect: (value: string | undefined) => void;
  label: string;
  placeholder?: string;
  // Text on the button instead of the value.
  shown?: string;
  // Adds a last choice for any other value.
  onCustom?: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const root = useRef<HTMLDivElement>(null);
  const id = useId();
  // A value from a pasted file that is not in the list still shows.
  const all = value !== undefined && !options.some((option) => option.value === value) ? [...options, { value }] : options;
  const items: Item[] = [{ value: undefined }, ...all, ...(onCustom ? [{ value: undefined, custom: true }] : [])];
  const selected = Math.max(
    items.findIndex((item) => !item.custom && item.value === value),
    0,
  );

  useEffect(() => {
    if (!open) return;
    const close = (event: PointerEvent) => !root.current?.contains(event.target as Node) && setOpen(false);
    document.addEventListener('pointerdown', close);
    return () => document.removeEventListener('pointerdown', close);
  }, [open]);

  useEffect(() => {
    if (open) document.getElementById(`${id}-${active}`)?.scrollIntoView({ block: 'nearest' });
  }, [open, active, id]);

  function show() {
    setActive(selected);
    setOpen(true);
  }

  function choose(item: Item) {
    setOpen(false);
    if (item.custom) onCustom?.();
    else onSelect(item.value);
  }

  function onKeyDown(event: KeyboardEvent<HTMLButtonElement>) {
    if (!open) {
      if (['ArrowDown', 'ArrowUp', 'Enter', ' '].includes(event.key)) {
        event.preventDefault();
        show();
      }
      return;
    }
    if (event.key === 'ArrowDown') setActive((index) => Math.min(index + 1, items.length - 1));
    else if (event.key === 'ArrowUp') setActive((index) => Math.max(index - 1, 0));
    else if (event.key === 'Enter' || event.key === ' ') choose(items[active]);
    else if (event.key === 'Escape' || event.key === 'Tab') return setOpen(false);
    else return;
    event.preventDefault();
  }

  return (
    <div ref={root} className="relative w-full">
      <button
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? id : undefined}
        aria-activedescendant={open ? `${id}-${active}` : undefined}
        aria-label={label}
        onClick={() => (open ? setOpen(false) : show())}
        onKeyDown={onKeyDown}
        className={cn(
          input,
          'flex items-center justify-between gap-2 text-left',
          shown === undefined && value === undefined && 'text-fd-muted-foreground',
        )}
      >
        <span className="truncate">{shown ?? value ?? placeholder}</span>
        <ChevronDown className="size-4 shrink-0 text-fd-muted-foreground" />
      </button>
      {open && (
        <ul
          id={id}
          role="listbox"
          aria-label={label}
          className="absolute right-0 z-30 mt-1 max-h-80 w-max max-w-[min(22rem,calc(100vw-2rem))] min-w-full overflow-y-auto rounded-lg border bg-fd-popover p-1 shadow-xl"
        >
          {items.map((item, index) => (
            <li
              key={item.custom ? 'custom' : (item.value ?? '')}
              id={`${id}-${index}`}
              role="option"
              aria-selected={index === selected && !item.custom}
              onPointerEnter={() => setActive(index)}
              onClick={() => choose(item)}
              className={cn(
                'flex cursor-pointer flex-col rounded-md px-2.5 py-1.5 text-sm',
                index === active && 'bg-fd-accent text-fd-accent-foreground',
              )}
            >
              <span
                className={cn(
                  item.value === undefined ? 'text-fd-muted-foreground' : 'font-medium',
                  index === selected && !item.custom && 'text-[#2f5fd6] dark:text-[#8cb4ff]',
                )}
              >
                {item.custom ? 'Custom…' : (item.value ?? placeholder)}
              </span>
              {item.hint && <span className="text-xs text-fd-muted-foreground">{item.hint}</span>}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// Common values in a list, and a field for any other value.
function PresetInput({
  presets,
  value,
  onChange,
  label,
}: {
  presets: Preset[];
  value: string | undefined;
  onChange: (value: string | undefined) => void;
  label: string;
}) {
  const known = value === undefined || presets.some((preset) => preset.value === value);
  const [custom, setCustom] = useState(!known);
  if (!known && !custom) setCustom(true);

  return (
    <div className="flex w-full flex-col gap-2">
      <Picker
        options={presets}
        value={custom ? undefined : value}
        shown={custom ? 'Custom…' : undefined}
        onSelect={(next) => {
          setCustom(false);
          onChange(next);
        }}
        onCustom={() => setCustom(true)}
        label={label}
      />
      {custom && (
        <DraftInput
          value={value ?? ''}
          onCommit={(text) => onChange(text === '' ? undefined : text)}
          placeholder="Type a value"
          aria-label={`${label}, custom value`}
          autoFocus={value === undefined}
        />
      )}
    </div>
  );
}

function ListControl({
  items,
  options,
  onChange,
  label,
  placeholder,
  presets,
}: {
  items: string[];
  options: string[];
  onChange: (items: string[]) => void;
  label: string;
  placeholder: string;
  presets: Preset[];
}) {
  const [adding, setAdding] = useState('');
  const remaining = options.filter((option) => !items.includes(option));
  const suggested = presets.filter((preset) => !items.includes(preset.value));

  function add(entry: string | undefined) {
    if (!entry?.trim()) return;
    onChange([...items, entry.trim()]);
    setAdding('');
  }

  return (
    <div className="flex w-full flex-col gap-2">
      {items.map((item, index) => (
        <div key={index} className="flex gap-2">
          <DraftInput
            value={item}
            onCommit={(text) =>
              onChange(text.trim() === '' ? items.filter((_, i) => i !== index) : items.map((old, i) => (i === index ? text : old)))
            }
            aria-label={`${label} entry ${index + 1}`}
            className="font-mono text-xs"
          />
          <button
            type="button"
            aria-label={`Remove ${item}`}
            onClick={() => onChange(items.filter((_, i) => i !== index))}
            className={iconButton}
          >
            <X className="size-4" />
          </button>
        </div>
      ))}
      {options.length > 0 ? (
        remaining.length > 0 && (
          <Picker
            options={remaining.map((option) => ({ value: option }))}
            value={undefined}
            onSelect={add}
            label={`Add to ${label}`}
            placeholder="Add an entry"
          />
        )
      ) : (
        <div className="flex gap-2">
          <input
            value={adding}
            onChange={(event) => setAdding(event.target.value)}
            onKeyDown={(event) => event.key === 'Enter' && add(adding)}
            placeholder={placeholder}
            aria-label={`Add to ${label}`}
            className={cn(input, 'font-mono text-xs')}
          />
          <button type="button" disabled={!adding.trim()} onClick={() => add(adding)} className={smallButton}>
            Add
          </button>
        </div>
      )}
      {suggested.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {suggested.map((preset) => (
            <button
              key={preset.value}
              type="button"
              title={preset.hint}
              onClick={() => add(preset.value)}
              className="rounded-full border px-2.5 py-1 font-mono text-xs text-fd-muted-foreground transition-colors hover:border-[#3b6ff0]/60 hover:text-fd-foreground"
            >
              + {preset.value}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function MapControl({
  entries,
  onChange,
  label,
  example,
  names,
}: {
  entries: Record<string, string>;
  onChange: (entries: Record<string, string>) => void;
  label: string;
  example?: [string, unknown];
  names: Preset[];
}) {
  const [key, setKey] = useState('');
  const [value, setValue] = useState('');
  const namesId = useId();
  const pairs = Object.entries(entries);

  // Rebuilding the object keeps the order of the keys.
  const rename = (from: string, to: string) =>
    to.trim() !== '' &&
    !(to in entries) &&
    onChange(Object.fromEntries(pairs.map(([k, v]) => (k === from ? [to.trim(), v] : [k, v]))));

  function add() {
    if (key.trim() === '' || key in entries) return;
    onChange({ ...entries, [key.trim()]: value });
    setKey('');
    setValue('');
  }

  return (
    <div className="grid w-full grid-cols-[minmax(0,1fr)_minmax(0,2fr)_auto] gap-2">
      {pairs.map(([k, v]) => (
        <div key={k} className="contents">
          <DraftInput value={k} onCommit={(text) => rename(k, text)} aria-label={`${label} name`} className="font-mono text-xs" />
          <DraftInput
            value={v}
            onCommit={(text) => onChange({ ...entries, [k]: text })}
            aria-label={`${label} ${k}`}
            className="font-mono text-xs"
          />
          <button
            type="button"
            aria-label={`Remove ${k}`}
            onClick={() => onChange(Object.fromEntries(pairs.filter(([other]) => other !== k)))}
            className={iconButton}
          >
            <X className="size-4" />
          </button>
        </div>
      ))}
      <input
        value={key}
        onChange={(event) => setKey(event.target.value)}
        onKeyDown={(event) => event.key === 'Enter' && add()}
        placeholder={example?.[0] ?? 'Name'}
        aria-label={`New ${label} name`}
        list={names.length > 0 ? namesId : undefined}
        className={cn(input, 'font-mono text-xs')}
      />
      {names.length > 0 && (
        <datalist id={namesId}>
          {names
            .filter((name) => !(name.value in entries))
            .map((name) => (
              <option key={name.value} value={name.value} label={name.hint} />
            ))}
        </datalist>
      )}
      <input
        value={value}
        onChange={(event) => setValue(event.target.value)}
        onKeyDown={(event) => event.key === 'Enter' && add()}
        placeholder={typeof example?.[1] === 'string' ? example[1] : 'Value'}
        aria-label={`New ${label} value`}
        className={cn(input, 'font-mono text-xs')}
      />
      <button type="button" disabled={!key.trim() || key in entries} onClick={add} className={smallButton}>
        Add
      </button>
    </div>
  );
}

// The TOML of one setting, with the tables above it. Saves when the field loses focus,
// if the text is valid. Empty text removes the setting.
function TOMLControl({
  value,
  path,
  onChange,
  label,
  example,
}: {
  value: unknown;
  path: string[];
  onChange: (value: unknown) => void;
  label: string;
  example: unknown;
}) {
  const text = value === undefined ? '' : snippetOf(path, value);
  const placeholder = example === undefined ? undefined : snippetOf(path, example);
  const [draft, setDraft] = useState(text);
  const [saved, setSaved] = useState(text);
  const [error, setError] = useState('');
  if (text !== saved) {
    setSaved(text);
    setDraft(text);
    setError('');
  }

  function commit() {
    if (draft === text) return;
    const read = readSnippet(draft, path);
    if ('error' in read) return setError(read.error);
    setError('');
    onChange(read.value);
  }

  return (
    <div className="flex w-full flex-col gap-1.5">
      <textarea
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
        onBlur={commit}
        placeholder={placeholder}
        aria-label={label}
        aria-invalid={error !== ''}
        spellCheck={false}
        rows={Math.min(Math.max((draft || placeholder || '').split('\n').length, 3), 16)}
        className={cn(input, 'h-auto py-2 font-mono text-xs leading-relaxed', error && 'border-red-500')}
      />
      {error && <p className="text-xs text-red-500">{error}</p>}
      {draft.trim() === '' && example !== undefined && (
        <button type="button" onClick={() => onChange(example)} className={cn(smallButton, 'self-start')}>
          Use the example
        </button>
      )}
    </div>
  );
}
