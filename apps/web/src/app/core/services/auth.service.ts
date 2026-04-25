// core/services/auth.service.ts

import { Injectable, inject, signal, computed } from '@angular/core';
import { Router } from '@angular/router';
import { tap } from 'rxjs/operators';
import { ApiService } from './api.service';
import {
    User,
    AuthResponse,
    LoginPayload,
    RegisterPayload
} from '../models/user.model';

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
        return this.api.post<AuthResponse>('/auth/login', payload).pipe(
            tap(response => this.handleAuthSuccess(response))
        );
    }

    register(payload: RegisterPayload) {
        return this.api.post<AuthResponse>('/auth/register', payload).pipe(
            tap(response => this.handleAuthSuccess(response))
        );
    }

    logout() {
        this.api.post<void>('/auth/logout', {}).subscribe({
            complete: () => this.clearSession()
        });
    }

    refreshToken() {
        const refreshToken = localStorage.getItem('refreshToken');
        return this.api.post<AuthResponse>('/auth/refresh', { refreshToken }).pipe(
            tap(response => this.handleAuthSuccess(response))
        );
    }

    getMe() {
        return this.api.get<User>('/auth/me').pipe(
            tap(user => this._currentUser.set(user))
        );
    }

    getAccessToken(): string | null {
        return this._accessToken();
    }

    // --- Helpers ---

    private handleAuthSuccess(response: AuthResponse) {
        const { user, tokens } = response;
        localStorage.setItem('accessToken', tokens.accessToken);
        localStorage.setItem('refreshToken', tokens.refreshToken);
        localStorage.setItem('currentUser', JSON.stringify(user));
        this._currentUser.set(user);
        this._accessToken.set(tokens.accessToken);
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