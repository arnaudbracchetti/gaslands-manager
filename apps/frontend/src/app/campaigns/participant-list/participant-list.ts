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
 */
import { Component, InputSignal, OutputEmitterRef, Signal, computed, input, output } from '@angular/core';
import { RouterLink } from '@angular/router';
import { CampaignParticipant } from '../campaign-participant.model';

@Component({
  selector: 'app-participant-list',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './participant-list.html',
  styleUrl: './participant-list.scss',
})
export class ParticipantList {
  /** Tous les participants de la saison (tous statuts). */
  participants: InputSignal<CampaignParticipant[]> = input.required<CampaignParticipant[]>();

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

  /** Vrai quand l'équipe est encore modifiable (saison EN_CONSTRUCTION). */
  canChangeTeam: InputSignal<boolean> = input(false);

  /** Émis au clic sur "Modifier l'équipe" — le parent possède la liste des équipes. */
  changeTeam: OutputEmitterRef<void> = output<void>();

  /** Id de la saison courante — utilisé pour construire le lien de retour vers TeamEditPage. */
  campaignId: InputSignal<number | undefined> = input<number | undefined>(undefined);

  private organizerCount: Signal<number> = computed(
    () => this.participants().filter((p) => p.isOrganizer && p.status === 'VALIDATED').length,
  );

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

  avatarInitials(participant: CampaignParticipant): string {
    return participant.userName
      .split(' ')
      .map((w: string) => w[0] ?? '')
      .slice(0, 2)
      .join('')
      .toUpperCase();
  }
}
