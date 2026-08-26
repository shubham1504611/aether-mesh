import React, { useState, useEffect } from 'react';
import { AgentSessionState, EdgeNode } from '../types/index.js';
import { Database, Lock, Unlock, Plus, RefreshCw, Layers, ShieldCheck } from 'lucide-react';

interface CrdtStateInspectorProps {
  nodes: EdgeNode[];
  onMutateCrdt: (nodeId: string, action: string, payload: any) => Promise<void>;
  crdtSession: AgentSessionState | null;
  onRefresh: () => void;
}

export const CrdtStateInspector: React.FC<CrdtStateInspectorProps> = ({
  nodes,
  onMutateCrdt,
  crdtSession,
  onRefresh,
}) => {
  const [selectedReplicaNodeId, setSelectedReplicaNodeId] = useState('node-us-east');
  const [newContextMsg, setNewContextMsg] = useState('');
  const [toolName, setToolName] = useState('webSearch');
  const [isMutating, setIsMutating] = useState(false);

  const handleAppendContext = async () => {
    if (!newContextMsg.trim()) return;
    setIsMutating(true);
    await onMutateCrdt(selectedReplicaNodeId, 'APPEND_CONTEXT', { message: newContextMsg });
    setNewContextMsg('');
    setIsMutating(false);
  };

  const handleAcquireLock = async () => {
    setIsMutating(true);
    await onMutateCrdt(selectedReplicaNodeId, 'LOCK_TOOL', { toolName });
    setIsMutating(false);
  };

  const handleReleaseLock = async () => {
    setIsMutating(true);
    await onMutateCrdt(selectedReplicaNodeId, 'RELEASE_TOOL', { toolName });
    setIsMutating(false);
  };

  const handleIncrementTokens = async () => {
    setIsMutating(true);
    await onMutateCrdt(selectedReplicaNodeId, 'INCREMENT_TOKENS', { tokens: 120, steps: 1 });
    setIsMutating(false);
  };

  return (
    <div className="glass-panel rounded-2xl p-6 relative">
      <div className="flex items-center justify-between mb-4 border-b border-slate-800 pb-3">
        <div className="flex items-center space-x-3">
          <div className="p-2 bg-emerald-500/10 rounded-lg text-emerald-400 border border-emerald-500/20">
            <Database className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-white tracking-wide flex items-center gap-2">
              DELTA-CRDT AGENT MEMORY SYNC
              <span className="text-xs font-mono font-normal px-2 py-0.5 bg-emerald-950 text-emerald-400 border border-emerald-800 rounded-full flex items-center gap-1">
                <ShieldCheck className="w-3 h-3" /> Strong Eventual Consistency (SEC)
              </span>
            </h2>
            <p className="text-xs text-slate-400">
              State-based semi-lattice joins ($\sqcup$) ensuring zero split-brain data loss across partitions
            </p>
          </div>
        </div>

        <button
          onClick={onRefresh}
          className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg transition"
          title="Refresh CRDT State"
        >
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      {/* Target Regional Replica Selector */}
      <div className="mb-4">
        <label className="text-xs font-semibold text-slate-300 block mb-2">
          Select Regional Replica to Inspect / Mutate:
        </label>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
          {nodes.map(node => (
            <button
              key={node.id}
              onClick={() => setSelectedReplicaNodeId(node.id)}
              className={`px-3 py-2 rounded-lg text-xs font-mono border text-left transition ${
                selectedReplicaNodeId === node.id
                  ? 'bg-emerald-950/50 border-emerald-500 text-emerald-300 font-bold shadow-[0_0_10px_rgba(16,185,129,0.2)]'
                  : 'bg-slate-900/60 border-slate-800 text-slate-400 hover:border-slate-700'
              }`}
            >
              <div className="truncate">{node.name.split(' ')[0]}</div>
              <div className="text-[10px] text-slate-500">{node.region}</div>
            </button>
          ))}
        </div>
      </div>

      {/* Interactive Mutation Controls */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-6 p-3 bg-slate-950/60 rounded-xl border border-slate-800">
        {/* Append Context */}
        <div className="space-y-1.5">
          <label className="text-[11px] font-semibold text-slate-300">Append Context to CRDT History</label>
          <div className="flex gap-1.5">
            <input
              type="text"
              value={newContextMsg}
              onChange={(e) => setNewContextMsg(e.target.value)}
              placeholder="e.g. Agent computed token lock"
              className="flex-1 bg-slate-900 border border-slate-800 rounded px-2 py-1 text-xs font-mono text-slate-200 focus:outline-none focus:border-emerald-500"
            />
            <button
              onClick={handleAppendContext}
              disabled={isMutating || !newContextMsg.trim()}
              className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded text-xs font-medium transition disabled:opacity-50"
            >
              <Plus className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Distributed Tool Lock */}
        <div className="space-y-1.5">
          <label className="text-[11px] font-semibold text-slate-300">Distributed Tool Execution Lock</label>
          <div className="flex gap-1.5">
            <select
              value={toolName}
              onChange={(e) => setToolName(e.target.value)}
              className="bg-slate-900 border border-slate-800 rounded px-2 py-1 text-xs font-mono text-slate-200 focus:outline-none focus:border-emerald-500"
            >
              <option value="webSearch">webSearch</option>
              <option value="codeExecution">codeExecution</option>
              <option value="vectorDbWrite">vectorDbWrite</option>
            </select>
            <button
              onClick={handleAcquireLock}
              disabled={isMutating}
              className="px-2 py-1 bg-amber-600 hover:bg-amber-500 text-white rounded text-xs font-medium flex items-center gap-1 transition"
            >
              <Lock className="w-3 h-3" /> Lock
            </button>
            <button
              onClick={handleReleaseLock}
              disabled={isMutating}
              className="px-2 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded text-xs font-medium flex items-center gap-1 transition"
            >
              <Unlock className="w-3 h-3" /> Free
            </button>
          </div>
        </div>

        {/* Distributed Counters */}
        <div className="space-y-1.5">
          <label className="text-[11px] font-semibold text-slate-300">PN-Counter Token Accounting</label>
          <button
            onClick={handleIncrementTokens}
            disabled={isMutating}
            className="w-full bg-slate-900 hover:bg-slate-800 border border-slate-800 text-sky-400 font-mono text-xs py-1.5 px-3 rounded flex items-center justify-center gap-1.5 transition"
          >
            <Layers className="w-3.5 h-3.5" />
            Increment Distributed Counter (+120 tokens)
          </button>
        </div>
      </div>

      {/* CRDT State Inspection Panel */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 font-mono text-xs">
        {/* Vector Clocks & Active Tool Locks */}
        <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-4 space-y-3">
          <div>
            <div className="text-slate-400 text-[11px] font-bold uppercase tracking-wider mb-1.5">
              Vector Clock (Causal Version State)
            </div>
            <div className="bg-slate-900/60 p-2.5 rounded-lg border border-slate-800 text-emerald-400">
              {crdtSession?.vectorClock ? (
                <div className="grid grid-cols-2 gap-1 text-[11px]">
                  {Object.entries(crdtSession.vectorClock).map(([node, seq]) => (
                    <div key={node} className="flex justify-between border-b border-slate-800/40 pb-0.5">
                      <span className="text-slate-400">{node}:</span>
                      <span className="font-bold">v{seq}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <span className="text-slate-500">Initializing vector clocks...</span>
              )}
            </div>
          </div>

          <div>
            <div className="text-slate-400 text-[11px] font-bold uppercase tracking-wider mb-1.5">
              Active Distributed Tool Locks (OR-Set)
            </div>
            <div className="bg-slate-900/60 p-2.5 rounded-lg border border-slate-800">
              {crdtSession?.toolLocks && Object.keys(crdtSession.toolLocks).length > 0 ? (
                Object.entries(crdtSession.toolLocks).map(([tool, holder]) => (
                  <div key={tool} className="flex items-center justify-between text-amber-300 text-[11px] py-0.5">
                    <span className="flex items-center gap-1">
                      <Lock className="w-3 h-3 text-amber-400" /> {tool}
                    </span>
                    <span className="text-[10px] text-slate-400">Held by: {holder}</span>
                  </div>
                ))
              ) : (
                <span className="text-slate-500 text-[11px]">No active tool locks (All resources free)</span>
              )}
            </div>
          </div>

          <div>
            <div className="text-slate-400 text-[11px] font-bold uppercase tracking-wider mb-1.5">
              PN-Counter Token Metrics
            </div>
            <div className="bg-slate-900/60 p-2.5 rounded-lg border border-slate-800 flex justify-between text-[11px]">
              <div>
                <span className="text-slate-400">Total Tokens: </span>
                <span className="text-sky-400 font-bold">{crdtSession?.counters?.totalTokens || 0}</span>
              </div>
              <div>
                <span className="text-slate-400">Step Count: </span>
                <span className="text-purple-400 font-bold">{crdtSession?.counters?.stepCount || 0}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Replicated Context Memory Log */}
        <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-4 flex flex-col">
          <div className="text-slate-400 text-[11px] font-bold uppercase tracking-wider mb-2 flex justify-between">
            <span>Replicated Agent Context Memory ({crdtSession?.contextWindow?.length || 0} entries)</span>
            <span className="text-emerald-400 font-normal">State-Based Join</span>
          </div>

          <div className="flex-1 bg-slate-900/60 p-3 rounded-lg border border-slate-800 max-h-56 overflow-y-auto space-y-2 text-[11px]">
            {crdtSession?.contextWindow && crdtSession.contextWindow.length > 0 ? (
              crdtSession.contextWindow.map((msg, i) => (
                <div key={i} className="p-1.5 rounded bg-slate-950/60 border border-slate-800/60 text-slate-200">
                  <span className="text-slate-500 mr-1.5">[{i + 1}]</span>
                  {msg}
                </div>
              ))
            ) : (
              <div className="text-slate-500 text-center py-6">
                No session context history. Append steps above or run inference.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
