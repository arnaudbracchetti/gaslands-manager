/**
 * HouseRulesSelector — liste des règles maison du catalogue, une case à
 * cocher par règle.
 *
 * Composant **dumb**, entièrement contrôlé par le parent (aucun état local
 * mutable, aucun appel HTTP) — même pattern que `SponsorCarousel` : l'état
 * "activé" vient de `enabledKeys` (input), chaque bascule émet `toggled` et
 * c'est le parent qui décide comment persister le changement (inclusion dans
 * un DTO de création, ou sauvegarde immédiate en modale d'édition, cf.
 * `CampaignForm`/`EditCampaignModal`).
 *
 * Porte le pattern `locked` du projet (cf. COMPONENTS.md) pour être réutilisé
 * tel quel en mode non modifiable (RM-7 — affichage lecture seule), sans
 * dupliquer le rendu.
 */
import { Component, InputSignal, OutputEmitterRef, input, output } from '@angular/core';
import type { HouseRuleDefinition } from '../campaign.model';

/** Événement émis à chaque bascule d'une règle maison. */
export interface HouseRuleToggledEvent {
  nomInterne: string;
  enabled: boolean;
}

@Component({
  selector: 'app-house-rules-selector',
  standalone: true,
  templateUrl: './house-rules-selector.html',
  styleUrl: './house-rules-selector.scss',
})
export class HouseRulesSelector {
  /** Catalogue des règles maison (GET /api/catalog/regles-maison). */
  definitions: InputSignal<HouseRuleDefinition[]> = input<HouseRuleDefinition[]>([]);

  /** Clés (nom_interne) actuellement activées. */
  enabledKeys: InputSignal<string[]> = input<string[]>([]);

  /** Lecture seule — désactive les cases (pattern `locked` du projet, cf. RM-7). */
  locked: InputSignal<boolean> = input(false);

  /** Émis avec la clé basculée et son nouvel état. */
  toggled: OutputEmitterRef<HouseRuleToggledEvent> = output<HouseRuleToggledEvent>();

  isEnabled(def: HouseRuleDefinition): boolean {
    return this.enabledKeys().includes(def.nom_interne);
  }

  onToggle(def: HouseRuleDefinition, checked: boolean): void {
    if (this.locked()) return;
    this.toggled.emit({ nomInterne: def.nom_interne, enabled: checked });
  }
}
