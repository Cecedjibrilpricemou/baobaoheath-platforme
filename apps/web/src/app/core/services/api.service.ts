// core/services/api.service.ts

import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';

@Injectable({
    providedIn: 'root'
})
export class ApiService {
    private readonly baseUrl = environment.apiUrl;
    private http = inject(HttpClient);

    get<T>(endpoint: string, params?: Record<string, string>): Observable<T> {
        let httpParams = new HttpParams();
        if (params) {
            Object.entries(params).forEach(([key, value]) => {
                httpParams = httpParams.set(key, value);
            });
        }
        return this.http.get<T>(`${this.baseUrl}${endpoint}`, { params: httpParams, withCredentials: true });
    }

    getBlob(endpoint: string): Observable<Blob> {
        return this.http.get(`${this.baseUrl}${endpoint}`, { responseType: 'blob', withCredentials: true });
    }

    post<T>(endpoint: string, body: unknown): Observable<T> {
        return this.http.post<T>(`${this.baseUrl}${endpoint}`, body, { withCredentials: true });
    }

    put<T>(endpoint: string, body: unknown): Observable<T> {
        return this.http.put<T>(`${this.baseUrl}${endpoint}`, body, { withCredentials: true });
    }

    delete<T>(endpoint: string): Observable<T> {
        return this.http.delete<T>(`${this.baseUrl}${endpoint}`, { withCredentials: true });
    }
}