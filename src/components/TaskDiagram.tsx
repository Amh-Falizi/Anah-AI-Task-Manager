import React, { useMemo } from 'react';
import { ReactFlow, MiniMap, Controls, Background, useNodesState, useEdgesState, MarkerType } from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import dagre from 'dagre';
import { Task } from '../types';

interface TaskDiagramProps {
  tasks: Task[];
}

const nodeWidth = 200;
const nodeHeight = 80;

const getLayoutedElements = (nodes: any[], edges: any[], direction = 'TB') => {
  const dagreGraph = new dagre.graphlib.Graph();
  dagreGraph.setDefaultEdgeLabel(() => ({}));

  dagreGraph.setGraph({ rankdir: direction });

  nodes.forEach((node) => {
    dagreGraph.setNode(node.id, { width: nodeWidth, height: nodeHeight });
  });

  edges.forEach((edge) => {
    dagreGraph.setEdge(edge.source, edge.target);
  });

  dagre.layout(dagreGraph);

  nodes.forEach((node) => {
    const nodeWithPosition = dagreGraph.node(node.id);
    node.targetPosition = direction === 'TB' ? 'top' : 'left';
    node.sourcePosition = direction === 'TB' ? 'bottom' : 'right';

    // We are shifting the dagre node position (anchor=center center) to the top left
    // so it matches the React Flow node anchor point (top left).
    node.position = {
      x: nodeWithPosition.x - nodeWidth / 2,
      y: nodeWithPosition.y - nodeHeight / 2,
    };

    return node;
  });

  return { nodes, edges };
};

export default function TaskDiagram({ tasks }: TaskDiagramProps) {
  const { initialNodes, initialEdges } = useMemo(() => {
    const nodes = tasks.map((task) => {
      let bgColor = '#1a1d23';
      if (task.status === 'done') bgColor = '#0f1115';
      
      const borderColor = task.status === 'done' ? '#10b981' : task.status === 'in_progress' ? '#3b82f6' : task.status === 'review' ? '#eab308' : '#2d3139';

      return {
        id: task.id,
        data: {
          label: (
            <div className="flex flex-col text-left">
               <div className="text-xs font-bold text-white truncate">{task.title}</div>
               <div className="text-[9px] uppercase tracking-wider text-slate-400 font-bold mt-1 max-w-[170px] truncate">STATUS: {task.status.replace('_', ' ')}</div>
            </div>
          )
        },
        position: { x: 0, y: 0 },
        style: {
          background: bgColor,
          border: `1px solid ${borderColor}`,
          borderRadius: '4px',
          padding: '10px',
          width: nodeWidth,
        }
      };
    });

    const edges: any[] = [];
    tasks.forEach(task => {
      if (task.dependencies) {
        task.dependencies.forEach(depId => {
          edges.push({
            id: `e-${depId}-${task.id}`,
            source: depId,
            target: task.id,
            markerEnd: {
              type: MarkerType.ArrowClosed,
              color: '#475569',
            },
            style: {
              stroke: '#475569',
              strokeWidth: 2,
            },
            animated: task.status === 'in_progress'
          });
        });
      }
      
      // Also draw subtask relationships
      if (task.parentId) {
         edges.push({
             id: `e-parent-${task.parentId}-${task.id}`,
             source: task.parentId,
             target: task.id,
             label: 'subtask',
             labelStyle: { fill: '#64748b', fontSize: 10, fontWeight: 700 },
             labelBgStyle: { fill: '#0a0c10' },
             markerEnd: {
               type: MarkerType.ArrowClosed,
               color: '#64748b',
             },
             style: {
               stroke: '#64748b',
               strokeWidth: 1,
               strokeDasharray: '3 3',
             }
         });
      }
    });

    return getLayoutedElements(nodes, edges);
  }, [tasks]);

  const [nodes, _, onNodesChange] = useNodesState(initialNodes);
  const [edges, __, onEdgesChange] = useEdgesState(initialEdges);

  return (
    <div className="w-full h-full bg-[#0a0c10]">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        fitView
        colorMode="dark"
      >
        <Background gap={12} size={1} />
        <Controls />
        <MiniMap zoomable pannable nodeColor="#2d3139" maskColor="rgba(10, 12, 16, 0.7)" />
      </ReactFlow>
    </div>
  );
}
