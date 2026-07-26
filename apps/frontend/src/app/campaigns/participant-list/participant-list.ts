/**
 * Composant ParticipantList — liste unifiée de tous les participants d'une saison.
 *
 * Composant "dumb" : reçoit la liste complète (tous statuts) et le contexte via
 * inputs, calcule localement quelles actions sont disponibles par ligne selon le
 * statut et le rôle. Plus de prop `actions` discriminante — le composant encapsule
 * toutes les règles de visibilité.
 *
 * Actions par ligne (organisateur uniquement, hors soi-même) :
 *   - PENDING  : Valider / Refuser
 *   - VALIDATED non-orga : Promouvoir / Retirer
 *   - Orga (autre que soi) : Retirer (sauf dernier organisateur)
 *   - REJECTED : Valider
 *
 * Le menu ⋯ (hors soi-même) est visible par TOUT participant, pas seulement
 * l'organisateur : "Voir l'historique" y est toujours proposé (même règle de
 * visibilité que le journal d'une partie — tout participant VALIDATED, même
 * pour un tiers). Les actions organisateur ci-dessus restent gated dedans.
 *
 * Classement : la liste est triée par Points de Championnat décroissants
 * (tri stable — tant qu'aucun point n'existe, l'ordre reste celui d'origine).
 * Les PC ne sont affichés que pour les participants VALIDATED.
 */
import { Component, InputSignal, OutputEmitterRef, Signal, WritableSignal, computed, input, output, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { CampaignParticipant } from '../campaign-participant.model';
import { CampaignState } from '../campaign.model';
import { Icon } from '../../shared/icon/icon';

@Component({
  selector: 'app-participant-list',
  standalone: true,
  imports: [RouterLink, Icon],
  templateUrl: './participant-list.html',
  styleUrl: './participant-list.scss',
})
export class ParticipantList {
  /** Tous les participants de la saison (tous statuts). */
  participants: InputSignal<CampaignParticipant[]> = input.required<CampaignParticipant[]>();

  /** PC par participantId — absent = 0 (aucune partie jouée pour ce participant). */
  championshipPoints: InputSignal<ReadonlyMap<number, number>> = input<ReadonlyMap<number, number>>(
    new Map(),
  );

  /** Vrai si l'utilisateur connecté est organisateur de cette saison. */
  isOrganizer: InputSignal<boolean> = input(false);

  /** Id de l'utilisateur connecté — pour identifier sa propre ligne. */
  currentUserId: InputSignal<number | undefined> = input<number | undefined>(undefined);

  /** Émis au clic sur "Valider" (accept: true) ou "Refuser" (accept: false). */
  validate: OutputEmitterRef<{ pid: number; accept: boolean }> = output<{ pid: number; accept: boolean }>();

  /** Émis au clic sur "Retirer", avec l'id du CampaignParticipant ciblé. */
  remove: OutputEmitterRef<number> = output<number>();

  /** Émis au clic sur "Promouvoir", avec l'id du CampaignParticipant ciblé. */
  promote: OutputEmitterRef<number> = output<number>();

  /** Émis au clic sur "Voir l'historique" (soi-même ou via le menu ⋯), avec l'id du CampaignParticipant ciblé. */
  viewJournal: OutputEmitterRef<number> = output<number>();

  /** Émis au clic sur "Fiche d'équipe" (soi-même ou via le menu ⋯, organisateur), avec l'id du CampaignParticipant ciblé. */
  exportSheet: OutputEmitterRef<number> = output<number>();

  /** Vrai quand l'équipe est encore modifiable (saison EN_CONSTRUCTION). */
  canChangeTeam: InputSignal<boolean> = input(false);

  /** Émis au clic sur "Modifier l'équipe" — le parent possède la liste des équipes. */
  changeTeam: OutputEmitterRef<void> = output<void>();

  /** Id de la saison courante — utilisé pour construire le lien "Gérer mon équipe" (TeamEditPage ou Atelier). */
  campaignId: InputSignal<number | undefined> = input<number | undefined>(undefined);

  /** État courant de la saison — pilote la cible du lien "Gérer mon équipe". */
  campaignState: InputSignal<CampaignState | undefined> = input<CampaignState | undefined>(undefined);

  /** Vrai si une partie de la saison est actuellement en statut ATELIER. */
  hasAtelierGame: InputSignal<boolean> = input(false);

  /**
   * Cible du lien "Gérer mon équipe" — construction d'équipe tant que la
   * saison est EN_CONSTRUCTION, sinon l'Atelier si (et seulement si) une
   * partie y est actuellement ouverte. `null` = campagne démarrée sans
   * atelier ouvert — le lien reste affiché mais grisé (cf. template).
   */
  manageTeamMode: Signal<'edit' | 'atelier' | null> = computed(() => {
    if (this.campaignState() === 'EN_CONSTRUCTION') return 'edit';
    if (this.hasAtelierGame()) return 'atelier';
    return null;
  });

  /**
   * Id du participant dont le menu ⋯ (actions secondaires) est actuellement
   * ouvert — un seul à la fois, `null` si aucun. Purement présentationnel :
   * ne change aucune des règles can*() ci-dessous, seulement leur groupement
   * visuel (inline vs. menu).
   */
  openMenuId: WritableSignal<number | null> = signal<number | null>(null);

  private organizerCount: Signal<number> = computed(
    () => this.participants().filter((p) => p.isOrganizer && p.status === 'VALIDATED').length,
  );

  /**
   * Tri stable décroissant par PC (défaut 0). Tant qu'aucun point n'a été
   * marqué, tous les PC sont égaux (0) donc l'ordre affiché reste celui
   * d'origine — aucun cas particulier à gérer pour "aucune partie jouée".
   */
  sortedParticipants: Signal<CampaignParticipant[]> = computed(() => {
    const points = this.championshipPoints();
    return [...this.participants()].sort(
      (a, b) => (points.get(b.id) ?? 0) - (points.get(a.id) ?? 0),
    );
  });

  pointsFor(participant: CampaignParticipant): number {
    return this.championshipPoints().get(participant.id) ?? 0;
  }

  onValidate(pid: number, accept: boolean): void {
    this.validate.emit({ pid, accept });
  }

  onRemove(pid: number): void {
    this.remove.emit(pid);
  }

  isSelf(participant: CampaignParticipant): boolean {
    return participant.userId === this.currentUserId();
  }

  /** Dernier organisateur validé — empêche de le retirer ou refuser (saison orpheline). */
  isLastOrganizer(participant: CampaignParticipant): boolean {
    return participant.isOrganizer && this.organizerCount() <= 1;
  }

  canValidate(participant: CampaignParticipant): boolean {
    return this.isOrganizer() && !this.isSelf(participant) && participant.status === 'PENDING';
  }

  canReject(participant: CampaignParticipant): boolean {
    return (
      this.isOrganizer() &&
      !this.isSelf(participant) &&
      (participant.status === 'PENDING' || participant.status === 'VALIDATED') &&
      !this.isLastOrganizer(participant)
    );
  }

  canPromote(participant: CampaignParticipant): boolean {
    return (
      this.isOrganizer() &&
      !this.isSelf(participant) &&
      participant.status === 'VALIDATED' &&
      !participant.isOrganizer
    );
  }

  canRetire(participant: CampaignParticipant): boolean {
    return (
      this.isOrganizer() &&
      !this.isSelf(participant) &&
      participant.status !== 'REJECTED' &&
      !this.isLastOrganizer(participant)
    );
  }

  canRevalidate(participant: CampaignParticipant): boolean {
    return this.isOrganizer() && !this.isSelf(participant) && participant.status === 'REJECTED';
  }

  /**
   * Regroupement présentationnel des actions organisateur (carte compacte) :
   * la décision d'accepter/refuser une demande (PENDING) reste inline, en
   * icône — c'est l'action la plus fréquente et la plus urgente. Le reste
   * (Refuser un VALIDATED, Promouvoir, Retirer) passe dans le menu ⋯ — des
   * actions de maintenance occasionnelles, pas de nouvelle règle métier.
   */
  showInlineReject(participant: CampaignParticipant): boolean {
    return this.canReject(participant) && participant.status === 'PENDING';
  }

  showMenuReject(participant: CampaignParticipant): boolean {
    return this.canReject(participant) && participant.status === 'VALIDATED';
  }

  toggleMenu(pid: number): void {
    this.openMenuId.set(this.openMenuId() === pid ? null : pid);
  }

  closeMenu(): void {
    this.openMenuId.set(null);
  }

  onMenuPromote(pid: number): void {
    this.closeMenu();
    this.promote.emit(pid);
  }

  onMenuReject(pid: number): void {
    this.closeMenu();
    this.onValidate(pid, false);
  }

  onMenuRemove(pid: number): void {
    this.closeMenu();
    this.onRemove(pid);
  }

  onViewJournal(pid: number): void {
    this.viewJournal.emit(pid);
  }

  onMenuViewJournal(pid: number): void {
    this.closeMenu();
    this.viewJournal.emit(pid);
  }

  onMenuExportSheet(pid: number): void {
    this.closeMenu();
    this.exportSheet.emit(pid);
  }

  /**
   * Ligne 2 atténuée : équipe · PC (VALIDATED) ou équipe · statut
   * (PENDING/REJECTED) — remplace les badges pleins pour réduire l'emprise
   * visuelle de chaque carte. Chaîne vide = ligne 2 absente du DOM.
   */
  metaText(participant: CampaignParticipant): string {
    const parts: string[] = [];
    if (participant.teamName) parts.push(participant.teamName);
    if (participant.status === 'VALIDATED') parts.push(`${this.pointsFor(participant)} PC`);
    else if (participant.status === 'PENDING') parts.push('En attente');
    else if (participant.status === 'REJECTED') parts.push('Refusé');
    return parts.join(' · ');
  }

  avatarInitials(participant: CampaignParticipant): string {
    return participant.userName
      .split(' ')
      .map((w: string) => w[0] ?? '')
      .slice(0, 2)
      .join('')
      .toUpperCase();
  }
}
