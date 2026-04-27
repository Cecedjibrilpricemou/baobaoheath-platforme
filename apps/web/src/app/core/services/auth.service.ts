// core/services/auth.service.ts
// Adapté au format de réponse du backend BaoBaoHealth
// Format login/register : { success: true, data: { accessToken, refreshToken } }
// Format /me           : { success: true, data: User }

import { Injectable, inject, signal, computed } from '@angular/core';
import { Router } from '@angular/router';
import { Observable } from 'rxjs';
import { tap, map, switchMap } from 'rxjs/operators';
import { ApiService } from './api.service';
import {
  User,
  LoginPayload,
  RegisterPayload
} from '../models/user.model';

interface BackendTokenResponse {
  success: boolean;
  data: {
    accessToken: string;
    refreshToken: string;
  };
}

interface BackendMeResponse {
  success: boolean;
  data: User;
}

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private api = inject(ApiService);
  private router = inject(Router);

  // Signals
  private _currentUser = signal<User | null>(this.loadUserFromStorage());
  private _accessToken = signal<string | null>(localStorage.getItem('accessToken'));

  // Computed
  currentUser     = this._currentUser.asReadonly();
  isAuthenticated = computed(() => !!this._currentUser());
  userRole        = computed(() => this._currentUser()?.role ?? null);

  // --- Auth ---

  // Retourne Observable<User> — plus de setTimeout fragile
  login(payload: LoginPayload): Observable<User> {
    return this.api.post<BackendTokenResponse>('/auth/login', payload).pipe(
      tap(response => {
        if (response.success && response.data) {
          this.handleAuthSuccess(response.data.accessToken, response.data.refreshToken);
        }
      }),
      switchMap(() => this.fetchCurrentUser())
    );
  }

  register(payload: RegisterPayload): Observable<User> {
    return this.api.post<BackendTokenResponse>('/auth/register', payload).pipe(
      tap(response => {
        if (response.success && response.data) {
          this.handleAuthSuccess(response.data.accessToken, response.data.refreshToken);
        }
      }),
      switchMap(() => this.fetchCurrentUser())
    );
  }

  logout() {
    this.api.post<void>('/auth/logout', {}).subscribe({
      complete: () => this.clearSession(),
      error: () => this.clearSession()
    });
  }

  refreshToken(): Observable<BackendTokenResponse> {
    const refreshToken = localStorage.getItem('refreshToken');
    return this.api.post<BackendTokenResponse>('/auth/refresh', { refreshToken }).pipe(
      tap(response => {
        if (response.success && response.data) {
          this.handleAuthSuccess(response.data.accessToken, response.data.refreshToken);
        }
      })
    );
  }

  // Appel HTTP à /auth/me + mise à jour du signal
  fetchCurrentUser(): Observable<User> {
    return this.api.get<BackendMeResponse>('/auth/me').pipe(
      map(response => response.data),
      tap(user => {
        if (user?.id) {
          this._currentUser.set(user);
          localStorage.setItem('currentUser', JSON.stringify(user));
        }
      })
    );
  }

  getAccessToken(): string | null {
    return this._accessToken();
  }

  // --- Helpers privés ---

  private handleAuthSuccess(accessToken: string, refreshToken: string) {
    localStorage.setItem('accessToken', accessToken);
    localStorage.setItem('refreshToken', refreshToken);
    this._accessToken.set(accessToken);
  }

  private clearSession() {
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
    localStorage.removeItem('currentUser');
    this._currentUser.set(null);
    this._accessToken.set(null);
    this.router.navigate(['/auth/login']);
  }

  private loadUserFromStorage(): User | null {
    const raw = localStorage.getItem('currentUser');
    return raw ? JSON.parse(raw) : null;
  }
}
