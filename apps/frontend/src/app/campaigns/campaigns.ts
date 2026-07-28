/**
 * Composant Campaigns — écran de gestion des saisons Gaslands.
 *
 * Composant "smart" (cf. teams.ts) : orchestre les données et délègue
 * l'affichage à :
 *   - CampaignCard → affiche une carte de saison (nom, état, badges)
 *   - CampaignForm → formulaire de création
 *
 * Pour l'US1, seules la liste et la création sont implémentées (pas d'édition,
 * pas de suppression, pas de navigation vers un détail).
 */
import { Component, OnInit, WritableSignal, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { CampaignsService } from './campaigns.service';
import { Campaign, CreateCampaignDto } from './campaign.model';

import { CampaignCard } from './campaign-card/campaign-card';
import { CampaignForm } from './campaign-form/campaign-form';
import { TeamsService } from '../teams/teams.service';
import { Team, CreateTeamDto } from '../teams/team.model';
import { Icon } from '../shared/icon/icon';
import { ModalShell } from '../shared/modal-shell/modal-shell';

@Component({
  selector: 'app-campaigns',
  standalone: true,
  imports: [CampaignCard, CampaignForm, FormsModule, Icon, ModalShell],
  templateUrl: './campaigns.html',
  styleUrl: './campaigns.scss',
})
export class Campaigns implements OnInit {
  private campaignsService: CampaignsService = inject(CampaignsService);
  private teamsService: TeamsService = inject(TeamsService);
  private router: Router = inject(Router);

  /** Liste des saisons chargées depuis l'API */
  campaigns: WritableSignal<Campaign[]> = signal<Campaign[]>([]);

  /** Vrai pendant le chargement initial */
  loading: WritableSignal<boolean> = signal(true);

  /** Message d'erreur API affiché à l'utilisateur (vide = pas d'erreur) */
  error: WritableSignal<string> = signal('');

  /** Vrai quand le formulaire de création est visible */
  showForm: WritableSignal<boolean> = signal(false);

  /** Vrai pendant l'appel API de création (passé à CampaignForm pour désactiver les boutons) */
  saving: WritableSignal<boolean> = signal(false);

  /** Vrai pendant l'appel API de création rapide d'équipe (QuickTeamCreate) */
  creatingTeam: WritableSignal<boolean> = signal(false);

  /** Équipes de l'utilisateur connecté, pour le select de CampaignForm (CA3) */
  userTeams: WritableSignal<Team[]> = signal<Team[]>([]);

  /** Code d'invitation saisi dans la modale "Rejoindre via code" */
  joinCode: WritableSignal<string> = signal('');

  /** Vrai quand la modale "Rejoindre via code" est ouverte */
  showJoinModal: WritableSignal<boolean> = signal(false);

  /** Ids des saisons pour lesquelles l'utilisateur a une demande PENDING (US4) */
  pendingCampaignIds: WritableSignal<Set<number>> = signal(new Set<number>());

  /** campaignId → nombre de demandes PENDING à valider, pour les saisons organisées (US4) */
  organizedPendingCounts: WritableSignal<Map<number, number>> = signal(new Map<number, number>());

  ngOnInit(): void {
    this.loadCampaigns();
    this.loadUserTeams();
    this.loadPendingRequests();
    this.loadOrganizedPendingCounts();
  }

  /** Charge toutes les saisons depuis l'API et met à jour le signal */
  loadCampaigns(): void {
    this.loading.set(true);
    this.error.set('');

    this.campaignsService.getAll().subscribe({
      next: (campaigns: Campaign[]) => {
        this.campaigns.set(campaigns);
        this.loading.set(false);
      },
      error: () => {
        this.error.set('Impossible de charger vos saisons. Vérifiez votre connexion.');
        this.loading.set(false);
      },
    });
  }

  /** Charge les équipes de l'utilisateur pour le select de CampaignForm */
  private loadUserTeams(): void {
    this.teamsService.getAll().subscribe({
      next: (teams: Team[]) => this.userTeams.set(teams),
      // Une erreur ici laisse simplement userTeams vide → CampaignForm affiche
      // le message CA3 ("vous devez d'abord créer une équipe").
      error: () => this.userTeams.set([]),
    });
  }

  /**
   * Charge les saisons où l'utilisateur a une demande PENDING (badge "⏳ En
   * attente de validation"). Erreur silencieuse — badge secondaire, ne doit
   * pas bloquer l'affichage des saisons (cf. loadUserTeams).
   */
  private loadPendingRequests(): void {
    this.campaignsService.getPending().subscribe({
      next: (campaigns: Campaign[]) => this.pendingCampaignIds.set(new Set(campaigns.map((s) => s.id))),
      error: () => this.pendingCampaignIds.set(new Set()),
    });
  }

  /**
   * Charge les saisons organisées par l'utilisateur ayant des demandes
   * PENDING à valider (badge "⚠️ N à valider"). Erreur silencieuse — même
   * raisonnement que loadPendingRequests.
   */
  private loadOrganizedPendingCounts(): void {
    this.campaignsService.getOrganizingPendingRequests().subscribe({
      next: (campaigns: Campaign[]) => {
        const counts = new Map<number, number>();
        campaigns.forEach((campaign) => counts.set(campaign.id, campaign.pendingRequestsCount ?? 0));
        this.organizedPendingCounts.set(counts);
      },
      error: () => this.organizedPendingCounts.set(new Map()),
    });
  }

  /** Ouvre la modale de création */
  openCreate(): void {
    this.showForm.set(true);
  }

  /** Ferme la modale de création sans sauvegarder */
  cancelForm(): void {
    this.showForm.set(false);
  }

  /** Ouvre la modale "Rejoindre via code" */
  openJoin(): void {
    this.joinCode.set('');
    this.showJoinModal.set(true);
  }

  /** Ferme la modale "Rejoindre via code" */
  closeJoinModal(): void {
    this.showJoinModal.set(false);
  }

  /** Navigue vers la page de jointure pour le code saisi, puis ferme la modale. */
  goToJoin(): void {
    const code = this.joinCode().trim();
    if (code) {
      this.router.navigate(['/campaigns/join', code]);
      this.closeJoinModal();
    }
  }

  /**
   * Crée une nouvelle équipe (QuickTeamCreate, depuis CampaignForm) et l'ajoute
   * à userTeams — CampaignForm sélectionne automatiquement la nouvelle équipe
   * (cf. son effect() de pré-sélection).
   */
  onTeamCreated(dto: CreateTeamDto): void {
    this.creatingTeam.set(true);
    this.error.set('');

    this.teamsService.create(dto).subscribe({
      next: (team: Team) => {
        this.userTeams.update((teams) => [...teams, team]);
        this.creatingTeam.set(false);
      },
      error: () => {
        this.error.set('Erreur lors de la création de l\'équipe. Veuillez réessayer.');
        this.creatingTeam.set(false);
      },
    });
  }

  /**
   * Reçoit le DTO validé de CampaignForm et appelle l'API de création.
   */
  onSaved(dto: CreateCampaignDto): void {
    this.saving.set(true);
    this.error.set('');

    this.campaignsService.create(dto).subscribe({
      next: (campaign: Campaign) => {
        this.saving.set(false);
        this.showForm.set(false);
        // Redirige vers le détail de la saison créée (décision de design)
        this.router.navigate(['/campaigns', campaign.id]);
      },
      error: () => {
        this.error.set('Une erreur est survenue. Veuillez réessayer.');
        this.saving.set(false);
      },
    });
  }
}
