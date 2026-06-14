import type { Connection, Node } from '@xyflow/react';
import { transitionsFor } from '../engine/index.ts';
import type { BuilderEdge, BuilderNode, ProcessData, StateData } from './types.ts';

export function edgeKind(
  source: Node | undefined,
  target: Node | undefined,
): 'consumes' | 'produces' | null {
  if (!source || !target) return null;
  if (source.type === 'state' && target.type === 'process') return 'consumes';
  if (source.type === 'process' && target.type === 'state') return 'produces';
  return null;
}

export function transitionAllowed(leaf: string, trans: string): boolean {
  const tf = transitionsFor(leaf);
  const row = tf.rows.find((r: { t: string; ok: boolean }) => r.t === trans);
  if (row) return row.ok;
  if (trans === 'cook' || trans === 'temper' || trans === 'cool') return true;
  return false;
}

export function stateLeaf(data: StateData): string | null {
  return data.leaf || data.ingredientKey || null;
}

export function isValidConnection(
  connection: Connection,
  nodes: BuilderNode[],
): boolean {
  const source = nodes.find((n) => n.id === connection.source);
  const target = nodes.find((n) => n.id === connection.target);
  const kind = edgeKind(source, target);
  if (!kind) return false;

  if (kind === 'consumes' && source?.type === 'state' && target?.type === 'process') {
    const leaf = stateLeaf(source.data);
    const trans = (target.data as ProcessData).trans;
    if (!leaf) return trans === 'cook';
    return transitionAllowed(leaf, trans);
  }

  if (kind === 'produces' && source?.type === 'process' && target?.type === 'state') {
    const trans = (source.data as ProcessData).trans;
    const leaf = stateLeaf(target.data);
    if (!leaf) return true;
    return transitionAllowed(leaf, trans);
  }

  return false;
}

export type NextNodeOption = {
  id: string;
  label: string;
  kind: 'process' | 'state';
  trans?: string;
  weight: number;
};

const TRANS_WEIGHT: Record<string, number> = {
  cut: 10,
  peel: 9,
  clean: 8,
  deskin: 7,
  grind: 6,
  juice: 5,
  cook: 4,
  temper: 3,
  cool: 2,
};

export function validNextFromState(
  stateNode: BuilderNode,
  nodes: BuilderNode[],
  edges: BuilderEdge[],
): NextNodeOption[] {
  if (stateNode.type !== 'state') return [];
  const leaf = stateLeaf(stateNode.data);
  const options: NextNodeOption[] = [];

  if (leaf) {
    const tf = transitionsFor(leaf);
    for (const row of tf.rows) {
      if (!row.ok) continue;
      options.push({
        id: `new:${row.t}`,
        label: row.t.charAt(0).toUpperCase() + row.t.slice(1),
        kind: 'process',
        trans: row.t,
        weight: TRANS_WEIGHT[row.t] ?? 1,
      });
    }
  } else {
    options.push({
      id: 'new:cook',
      label: 'Cook',
      kind: 'process',
      trans: 'cook',
      weight: 4,
    });
  }

  const existingTargets = new Set(
    edges.filter((e) => e.source === stateNode.id).map((e) => e.target),
  );
  return options
    .filter((o) => {
      if (o.kind !== 'process') return true;
      return !nodes.some(
        (n) =>
          n.type === 'process' &&
          existingTargets.has(n.id) &&
          (n.data as ProcessData).trans === o.trans,
      );
    })
    .sort((a, b) => b.weight - a.weight);
}

export function validNextFromProcess(
  procNode: BuilderNode,
  _nodes: BuilderNode[],
  edges: BuilderEdge[],
): NextNodeOption[] {
  if (procNode.type !== 'process') return [];
  const hasOutput = edges.some(
    (e) => e.source === procNode.id && e.data?.kind === 'produces',
  );
  if (hasOutput) return [];
  return [
    {
      id: 'new:output-state',
      label: 'Output state',
      kind: 'state',
      weight: 1,
    },
  ];
}

let nextId = 1;
export function freshId(prefix: string): string {
  return `${prefix}_${nextId++}`;
}

export function resetIdCounter(): void {
  nextId = 1;
}
