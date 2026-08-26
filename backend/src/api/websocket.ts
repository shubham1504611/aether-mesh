import { WebSocketServer, WebSocket } from 'ws';
import { Server as HttpServer } from 'http';
import { HyParViewMesh, MeshEvent } from '../core/gossip/hyparview-mesh.js';
import { PewmaEstimator } from '../core/router/p2c-pewma.js';

export class MeshWebSocketGateway {
  private wss: WebSocketServer;
  private mesh: HyParViewMesh;
  private pewma: PewmaEstimator;
  private clients: Set<WebSocket> = new Set();
  private broadcastInterval: NodeJS.Timeout | null = null;

  constructor(server: HttpServer, mesh: HyParViewMesh, pewma: PewmaEstimator) {
    this.mesh = mesh;
    this.pewma = pewma;
    this.wss = new WebSocketServer({ server, path: '/ws/mesh' });

    this.init();
  }

  private init(): void {
    this.wss.on('connection', (ws: WebSocket) => {
      this.clients.add(ws);

      // Send initial snapshot
      const snapshot = {
        type: 'INITIAL_SNAPSHOT',
        nodes: this.mesh.getNodes(),
        pewmaStates: this.pewma.getAllStates(),
        timestamp: Date.now(),
      };
      ws.send(JSON.stringify(snapshot));

      ws.on('message', (message: string) => {
        try {
          const parsed = JSON.parse(message.toString());
          if (parsed.type === 'PING') {
            ws.send(JSON.stringify({ type: 'PONG', timestamp: Date.now() }));
          }
        } catch {
          // Ignore malformed client frames
        }
      });

      ws.on('close', () => {
        this.clients.delete(ws);
      });

      ws.on('error', () => {
        this.clients.delete(ws);
      });
    });

    // Listen to internal mesh events and broadcast to all connected web clients
    this.mesh.onEvent((event: MeshEvent) => {
      this.broadcast({
        type: 'MESH_EVENT',
        event,
        nodes: this.mesh.getNodes(),
        pewmaStates: this.pewma.getAllStates(),
      });
    });

    // Periodic telemetry broadcast every 1.5 seconds
    this.broadcastInterval = setInterval(() => {
      if (this.clients.size > 0) {
        this.broadcast({
          type: 'TOPOLOGY_TICK',
          nodes: this.mesh.getNodes(),
          pewmaStates: this.pewma.getAllStates(),
          timestamp: Date.now(),
        });
      }
    }, 1500);
  }

  public broadcast(payload: any): void {
    const data = JSON.stringify(payload);
    for (const client of this.clients) {
      if (client.readyState === WebSocket.OPEN) {
        client.send(data);
      }
    }
  }

  public close(): void {
    if (this.broadcastInterval) clearInterval(this.broadcastInterval);
    this.wss.close();
  }
}
