// features/landing/landing.component.ts
// Rôle : page d'accueil publique de BaoBaoHealth
// Présente la plateforme et redirige vers login/register

import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { CommonModule } from '@angular/common';

@Component({
    selector: 'app-landing',
    standalone: true,
    imports: [RouterLink, CommonModule],
    templateUrl: './landing.component.html',
    styleUrl: './landing.component.scss'
})
export class LandingComponent {

    // Fonctionnalités principales affichées sur la landing
    features = [
        {
            icon: '🩺',
            title: 'Consultations',
            description: 'Suivi complet des consultations avec constantes vitales, diagnostics CIM-11 et ordonnances.'
        },
        {
            icon: '📊',
            title: 'Analytics',
            description: 'Tableaux de bord épidémiologiques, heatmaps et exports DHIS2 pour les décideurs.'
        },
        {
            icon: '💉',
            title: 'Vaccinations',
            description: 'Carnet vaccinal numérique, rappels automatiques et suivi de la couverture vaccinale.'
        },
        {
            icon: '📱',
            title: 'QR Code Patient',
            description: 'Accès instantané au dossier médical via QR code — sans papier, sans délai.'
        },
        {
            icon: '💊',
            title: 'Stocks & Paiements',
            description: 'Gestion des stocks de médicaments et paiements Orange Money / MTN MoMo.'
        },
        {
            icon: '🔔',
            title: 'Notifications SMS',
            description: 'Rappels automatiques de rendez-vous et alertes de stock par SMS.'
        }
    ];

    // Statistiques clés
    stats = [
        { value: '9', label: 'Modules' },
        { value: '62', label: 'Routes API' },
        { value: '8', label: 'Rôles' },
        { value: '18', label: 'Tables DB' }
    ];

    // Rôles utilisateurs
    roles = [
        { icon: '👤', title: 'Patient', desc: 'Dossier médical, QR code, vaccinations, paiements' },
        { icon: '🏥', title: 'Agent ASC', desc: 'Consultations, constantes vitales, stocks, planning' },
        { icon: '👨‍⚕️', title: 'Médecin', desc: 'Validation, reférencemnts, messagerie, dashboard' },
        { icon: '⚙️', title: 'Administrateur', desc: 'Analytics, rapports, gestion des structures' }
    ];
}