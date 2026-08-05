// core/services/socket.service.ts
// Connexion WebSocket temps réel — authentifiée par le même cookie httpOnly
// bb_access que les requêtes HTTP (le serveur le lit dans le handshake).
// Le cycle de vie de la socket suit la session : connectée quand l'utilisateur
// est authentifié, déconnectée sinon (voir l'effect() du constructeur).
import { Injectable, OnDestroy, effect, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { io, Socket } from 'socket.io-client';
import { environment } from '../../../environments/environment';
import { AuthService } from './auth.service';

function resolveSocketOrigin(): string {
  const apiUrl = environment.apiUrl;
  // apiUrl is either absolute ("http://localhost:3000/api/v1") or a
  // same-origin relative path ("/api/v1") in production — strip the
  // "/api/v1" suffix, falling back to the page's own origin.
  const withoutApiSuffix = apiUrl.replace(/\/api\/v1\/?$/, '');
  return withoutApiSuffix || window.location.origin;
}

@Injectable({ providedIn: 'root' })
export class SocketService implements OnDestroy {
  private authService = inject(AuthService);
  private socket: Socket = io(resolveSocketOrigin(), {
    // Must match the server's path (socket.server.ts) — nested under /api/v1
    // so the handshake request stays within the bb_access cookie's Path scope.
    path: '/api/v1/socket.io',
    withCredentials: true,
    autoConnect: false,
  });

  constructor() {
    effect(() => {
      if (this.authService.isAuthenticated()) {
        this.socket.connect();
      } else {
        this.socket.disconnect();
      }
    });
  }

  /** Subscribe to a server-emitted event. Unsubscribing detaches the listener. */
  on<T>(event: string): Observable<T> {
    return new Observable<T>((subscriber) => {
      const handler = (payload: T) => subscriber.next(payload);
      this.socket.on(event, handler);
      return () => this.socket.off(event, handler);
    });
  }

  ngOnDestroy(): void {
    this.socket.disconnect();
  }
}
