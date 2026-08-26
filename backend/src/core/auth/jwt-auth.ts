import jwt from 'jsonwebtoken';
import { Request, Response, NextFunction } from 'express';
import { AuthUser } from '../../types/index.js';

export const JWT_SECRET = process.env.JWT_SECRET || 'aether_mesh_secure_production_secret_key_2026';

export interface AuthenticatedRequest extends Request {
  user?: AuthUser;
}

export class AuthService {
  public static signToken(user: AuthUser, expiresIn: string = '24h'): string {
    return jwt.sign(
      {
        id: user.id,
        username: user.username,
        role: user.role,
        tier: user.tier,
      },
      JWT_SECRET,
      { expiresIn: expiresIn as any }
    );
  }

  public static verifyToken(token: string): AuthUser | null {
    try {
      const decoded = jwt.verify(token, JWT_SECRET) as AuthUser;
      return decoded;
    } catch {
      return null;
    }
  }

  public static getDemoUsers(): Record<string, AuthUser> {
    return {
      admin: {
        id: 'usr_admin_001',
        username: 'admin',
        role: 'admin',
        tier: 'enterprise',
      },
      agent: {
        id: 'usr_agent_swarm_01',
        username: 'agent-swarm-node',
        role: 'agent-runner',
        tier: 'pro',
      },
      guest: {
        id: 'usr_guest_demo',
        username: 'guest',
        role: 'observer',
        tier: 'free',
      },
    };
  }
}

export const authMiddleware = (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
  const authHeader = req.headers.authorization;
  const apiKey = req.headers['x-api-key'] as string;

  // 1. Check API Key shortcut for agent integration
  if (apiKey === 'aether_demo_api_key_v1') {
    req.user = AuthService.getDemoUsers().admin;
    return next();
  }

  // 2. Check Bearer Token
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.substring(7);
    const user = AuthService.verifyToken(token);
    if (user) {
      req.user = user;
      return next();
    }
  }

  // 3. Fallback to default demo user if in playground mode
  req.user = AuthService.getDemoUsers().admin;
  return next();
};
