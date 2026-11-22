import type { ReactNode } from 'react';
import type { Setting } from '../../fields';
import { highlightTOML } from '../../toml-view';
import { Prose } from '../prose';
import { exampleOf, rangeOf, typeOf, valuesOf } from '../reference';

// The type, the values and the default of a setting.
export function Facts({ setting, children }: { setting: Setting; children?: ReactNode }) {
  const { values, complete } = valuesOf(setting);
  const range = rangeOf(setting.field);

  return (
    <dl className="grid gap-y-1 text-sm sm:grid-cols-[minmax(0,7rem)_minmax(0,1fr)] sm:gap-x-4 sm:gap-y-3">
      <Fact term="Type">{typeOf(setting.field)}</Fact>
      {range && <Fact term="Range">{range}</Fact>}
      {values.length > 0 && (
        <Fact term={complete ? 'Values' : 'Common values'}>
          <ul className="flex flex-wrap gap-1.5">
            {values.map(({ value, hint }) => (
              <li key={value} className="rounded-md border bg-fd-background px-2 py-0.5">
                <code className="font-mono text-[13px]">{value}</code>
                {hint && <span className="ml-1.5 text-fd-muted-foreground">{hint}</span>}
              </li>
            ))}
          </ul>
        </Fact>
      )}
      {setting.fallback !== undefined && (
        <Fact term="Default">
          <code className="font-mono text-[13px]">{String(setting.fallback)}</code>
        </Fact>
      )}
      {children}
    </dl>
  );
}

export function Fact({ term, children }: { term: string; children: ReactNode }) {
  return (
    <>
      <dt className="text-fd-muted-foreground">{term}</dt>
      <dd className="mb-2 min-w-0 last:mb-0 sm:mb-0">{children}</dd>
    </>
  );
}

export function Example({ toml }: { toml: string }) {
  return (
    <pre className="overflow-x-auto rounded-xl border bg-fd-card p-4 font-mono text-[13px] leading-6">
      <code>{highlightTOML(toml)}</code>
    </pre>
  );
}

// A setting inside a table, such as tui.theme. Each one has an anchor.
export function Child({ setting, path, depth }: { setting: Setting; path: string; depth: number }) {
  const Heading = depth === 0 ? 'h3' : 'h4';
  const field = setting.field;
  const toml = setting.example !== undefined ? exampleOf(setting, path.split('.')) : undefined;

  return (
    <section id={path} className="scroll-mt-20 py-6">
      <Heading className="font-mono text-base font-semibold break-all">
        <a href={`#${path}`} className="hover:underline hover:underline-offset-4">
          {path}
        </a>
      </Heading>
      {setting.description && <Prose text={setting.description} className="mt-2 leading-relaxed text-fd-muted-foreground" />}
      <div className="mt-4">
        <Facts setting={setting} />
      </div>
      {toml && (
        <div className="mt-4">
          <Example toml={toml} />
        </div>
      )}
      {field.kind === 'object' && (
        <div className="mt-4 divide-y border-l pl-5">
          {field.settings.map((child) => (
            <Child key={child.key} setting={child} path={`${path}.${child.key}`} depth={depth + 1} />
          ))}
        </div>
      )}
    </section>
  );
}
