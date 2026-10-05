interface Node {
  id: string;
  name: string;
  c_subcategories?: Node[];
  c_numberOfProducts?: string;
  c_isActive?: boolean;
}

function categoryResultCount(
  cat: Node,
  counts: Record<string, number>
): number {
  if (counts[cat.id] && !cat.c_subcategories?.length) {
    return counts[cat.id];
  }
  return (cat.c_subcategories || []).reduce(
    (total, subcat) => total + categoryResultCount(subcat, counts),
    0
  );
}

function findNode(
  tree: Node | null,
  parents: Node[],
  id: string
): [Node | null, Node[]] {
  if (!tree) return [null, []];
  if (tree.id === id) return [tree, parents];

  for (const child of tree.c_subcategories || []) {
    const res = findNode(child, [...parents, tree], id);
    if (res[0]) return res;
  }

  return [null, []];
}

function pruneTree(root: Node) {
  if (!root) return null;

  if (!root.c_isActive) return null;

  if (!root.c_subcategories && root.c_numberOfProducts === "0") {
    return null;
  }

  const newChildren = (root.c_subcategories || [])
    .map((cat) => pruneTree(cat))
    .filter((x) => x !== null);
  // eslint-disable-next-line @typescript-eslint/ban-ts-comment
  // @ts-ignore Null elements are filtered above
  root.c_subcategories = newChildren || [];
  return root;
}

function isInTree(root: Node, target: string): boolean {
  if (!root) return false;
  if (root.id === target) return true;

  for (const child of root.c_subcategories || []) {
    if (isInTree(child, target)) return true;
  }

  return false;
}

export { Node, categoryResultCount, findNode, pruneTree, isInTree };