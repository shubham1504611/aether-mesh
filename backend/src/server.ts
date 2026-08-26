import express from 'express';
import cors from 'cors';
import { createServer } from 'http';
import dotenv from 'dotenv';
import { PewmaEstimator, PowerOfTwoRouter } from './core/router/p2c-pewma.js';
import { HyParViewMesh } from './core/gossip/hyparview-mesh.js';
import { DistributedStorageEngine } from './core/storage/database.js';
import { InferenceEngine } from './core/inference/engine.js';
import { DistributedTokenBucketLimiter } from './core/ratelimit/token-bucket.js';
import { createApiRouter } from './api/routes.js';
import { MeshWebSocketGateway } from './api/websocket.js';

dotenv.config();

const PORT = parseInt(process.env.PORT || '8080', 10);
const HOST = process.env.HOST || '0.0.0.0';

export function createApplication() {
  const app = express();
  app.use(cors({ origin: '*' }));
  app.use(express.json());

  // 1. Instantiate Core Systems
  const pewma = new PewmaEstimator();
  const mesh = new HyParViewMesh('gateway-ingress-node', pewma);
  const router = new PowerOfTwoRouter(pewma);
  const storage = new DistributedStorageEngine();
  const inference = new InferenceEngine(router, mesh, storage);
  const limiter = new DistributedTokenBucketLimiter();

  // Start background gossip heartbeats
  mesh.startHeartbeat(2000);

  // 2. Mount API Routes
  const apiRouter = createApiRouter(router, pewma, mesh, storage, inference, limiter);
  app.use('/api/v1', apiRouter);

  // Fallback route for root
  app.get('/', (req, res) => {
    res.json({
      name: 'AETHER-MESH API Gateway',
      version: '2.4.0-PROD',
      status: 'OPERATIONAL',
      endpoints: {
        health: '/api/v1/health',
        nodes: '/api/v1/mesh/nodes',
        dispatch: 'POST /api/v1/inference/dispatch',
        metrics: '/api/v1/metrics/summary',
        crdt: '/api/v1/crdt/sessions',
        websocket: 'ws://localhost:8080/ws/mesh',
      },
    });
  });

  const httpServer = createServer(app);
  const wsGateway = new MeshWebSocketGateway(httpServer, mesh, pewma);

  return { app, httpServer, wsGateway, mesh, storage, router, pewma, inference };
}

// Start server if executed directly
if (process.env.NODE_ENV !== 'test' && !process.env.IS_SUBAGENT) {
  const { httpServer } = createApplication();

  httpServer.listen(PORT, HOST, () => {
    console.log(`=======================================================`);
    console.log(`  ⚡ AETHER-MESH EDGE INGRESS GATEWAY INITIALIZED       `);
    console.log(`  🌐 Ingress HTTP: http://${HOST}:${PORT}               `);
    console.log(`  📡 WebSocket Stream: ws://${HOST}:${PORT}/ws/mesh      `);
    console.log(`  🎯 P2C + PEWMA Inference Routing: ACTIVE              `);
    console.log(`  🔄 Delta-CRDT Strong Eventual Consistency: SYNCED    `);
    console.log(`  📊 Prometheus Exposition: /api/v1/metrics/prometheus  `);
    console.log(`=======================================================`);
  });

  const shutdown = () => {
    console.log('\n[AETHER-MESH] Received termination signal. Draining connections...');
    httpServer.close(() => {
      console.log('[AETHER-MESH] Server gracefully shut down.');
      process.exit(0);
    });
  };

  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
}
