import { useQuery } from '@tanstack/react-query'
import { ChevronRight, Globe, X } from 'lucide-react'
import { useState } from 'react'

import { EmptyState } from '@/components/empty-state'
import { Button } from '@/components/ui/button'
import { SidebarInset, SidebarProvider, useSidebar } from '@/components/ui/sidebar'
import { FileEditor } from '@/files/file-editor'
import { queries } from '@/lib/api'
import { navigate, shortPath, useLocation, type Tab } from '@/lib/location'
import { cn } from '@/lib/ui'
import { FeaturesPanel } from '@/features/features-panel'
import { MarketplacesPanel } from '@/marketplaces/marketplaces-panel'
import { MCPPanel } from '@/mcp/mcp-panel'
import { PluginsPanel } from '@/plugins/plugins-panel'
import { AppSidebar } from '@/projects/app-sidebar'
import { VersionInfo } from '@/projects/version-info'
import { sections, type Section as SectionInfo } from '@/sections'
import { SettingsPanel } from '@/settings/settings-panel'
import { SkillsPanel } from '@/skills/skills-panel'

// Sections that scroll as a whole. The others scroll inside their own panels.
const scrolls: Tab[] = ['plugins', 'marketplaces', 'features']

export default function App() {
  const { dir, tab } = useLocation()
  const [actions, setActions] = useState<HTMLDivElement | null>(null)

  return (
    <SidebarProvider>
      <AppSidebar current={dir} tab={tab} />
      <SidebarInset className="h-svh min-h-0 overflow-hidden">
        <Header dir={dir} tab={tab} actions={setActions} />
        {/* key resets editors and their drafts when the folder changes */}
        <main key={dir} className="flex min-h-0 flex-1 flex-col">
          {/* Every section stays mounted, so that switching keeps unsaved edits. */}
          {sections.map((section) => (
            <div
              key={section.tab}
              className={cn('min-h-0 flex-1 p-5 animate-in fade-in-0 duration-150', section.tab !== tab && 'hidden')}
            >
              {/* Cards clip with small round corners where they scroll out of view. */}
              <div className={cn('h-full', scrolls.includes(section.tab) && 'overflow-y-auto rounded-lg')}>
                {dir && section.globalOnly ? (
                  <GlobalOnly section={section} />
                ) : (
                  <Section tab={section.tab} dir={dir} actions={section.tab === tab ? actions : null} />
                )}
              </div>
            </div>
          ))}
        </main>
      </SidebarInset>
    </SidebarProvider>
  )
}

function GlobalOnly({ section }: { section: SectionInfo }) {
  return (
    <EmptyState icon={<Globe />} title={`${section.label} are global`}>
      <div className="flex flex-col items-center gap-4">
        They apply to every project, so you manage them in the global view.
        <Button onClick={() => navigate({ dir: '' })}>Open the global view</Button>
      </div>
    </EmptyState>
  )
}

// Save buttons go into the header. Hidden sections get null, so they show none.
function Section({ tab, dir, actions }: { tab: Tab; dir: string; actions: Element | null }) {
  switch (tab) {
    case 'settings':
      return <SettingsPanel dir={dir} />
    case 'agents-md':
      return <FileEditor dir={dir} kind="agents-md" toolbar={actions} />
    case 'skills':
      return <SkillsPanel dir={dir} actions={actions} />
    case 'plugins':
      return <PluginsPanel />
    case 'marketplaces':
      return <MarketplacesPanel actions={actions} />
    case 'mcp':
      return <MCPPanel dir={dir} actions={actions} />
    case 'features':
      return <FeaturesPanel dir={dir} />
  }
}

// One line: where you are, and the way back to the global view.
function Header({ dir, tab, actions }: { dir: string; tab: Tab; actions: (element: HTMLDivElement | null) => void }) {
  const health = useQuery(queries.health())
  const name = dir.split(/[\\/]/).filter(Boolean).pop() ?? dir
  const section = sections.find((each) => each.tab === tab)
  const { open, openMobile, isMobile } = useSidebar()
  const sidebarHidden = isMobile ? !openMobile : !open

  return (
    // While the sidebar is hidden, the floating logo takes the left corner.
    <header
      className={cn(
        'flex h-12 shrink-0 items-center gap-3 border-b px-5 transition-[padding] duration-200 ease-out',
        sidebarHidden && 'pl-14',
      )}
    >
      <nav aria-label="Location" className="flex min-w-0 items-center gap-2 text-sm">
        {dir ? (
          <span className="flex min-w-0 items-center gap-1.5 rounded-md border px-2 py-0.5">
            <span className="truncate font-semibold">{name}</span>
            <button
              type="button"
              title="Back to global"
              aria-label="Back to global"
              onClick={() => navigate({ dir: '' })}
              className="text-muted-foreground hover:text-foreground"
            >
              <X className="size-3.5" />
            </button>
          </span>
        ) : (
          <span className="font-semibold">Global</span>
        )}
        <ChevronRight className="size-3.5 shrink-0 text-muted-foreground" />
        <span className="font-semibold">{section?.label}</span>
      </nav>
      <span className="ml-auto truncate text-xs text-dim">
        {dir ? shortPath(dir, health.data?.home) : 'Applies to every folder'}
      </span>
      <VersionInfo />
      <div ref={actions} className="flex items-center gap-2 empty:hidden" />
    </header>
  )
}
