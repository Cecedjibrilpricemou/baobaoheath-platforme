import { Component, inject, signal, OnInit } from '@angular/core';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../../core/services/api.service';
import { TranslatePipe } from '../../../shared/pipes/translate.pipe';
import { I18nService } from '../../../shared/services/i18n.service';
import type { AgentStructureView, CreationAgentView, HorodatageApi } from '@baobaoheath/shared-types';

// Contenu de la modale de confirmation : assemble cote client. L'adresse
// email affichee provient de la saisie, l'API ne la renvoie pas.
interface MotDePasseAffiche {
  agentNom: string;
  agentTelephone: string;
  motDePasse: string;
  emailEnvoye?: string;
}

@Component({
  selector: 'app-agents',
  standalone: true,
  imports: [
    MatFormFieldModule, MatInputModule, MatSelectModule,CommonModule, FormsModule, TranslatePipe],
  templateUrl: './agents.component.html',
  styleUrl: './agents.component.scss'
})
export class AgentsComponent implements OnInit {
  private api = inject(ApiService);
  private i18n = inject(I18nService);

  agents = signal<AgentStructureView[]>([]);
  isLoading = signal(true);
  showForm = signal(false);
  isSaving = signal(false);
  successMsg = signal('');
  errorMsg = signal('');

  mdpAffiche = signal<MotDePasseAffiche | null>(null);

  /**
   * Affiche un message, et **annule celui d'avant**.
   *
   * Chaque annonce programmait son propre effacement sans toucher au
   * precedent : deux gestes a moins de quatre secondes d'intervalle, et la
   * minuterie du premier effacait la confirmation du second — l'agent voyait
   * son message disparaitre aussitot et doutait d'avoir reussi.
   */
  private minuterie?: ReturnType<typeof setTimeout>;

  private annoncer(message: string, type: 'succes' | 'erreur' = 'succes', duree = 4000) {
    clearTimeout(this.minuterie);
    if (type === 'succes') { this.successMsg.set(message); this.errorMsg.set(''); }
    else { this.errorMsg.set(message); this.successMsg.set(''); }
    this.minuterie = setTimeout(() => { this.successMsg.set(''); this.errorMsg.set(''); }, duree);
  }

  newAgent = { telephone: '', email: '', prenom: '', nom: '', role: 'ASC' };

  // ── Le bureau du medecin (addendum, point 2) ───────────────────────
  //
  // **Il ne se saisit pas a la creation du compte.** Un medecin demenage, un
  // service est redecoupe : la valeur serait fausse en quelques mois, et un
  // bureau faux est pire que pas de bureau — le patient y va.
  //
  // Facultatif : beaucoup d'hopitaux ne numerotent pas leurs bureaux, et
  // l'agent d'accueil accompagne le patient a pied. Vider le champ efface.
  bureauEnEdition = signal<string | null>(null);
  bureauSaisi = '';

  ouvrirBureau(agent: AgentStructureView) {
    this.bureauEnEdition.set(agent.id);
    this.bureauSaisi = agent.bureau ?? '';
  }

  annulerBureau() {
    this.bureauEnEdition.set(null);
    this.bureauSaisi = '';
  }

  enregistrerBureau(id: string) {
    const saisi = this.bureauSaisi.trim();
    this.api.put<{ success: boolean; message?: string }>(
      `/admin-structure/agents/${id}/bureau`,
      { bureau: saisi.length > 0 ? saisi : null },
    ).subscribe({
      next: (r) => {
        this.annulerBureau();
        this.annoncer(r?.message ?? this.i18n.t('ADMIN_STRUCTURE.AGENTS.BUREAU_OK'));
        this.loadAgents();
      },
      error: (err) => {
        this.annoncer(err?.error?.error ?? this.i18n.t('ADMIN_STRUCTURE.AGENTS.ERR_CREATE'), 'erreur');
      },
    });
  }

  get rolesOptions() {
    return [
      { label: this.i18n.t('ADMIN_STRUCTURE.AGENTS.ROLE_OPTION_ASC'), value: 'ASC' },
      { label: this.i18n.t('ADMIN_STRUCTURE.AGENTS.ROLE_MEDECIN'), value: 'MEDECIN' },
      { label: this.i18n.t('ADMIN_STRUCTURE.AGENTS.ROLE_PHARMACIEN'), value: 'PHARMACIEN' },
      { label: this.i18n.t('ADMIN_STRUCTURE.AGENTS.ROLE_AGENT_ACCUEIL'), value: 'AGENT_ACCUEIL' },
      { label: this.i18n.t('ADMIN_STRUCTURE.AGENTS.ROLE_TECHNICIEN_LABO'), value: 'TECHNICIEN_LABO' }
    ];
  }

  ngOnInit() { this.loadAgents(); }

  loadAgents() {
    this.isLoading.set(true);
    this.api.get<{ data?: AgentStructureView[]; success?: boolean } | AgentStructureView[]>('/admin-structure/agents').subscribe({
      next: r => { this.agents.set(Array.isArray(r) ? r : (r as { data?: AgentStructureView[] })?.data ?? []); this.isLoading.set(false); },
      error: () => { this.isLoading.set(false); }
    });
  }

  creerAgent() {
    if (!this.newAgent.telephone || !this.newAgent.prenom || !this.newAgent.nom || !this.newAgent.email) {
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

    this.api.post<{ data?: CreationAgentView } | CreationAgentView>('/admin-structure/agents', payload).subscribe({
      next: (r) => {
        const data = ((r as { data?: CreationAgentView })?.data ?? r) as CreationAgentView;
        this.isSaving.set(false);
        this.showForm.set(false);
        this.newAgent = { telephone: '', email: '', prenom: '', nom: '', role: 'ASC' };

        // Le mot de passe temporaire est toujours affiché ici : l'envoi d'email
        // peut échouer silencieusement côté serveur, il ne faut jamais faire
        // dépendre l'accès au compte de sa réception.
        if (data.motDePasseTemporaire) {
          this.mdpAffiche.set({
            agentNom: `${data.agent?.prenom ?? ''} ${data.agent?.nom ?? ''}`,
            agentTelephone: data.agent?.telephone ?? payload.telephone,
            motDePasse: data.motDePasseTemporaire,
            emailEnvoye: payload.email
          });
        } else {
          this.annoncer(this.i18n.t('ADMIN_STRUCTURE.AGENTS.SUCCESS_CREATED'));
        }
        this.loadAgents();
      },
      error: err => { this.isSaving.set(false); this.errorMsg.set(err?.error?.error ?? this.i18n.t('ADMIN_STRUCTURE.AGENTS.ERR_CREATE')); }
    });
  }

  fermerMdp() {
    this.mdpAffiche.set(null);
    this.annoncer(this.i18n.t('ADMIN_STRUCTURE.AGENTS.SUCCESS_CREATED'));
  }

  desactiver(id: string) {
    this.api.put<{ success: boolean }>(`/admin-structure/agents/${id}/desactiver`, {}).subscribe({
      next: () => { this.annoncer(this.i18n.t('ADMIN_STRUCTURE.AGENTS.SUCCESS_DEACTIVATED')); this.loadAgents(); },
      error: () => { }
    });
  }

  getRoleLabel(role: string): string {
    const map: Record<string, string> = {
      'ASC': this.i18n.t('ADMIN_STRUCTURE.AGENTS.ROLE_ASC'),
      'ASC_SUPERVISOR': this.i18n.t('ADMIN_STRUCTURE.AGENTS.ROLE_ASC_SUPERVISOR'),
      'MEDECIN': this.i18n.t('ADMIN_STRUCTURE.AGENTS.ROLE_MEDECIN'),
      'PHARMACIEN': this.i18n.t('ADMIN_STRUCTURE.AGENTS.ROLE_PHARMACIEN'),
      'AGENT_ACCUEIL': this.i18n.t('ADMIN_STRUCTURE.AGENTS.ROLE_AGENT_ACCUEIL'),
      'TECHNICIEN_LABO': this.i18n.t('ADMIN_STRUCTURE.AGENTS.ROLE_TECHNICIEN_LABO')
    };
    return map[role] ?? role;
  }

  formatDate(d: HorodatageApi | null | undefined): string {
    if (!d) return '—';
    return new Date(d).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' });
  }
}