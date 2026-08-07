import { Component, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { TagModule } from 'primeng/tag';
import { SelectModule } from 'primeng/select';
import { InputTextModule } from 'primeng/inputtext';
import { SkeletonModule } from 'primeng/skeleton';
import { ApiService } from '../../../core/services/api.service';
import { TranslatePipe } from '../../../shared/pipes/translate.pipe';
import { I18nService } from '../../../shared/services/i18n.service';

interface Agent {
  id: string; telephone: string; email?: string;
  prenom: string; nom: string; role: string;
  creeLe: string; derniereConnexion?: string;
}

interface MotDePasseAffiche {
  agentNom: string;
  agentTelephone: string;
  motDePasse: string;
}

interface CreateAgentResponse {
  motDePasseTemporaire?: string;
  agent?: { prenom: string; nom: string; telephone: string };
}

@Component({
  selector: 'app-agents',
  standalone: true,
  imports: [CommonModule, FormsModule, ButtonModule, TagModule, SelectModule, InputTextModule, SkeletonModule, TranslatePipe],
  templateUrl: './agents.component.html',
  styleUrl: './agents.component.scss'
})
export class AgentsComponent implements OnInit {
  private api = inject(ApiService);
  private i18n = inject(I18nService);

  agents = signal<Agent[]>([]);
  isLoading = signal(true);
  showForm = signal(false);
  isSaving = signal(false);
  successMsg = signal('');
  errorMsg = signal('');

  mdpAffiche = signal<MotDePasseAffiche | null>(null);

  newAgent = { telephone: '', email: '', prenom: '', nom: '', role: 'ASC' };

  get rolesOptions() {
    return [
      { label: this.i18n.t('ADMIN_STRUCTURE.AGENTS.ROLE_OPTION_ASC'), value: 'ASC' },
      { label: this.i18n.t('ADMIN_STRUCTURE.AGENTS.ROLE_MEDECIN'), value: 'MEDECIN' },
      { label: this.i18n.t('ADMIN_STRUCTURE.AGENTS.ROLE_PHARMACIEN'), value: 'PHARMACIEN' }
    ];
  }

  ngOnInit() { this.loadAgents(); }

  loadAgents() {
    this.isLoading.set(true);
    this.api.get<{ data?: Agent[]; success?: boolean } | Agent[]>('/admin-structure/agents').subscribe({
      next: r => { this.agents.set(Array.isArray(r) ? r : (r as { data?: Agent[] })?.data ?? []); this.isLoading.set(false); },
      error: () => { this.isLoading.set(false); }
    });
  }

  creerAgent() {
    if (!this.newAgent.telephone || !this.newAgent.prenom || !this.newAgent.nom) {
      this.errorMsg.set(this.i18n.t('ADMIN_STRUCTURE.AGENTS.ERR_REQUIRED')); return;
    }
    this.isSaving.set(true); this.errorMsg.set('');

    const payload = {
      telephone: this.newAgent.telephone,
      prenom: this.newAgent.prenom,
      nom: this.newAgent.nom,
      role: this.newAgent.role,
      email: this.newAgent.email || undefined
    };

    this.api.post<{ data?: CreateAgentResponse } | CreateAgentResponse>('/admin-structure/agents', payload).subscribe({
      next: (r) => {
        const data = ((r as { data?: CreateAgentResponse })?.data ?? r) as CreateAgentResponse;
        this.isSaving.set(false);
        this.showForm.set(false);
        this.newAgent = { telephone: '', email: '', prenom: '', nom: '', role: 'ASC' };

        // Si email fourni → email envoyé, pas besoin d'afficher le MDP
        if (payload.email && data.motDePasseTemporaire) {
          this.successMsg.set(this.i18n.t('ADMIN_STRUCTURE.AGENTS.SUCCESS_EMAIL_SENT', { email: payload.email }));
          setTimeout(() => this.successMsg.set(''), 6000);
        } else if (data.motDePasseTemporaire) {
          // Pas d'email → afficher MDP UNE SEULE FOIS
          this.mdpAffiche.set({
            agentNom: `${data.agent?.prenom ?? ''} ${data.agent?.nom ?? ''}`,
            agentTelephone: data.agent?.telephone ?? payload.telephone,
            motDePasse: data.motDePasseTemporaire
          });
        } else {
          this.successMsg.set(this.i18n.t('ADMIN_STRUCTURE.AGENTS.SUCCESS_CREATED'));
          setTimeout(() => this.successMsg.set(''), 3000);
        }
        this.loadAgents();
      },
      error: err => { this.isSaving.set(false); this.errorMsg.set(err?.error?.error ?? this.i18n.t('ADMIN_STRUCTURE.AGENTS.ERR_CREATE')); }
    });
  }

  fermerMdp() {
    this.mdpAffiche.set(null);
    this.successMsg.set(this.i18n.t('ADMIN_STRUCTURE.AGENTS.SUCCESS_CREATED'));
    setTimeout(() => this.successMsg.set(''), 3000);
  }

  desactiver(id: string) {
    this.api.put<{ success: boolean }>(`/admin-structure/agents/${id}/desactiver`, {}).subscribe({
      next: () => { this.successMsg.set(this.i18n.t('ADMIN_STRUCTURE.AGENTS.SUCCESS_DEACTIVATED')); this.loadAgents(); },
      error: () => { }
    });
  }

  getRoleLabel(role: string): string {
    const map: Record<string, string> = {
      'ASC': this.i18n.t('ADMIN_STRUCTURE.AGENTS.ROLE_ASC'),
      'ASC_SUPERVISOR': this.i18n.t('ADMIN_STRUCTURE.AGENTS.ROLE_ASC_SUPERVISOR'),
      'MEDECIN': this.i18n.t('ADMIN_STRUCTURE.AGENTS.ROLE_MEDECIN'),
      'PHARMACIEN': this.i18n.t('ADMIN_STRUCTURE.AGENTS.ROLE_PHARMACIEN')
    };
    return map[role] ?? role;
  }

  formatDate(d: string): string {
    if (!d) return '—';
    return new Date(d).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' });
  }
}