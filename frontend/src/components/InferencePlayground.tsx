import React, { useState } from 'react';
import { InferenceResponse, RegionId } from '../types/index.js';
import { Play, Sparkles, Cpu, Clock, CheckCircle2, Zap, ArrowRight, Layers, Coins } from 'lucide-react';

interface InferencePlaygroundProps {
  onDispatch: (prompt: string, model: string, preferredRegion?: RegionId) => Promise<InferenceResponse | null>;
  loading: boolean;
}

export const InferencePlayground: React.FC<InferencePlaygroundProps> = ({ onDispatch, loading }) => {
  const [prompt, setPrompt] = useState('Analyze global telemetry vectors and execute autonomous agent coordination.');
  const [model, setModel] = useState('gemini-3.7-flash-edge');
  const [preferredRegion, setPreferredRegion] = useState<RegionId | ''>('');
  const [lastResult, setLastResult] = useState<InferenceResponse | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!prompt.trim() || loading) return;

    const res = await onDispatch(
      prompt,
      model,
      preferredRegion ? (preferredRegion as RegionId) : undefined
    );
    if (res) {
      setLastResult(res);
    }
  };

  const presetPrompts = [
    { label: 'Swarm Consensus', text: 'Synthesize multi-agent tool execution plan with zero-loss CRDT state joining.' },
    { label: 'High-Concurrency Ingress', text: 'Process 1,000 parallel vector embedding updates across edge clusters.' },
    { label: 'Failover Simulation', text: 'Simulate cross-region spillover to secondary cluster with sub-millisecond overhead.' },
  ];

  return (
    <div className="glass-panel rounded-2xl p-6 relative">
      <div className="flex items-center space-x-3 mb-4 border-b border-slate-800 pb-3">
        <div className="p-2 bg-purple-500/10 rounded-lg text-purple-400 border border-purple-500/20">
          <Cpu className="w-5 h-5" />
        </div>
        <div>
          <h2 className="text-lg font-bold text-white tracking-wide">
            LIVE EDGE INFERENCE ENGINE
          </h2>
          <p className="text-xs text-slate-400">
            Real-time P2C dispatch, PEWMA latency comparison, and token streaming
          </p>
        </div>
      </div>

      {/* Input Form */}
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label className="text-xs font-semibold text-slate-300">Prompt / Agent Task Payload</label>
            <div className="flex space-x-1.5">
              {presetPrompts.map((p, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => setPrompt(p.text)}
                  className="text-[10px] px-2 py-0.5 rounded bg-slate-800 text-sky-300 hover:bg-slate-700 transition"
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>
          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            rows={3}
            className="w-full bg-slate-950/80 border border-slate-800 rounded-xl p-3 text-sm font-mono text-slate-100 placeholder-slate-600 focus:outline-none focus:border-sky-500 transition"
            placeholder="Enter agent task or inference prompt..."
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div>
            <label className="text-xs text-slate-400 block mb-1">Model Architecture</label>
            <select
              value={model}
              onChange={(e) => setModel(e.target.value)}
              className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-xs font-mono text-slate-200 focus:outline-none focus:border-sky-500"
            >
              <option value="gemini-3.7-flash-edge">Gemini 3.7 Flash Edge (Ultra-Fast)</option>
              <option value="deepseek-r1-distill-q8">DeepSeek-R1 Distill (Edge Q8)</option>
              <option value="llama-3.3-70b-instruct">Llama 3.3 70B Instruct</option>
              <option value="claude-3.5-haiku-edge">Claude 3.5 Haiku Edge</option>
            </select>
          </div>

          <div>
            <label className="text-xs text-slate-400 block mb-1">Target Ingress Region (Optional)</label>
            <select
              value={preferredRegion}
              onChange={(e) => setPreferredRegion(e.target.value as any)}
              className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-xs font-mono text-slate-200 focus:outline-none focus:border-sky-500"
            >
              <option value="">Auto-Route (Optimal P2C Global)</option>
              <option value="us-east-1">US-East-1 (N. Virginia)</option>
              <option value="us-west-2">US-West-2 (Oregon)</option>
              <option value="eu-west-1">EU-West-1 (Frankfurt)</option>
              <option value="ap-south-1">AP-South-1 (Mumbai)</option>
              <option value="sa-east-1">SA-East-1 (São Paulo)</option>
            </select>
          </div>

          <div className="flex items-end">
            <button
              type="submit"
              disabled={loading || !prompt.trim()}
              className="w-full bg-gradient-to-r from-sky-500 to-indigo-600 hover:from-sky-400 hover:to-indigo-500 text-white font-semibold text-xs py-2.5 px-4 rounded-lg flex items-center justify-center space-x-2 transition shadow-[0_0_15px_rgba(56,189,248,0.3)] disabled:opacity-50"
            >
              {loading ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  <span>Evaluating P2C Route...</span>
                </>
              ) : (
                <>
                  <Play className="w-4 h-4 fill-current" />
                  <span>Dispatch Inference</span>
                </>
              )}
            </button>
          </div>
        </div>
      </form>

      {/* Execution Result & P2C Breakdown */}
      {lastResult && (
        <div className="mt-6 border-t border-slate-800/80 pt-4 space-y-4">
          {/* P2C Decision Diagnostics */}
          <div className="p-4 rounded-xl bg-slate-950/60 border border-sky-900/40">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-mono text-sky-400 flex items-center gap-1.5 font-bold">
                <Sparkles className="w-4 h-4" />
                POWER OF TWO CHOICES (P2C) DECISION MATRIX
              </span>
              <span className="text-[11px] font-mono text-emerald-400 bg-emerald-950/60 border border-emerald-800 px-2 py-0.5 rounded">
                ⚡ Overhead: {lastResult.routingDecision.decisionTimeMicros.toFixed(2)} µs
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 items-center">
              {/* Candidate A */}
              <div className={`p-3 rounded-lg border text-xs font-mono ${
                lastResult.routingDecision.selectedNodeId === lastResult.routingDecision.candidateA
                  ? 'bg-emerald-950/30 border-emerald-500/50 text-emerald-200'
                  : 'bg-slate-900/40 border-slate-800 text-slate-400'
              }`}>
                <div className="text-[10px] text-slate-500">CANDIDATE A</div>
                <div className="font-bold text-slate-200">{lastResult.routingDecision.candidateA}</div>
                <div className="text-sky-300 mt-1">
                  PEWMA: {lastResult.routingDecision.candidateALatencyPewma.toFixed(1)}ms
                </div>
              </div>

              {/* VS Divider */}
              <div className="text-center font-mono text-xs text-slate-500 flex flex-col items-center">
                <span>VS</span>
                <ArrowRight className="w-4 h-4 text-sky-400 mt-0.5" />
              </div>

              {/* Candidate B */}
              <div className={`p-3 rounded-lg border text-xs font-mono ${
                lastResult.routingDecision.selectedNodeId === lastResult.routingDecision.candidateB
                  ? 'bg-emerald-950/30 border-emerald-500/50 text-emerald-200'
                  : 'bg-slate-900/40 border-slate-800 text-slate-400'
              }`}>
                <div className="text-[10px] text-slate-500">CANDIDATE B</div>
                <div className="font-bold text-slate-200">{lastResult.routingDecision.candidateB}</div>
                <div className="text-sky-300 mt-1">
                  PEWMA: {lastResult.routingDecision.candidateBLatencyPewma.toFixed(1)}ms
                </div>
              </div>
            </div>

            {lastResult.routingDecision.spillover && (
              <div className="mt-2 text-[11px] font-mono text-amber-400 bg-amber-950/30 border border-amber-800/40 p-2 rounded flex items-center gap-2">
                <Zap className="w-3.5 h-3.5" />
                Automated Regional Spillover Activated: Load seamlessly redirected to {lastResult.routedNode.name}
              </div>
            )}
          </div>

          {/* Model Output & Stats */}
          <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-4">
            <div className="flex items-center justify-between mb-2 pb-2 border-b border-slate-900">
              <span className="text-xs font-semibold text-slate-300 flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                Response Stream ({lastResult.routedNode.region})
              </span>
              <div className="flex space-x-3 text-xs font-mono text-slate-400">
                <span className="flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5 text-sky-400" />
                  {lastResult.durationMs}ms
                </span>
                <span className="flex items-center gap-1">
                  <Layers className="w-3.5 h-3.5 text-purple-400" />
                  {lastResult.tokensGenerated} tokens
                </span>
                <span className="flex items-center gap-1">
                  <Coins className="w-3.5 h-3.5 text-amber-400" />
                  ${lastResult.costMicroUSD.toFixed(4)}
                </span>
              </div>
            </div>

            <p className="text-xs font-mono text-slate-200 leading-relaxed bg-slate-900/50 p-3 rounded-lg border border-slate-800/50">
              {lastResult.completion}
            </p>
          </div>
        </div>
      )}
    </div>
  );
};
