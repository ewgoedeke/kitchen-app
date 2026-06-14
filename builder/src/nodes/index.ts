import type { NodeTypes } from '@xyflow/react';
import { ProcessNode } from './ProcessNode.tsx';
import { StateNode } from './StateNode.tsx';

export const nodeTypes: NodeTypes = {
  state: StateNode,
  process: ProcessNode,
};
