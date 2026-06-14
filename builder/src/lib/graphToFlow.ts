import type { BuilderEdge, BuilderNode, EngineGraph, GraphRecipe } from './types.ts';

function stateLabel(id: string, s: EngineGraph['states'][string]): string {
  if (s.name) return s.name;
  if (s.leaf) {
    const form = s.form && s.form !== 'whole' ? ` · ${s.form}` : '';
    return `${s.leaf}${form}`;
  }
  return id;
}

function parseStageCook(title: string): { stageName?: string; isPlate: boolean } {
  const parts = title.split(' · ');
  if (parts[0] === 'Plate') return { isPlate: true };
  if (parts.length >= 2) return { stageName: parts[0], isPlate: false };
  return { isPlate: false };
}

export function buildIngredientTerminus(
  recipe: GraphRecipe,
): Map<string, string> {
  const map = new Map<string, string>();
  for (const ing of recipe.ingredients) {
    const form = ing.form || 'whole';
    const key = ing.k;
    if (form === 'whole') {
      map.set(key, key);
      continue;
    }
    const candidates = [
      `${key}_${form}`,
      `${key}_tempered`,
      `${key}_peeled`,
      `${key}_cleaned`,
      `${key}_skinned`,
    ];
    map.set(key, candidates[0]);
  }
  return map;
}

export function resolveTerminus(
  recipe: GraphRecipe,
  graph: EngineGraph,
): Map<string, string> {
  const result = new Map<string, string>();
  const produced = new Set<string>();
  graph.procs.forEach((p) => p.produces.forEach((s) => produced.add(s)));

  for (const ing of recipe.ingredients) {
    const leafStates = Object.entries(graph.states).filter(
      ([, s]) => s.leaf === ing.k,
    );
    const terminal = leafStates
      .map(([id]) => id)
      .filter((id) => !graph.procs.some((p) => p.consumes.includes(id)))
      .sort((a, b) => b.length - a.length)[0];
    if (terminal) result.set(ing.k, terminal);
    else result.set(ing.k, ing.k);
  }
  return result;
}

export function graphToFlow(
  graph: EngineGraph,
  recipe: GraphRecipe,
): { nodes: BuilderNode[]; edges: BuilderEdge[] } {
  const terminus = resolveTerminus(recipe, graph);
  const stageStateToId = new Map<string, string>();
  for (const st of recipe.stages || []) {
    stageStateToId.set(`${recipe.id}__${st.id}`, st.id);
  }

  const nodes: BuilderNode[] = [];
  const edges: BuilderEdge[] = [];

  for (const [id, s] of Object.entries(graph.states)) {
    let ingredientKey: string | undefined;
    let stageId: string | undefined;

    if (id === recipe.id) {
      ingredientKey = undefined;
    } else if (stageStateToId.has(id)) {
      stageId = stageStateToId.get(id);
    } else if (s.leaf) {
      for (const [k, term] of terminus) {
        if (term === id || id.startsWith(s.leaf)) {
          if (terminus.get(k) === id) ingredientKey = k;
        }
      }
      if (!ingredientKey && terminus.has(s.leaf) && terminus.get(s.leaf) === id) {
        ingredientKey = s.leaf;
      }
    }

    nodes.push({
      id,
      type: 'state',
      position: { x: 0, y: 0 },
      data: {
        engineId: id,
        kind: s.kind,
        label: stateLabel(id, s),
        leaf: s.leaf,
        form: s.form,
        stageId,
        ingredientKey,
      },
    });
  }

  for (const p of graph.procs) {
    const stageInfo: { stageName?: string; isPlate: boolean } =
      p.trans === 'cook' ? parseStageCook(p.title) : { isPlate: false };
    const stageId =
      p.trans === 'cook' && !stageInfo.isPlate && stageInfo.stageName
        ? recipe.stages?.find((st) => st.name === stageInfo.stageName)?.id
        : undefined;

    nodes.push({
      id: p.id,
      type: 'process',
      position: { x: 0, y: 0 },
      data: {
        engineId: p.id,
        trans: p.trans,
        title: p.title,
        dur: p.dur,
        method: p.method,
        isStageCook: p.trans === 'cook' && !stageInfo.isPlate && !!stageId,
        isPlateCook: p.trans === 'cook' && !!stageInfo.isPlate,
        stageId,
        stageName: stageInfo.stageName,
      },
    });

    for (const c of p.consumes) {
      edges.push({
        id: `${c}->${p.id}`,
        source: c,
        target: p.id,
        type: 'smoothstep',
        data: { kind: 'consumes' },
      });
    }
    for (const o of p.produces) {
      edges.push({
        id: `${p.id}->${o}`,
        source: p.id,
        target: o,
        type: 'smoothstep',
        data: { kind: 'produces' },
      });
    }
  }

  return { nodes, edges };
}
