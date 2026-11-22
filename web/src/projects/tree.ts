import type { Project } from '@/lib/api'

export type TreeNode = {
  // The full path of the folder. It is also the key of the node.
  path: string
  // One folder name, or several when folders with one subfolder are joined, as in "~/code/work".
  label: string
  project?: Project
  children: TreeNode[]
}

// Builds the folders that hold the projects. Folders without projects below them are not in the tree.
export function buildTree(projects: Project[], home?: string): TreeNode[] {
  const root: TreeNode = { path: '', label: '', children: [] }
  for (const project of projects) {
    let node = root
    for (const [label, path] of steps(project.path, home)) {
      let child = node.children.find((each) => each.path === path)
      if (!child) {
        child = { path, label, children: [] }
        node.children.push(child)
      }
      node = child
    }
    node.project = project
  }
  // The home folder comes first.
  return sort(root.children.map(compact)).sort((a, b) => Number(b.label.startsWith('~')) - Number(a.label.startsWith('~')))
}

// The folders from the root down to the path, as [label, path] pairs. Paths in
// the home folder start at "~".
function steps(path: string, home?: string): [string, string][] {
  const separator = path.includes('/') ? '/' : '\\'
  const parts = path.split(separator)
  const homeParts = home ? home.split(separator).length : 0
  const inHome = !!home && path.startsWith(home + separator)

  const result: [string, string][] = inHome ? [['~', home]] : [[parts[0] || separator, parts[0] || separator]]
  for (let i = inHome ? homeParts : 1; i < parts.length; i++) {
    if (parts[i] === '') continue
    result.push([parts[i], parts.slice(0, i + 1).join(separator)])
  }
  return result
}

// A folder that is not a project and holds only one folder is joined with it.
function compact(node: TreeNode): TreeNode {
  let current = node
  while (!current.project && current.children.length === 1 && !current.children[0].project) {
    const child = current.children[0]
    const separator = child.path.includes('/') ? '/' : '\\'
    const label = current.label.endsWith(separator) ? current.label + child.label : current.label + separator + child.label
    current = { ...child, label }
  }
  return { ...current, children: sort(current.children.map(compact)) }
}

function sort(nodes: TreeNode[]) {
  return nodes.sort((a, b) => a.label.localeCompare(b.label, undefined, { numeric: true, sensitivity: 'base' }))
}

// The folders above a path, so that they can be opened to show it.
export function ancestors(nodes: TreeNode[], path: string): string[] {
  for (const node of nodes) {
    if (node.path === path) return []
    const below = ancestors(node.children, path)
    if (below.length > 0 || node.children.some((child) => child.path === path)) return [node.path, ...below]
  }
  return []
}
