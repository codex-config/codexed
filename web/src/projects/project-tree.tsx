import { ChevronRight, X } from 'lucide-react'
import { Fragment, useMemo, useState } from 'react'

import { SidebarMenuAction, SidebarMenuButton, SidebarMenuItem } from '@/components/ui/sidebar'
import type { Project } from '@/lib/api'
import { navigate } from '@/lib/location'
import { cn } from '@/lib/ui'
import { useStoredState } from '@/projects/stored-state'
import { ancestors, buildTree, type TreeNode } from '@/projects/tree'

type Props = {
  projects: Project[]
  current: string
  home?: string
  // While you filter, every folder is open.
  filtering: boolean
  onRemove: (project: Project) => void
}

// Folders are open until you close them, so that new projects are visible.
export function ProjectTree({ projects, current, home, filtering, onRemove }: Props) {
  const tree = useMemo(() => buildTree(projects, home), [projects, home])
  const [closed, setClosed] = useStoredState<string[]>('codexed.projects.closed', [])
  const [revealed, setRevealed] = useState('')

  // Open the folders above the selected project, for example after you add it.
  if (revealed !== current) {
    setRevealed(current)
    const above = ancestors(tree, current)
    if (above.some((path) => closed.includes(path))) setClosed(closed.filter((path) => !above.includes(path)))
  }

  function toggle(path: string) {
    setClosed(closed.includes(path) ? closed.filter((each) => each !== path) : [...closed, path])
  }

  function rows(nodes: TreeNode[], depth: number) {
    return nodes.map((node) => {
      const open = filtering || !closed.includes(node.path)
      return (
        <Fragment key={node.path}>
          <Row node={node} depth={depth} open={open} current={current} onToggle={toggle} onRemove={onRemove} />
          {open && rows(node.children, depth + 1)}
        </Fragment>
      )
    })
  }

  return rows(tree, 0)
}

function Row({
  node,
  depth,
  open,
  current,
  onToggle,
  onRemove,
}: {
  node: TreeNode
  depth: number
  open: boolean
  current: string
  onToggle: (path: string) => void
  onRemove: (project: Project) => void
}) {
  const { project } = node
  const active = project?.path === current

  return (
    <SidebarMenuItem className="flex items-center" style={{ paddingLeft: depth * 12 }}>
      {node.children.length > 0 ? (
        <button
          type="button"
          aria-expanded={open}
          aria-label={`${open ? 'Close' : 'Open'} ${node.label}`}
          onClick={() => onToggle(node.path)}
          className="grid size-6 shrink-0 place-items-center rounded-sm text-muted-foreground hover:text-foreground"
        >
          <ChevronRight className={cn('size-3.5 transition-transform duration-150', open && 'rotate-90')} />
        </button>
      ) : (
        <span className="size-6 shrink-0" />
      )}
      {project ? (
        <SidebarMenuButton
          isActive={active}
          // Selecting the open project again goes back to the global view.
          onClick={() => navigate({ dir: active ? '' : project.path })}
          title={active ? 'Back to global' : project.path}
          className="h-7 min-w-0 flex-1 font-semibold data-active:bg-transparent data-active:text-link"
        >
          <span>{node.label}</span>
        </SidebarMenuButton>
      ) : (
        <SidebarMenuButton
          onClick={() => onToggle(node.path)}
          aria-expanded={open}
          title={node.path}
          className="h-7 min-w-0 flex-1 text-muted-foreground"
        >
          <span>{node.label}</span>
        </SidebarMenuButton>
      )}
      {project?.saved && (
        <SidebarMenuAction showOnHover title="Remove from list" onClick={() => onRemove(project)}>
          <X />
          <span className="sr-only">Remove {project.name} from list</span>
        </SidebarMenuAction>
      )}
    </SidebarMenuItem>
  )
}
