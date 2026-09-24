/**
 * The file tree in the left sidebar.
 *
 * Directory chains with a single child collapse into one row
 * (`packages/chart-app/src/utils`), the way an editor shows them, which is
 * what keeps a deep monorepo path readable in a narrow sidebar.
 */
import { el, icon } from '../util.ts';
import type { DiffFile, FileStatus } from '@sofa/core';

/**
 * A directory in the tree.
 */
export interface DirNode {
  /** Discriminant for the node union. */
  type: 'dir';
  /** Display name, which may span several path segments after collapsing. */
  name: string;
  /** Full path of the directory. */
  path: string;
  /** Child directories and files. */
  children: TreeNode[];
  /** Lookup of child directories by segment name, used only while building. */
  index: Map<string, DirNode>;
}

/**
 * A changed file in the tree.
 */
export interface FileNode {
  /** Discriminant for the node union. */
  type: 'file';
  /** File name, and the full path it came from. */
  name: string; path: string;
  /** The diff record this row represents. */
  file: DiffFile;
}

/**
 * Either kind of tree node.
 */
export type TreeNode = DirNode | FileNode;

/**
 * Everything `render` needs to draw the tree and report interactions.
 */
export interface TreeOptions {
  /** The files to show, already filtered. */
  files: DiffFile[];
  /** Path of the file currently open in the viewer. */
  selectedPath: string | null;
  /**
   * Paths the user has marked viewed. Kept as a set because the tree asks
   * about every row on every render.
   */
  viewed: Set<string>;
  /** Directory paths the user has collapsed. */
  collapsed: Set<string>;
  /** Called with a file path when a file row is clicked. */
  onSelect: (path: string) => void;
  /** Called with a directory path when a directory row is clicked. */
  onToggleDir: (path: string) => void;
}

/**
 * Octicon path data, copied from the icon set GitHub itself uses in the file
 * tree, so the tree reads as part of the page rather than as an add-on.
 */
const ICONS = {
  chevronDown: 'M12.78 5.22a.749.749 0 0 1 0 1.06l-4.25 4.25a.749.749 0 0 1-1.06 0L3.22 6.28a.749.749 0 1 1 1.06-1.06L8 8.939l3.72-3.719a.749.749 0 0 1 1.06 0Z',
  chevronRight: 'M6.22 3.22a.75.75 0 0 1 1.06 0l4.25 4.25a.75.75 0 0 1 0 1.06l-4.25 4.25a.75.75 0 0 1-1.06-1.06L9.94 8 6.22 4.28a.75.75 0 0 1 0-1.06Z',
  directory: 'M1.75 1A1.75 1.75 0 0 0 0 2.75v10.5C0 14.216.784 15 1.75 15h12.5A1.75 1.75 0 0 0 16 13.25v-8.5A1.75 1.75 0 0 0 14.25 3H7.5a.25.25 0 0 1-.2-.1l-.9-1.2C6.07 1.26 5.55 1 5 1H1.75Z',
  file: 'M2 1.75C2 .784 2.784 0 3.75 0h6.586c.464 0 .909.184 1.237.513l2.914 2.914c.329.328.513.773.513 1.237v9.586A1.75 1.75 0 0 1 13.25 16h-9.5A1.75 1.75 0 0 1 2 14.25Zm1.75-.25a.25.25 0 0 0-.25.25v12.5c0 .138.112.25.25.25h9.5a.25.25 0 0 0 .25-.25V6h-2.75A1.75 1.75 0 0 1 9 4.25V1.5Zm6.75.062V4.25c0 .138.112.25.25.25h2.688l-.011-.013-2.914-2.914-.013-.011Z',
} as const;

/**
 * The square status glyph GitHub puts at the end of each file row: a plus for an
 * addition, a dash for a deletion, a dot for a modification, an arrow for a
 * rename. The square outline is shared; only the mark inside it changes.
 */
const STATUS_SQUARE = 'M2.75 1h10.5c.966 0 1.75.784 1.75 1.75v10.5A1.75 1.75 0 0 1 13.25 15H2.75A1.75 1.75 0 0 1 1 13.25V2.75C1 1.784 1.784 1 2.75 1Zm0 1.5a.25.25 0 0 0-.25.25v10.5c0 .138.112.25.25.25h10.5a.25.25 0 0 0 .25-.25V2.75a.25.25 0 0 0-.25-.25Z';

/**
 * The mark drawn inside the status square, per diff status.
 */
const STATUS_MARK: Record<FileStatus, string> = {
  added: 'M8 4a.75.75 0 0 1 .75.75v2.5h2.5a.75.75 0 0 1 0 1.5h-2.5v2.5a.75.75 0 0 1-1.5 0v-2.5h-2.5a.75.75 0 0 1 0-1.5h2.5v-2.5A.75.75 0 0 1 8 4Z',
  deleted: 'M4.75 7.25h6.5a.75.75 0 0 1 0 1.5h-6.5a.75.75 0 0 1 0-1.5Z',
  modified: 'M10 8a2 2 0 1 1-4 0 2 2 0 0 1 4 0Z',
  renamed: 'M6.5 4.75 10.75 8 6.5 11.25Z',
};

/**
 * Create an empty directory node.
 *
 * @param name - Display name of the directory.
 * @param path - Full path of the directory.
 * @returns The new node.
 */
function dirNode(name: string, path: string): DirNode {
  return { type: 'dir', name, path, children: [], index: new Map() };
}

/**
 * Merge every directory that has exactly one directory child into that child.
 *
 * @param node - Directory to compact, in place, depth first.
 */
function collapseChains(node: DirNode): void {
  for (const child of node.children) {
    if (child.type === 'dir') collapseChains(child);
  }
  const only = node.children[0];
  if (node.path && node.children.length === 1 && only && only.type === 'dir') {
    node.name = `${node.name}/${only.name}`;
    node.path = only.path;
    node.children = only.children;
  }
}

/**
 * Sort each directory's children: directories first, then files, both by name.
 *
 * @param node - Directory to sort, in place, depth first.
 */
function sortTree(node: DirNode): void {
  node.children.sort((a, b) => (a.type !== b.type ? (a.type === 'dir' ? -1 : 1) : a.name.localeCompare(b.name)));
  for (const child of node.children) {
    if (child.type === 'dir') sortTree(child);
  }
}

/**
 * Build a nested directory tree from a flat list of changed files.
 *
 * @param files - The files to place in the tree.
 * @returns The synthetic root directory node.
 */
export function buildTree(files: DiffFile[]): DirNode {
  const rootNode = dirNode('', '');
  for (const file of files) {
    const segments = file.path.split('/');
    let node = rootNode;
    for (const name of segments.slice(0, -1)) {
      let child = node.index.get(name);
      if (!child) {
        child = dirNode(name, node.path ? `${node.path}/${name}` : name);
        node.index.set(name, child);
        node.children.push(child);
      }
      node = child;
    }
    node.children.push({ type: 'file', name: segments[segments.length - 1] ?? file.path, path: file.path, file });
  }
  collapseChains(rootNode);
  sortTree(rootNode);
  return rootNode;
}

/**
 * Flatten the tree into the file paths it contains, in display order.
 *
 * The panel uses this order for next-file and previous-file navigation so the
 * keyboard follows what the sidebar shows.
 *
 * @param node - Any tree node.
 * @param out - Accumulator used by the recursion.
 * @returns File paths in display order.
 */
export function flattenPaths(node: DirNode, out: string[] = []): string[] {
  for (const child of node.children) {
    if (child.type === 'file') out.push(child.path);
    else flattenPaths(child, out);
  }
  return out;
}

/**
 * Render a single file row.
 *
 * @param node - The file node to render.
 * @param depth - Nesting depth, used for indentation only.
 * @param options - The active render options.
 * @returns A list item for the file.
 */
function renderFile(node: FileNode, depth: number, options: TreeOptions): HTMLLIElement {
  const isViewed = options.viewed.has(node.path);
  const isSelected = node.path === options.selectedPath;
  const row = el('button', {
    className: ['sofa-tree-row', 'sofa-tree-row--file', isSelected ? 'is-selected' : '', isViewed ? 'is-viewed' : '']
      .filter(Boolean)
      .join(' '),
    attrs: { type: 'button', title: node.path, 'data-sofa-path': node.path },
    children: [
      icon('sofa-tree-icon', [ICONS.file]),
      el('span', { className: 'sofa-tree-name', text: node.name }),
      el('span', {
        className: 'sofa-tree-counts',
        children: [
          el('span', { className: 'sofa-add', text: node.file.additions ? `+${node.file.additions}` : '' }),
          el('span', { className: 'sofa-del', text: node.file.deletions ? `-${node.file.deletions}` : '' }),
        ],
      }),
      icon(`sofa-status sofa-status--${node.file.status}`, [STATUS_SQUARE, STATUS_MARK[node.file.status]], node.file.status),
    ],
  });
  row.style.paddingLeft = `${8 + depth * 12}px`;
  row.addEventListener('click', () => options.onSelect(node.path));
  return el('li', { className: 'sofa-tree-item', children: [row] });
}

/**
 * Render a directory row together with its children, unless it is collapsed.
 *
 * @param node - The directory node to render.
 * @param depth - Nesting depth, used for indentation only.
 * @param options - The active render options.
 * @returns A list item for the directory.
 */
function renderDir(node: DirNode, depth: number, options: TreeOptions): HTMLLIElement {
  const collapsed = options.collapsed.has(node.path);
  const row = el('button', {
    className: 'sofa-tree-row sofa-tree-row--dir',
    attrs: { type: 'button', title: node.path, 'aria-expanded': String(!collapsed) },
    children: [
      icon('sofa-tree-caret', [collapsed ? ICONS.chevronRight : ICONS.chevronDown]),
      icon('sofa-tree-icon sofa-tree-icon--dir', [ICONS.directory]),
      el('span', { className: 'sofa-tree-name', text: node.name }),
    ],
  });
  row.style.paddingLeft = `${8 + depth * 12}px`;
  row.addEventListener('click', () => options.onToggleDir(node.path));

  const item = el('li', { className: 'sofa-tree-item', children: [row] });
  if (!collapsed) item.appendChild(renderChildren(node, depth + 1, options));
  return item;
}

/**
 * Render one directory level into a list element.
 *
 * @param node - Directory whose children are rendered.
 * @param depth - Nesting depth, used for indentation only.
 * @param options - The active render options.
 * @returns The list element for this level.
 */
function renderChildren(node: DirNode, depth: number, options: TreeOptions): HTMLUListElement {
  const list = el('ul', { className: 'sofa-tree-list' });
  for (const child of node.children) {
    list.appendChild(child.type === 'dir' ? renderDir(child, depth, options) : renderFile(child, depth, options));
  }
  return list;
}

/**
 * Render the whole tree into a fresh element.
 *
 * @param options - Files, selection, viewed and collapsed state, and callbacks.
 * @returns The tree container element.
 */
export function renderTree(options: TreeOptions): HTMLElement {
  const container = el('div', { className: 'sofa-tree' });
  if (!options.files.length) {
    container.appendChild(el('p', { className: 'sofa-empty', text: 'No files match.' }));
    return container;
  }
  container.appendChild(renderChildren(buildTree(options.files), 0, options));
  return container;
}
