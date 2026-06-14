import { Handle, Position, type NodeProps } from '@xyflow/react';
import type { StateData } from '../lib/types.ts';

export function StateNode({ data, selected }: NodeProps & { data: StateData }) {
  return (
    <div className={`state-node${selected ? ' selected' : ''}`}>
      <Handle type="target" position={Position.Left} id="in" />
      <span>{data.label}</span>
      <Handle type="source" position={Position.Right} id="out" />
    </div>
  );
}
