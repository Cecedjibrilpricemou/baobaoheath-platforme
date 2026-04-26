// core/services/auth.service.ts
// Adapté au format de réponse du backend BaoBaoHealth
// Format : { success: true, data: { accessToken, refreshToken, user } }

import { Injectable, inject, signal, computed } from '@angular/core';
import { Router } from '@angular/router';
import { tap } from 'rxjs/operators';
import { ApiService } from './api.service';
import {
  User,
  LoginPayload,
  RegisterPayload
} from '../models/user.model';

// Format réel de la réponse backend
interface BackendAuthResponse {
  success: boolean;
  data: {
    accessToken: string;
    refreshToken: string;
    user?: User;
  };
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
  currentUser = this._currentUser.asReadonly();
  isAuthenticated = computed(() => !!this._currentUser());
  userRole = computed(() => this._currentUser()?.role ?? null);

  // --- Auth ---

  login(payload: LoginPayload) {
    return this.api.post<BackendAuthResponse>('/auth/login', payload).pipe(
      tap(response => {
        if (response.success && response.data) {
          this.handleAuthSuccess(response.data.accessToken, response.data.refreshToken);
          // Charge le profil utilisateur après login
          this.loadCurrentUser();
        }
      })
    );
  }

  register(payload: RegisterPayload) {
    return this.api.post<BackendAuthResponse>('/auth/register', payload).pipe(
      tap(response => {
        if (response.success && response.data) {
          this.handleAuthSuccess(response.data.accessToken, response.data.refreshToken);
          this.loadCurrentUser();
        }
      })
    );
  }

  logout() {
    this.api.post<void>('/auth/logout', {}).subscribe({
      complete: () => this.clearSession(),
      error: () => this.clearSession()
    });
  }

  refreshToken() {
    const refreshToken = localStorage.getItem('refreshToken');
    return this.api.post<BackendAuthResponse>('/auth/refresh', { refreshToken }).pipe(
      tap(response => {
        if (response.success && response.data) {
          this.handleAuthSuccess(response.data.accessToken, response.data.refreshToken);
        }
      })
    );
  }

  // Charge le profil utilisateur connecté via /auth/me
  loadCurrentUser() {
    this.api.get<any>('/auth/me').subscribe({
      next: (response) => {
        // Le backend retourne { success: true, data: { user } } ou { success: true, data: user }
        const user = response?.data?.user ?? response?.data ?? response;
        if (user?.id) {
          this._currentUser.set(user);
          localStorage.setItem('currentUser', JSON.stringify(user));
        }
      },
      error: () => {}
    });
  }

  getAccessToken(): string | null {
    return this._accessToken();
  }

  // --- Helpers ---

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