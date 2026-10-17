// core/services/api.service.ts

import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams, HttpResponse } from '@angular/common/http';
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

    /**
     * Un telechargement dont on veut aussi les en-tetes.
     *
     * `getBlob` ne rend que le corps : le nom de fichier propose par le
     * serveur (`Content-Disposition`) est alors perdu, et le front doit en
     * inventer un. L'API l'expose depuis le 2026-10-03 (CORS
     * `exposedHeaders`), encore faut-il le lire.
     */
    getFichier(endpoint: string, params?: Record<string, string>): Observable<HttpResponse<Blob>> {
        let httpParams = new HttpParams();
        if (params) {
            Object.entries(params).forEach(([key, value]) => {
                httpParams = httpParams.set(key, value);
            });
        }
        return this.http.get(`${this.baseUrl}${endpoint}`, {
            params: httpParams,
            responseType: 'blob',
            observe: 'response',
            withCredentials: true,
        });
    }

    post<T>(endpoint: string, body: unknown): Observable<T> {
        return this.http.post<T>(`${this.baseUrl}${endpoint}`, body, { withCredentials: true });
    }

    put<T>(endpoint: string, body: unknown): Observable<T> {
        return this.http.put<T>(`${this.baseUrl}${endpoint}`, body, { withCredentials: true });
    }

    patch<T>(endpoint: string, body: unknown): Observable<T> {
        return this.http.patch<T>(`${this.baseUrl}${endpoint}`, body, { withCredentials: true });
    }

    delete<T>(endpoint: string): Observable<T> {
        return this.http.delete<T>(`${this.baseUrl}${endpoint}`, { withCredentials: true });
    }
}