import type { EngineGraph } from '../lib/types.ts';

export function recipeGraph(recipe: unknown): EngineGraph;
export const CATALOG: Record<string, { name?: string; [key: string]: unknown }>;
export function prepClassOf(leaf: string): string;
export function offeredForms(leaf: string): string[];
export function transitionsFor(leaf: string): { rows: Array<{ t: string; ok: boolean }> };
export function exportRecipe(recipe: unknown): unknown;
export function topoSteps(graph: EngineGraph): unknown[];
export const PREP_CLASS: Record<string, unknown>;
