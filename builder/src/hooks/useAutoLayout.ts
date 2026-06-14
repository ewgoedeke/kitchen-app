import dagre from '@dagrejs/dagre';
import { useReactFlow } from '@xyflow/react';
import { useCallback } from 'react';

const DEFAULT_W = 140;
const DEFAULT_H = 44;

export function useAutoLayout() {
  const { getNodes, getEdges, setNodes, getInternalNode } = useReactFlow();

  const runLayout = useCallback(() => {
    const nodes = getNodes();
    const edges = getEdges();
    if (!nodes.length) return;

    const g = new dagre.graphlib.Graph();
    g.setDefaultEdgeLabel(() => ({}));
    g.setGraph({ rankdir: 'LR', nodesep: 48, ranksep: 72, marginx: 24, marginy: 24 });

    for (const node of nodes) {
      const internal = getInternalNode(node.id);
      const w = internal?.measured?.width ?? DEFAULT_W;
      const h = internal?.measured?.height ?? DEFAULT_H;
      g.setNode(node.id, { width: w, height: h });
    }

    for (const edge of edges) {
      g.setEdge(edge.source, edge.target);
    }

    dagre.layout(g);

    setNodes(
      nodes.map((node) => {
        const pos = g.node(node.id);
        const internal = getInternalNode(node.id);
        const w = internal?.measured?.width ?? DEFAULT_W;
        const h = internal?.measured?.height ?? DEFAULT_H;
        return {
          ...node,
          position: {
            x: pos.x - w / 2,
            y: pos.y - h / 2,
          },
        };
      }),
    );
  }, [getNodes, getEdges, setNodes, getInternalNode]);

  return runLayout;
}

export function useMeasuredLayout() {
  const runLayout = useAutoLayout();
  const { getNodes, getInternalNode } = useReactFlow();

  const runTwoPass = useCallback(() => {
    requestAnimationFrame(() => {
      const nodes = getNodes();
      const allMeasured = nodes.every((n) => {
        const internal = getInternalNode(n.id);
        return (internal?.measured?.width ?? 0) > 0;
      });
      runLayout();
      if (!allMeasured) {
        requestAnimationFrame(() => runLayout());
      }
    });
  }, [runLayout, getNodes, getInternalNode]);

  return runTwoPass;
}
