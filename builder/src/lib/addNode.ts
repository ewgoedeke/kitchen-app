import { CATALOG } from '../engine/index.ts';
import type { BuilderEdge, BuilderNode, ProcessData, StateData } from './types.ts';
import { freshId } from './validation.ts';

type AddContext = {
  anchorId: string;
  anchorType: 'state' | 'process';
  handleType: 'source' | 'target';
  trans?: string;
  flowPos: { x: number; y: number };
};

export function createNodesFromOption(
  ctx: AddContext,
  option: { kind: 'process' | 'state'; trans?: string; label: string },
): { nodes: BuilderNode[]; edges: BuilderEdge[] } {
  const nodes: BuilderNode[] = [];
  const edges: BuilderEdge[] = [];

  if (ctx.anchorType === 'state' && option.kind === 'process' && option.trans) {
    const procId = freshId('proc');
    const anchor = ctx.anchorId;
    const leaf = anchor.includes('_') ? anchor.split('_')[0] : anchor;
    const nm = CATALOG[leaf]?.name?.toLowerCase() || leaf;
    const trans = option.trans;

    const procData: ProcessData = {
      engineId: procId,
      trans,
      title:
        trans === 'cook'
          ? `Cook · ${nm}`
          : `${trans.charAt(0).toUpperCase() + trans.slice(1)} ${nm}`,
      dur: trans === 'cook' ? 10 : 2,
    };

    nodes.push({
      id: procId,
      type: 'process',
      position: ctx.flowPos,
      data: procData,
    });

    edges.push({
      id: `${anchor}->${procId}`,
      source: anchor,
      target: procId,
      type: 'smoothstep',
      data: { kind: 'consumes' },
    });

    if (trans !== 'cook' && trans !== 'temper' && trans !== 'cool') {
      const outId = freshId('state');
      const outData: StateData = {
        engineId: outId,
        kind: trans === 'cut' ? 'cut' : 'prep',
        label: `${leaf} · ${trans}`,
        leaf,
        form: trans === 'cut' ? 'diced' : trans,
      };
      nodes.push({
        id: outId,
        type: 'state',
        position: { x: ctx.flowPos.x + 180, y: ctx.flowPos.y },
        data: outData,
      });
      edges.push({
        id: `${procId}->${outId}`,
        source: procId,
        target: outId,
        type: 'smoothstep',
        data: { kind: 'produces' },
      });
    }
  }

  if (ctx.anchorType === 'process' && option.kind === 'state') {
    const outId = freshId('state');
    const procId = ctx.anchorId;
    const outData: StateData = {
      engineId: outId,
      kind: 'prep',
      label: 'New state',
    };
    nodes.push({
      id: outId,
      type: 'state',
      position: ctx.flowPos,
      data: outData,
    });
    edges.push({
      id: `${procId}->${outId}`,
      source: procId,
      target: outId,
      type: 'smoothstep',
      data: { kind: 'produces' },
    });
  }

  return { nodes, edges };
}
