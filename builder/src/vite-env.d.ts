/// <reference types="vite/client" />

declare module '@data/recipes.json' {
  import type { RecipesFile } from './lib/types.ts';
  const data: RecipesFile;
  export default data;
}
