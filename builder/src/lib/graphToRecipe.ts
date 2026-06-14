import type {
  BuilderEdge,
  BuilderNode,
  GraphRecipe,
  ProcessData,
  RecipeStage,
  StateData,
} from './types.ts';

function stateById(nodes: BuilderNode[]): Map<string, BuilderNode> {
  return new Map(nodes.map((n) => [n.id, n]));
}

function incomingStates(
  procId: string,
  edges: BuilderEdge[],
  nodes: Map<string, BuilderNode>,
): StateData[] {
  return edges
    .filter((e) => e.target === procId && e.data?.kind === 'consumes')
    .map((e) => nodes.get(e.source))
    .filter((n): n is BuilderNode & { type: 'state' } => n?.type === 'state')
    .map((n) => n.data);
}

function consumesToken(state: StateData, recipeId: string): string | null {
  if (state.stageId) return state.stageId;
  if (state.ingredientKey) return state.ingredientKey;
  if (state.engineId === recipeId) return null;
  const m = state.engineId.match(new RegExp(`^${recipeId}__(.+)$`));
  if (m) return m[1];
  if (state.leaf) return state.leaf;
  return null;
}

export function graphToRecipe(
  nodes: BuilderNode[],
  edges: BuilderEdge[],
  base: GraphRecipe,
): GraphRecipe {
  const nodeMap = stateById(nodes);
  const stageProcs = nodes
    .filter((n): n is BuilderNode & { type: 'process' } => n.type === 'process')
    .map((n) => n as BuilderNode & { data: ProcessData })
    .filter((n) => n.data.isStageCook && n.data.stageId)
    .sort((a, b) => {
      const ai = (base.stages || []).findIndex((s) => s.id === a.data.stageId);
      const bi = (base.stages || []).findIndex((s) => s.id === b.data.stageId);
      return ai - bi;
    });

  const stages: RecipeStage[] = stageProcs.map((proc) => {
    const inputs = incomingStates(proc.id, edges, nodeMap);
    const consumes = inputs
      .map((s) => consumesToken(s, base.id))
      .filter((t): t is string => t != null);
    const existing = (base.stages || []).find((s) => s.id === proc.data.stageId);
    return {
      id: proc.data.stageId!,
      name: proc.data.stageName || existing?.name || proc.data.stageId!,
      method: proc.data.method || existing?.method || base.method || 'fat',
      cookMin: proc.data.dur ?? existing?.cookMin ?? 0,
      consumes,
    };
  });

  return {
    ...base,
    kind: 'graph',
    stages: stages.length ? stages : base.stages,
    ingredients: base.ingredients,
  };
}

export type TopologySnapshot = {
  stateIds: string[];
  procIds: string[];
  edges: Array<{ source: string; target: string; kind: string }>;
  stages: RecipeStage[];
};

export function topologySnapshot(
  nodes: BuilderNode[],
  edges: BuilderEdge[],
  recipe: GraphRecipe,
): TopologySnapshot {
  const saved = graphToRecipe(nodes, edges, recipe);
  return {
    stateIds: nodes.filter((n) => n.type === 'state').map((n) => n.id).sort(),
    procIds: nodes.filter((n) => n.type === 'process').map((n) => n.id).sort(),
    edges: edges
      .map((e) => ({
        source: e.source,
        target: e.target,
        kind: e.data?.kind || 'consumes',
      }))
      .sort((a, b) => a.source.localeCompare(b.source) || a.target.localeCompare(b.target)),
    stages: saved.stages || [],
  };
}

export function topologyEqual(a: TopologySnapshot, b: TopologySnapshot): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}
