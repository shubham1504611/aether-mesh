import React, { useState, useEffect, useCallback } from 'react';
import { EdgeNode, PewmaState, InferenceResponse, AgentSessionState, MeshMetrics, RegionId } from './types/index.js';
import { TopologyMesh } from './components/TopologyMesh.js';
import { InferencePlayground } from './components/InferencePlayground.js';
import { CrdtStateInspector } from './components/CrdtStateInspector.js';
import { ChaosSimulator } from './components/ChaosSimulator.js';
import { MetricsDashboard } from './components/MetricsDashboard.js';
import { Globe, Cpu, Database, AlertOctagon, Activity, Radio, Shield, Terminal, Zap } from 'lucide-react';

const API_BASE = (import.meta.env.VITE_API_URL as string) || (typeof window !== 'undefined' && window.location.hostname === 'localhost' ? 'http://localhost:8080/api/v1' : '/api/v1');

export const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'topology' | 'inference' | 'crdt' | 'chaos'>('topology');
  const [nodes, setNodes] = useState<EdgeNode[]>([]);
  const [pewmaStates, setPewmaStates] = useState<Record<string, PewmaState>>({});
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>('node-us-east');
  const [crdtSession, setCrdtSession] = useState<AgentSessionState | null>(null);
  const [metrics, setMetrics] = useState<MeshMetrics | null>(null);
  const [wsConnected, setWsConnected] = useState(false);
  const [loadingInference, setLoadingInference] = useState(false);

  // 1. Fetch Topology & Nodes
  const fetchTopology = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/mesh/nodes`);
      const json = await res.json();
      if (json.success) {
        setNodes(json.data.nodes);
        setPewmaStates(json.data.pewmaStates);
      }
    } catch (err) {
      console.warn('API fetch fallback:', err);
    }
  }, []);

  // 2. Fetch CRDT Session
  const fetchCrdtSession = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/crdt/sessions`);
      const json = await res.json();
      if (json.success && json.data.length > 0) {
        setCrdtSession(json.data[0]);
      } else {
        // Fallback default state
        setCrdtSession({
          sessionId: 'session_agent_mesh_001',
          agentId: 'swarm-primary-coordinator',
          contextWindow: [
            'System initialization: HyParView gossip protocol connected across 5 global regions.',
            'Causal memory verified: Delta-CRDT Strong Eventual Consistency active.',
          ],
          toolLocks: {
            webSearch: 'node-us-east',
          },
          counters: {
            totalTokens: 14250,
            stepCount: 18,
          },
          metadata: {
            priority: 'HIGH',
            routingPolicy: 'P2C_PEWMA_ADAPTIVE',
          },
          vectorClock: {
            'node-us-east': 14,
            'node-us-west': 9,
            'node-eu-west': 11,
            'node-ap-south': 6,
            'node-sa-east': 4,
          },
          updatedAt: Date.now(),
        });
      }
    } catch (err) {
      console.warn('CRDT fetch fallback:', err);
    }
  }, []);

  // 3. Fetch Metrics
  const fetchMetrics = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/metrics/summary`);
      const json = await res.json();
      if (json.success) {
        setMetrics(json.data);
      }
    } catch (err) {
      console.warn('Metrics fetch fallback:', err);
    }
  }, []);

  // 4. WebSocket Live Synchronization
  useEffect(() => {
    fetchTopology();
    fetchCrdtSession();
    fetchMetrics();

    let ws: WebSocket | null = null;
    let reconnectTimeout: NodeJS.Timeout | null = null;

    const connectWebSocket = () => {
      try {
        let wsUrl = window.location.protocol === 'https:'
          ? `wss://${window.location.host}/ws/mesh`
          : `ws://localhost:8080/ws/mesh`;

        if (import.meta.env.VITE_WS_URL) {
          wsUrl = import.meta.env.VITE_WS_URL as string;
        } else if (import.meta.env.VITE_API_URL) {
          try {
            const parsed = new URL(import.meta.env.VITE_API_URL as string);
            const proto = parsed.protocol === 'https:' ? 'wss:' : 'ws:';
            wsUrl = `${proto}//${parsed.host}/ws/mesh`;
          } catch {
            // fallback
          }
        }

        ws = new WebSocket(wsUrl);

        ws.onopen = () => {
          setWsConnected(true);
        };

        ws.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            if (data.nodes) setNodes(data.nodes);
            if (data.pewmaStates) setPewmaStates(data.pewmaStates);
            if (data.type === 'MESH_EVENT') {
              fetchMetrics();
              fetchCrdtSession();
            }
          } catch (e) {
            console.error('WS parse error', e);
          }
        };

        ws.onclose = () => {
          setWsConnected(false);
          reconnectTimeout = setTimeout(connectWebSocket, 3000);
        };

        ws.onerror = () => {
          setWsConnected(false);
        };
      } catch {
        setWsConnected(false);
      }
    };

    connectWebSocket();

    // Fallback periodic poll every 3 seconds
    const interval = setInterval(() => {
      fetchTopology();
      fetchMetrics();
    }, 3000);

    return () => {
      if (ws) ws.close();
      if (reconnectTimeout) clearTimeout(reconnectTimeout);
      clearInterval(interval);
    };
  }, [fetchTopology, fetchCrdtSession, fetchMetrics]);

  // Dispatch Inference Action
  const handleDispatchInference = async (
    prompt: string,
    model: string,
    preferredRegion?: RegionId
  ): Promise<InferenceResponse | null> => {
    setLoadingInference(true);
    try {
      const res = await fetch(`${API_BASE}/inference/dispatch`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer aether_demo_token',
        },
        body: JSON.stringify({
          prompt,
          model,
          preferredRegion,
          sessionId: crdtSession?.sessionId || 'session_agent_mesh_001',
        }),
      });

      const json = await res.json();
      if (json.success) {
        await fetchMetrics();
        await fetchCrdtSession();
        await fetchTopology();
        return json.data;
      }
      return null;
    } catch (err) {
      console.error('Inference error:', err);
      return null;
    } finally {
      setLoadingInference(false);
    }
  };

  // Mutate CRDT Action
  const handleMutateCrdt = async (nodeId: string, action: string, payload: any) => {
    try {
      const res = await fetch(`${API_BASE}/crdt/mutate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId: crdtSession?.sessionId || 'session_agent_mesh_001',
          nodeId,
          action,
          payload,
        }),
      });
      const json = await res.json();
      if (json.success && json.updatedSession) {
        setCrdtSession(json.updatedSession);
      }
    } catch (err) {
      console.error('CRDT mutation error:', err);
    }
  };

  // Chaos Actions
  const handlePartition = async (nodeIds: string[]) => {
    await fetch(`${API_BASE}/mesh/chaos/partition`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nodeIds }),
    });
    await fetchTopology();
    await fetchMetrics();
  };

  const handleHeal = async () => {
    await fetch(`${API_BASE}/mesh/chaos/heal`, { method: 'POST' });
    await fetchTopology();
    await fetchMetrics();
    await fetchCrdtSession();
  };

  const handleSpikeLatency = async (nodeId: string, multiplier: number) => {
    await fetch(`${API_BASE}/mesh/chaos/spike`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nodeId, multiplier }),
    });
    await fetchTopology();
    await fetchMetrics();
  };

  const handleRecoverNode = async (nodeId: string) => {
    await fetch(`${API_BASE}/mesh/chaos/recover`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nodeId }),
    });
    await fetchTopology();
    await fetchMetrics();
  };

  return (
    <div className="min-h-screen bg-[#080c14] text-slate-100 flex flex-col">
      {/* Top Enterprise Navigation Header */}
      <header className="border-b border-slate-800/80 bg-slate-950/70 backdrop-blur-md sticky top-0 z-50 px-6 py-3.5">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-gradient-to-tr from-sky-500 to-indigo-600 rounded-xl shadow-[0_0_15px_rgba(56,189,248,0.4)]">
              <Zap className="w-5 h-5 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="font-extrabold text-base tracking-wider text-white">
                  AETHER<span className="text-sky-400 font-normal">::MESH</span>
                </h1>
                <span className="text-[10px] font-mono font-bold px-2 py-0.5 bg-sky-950 text-sky-400 border border-sky-800 rounded-full">
                  v2.4.0-PROD
                </span>
              </div>
              <p className="text-[11px] text-slate-400 font-mono">
                Autonomous Multi-Region AI Inference & Delta-CRDT Mesh
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-4">
            {/* Live WebSockets Status Indicator */}
            <div className="flex items-center space-x-2 bg-slate-900 border border-slate-800 px-3 py-1.5 rounded-full text-xs font-mono">
              <Radio className={`w-3.5 h-3.5 ${wsConnected ? 'text-emerald-400 animate-pulse' : 'text-slate-500'}`} />
              <span className={wsConnected ? 'text-emerald-300' : 'text-slate-400'}>
                {wsConnected ? 'LIVE MESH STREAM' : 'SYNCING...'}
              </span>
            </div>

            {/* Gateway API Badge */}
            <a
              href={`${API_BASE}/metrics/prometheus`}
              target="_blank"
              rel="noreferrer"
              className="text-xs font-mono px-3 py-1.5 bg-slate-900 hover:bg-slate-800 border border-slate-800 rounded-full text-slate-300 transition flex items-center gap-1.5"
            >
              <Activity className="w-3.5 h-3.5 text-sky-400" />
              Prometheus
            </a>

            {/* User Profile */}
            <div className="hidden sm:flex items-center space-x-2 bg-sky-950/40 border border-sky-800/60 px-3 py-1.5 rounded-full text-xs font-mono text-sky-200">
              <Shield className="w-3.5 h-3.5 text-sky-400" />
              <span>Enterprise Tier (Admin)</span>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-6 space-y-6">
        {/* Real-time Global Cluster Metrics */}
        <MetricsDashboard metrics={metrics} />

        {/* Tab Navigation */}
        <div className="flex space-x-2 border-b border-slate-800/80 pb-2">
          <button
            onClick={() => setActiveTab('topology')}
            className={`px-4 py-2 rounded-xl text-xs font-mono font-semibold flex items-center gap-2 transition ${
              activeTab === 'topology'
                ? 'bg-sky-500/15 border border-sky-500 text-sky-300 shadow-[0_0_15px_rgba(56,189,248,0.2)]'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
            }`}
          >
            <Globe className="w-4 h-4" /> Global Mesh Topology
          </button>

          <button
            onClick={() => setActiveTab('inference')}
            className={`px-4 py-2 rounded-xl text-xs font-mono font-semibold flex items-center gap-2 transition ${
              activeTab === 'inference'
                ? 'bg-purple-500/15 border border-purple-500 text-purple-300 shadow-[0_0_15px_rgba(168,85,247,0.2)]'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
            }`}
          >
            <Cpu className="w-4 h-4" /> Live Inference Dispatch (P2C)
          </button>

          <button
            onClick={() => setActiveTab('crdt')}
            className={`px-4 py-2 rounded-xl text-xs font-mono font-semibold flex items-center gap-2 transition ${
              activeTab === 'crdt'
                ? 'bg-emerald-500/15 border border-emerald-500 text-emerald-300 shadow-[0_0_15px_rgba(16,185,129,0.2)]'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
            }`}
          >
            <Database className="w-4 h-4" /> Delta-CRDT State Sync (SEC)
          </button>

          <button
            onClick={() => setActiveTab('chaos')}
            className={`px-4 py-2 rounded-xl text-xs font-mono font-semibold flex items-center gap-2 transition ${
              activeTab === 'chaos'
                ? 'bg-rose-500/15 border border-rose-500 text-rose-300 shadow-[0_0_15px_rgba(244,63,94,0.2)]'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
            }`}
          >
            <AlertOctagon className="w-4 h-4" /> Chaos & Split-Brain Simulator
          </button>
        </div>

        {/* Tab View Panels */}
        {activeTab === 'topology' && (
          <div className="space-y-6">
            <TopologyMesh
              nodes={nodes}
              pewmaStates={pewmaStates}
              selectedNodeId={selectedNodeId}
              onSelectNode={setSelectedNodeId}
            />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <InferencePlayground onDispatch={handleDispatchInference} loading={loadingInference} />
              <ChaosSimulator
                onPartition={handlePartition}
                onHeal={handleHeal}
                onSpikeLatency={handleSpikeLatency}
                onRecoverNode={handleRecoverNode}
                partitionActive={nodes.some(n => n.status === 'isolated')}
              />
            </div>
          </div>
        )}

        {activeTab === 'inference' && (
          <div className="space-y-6">
            <InferencePlayground onDispatch={handleDispatchInference} loading={loadingInference} />
            <TopologyMesh
              nodes={nodes}
              pewmaStates={pewmaStates}
              selectedNodeId={selectedNodeId}
              onSelectNode={setSelectedNodeId}
            />
          </div>
        )}

        {activeTab === 'crdt' && (
          <div className="space-y-6">
            <CrdtStateInspector
              nodes={nodes}
              onMutateCrdt={handleMutateCrdt}
              crdtSession={crdtSession}
              onRefresh={fetchCrdtSession}
            />
            <ChaosSimulator
              onPartition={handlePartition}
              onHeal={handleHeal}
              onSpikeLatency={handleSpikeLatency}
              onRecoverNode={handleRecoverNode}
              partitionActive={nodes.some(n => n.status === 'isolated')}
            />
          </div>
        )}

        {activeTab === 'chaos' && (
          <div className="space-y-6">
            <ChaosSimulator
              onPartition={handlePartition}
              onHeal={handleHeal}
              onSpikeLatency={handleSpikeLatency}
              onRecoverNode={handleRecoverNode}
              partitionActive={nodes.some(n => n.status === 'isolated')}
            />
            <TopologyMesh
              nodes={nodes}
              pewmaStates={pewmaStates}
              selectedNodeId={selectedNodeId}
              onSelectNode={setSelectedNodeId}
            />
          </div>
        )}
      </main>

      {/* Footer Status Bar */}
      <footer className="border-t border-slate-800/80 bg-slate-950/80 py-3 px-6 text-center text-xs font-mono text-slate-500">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row justify-between items-center gap-2">
          <span>AETHER-MESH Enterprise Engine &bull; Google Antigravity 2.0 Autonomous Deployment</span>
          <span className="text-slate-400">
            Protocols: Power-of-Two-Choices (P2C) &bull; PEWMA Adaptive Latency &bull; Delta-CRDT Lattice Join
          </span>
        </div>
      </footer>
    </div>
  );
};
export default App;
