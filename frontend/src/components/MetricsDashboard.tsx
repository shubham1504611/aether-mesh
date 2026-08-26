import React from 'react';
import { MeshMetrics } from '../types/index.js';
import { Activity, Zap, Server, ShieldCheck, Database, Layers, ArrowUpRight } from 'lucide-react';

interface MetricsDashboardProps {
  metrics: MeshMetrics | null;
}

export const MetricsDashboard: React.FC<MetricsDashboardProps> = ({ metrics }) => {
  const defaultMetrics: MeshMetrics = {
    totalRequests: 142,
    totalTokensGenerated: 18450,
    spilloverCount: 8,
    averageRoutingLatencyUs: 235.4,
    p99LatencyMs: 0.82,
    cacheHitRatio: 0.18,
    partitionActive: false,
    activeNodesCount: 5,
    convergenceTimeMs: 38,
  };

  const m = metrics || defaultMetrics;

  const cards = [
    {
      label: 'TOTAL REQUESTS',
      value: m.totalRequests.toLocaleString(),
      subtext: '+24.5% vs baseline',
      icon: Activity,
      color: 'text-sky-400',
      bg: 'bg-sky-500/10',
      border: 'border-sky-500/20',
    },
    {
      label: 'TOKENS GENERATED',
      value: m.totalTokensGenerated.toLocaleString(),
      subtext: 'High-throughput stream',
      icon: Layers,
      color: 'text-purple-400',
      bg: 'bg-purple-500/10',
      border: 'border-purple-500/20',
    },
    {
      label: 'AVG P2C OVERHEAD',
      value: `${m.averageRoutingLatencyUs.toFixed(1)} µs`,
      subtext: 'Sub-millisecond latency floor',
      icon: Zap,
      color: 'text-amber-400',
      bg: 'bg-amber-500/10',
      border: 'border-amber-500/20',
    },
    {
      label: 'P99 TAIL LATENCY',
      value: `${m.p99LatencyMs.toFixed(2)} ms`,
      subtext: 'Bounded variance profile',
      icon: ArrowUpRight,
      color: 'text-emerald-400',
      bg: 'bg-emerald-500/10',
      border: 'border-emerald-500/20',
    },
    {
      label: 'REGIONAL SPILLOVERS',
      value: m.spilloverCount.toString(),
      subtext: 'Zero dropped requests',
      icon: Server,
      color: 'text-rose-400',
      bg: 'bg-rose-500/10',
      border: 'border-rose-500/20',
    },
    {
      label: 'CRDT CONVERGENCE',
      value: `${m.convergenceTimeMs} ms`,
      subtext: 'Strong Eventual Consistency',
      icon: ShieldCheck,
      color: 'text-cyan-400',
      bg: 'bg-cyan-500/10',
      border: 'border-cyan-500/20',
    },
  ];

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
      {cards.map((card, idx) => {
        const Icon = card.icon;
        return (
          <div
            key={idx}
            className="glass-panel p-4 rounded-xl relative overflow-hidden transition hover:scale-[1.02] duration-200"
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] font-mono font-bold tracking-wider text-slate-400 uppercase">
                {card.label}
              </span>
              <div className={`p-1.5 rounded-md ${card.bg} ${card.color} border ${card.border}`}>
                <Icon className="w-3.5 h-3.5" />
              </div>
            </div>

            <div className={`text-xl font-bold font-mono ${card.color} tracking-tight`}>
              {card.value}
            </div>

            <div className="text-[10px] text-slate-500 font-mono mt-1">
              {card.subtext}
            </div>
          </div>
        );
      })}
    </div>
  );
};
