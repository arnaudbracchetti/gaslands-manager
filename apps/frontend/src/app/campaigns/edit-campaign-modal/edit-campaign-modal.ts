/**
 * EditCampaignModal — modification d'une campagne (organisateur uniquement).
 *
 * Composant **dumb** : reçoit la campagne courante, pré-remplit le formulaire
 * nom/budget, valide localement (nom non vide) puis émet un `UpdateCampaignDto`.
 * Contrairement à `ChangeTeamModal`, ne se ferme JAMAIS automatiquement sur
 * `confirmed` — c'est le parent (CampaignDetail) qui décide de la fermeture,
 * uniquement en cas de succès serveur, pour que l'erreur de budget (`error`
 * input) reste visible et corrigeable sans rouvrir la modale.
 *
 * Nom/budget restent réservés à `EN_CONSTRUCTION` (`canEditNameBudget`, champs
 * désactivés sinon) — mais la modale elle-même reste accessible dans tout état
 * de la campagne : les règles maison (`HouseRulesSelector`) n'ont, elles,
 * aucune contrainte d'état (cf. spec/CAMPAIGN.md — Règles maison). Elles ne
 * rejoignent pas `UpdateCampaignDto`/`onConfirm()` : chaque bascule est
 * auto-sauvegardée par le parent via le output dédié `houseRuleToggled`, sur
 * la route backend séparée `PUT .../house-rules`.
 */
import { Component, InputSignal, OutputEmitterRef, Signal, WritableSignal, computed, effect, input, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import type { Campaign, UpdateCampaignDto, HouseRuleDefinition } from '../campaign.model';
import { Icon } from '../../shared/icon/icon';
import { ModalShell } from '../../shared/modal-shell/modal-shell';
import { HouseRulesSelector, HouseRuleToggledEvent } from '../house-rules-selector/house-rules-selector';

@Component({
  selector: 'app-edit-campaign-modal',
  standalone: true,
  imports: [FormsModule, Icon, ModalShell, HouseRulesSelector],
  templateUrl: './edit-campaign-modal.html',
  styleUrl: './edit-campaign-modal.scss',
})
export class EditCampaignModal {
  /** Campagne à modifier — sert de pré-remplissage. */
  campaign: InputSignal<Campaign> = input.required<Campaign>();

  /** Vrai pendant que le parent attend la réponse de l'API (nom/budget). */
  saving: InputSignal<boolean> = input(false);

  /** Message d'erreur serveur (ex. budget trop bas pour une équipe déjà engagée). */
  error: InputSignal<string> = input('');

  /** Catalogue des règles maison (GET /api/catalog/regles-maison). */
  houseRuleCatalog: InputSignal<HouseRuleDefinition[]> = input<HouseRuleDefinition[]>([]);

  /** Vrai pendant que le parent attend la réponse de la sauvegarde d'une règle maison. */
  savingHouseRules: InputSignal<boolean> = input(false);

  /** Message d'erreur serveur pour la dernière bascule de règle maison. */
  houseRulesError: InputSignal<string> = input('');

  /** Émis avec le DTO validé localement. */
  confirmed: OutputEmitterRef<UpdateCampaignDto> = output<UpdateCampaignDto>();

  /** Émis quand l'utilisateur annule sans modifier. */
  cancelled: OutputEmitterRef<void> = output<void>();

  /** Émis à chaque bascule d'une règle maison — le parent persiste immédiatement. */
  houseRuleToggled: OutputEmitterRef<HouseRuleToggledEvent> = output<HouseRuleToggledEvent>();

  formName: WritableSignal<string> = signal('');
  formBudget: WritableSignal<number> = signal(1);

  /** Erreur de validation locale (nom vide) — distincte de l'erreur serveur `error`. */
  formError: WritableSignal<string> = signal('');

  /** Erreur affichée : locale en priorité, sinon celle transmise par le parent. */
  displayError: Signal<string> = computed(() => this.formError() || this.error());

  /** Nom/budget ne sont modifiables qu'en construction — les règles maison, elles, le restent toujours. */
  canEditNameBudget: Signal<boolean> = computed(() => this.campaign().state === 'EN_CONSTRUCTION');

  constructor() {
    // Pré-remplit le formulaire depuis la campagne courante à chaque ouverture.
    effect(() => {
      const campaign = this.campaign();
      this.formName.set(campaign.name);
      this.formBudget.set(campaign.budget);
    });
  }

  onConfirm(): void {
    const name = this.formName().trim();
    if (!name) {
      this.formError.set('Le nom de la saison est obligatoire.');
      return;
    }
    this.formError.set('');
    this.confirmed.emit({ name, budget: this.formBudget() });
  }
}
