import { Handle, Position, type NodeProps } from '@xyflow/react';
import type { ProcessData } from '../lib/types.ts';

function shortTitle(title: string): string {
  const parts = title.split(' · ');
  if (parts.length >= 2 && parts[0] !== 'Plate' && parts[0] !== 'Cook & plate') {
    return parts.slice(0, 2).join(' · ');
  }
  return parts[0] || title;
}

export function ProcessNode({ data, selected }: NodeProps & { data: ProcessData }) {
  return (
    <div className={`process-node${selected ? ' selected' : ''}`}>
      <Handle type="target" position={Position.Left} id="in" />
      <div className="trans">{data.trans}</div>
      <div>{shortTitle(data.title)}</div>
      {data.dur != null && (
        <div style={{ color: 'var(--muted)', fontSize: 10 }}>{data.dur}m</div>
      )}
      <Handle type="source" position={Position.Right} id="out" />
    </div>
  );
}
