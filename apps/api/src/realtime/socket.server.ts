import type { Server as HttpServer } from 'http';
import { Server as SocketIoServer, Socket } from 'socket.io';
import { env } from '../config/env';
import { logger } from '../config/logger';
import { ACCESS_COOKIE, verifySessionFromToken } from '../middlewares/auth.middleware';
import { JwtPayload } from '../types/auth.types';

interface AuthenticatedSocket extends Socket {
  data: { user: JwtPayload };
}

let io: SocketIoServer | undefined;

function userRoom(userId: string): string {
  return `user:${userId}`;
}

/** Minimal cookie-header parser — Socket.IO handshakes bypass Express's cookie-parser middleware. */
function readCookie(cookieHeader: string | undefined, name: string): string | undefined {
  if (!cookieHeader) return undefined;
  for (const part of cookieHeader.split(';')) {
    const [key, ...rest] = part.trim().split('=');
    if (key === name) return decodeURIComponent(rest.join('='));
  }
  return undefined;
}

export function initSocketServer(httpServer: HttpServer): SocketIoServer {
  io = new SocketIoServer(httpServer, {
    cors: {
      origin: env.ALLOWED_ORIGINS,
      credentials: true,
    },
  });

  io.use(async (socket, next) => {
    const token = readCookie(socket.handshake.headers.cookie, ACCESS_COOKIE);
    if (!token) {
      next(new Error('Non authentifié'));
      return;
    }

    try {
      (socket as AuthenticatedSocket).data.user = await verifySessionFromToken(token);
      next();
    } catch {
      next(new Error('Token expiré ou invalide'));
    }
  });

  io.on('connection', (socket: Socket) => {
    const { user } = (socket as AuthenticatedSocket).data;
    socket.join(userRoom(user.userId));
    logger.debug('[WS] connexion établie', { userId: user.userId, socketId: socket.id });

    socket.on('disconnect', () => {
      logger.debug('[WS] déconnexion', { userId: user.userId, socketId: socket.id });
    });
  });

  logger.info('[WS] Socket.IO initialisé');
  return io;
}

/** Push a real-time event to every connected socket of a given user. No-op if a user has no open socket. */
export function emitToUser(userId: string, event: string, payload: unknown): void {
  io?.to(userRoom(userId)).emit(event, payload);
}
