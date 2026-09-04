// core/services/auth.service.ts
import { Injectable, inject, signal, computed } from '@angular/core';
import { Router } from '@angular/router';
import { Observable, of } from 'rxjs';
import { tap, map, switchMap } from 'rxjs/operators';
import { ApiService } from './api.service';
import { User, LoginPayload, RegisterPayload } from '../models/user.model';

interface BackendAckResponse {
  success: boolean;
  data: { authenticated: boolean; };
}

interface BackendMeResponse {
  success: boolean;
  data: User;
}

interface BackendLoginResponse {
  success: boolean;
  data: {
    authenticated?: boolean;
    requiresOtp?: boolean;
    email?: string;
    message?: string;
    expiresInMinutes?: number;
  };
}

@Injectable({ providedIn: 'root' })
export class AuthService {
  private api    = inject(ApiService);
  private router = inject(Router);

  // Access/refresh/CSRF tokens all live in cookies (httpOnly for the first two) — never touched from JS.
  // User profile in localStorage for fast re-render; refreshed on every token refresh
  private _currentUser = signal<User | null>(this.loadUserFromStorage());

  currentUser           = this._currentUser.asReadonly();
  isAuthenticated       = computed(() => !!this._currentUser());
  userRole              = computed(() => this._currentUser()?.role ?? null);
  doitChangerMotDePasse = computed(() => this._currentUser()?.doitChangerMotDePasse ?? false);

  login(payload: LoginPayload): Observable<BackendLoginResponse['data']> {
    return this.api.post<BackendLoginResponse>('/auth/login', payload).pipe(
      switchMap(response => {
        if (response.success && response.data.authenticated) {
          return this.fetchCurrentUser().pipe(map(() => response.data));
        }
        return of(response.data);
      })
    );
  }

  verifyOtp(email: string, code: string): Observable<User> {
    return this.api.post<BackendAckResponse>('/auth/verify-otp', { email, code }).pipe(
      switchMap(() => this.fetchCurrentUser())
    );
  }

  register(payload: RegisterPayload): Observable<User> {
    return this.api.post<BackendAckResponse>('/auth/register', payload).pipe(
      switchMap(() => this.fetchCurrentUser())
    );
  }

  logout() {
    this.api.post<void>('/auth/logout', {}).subscribe({
      complete: () => this.clearSession(),
      error:    () => this.clearSession()
    });
  }

  // Refresh uses the HttpOnly cookie automatically — response just confirms new cookies were issued.
  refreshToken(): Observable<BackendAckResponse> {
    return this.api.post<BackendAckResponse>('/auth/refresh', {});
  }

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

  changerMotDePasse(dto: { ancienMotDePasse?: string; nouveauMotDePasse: string; }): Observable<unknown> {
    return this.api.put<unknown>('/auth/change-password', dto).pipe(
      tap(() => this.fetchCurrentUser().subscribe())
    );
  }

  forgotPassword(email: string): Observable<void> {
    return this.api.post<void>('/auth/forgot-password', { email });
  }

  resetPassword(token: string, nouveauMotDePasse: string): Observable<void> {
    return this.api.post<void>('/auth/reset-password', { token, nouveauMotDePasse });
  }

  updateProfil(dto: { prenom?: string; nom?: string; email?: string; telephone?: string; photoUrl?: string; }): Observable<User> {
    return this.api.put<BackendMeResponse>('/auth/profile', dto).pipe(
      map(response => response.data),
      tap(user => {
        if (user?.id) {
          this._currentUser.set(user);
          localStorage.setItem('currentUser', JSON.stringify(user));
        }
      })
    );
  }

  uploadAvatar(file: File): Observable<{ url: string }> {
    const formData = new FormData();
    formData.append('photo', file);
    return this.api.post<{ success: boolean; data: { url: string }; }>('/uploads/avatar', formData).pipe(
      map(response => response.data)
    );
  }

  private clearSession() {
    this._currentUser.set(null);
    localStorage.removeItem('currentUser');
    this.router.navigate(['/auth/login']);
  }

  private loadUserFromStorage(): User | null {
    try {
      const raw = localStorage.getItem('currentUser');
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }
}
