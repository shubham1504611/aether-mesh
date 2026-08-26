# AETHER-MESH: Autonomous Edge AI Inference Routing & Delta-State Coordination Fabric

[![TypeScript](https://img.shields.io/badge/TypeScript-5.7-blue.svg)](https://www.typescriptlang.org/)
[![React 19](https://img.shields.io/badge/React-19.0-cyan.svg)](https://react.dev/)
[![Express](https://img.shields.io/badge/Express-4.21-emerald.svg)](https://expressjs.com/)
[![Vite](https://img.shields.io/badge/Vite-6.2-purple.svg)](https://vitejs.dev/)
[![Docker](https://img.shields.io/badge/Docker-Ready-2496ED.svg)](https://docker.com/)

**AETHER-MESH** is a high-throughput, edge-native microservice architecture that delivers sub-millisecond AI inference routing decisions, Strong Eventual Consistency (SEC) across multi-region agent swarms, and automatic regional traffic spillover without dropped packets.

---

## 🏛️ Academic Algorithmic Foundations

1. **Power of Two Choices (P2C) Randomized Routing**  
   *Mitzenmacher, M. (2001). IEEE TPDS.*  
   Selects 2 random eligible edge nodes and routes to $\arg\min(\text{Load}_A, \text{Load}_B)$, reducing peak queue depths from $O(\frac{\log n}{\log \log n})$ to $O(\log \log n)$ with $O(1)$ decision overhead.
2. **Probabilistic Exponentially Weighted Moving Average (PEWMA)**  
   *Trihinas, D. et al. (2014). IEEE IC2E / arXiv:1403.4074.*  
   Dynamically weights observations based on probability density, filtering out transient spikes while tracking real regional degradation.
3. **Delta-State Conflict-Free Replicated Data Types (Delta-CRDTs)**  
   *Almeida, P. S. et al. (2018). JPDC / arXiv:1410.2803; Shapiro, M. et al. (2011).*  
   State-based semi-lattice joins ($\sqcup$) guaranteeing Strong Eventual Consistency (SEC) across multi-agent session state, tool locks, and vector memory.
4. **HyParView Membership & Gossip Protocol**  
   *Leitão, J. et al. (2007). IEEE/IFIP DSN.*  
   Maintains active and passive peer views for fast delta dissemination and partition recovery.

---

## 📂 Project Architecture

```
production-mvp/
├── backend/
│   ├── src/
│   │   ├── api/
│   │   │   ├── routes.ts         # REST API Gateway (Auth, Inference, CRDT, Chaos, Metrics)
│   │   │   └── websocket.ts      # Real-time WebSocket Telemetry & Topology Stream
│   │   ├── core/
│   │   │   ├── auth/             # JWT & HMAC Authentication Middleware
│   │   │   ├── crdt/             # Delta-State CRDT Engine & Vector Clocks
│   │   │   ├── gossip/           # HyParView Peer Gossip Mesh Protocol
│   │   │   ├── inference/        # Streaming LLM Engine & Token Pricing
│   │   │   ├── ratelimit/        # Distributed Token Bucket & Regional Spillover
│   │   │   ├── router/           # P2C + PEWMA Latency Tracking Algorithm
│   │   │   └── storage/          # Multi-Tier Storage (L1 LRU + L2 Persistent Ledger)
│   │   ├── types/                # Strict TypeScript Type Definitions
│   │   └── server.ts             # Microservice Bootstrap & Graceful Shutdown
│   ├── test/
│   │   └── index.ts              # 17-Point Unit & SEC Convergence Test Suite
│   ├── package.json
│   └── tsconfig.json
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   │   ├── ChaosSimulator.tsx      # Split-Brain & Traffic Spike Simulator
│   │   │   ├── CrdtStateInspector.tsx  # Multi-Replica CRDT Memory & Lock Inspector
│   │   │   ├── InferencePlayground.tsx # Live Prompt Dispatcher & P2C Matrix
│   │   │   ├── MetricsDashboard.tsx    # Live Performance & SLA Telemetry Cards
│   │   │   └── TopologyMesh.tsx        # Interactive SVG Global Mesh Visualizer
│   │   ├── types/
│   │   ├── App.tsx                     # Cyberpunk Glassmorphic Dashboard
│   │   ├── index.css
│   │   └── main.tsx
│   ├── index.html
│   ├── package.json
│   ├── tailwind.config.js
│   └── vite.config.ts
├── infrastructure/
│   ├── Dockerfile.backend        # Multi-stage lean Node.js container
│   ├── Dockerfile.frontend       # Multi-stage Nginx static web container
│   ├── docker-compose.yml        # Multi-container cluster orchestration
│   ├── prometheus.yml            # Prometheus metrics scraper
│   └── .env.example
├── scripts/
│   ├── test-deployment.ps1       # Automated PowerShell deployment validation
│   ├── test-deployment.sh        # Automated POSIX Bash deployment validation
│   └── start-mesh.ps1            # Instant development launcher
├── package.json                  # Workspace monorepo root
└── README.md
```

---

## 🚀 Instant Quickstart

### 1. Run Automated Validation & Sanitization Pipeline
```powershell
# In PowerShell:
powershell -ExecutionPolicy Bypass -File scripts/test-deployment.ps1
```
Or on Linux/macOS:
```bash
chmod +x scripts/test-deployment.sh
./scripts/test-deployment.sh
```

### 2. Launch Development Servers
```bash
# Terminal 1: Backend API Gateway
cd backend
npm run dev

# Terminal 2: Frontend Web UI
cd frontend
npm run dev
```

* **Web UI Dashboard:** `http://localhost:5173`
* **API Ingress Gateway:** `http://localhost:8080`
* **WebSocket Stream:** `ws://localhost:8080/ws/mesh`
* **Prometheus Metrics:** `http://localhost:8080/api/v1/metrics/prometheus`

---

## 📡 REST API Reference

| Method | Path | Description |
| :--- | :--- | :--- |
| `POST` | `/api/v1/inference/dispatch` | Evaluates P2C route, checks rate limits, executes inference, and updates CRDT session |
| `GET` | `/api/v1/mesh/nodes` | Retrieves active cluster topology and PEWMA $\alpha$-adaptation states |
| `POST` | `/api/v1/mesh/chaos/partition` | Injects network partition isolating specified nodes |
| `POST` | `/api/v1/mesh/chaos/heal` | Restores network links and triggers anti-entropy state merge |
| `POST` | `/api/v1/mesh/chaos/spike` | Injects sudden traffic spike or latency multiplier on target node |
| `GET` | `/api/v1/crdt/sessions` | Inspects all distributed agent session states |
| `POST` | `/api/v1/crdt/mutate` | Mutates session context, acquires distributed locks, or increments counters |
| `GET` | `/api/v1/metrics/prometheus` | Exposes standard Prometheus scrapable metrics |
| `GET` | `/api/v1/health` | Service health status check |

---
*Developed under Google Antigravity 2.0 Autonomous Multi-Agent Protocol.*
