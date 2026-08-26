import React from 'react';
import { EdgeNode, PewmaState } from '../types/index.js';
import { Globe, Server, Activity, Zap, AlertTriangle, ShieldCheck } from 'lucide-react';

interface TopologyMeshProps {
  nodes: EdgeNode[];
  pewmaStates: Record<string, PewmaState>;
  selectedNodeId: string | null;
  onSelectNode: (nodeId: string) => void;
  activePacket?: { from: string; to: string } | null;
}

interface NodeCoords {
  x: number;
  y: number;
  label: string;
}

const REGION_COORDS: Record<string, NodeCoords> = {
  'node-us-east': { x: 230, y: 150, label: 'US-East (Virginia)' },
  'node-us-west': { x: 130, y: 140, label: 'US-West (Oregon)' },
  'node-eu-west': { x: 440, y: 110, label: 'EU-West (Frankfurt)' },
  'node-ap-south': { x: 620, y: 190, label: 'AP-South (Mumbai)' },
  'node-sa-east': { x: 290, y: 310, label: 'SA-East (São Paulo)' },
};

export const TopologyMesh: React.FC<TopologyMeshProps> = ({
  nodes,
  pewmaStates,
  selectedNodeId,
  onSelectNode,
  activePacket,
}) => {
  const nodeMap = new Map(nodes.map(n => [n.id, n]));

  // Mesh connection pairs for topology links
  const links: [string, string][] = [
    ['node-us-west', 'node-us-east'],
    ['node-us-east', 'node-eu-west'],
    ['node-eu-west', 'node-ap-south'],
    ['node-us-east', 'node-sa-east'],
    ['node-eu-west', 'node-sa-east'],
    ['node-us-west', 'node-ap-south'],
  ];

  return (
    <div className="glass-panel rounded-2xl p-6 relative overflow-hidden">
      <div className="flex items-center justify-between mb-4 border-b border-slate-800 pb-3">
        <div className="flex items-center space-x-3">
          <div className="p-2 bg-sky-500/10 rounded-lg text-sky-400 border border-sky-500/20">
            <Globe className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-white tracking-wide flex items-center gap-2">
              GLOBAL MESH TOPOLOGY
              <span className="text-xs font-mono font-normal px-2 py-0.5 bg-sky-950 text-sky-400 border border-sky-800 rounded-full">
                HyParView Gossip Active
              </span>
            </h2>
            <p className="text-xs text-slate-400">
              Sub-millisecond P2C dispatch across 5 geo-distributed autonomous edge clusters
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-4 text-xs font-mono">
          <div className="flex items-center space-x-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 shadow-[0_0_8px_#34d399]"></span>
            <span className="text-slate-300">Healthy</span>
          </div>
          <div className="flex items-center space-x-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-amber-400 shadow-[0_0_8px_#fbbf24]"></span>
            <span className="text-slate-300">Degraded</span>
          </div>
          <div className="flex items-center space-x-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-rose-400 shadow-[0_0_8px_#f87171]"></span>
            <span className="text-slate-300">Partitioned</span>
          </div>
        </div>
      </div>

      {/* SVG Canvas Mesh Visualizer */}
      <div className="relative w-full h-80 bg-slate-950/80 rounded-xl border border-slate-800/80 overflow-hidden flex items-center justify-center">
        <div className="absolute inset-0 mesh-grid-bg opacity-30"></div>

        <svg className="w-full h-full" viewBox="0 0 760 380">
          <defs>
            <linearGradient id="linkGrad" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#38bdf8" stopOpacity="0.4" />
              <stop offset="100%" stopColor="#818cf8" stopOpacity="0.1" />
            </linearGradient>
            <linearGradient id="isolatedGrad" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#f43f5e" stopOpacity="0.3" />
              <stop offset="100%" stopColor="#f43f5e" stopOpacity="0.05" />
            </linearGradient>
          </defs>

          {/* Links */}
          {links.map(([idA, idB], i) => {
            const coordA = REGION_COORDS[idA];
            const coordB = REGION_COORDS[idB];
            const nodeA = nodeMap.get(idA);
            const nodeB = nodeMap.get(idB);
            const isIsolated = nodeA?.status === 'isolated' || nodeB?.status === 'isolated';

            return (
              <line
                key={i}
                x1={coordA.x}
                y1={coordA.y}
                x2={coordB.x}
                y2={coordB.y}
                stroke={isIsolated ? '#f43f5e' : '#38bdf8'}
                strokeWidth={isIsolated ? 1.5 : 2}
                strokeDasharray={isIsolated ? '4 4' : undefined}
                strokeOpacity={isIsolated ? 0.3 : 0.35}
              />
            );
          })}

          {/* Nodes */}
          {nodes.map(node => {
            const coords = REGION_COORDS[node.id];
            if (!coords) return null;

            const isSelected = selectedNodeId === node.id;
            const pewmaState = pewmaStates[node.id];

            let strokeColor = '#10b981';
            let fillColor = 'rgba(16, 185, 129, 0.15)';
            if (node.status === 'degraded') {
              strokeColor = '#f59e0b';
              fillColor = 'rgba(245, 158, 11, 0.15)';
            } else if (node.status === 'isolated') {
              strokeColor = '#f43f5e';
              fillColor = 'rgba(244, 63, 94, 0.15)';
            }

            return (
              <g
                key={node.id}
                className="cursor-pointer transition-transform duration-200 hover:scale-105"
                onClick={() => onSelectNode(node.id)}
              >
                {/* Ping wave for healthy nodes */}
                {node.status === 'healthy' && (
                  <circle
                    cx={coords.x}
                    cy={coords.y}
                    r={isSelected ? 26 : 20}
                    fill="none"
                    stroke={strokeColor}
                    strokeWidth="1"
                    opacity="0.3"
                    className="animate-ping"
                  />
                )}

                {/* Node Outer Ring */}
                <circle
                  cx={coords.x}
                  cy={coords.y}
                  r={isSelected ? 22 : 17}
                  fill={fillColor}
                  stroke={isSelected ? '#38bdf8' : strokeColor}
                  strokeWidth={isSelected ? 3 : 2}
                />

                {/* Node Inner Core */}
                <circle
                  cx={coords.x}
                  cy={coords.y}
                  r={isSelected ? 8 : 6}
                  fill={strokeColor}
                />

                {/* Node Label */}
                <text
                  x={coords.x}
                  y={coords.y + 32}
                  textAnchor="middle"
                  fill="#94a3b8"
                  fontSize="10"
                  fontFamily="JetBrains Mono"
                  fontWeight="600"
                >
                  {coords.label.split(' ')[0]}
                </text>

                {/* Latency badge */}
                <text
                  x={coords.x}
                  y={coords.y + 45}
                  textAnchor="middle"
                  fill={strokeColor}
                  fontSize="10"
                  fontFamily="JetBrains Mono"
                  fontWeight="bold"
                >
                  {node.pewmaLatencyMs.toFixed(1)} ms
                </text>
              </g>
            );
          })}
        </svg>
      </div>

      {/* Cluster Node Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mt-4">
        {nodes.map(node => {
          const isSelected = selectedNodeId === node.id;
          const pewma = pewmaStates[node.id];

          return (
            <div
              key={node.id}
              onClick={() => onSelectNode(node.id)}
              className={`p-3 rounded-xl cursor-pointer border transition-all duration-200 ${
                isSelected
                  ? 'bg-sky-950/40 border-sky-500 shadow-[0_0_15px_rgba(56,189,248,0.2)]'
                  : 'bg-slate-900/60 border-slate-800 hover:border-slate-700'
              }`}
            >
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-mono font-bold text-slate-200">{node.region}</span>
                <span
                  className={`w-2 h-2 rounded-full ${
                    node.status === 'healthy'
                      ? 'bg-emerald-400'
                      : node.status === 'degraded'
                      ? 'bg-amber-400'
                      : 'bg-rose-400'
                  }`}
                />
              </div>

              <div className="text-[11px] text-slate-400 truncate mb-2">{node.name}</div>

              <div className="space-y-1 text-[11px] font-mono">
                <div className="flex justify-between">
                  <span className="text-slate-500">PEWMA:</span>
                  <span className="text-sky-300 font-semibold">{node.pewmaLatencyMs.toFixed(1)}ms</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Queue:</span>
                  <span className="text-slate-300">{node.currentQueueDepth} req</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">α-Adapt:</span>
                  <span className="text-emerald-400">{pewma?.alpha?.toFixed(3) || '0.250'}</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
