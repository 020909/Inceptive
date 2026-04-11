declare module "@xyflow/react" {
  import * as React from "react";

  export type Position = "left" | "right" | "top" | "bottom";
  export const Position: {
    Left: Position;
    Right: Position;
    Top: Position;
    Bottom: Position;
  };

  export type Node<T = any> = {
    id: string;
    type?: string;
    position: { x: number; y: number };
    data: T;
    draggable?: boolean;
    selected?: boolean;
  };

  export type Edge = {
    id: string;
    source: string;
    target: string;
    type?: string;
    animated?: boolean;
    label?: string;
    style?: Record<string, unknown>;
    labelStyle?: Record<string, unknown>;
    labelBgStyle?: Record<string, unknown>;
    labelBgPadding?: [number, number];
    labelBgBorderRadius?: number;
  };

  export type Connection = {
    source: string | null;
    target: string | null;
  };

  export type NodeProps<T = any> = {
    id: string;
    data: T;
    selected?: boolean;
  };

  export type NodeTypes = Record<string, React.ComponentType<any>>;

  export function addEdge(edge: Edge | Connection, edges: Edge[]): Edge[];
  export function useNodesState<T = any>(
    initialNodes: Node<T>[]
  ): [Node<T>[], React.Dispatch<React.SetStateAction<Node<T>[]>>, (changes: any[]) => void];
  export function useEdgesState(
    initialEdges: Edge[]
  ): [Edge[], React.Dispatch<React.SetStateAction<Edge[]>>, (changes: any[]) => void];

  export const ReactFlowProvider: React.ComponentType<{ children: React.ReactNode }>;
  export const ReactFlow: React.ComponentType<any>;
  export const Background: React.ComponentType<any>;
  export const Controls: React.ComponentType<any>;
  export const MiniMap: React.ComponentType<any>;
  export const Handle: React.ComponentType<any>;
}
