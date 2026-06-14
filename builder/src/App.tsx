import {
  Background,
  Controls,
  MiniMap,
  ReactFlow,
  ReactFlowProvider,
  addEdge,
  useEdgesState,
  useNodesState,
  type Connection,
  type IsValidConnection,
  type NodeChange,
  type OnConnectEnd,
  type ReactFlowInstance,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import recipesData from '@data/recipes.json';
import { LinkDragMenu } from './components/LinkDragMenu.tsx';
import { recipeGraph } from './engine/index.ts';
import { useMeasuredLayout } from './hooks/useAutoLayout.ts';
import { createNodesFromOption } from './lib/addNode.ts';
import { graphToFlow } from './lib/graphToFlow.ts';
import { graphToRecipe } from './lib/graphToRecipe.ts';
import type { BuilderEdge, BuilderNode, GraphRecipe, RecipesFile } from './lib/types.ts';
import {
  isValidConnection,
  resetIdCounter,
  validNextFromProcess,
  validNextFromState,
  type NextNodeOption,
} from './lib/validation.ts';
import { nodeTypes } from './nodes/index.ts';
import './styles/tokens.css';

const recipes = recipesData as RecipesFile;

type MenuState = {
  x: number;
  y: number;
  flowX: number;
  flowY: number;
  anchorId: string;
  anchorType: 'state' | 'process';
  handleType: 'source' | 'target';
  options: NextNodeOption[];
};

function BuilderCanvas() {
  const [recipeId, setRecipeId] = useState('bolognese');
  const [nodes, setNodes, onNodesChange] = useNodesState<BuilderNode>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<BuilderEdge>([]);
  const [menu, setMenu] = useState<MenuState | null>(null);
  const [status, setStatus] = useState('');
  const rfRef = useRef<ReactFlowInstance<BuilderNode, BuilderEdge> | null>(null);
  const runLayout = useMeasuredLayout();

  const recipe = useMemo(
    () => recipes.library[recipeId] as GraphRecipe,
    [recipeId],
  );

  const loadRecipe = useCallback(
    (r: GraphRecipe) => {
      resetIdCounter();
      const graph = recipeGraph(r);
      const { nodes: n, edges: e } = graphToFlow(graph, r);
      setNodes(n);
      setEdges(e);
      requestAnimationFrame(() => runLayout());
    },
    [setNodes, setEdges, runLayout],
  );

  useEffect(() => {
    loadRecipe(recipe);
  }, [recipe, loadRecipe]);

  const checkValid = useCallback<IsValidConnection<BuilderEdge>>(
    (conn) => isValidConnection(conn as Connection, nodes),
    [nodes],
  );

  const onConnect = useCallback(
    (conn: Connection) => {
      if (!checkValid(conn)) return;
      const source = nodes.find((n) => n.id === conn.source);
      const target = nodes.find((n) => n.id === conn.target);
      const kind =
        source?.type === 'state' && target?.type === 'process'
          ? 'consumes'
          : 'produces';
      setEdges((eds) =>
        addEdge({ ...conn, type: 'smoothstep', data: { kind } }, eds),
      );
      requestAnimationFrame(() => runLayout());
    },
    [nodes, setEdges, checkValid, runLayout],
  );

  const onConnectEnd: OnConnectEnd = useCallback(
    (event, connectionState) => {
      if (connectionState.isValid || !connectionState.fromNode) return;
      const fromNode = connectionState.fromNode as unknown as BuilderNode;
      const handleType = connectionState.fromHandle?.type === 'target' ? 'target' : 'source';
      const anchorType = fromNode.type as 'state' | 'process';

      let options: NextNodeOption[] = [];
      if (anchorType === 'state' && handleType === 'source') {
        options = validNextFromState(fromNode, nodes, edges);
      } else if (anchorType === 'process' && handleType === 'source') {
        options = validNextFromProcess(fromNode, nodes, edges);
      } else {
        return;
      }
      if (!options.length) return;

      const clientX = 'clientX' in event ? event.clientX : 0;
      const clientY = 'clientY' in event ? event.clientY : 0;
      const flowPos = rfRef.current?.screenToFlowPosition({ x: clientX, y: clientY }) ?? {
        x: 0,
        y: 0,
      };

      setMenu({
        x: clientX,
        y: clientY,
        flowX: flowPos.x,
        flowY: flowPos.y,
        anchorId: fromNode.id,
        anchorType,
        handleType,
        options,
      });
    },
    [nodes, edges],
  );

  const handleMenuPick = useCallback(
    (option: NextNodeOption) => {
      if (!menu) return;
      const { nodes: newNodes, edges: newEdges } = createNodesFromOption(
        {
          anchorId: menu.anchorId,
          anchorType: menu.anchorType,
          handleType: menu.handleType,
          trans: option.trans,
          flowPos: { x: menu.flowX, y: menu.flowY },
        },
        option,
      );
      setNodes((ns) => [...ns, ...newNodes]);
      setEdges((es) => [...es, ...newEdges]);
      setMenu(null);
      requestAnimationFrame(() => runLayout());
    },
    [menu, setNodes, setEdges, runLayout],
  );

  const selectedNode = nodes.find((n) => n.selected);

  const openAddNext = useCallback(() => {
    if (!selectedNode) return;
    const anchorType = selectedNode.type as 'state' | 'process';
    const options =
      anchorType === 'state'
        ? validNextFromState(selectedNode, nodes, edges)
        : validNextFromProcess(selectedNode, nodes, edges);
    if (!options.length) return;
    const rect = document.querySelector('.builder-canvas')?.getBoundingClientRect();
    setMenu({
      x: (rect?.left ?? 0) + 200,
      y: (rect?.top ?? 0) + 120,
      flowX: 200,
      flowY: 120,
      anchorId: selectedNode.id,
      anchorType,
      handleType: 'source',
      options,
    });
  }, [selectedNode, nodes, edges]);

  const handleSave = useCallback(async () => {
    const updated = graphToRecipe(nodes, edges, recipe);
    const payload: RecipesFile = {
      ...recipes,
      library: {
        ...recipes.library,
        [recipeId]: updated,
      },
    };
    try {
      const res = await fetch('/api/save-recipes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (res.ok) {
        setStatus('Saved to data/recipes.json');
        loadRecipe(updated);
      } else {
        setStatus('Save failed — use Export');
      }
    } catch {
      const blob = new Blob([JSON.stringify(payload, null, 1)], {
        type: 'application/json',
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'recipes.json';
      a.click();
      setStatus('Exported recipes.json');
    }
  }, [nodes, edges, recipe, recipeId, loadRecipe]);

  const handleNodesChange = useCallback(
    (changes: NodeChange<BuilderNode>[]) => {
      onNodesChange(changes);
      if (changes.some((c) => c.type === 'dimensions')) {
        requestAnimationFrame(() => runLayout());
      }
    },
    [onNodesChange, runLayout],
  );

  const recipeIds = Object.keys(recipes.library);

  return (
    <div className="builder-shell">
      <div className="builder-toolbar">
        <strong>Recipe Builder</strong>
        <select value={recipeId} onChange={(e) => setRecipeId(e.target.value)}>
          {recipeIds.map((id) => (
            <option key={id} value={id}>
              {recipes.library[id].name}
            </option>
          ))}
        </select>
        <button type="button" onClick={openAddNext} disabled={!selectedNode}>
          Add next
        </button>
        <button type="button" onClick={() => runLayout()}>
          Layout
        </button>
        <button type="button" className="primary" onClick={handleSave}>
          Save
        </button>
        {status && <span style={{ color: 'var(--muted)' }}>{status}</span>}
      </div>
      <div className="builder-canvas">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={handleNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          onConnectEnd={onConnectEnd}
          isValidConnection={checkValid}
          nodeTypes={nodeTypes}
          fitView
          onInit={(inst) => {
            rfRef.current = inst;
          }}
        >
          <Background gap={20} size={1} color="var(--line)" />
          <Controls showInteractive={false} />
          <MiniMap
            nodeColor={(n) => (n.type === 'state' ? '#e8e4dc' : '#d8d4cc')}
            maskColor="rgba(247,244,239,0.7)"
          />
        </ReactFlow>
        {menu && (
          <LinkDragMenu
            x={menu.x}
            y={menu.y}
            options={menu.options}
            onPick={handleMenuPick}
            onClose={() => setMenu(null)}
          />
        )}
      </div>
    </div>
  );
}

export default function App() {
  return (
    <ReactFlowProvider>
      <BuilderCanvas />
    </ReactFlowProvider>
  );
}
