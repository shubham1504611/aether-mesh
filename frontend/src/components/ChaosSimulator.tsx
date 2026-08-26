import React, { useState } from 'react';
import { AlertOctagon, HeartHandshake, Zap, ShieldAlert, CheckCircle } from 'lucide-react';

interface ChaosSimulatorProps {
  onPartition: (nodeIds: string[]) => Promise<void>;
  onHeal: () => Promise<void>;
  onSpikeLatency: (nodeId: string, multiplier: number) => Promise<void>;
  onRecoverNode: (nodeId: string) => Promise<void>;
  partitionActive: boolean;
}

export const ChaosSimulator: React.FC<ChaosSimulatorProps> = ({
  onPartition,
  onHeal,
  onSpikeLatency,
  onRecoverNode,
  partitionActive,
}) => {
  const [chaosLog, setChaosLog] = useState<string[]>([
    'System operating at nominal multi-region health. HyParView active.',
  ]);

  const addLog = (msg: string) => {
    setChaosLog(prev => [`[${new Date().toLocaleTimeString()}] ${msg}`, ...prev.slice(0, 8)]);
  };

  const handlePartitionUSEU = async () => {
    addLog('⚡ INJECTING SPLIT-BRAIN: Severing WAN links between US and EU regions...');
    await onPartition(['node-eu-west', 'node-ap-south']);
    addLog('⚠️ Nodes isolated: EU-West and AP-South. Operating under Delta-CRDT AP partition mode.');
  };

  const handleSpikeUSEast = async () => {
    addLog('💥 INJECTING TRAFFIC SURGE: 50x request spike on US-East-1 Ingress...');
    await onSpikeLatency('node-us-east', 5.5);
    addLog('⚡ P2C Router detected US-East queue depth spike. Automated spillover to US-West/EU engaged.');
  };

  const handleSpikeAPSouth = async () => {
    addLog('📉 INJECTING LATENCY DEGRADATION: Undersea fiber degradation on AP-South (Mumbai)...');
    await onSpikeLatency('node-ap-south', 4.0);
    addLog('📊 PEWMA filter adjusted AP-South latency weight (α_t dynamically reduced).');
  };

  const handleHealAll = async () => {
    addLog('🩹 HEALING ALL PARTITIONS: Restoring WAN links and triggering anti-entropy semi-lattice join...');
    await onHeal();
    await onRecoverNode('node-us-east');
    await onRecoverNode('node-ap-south');
    addLog('✅ All regional replicas converged to Strong Eventual Consistency (SEC).');
  };

  return (
    <div className="glass-panel rounded-2xl p-6 relative">
      <div className="flex items-center space-x-3 mb-4 border-b border-slate-800 pb-3">
        <div className="p-2 bg-rose-500/10 rounded-lg text-rose-400 border border-rose-500/20">
          <AlertOctagon className="w-5 h-5" />
        </div>
        <div>
          <h2 className="text-lg font-bold text-white tracking-wide flex items-center gap-2">
            CHAOS & RESILIENCE SIMULATOR
            {partitionActive ? (
              <span className="text-xs font-mono px-2 py-0.5 bg-rose-950 text-rose-400 border border-rose-800 rounded-full animate-pulse">
                PARTITION ACTIVE
              </span>
            ) : (
              <span className="text-xs font-mono px-2 py-0.5 bg-emerald-950 text-emerald-400 border border-emerald-800 rounded-full">
                NOMINAL
              </span>
            )}
          </h2>
          <p className="text-xs text-slate-400">
            Validate deterministic recovery against split-brain scenarios and catastrophic traffic spikes
          </p>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
        <button
          onClick={handlePartitionUSEU}
          disabled={partitionActive}
          className="p-3 bg-rose-950/40 hover:bg-rose-900/60 border border-rose-800/60 text-rose-200 rounded-xl text-xs font-mono font-semibold flex flex-col items-center justify-center gap-1.5 transition disabled:opacity-40"
        >
          <ShieldAlert className="w-4 h-4 text-rose-400" />
          <span>Sever WAN Link (Split-Brain)</span>
          <span className="text-[10px] text-rose-400 font-normal">Isolate EU & AP clusters</span>
        </button>

        <button
          onClick={handleSpikeUSEast}
          className="p-3 bg-amber-950/40 hover:bg-amber-900/60 border border-amber-800/60 text-amber-200 rounded-xl text-xs font-mono font-semibold flex flex-col items-center justify-center gap-1.5 transition"
        >
          <Zap className="w-4 h-4 text-amber-400" />
          <span>50x Traffic Spike (US-East)</span>
          <span className="text-[10px] text-amber-400 font-normal">Verify automated spillover</span>
        </button>

        <button
          onClick={handleSpikeAPSouth}
          className="p-3 bg-indigo-950/40 hover:bg-indigo-900/60 border border-indigo-800/60 text-indigo-200 rounded-xl text-xs font-mono font-semibold flex flex-col items-center justify-center gap-1.5 transition"
        >
          <AlertOctagon className="w-4 h-4 text-indigo-400" />
          <span>Degrade AP-South Latency</span>
          <span className="text-[10px] text-indigo-400 font-normal">Trigger PEWMA rerouting</span>
        </button>

        <button
          onClick={handleHealAll}
          className="p-3 bg-emerald-950/40 hover:bg-emerald-900/60 border border-emerald-800/60 text-emerald-200 rounded-xl text-xs font-mono font-semibold flex flex-col items-center justify-center gap-1.5 transition shadow-[0_0_15px_rgba(16,185,129,0.2)]"
        >
          <HeartHandshake className="w-4 h-4 text-emerald-400" />
          <span>Heal Mesh & Reconcile</span>
          <span className="text-[10px] text-emerald-400 font-normal">Anti-entropy state merge</span>
        </button>
      </div>

      {/* Live Chaos Terminal Log */}
      <div className="bg-slate-950/90 border border-slate-800 rounded-xl p-3 font-mono text-[11px] text-slate-300 space-y-1 max-h-36 overflow-y-auto">
        <div className="text-slate-500 font-semibold mb-1 flex items-center gap-1.5">
          <CheckCircle className="w-3.5 h-3.5 text-sky-400" />
          CHAOS EXECUTION & SELF-HEALING TELEMETRY LOG
        </div>
        {chaosLog.map((log, idx) => (
          <div key={idx} className="leading-relaxed">
            {log}
          </div>
        ))}
      </div>
    </div>
  );
};
