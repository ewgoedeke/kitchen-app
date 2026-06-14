import type { Node, Edge } from '@xyflow/react';

export type StateData = {
  engineId: string;
  kind: string;
  label: string;
  leaf?: string;
  form?: string;
  stageId?: string;
  ingredientKey?: string;
};

export type ProcessData = {
  engineId: string;
  trans: string;
  title: string;
  dur?: number;
  method?: string;
  isStageCook?: boolean;
  isPlateCook?: boolean;
  stageId?: string;
  stageName?: string;
};

export type StateNode = Node<StateData, 'state'>;
export type ProcessNode = Node<ProcessData, 'process'>;
export type BuilderNode = StateNode | ProcessNode;

export type BuilderEdge = Edge & {
  data?: { kind: 'consumes' | 'produces' };
};

export type EngineState = {
  kind: string;
  keep: number;
  leaf?: string;
  form?: string;
  name?: string;
  stage?: string;
};

export type EngineProc = {
  id: string;
  title: string;
  trans: string;
  consumes: string[];
  produces: string[];
  dur?: number;
  active?: number;
  method?: string;
};

export type EngineGraph = {
  states: Record<string, EngineState>;
  procs: EngineProc[];
};

export type RecipeIngredient = {
  k: string;
  qty: number;
  u: string;
  form?: string;
  peel?: boolean;
};

export type RecipeStage = {
  id: string;
  name: string;
  method?: string;
  cookMin?: number;
  consumes: string[];
};

export type GraphRecipe = {
  id: string;
  name: string;
  keep: number;
  method?: string;
  cookMin?: number;
  kind: 'graph' | 'simple';
  ingredients: RecipeIngredient[];
  stages?: RecipeStage[];
};

export type RecipesFile = {
  schema: string;
  version: number;
  library: Record<string, GraphRecipe>;
  plan: Array<{ recipeId: string; day: number }>;
};
