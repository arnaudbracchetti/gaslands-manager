/**
 * Interfaces TypeScript pour le catalogue de scénarios Gaslands (mode campagne).
 *
 * Miroir fidèle de la structure YAML définie dans database_init/data/scenarios.yml.
 * Même rôle que catalog.interfaces.ts pour le catalogue de jeu : type partagé
 * entre le service de chargement (ScenarioCatalogService) et les réponses HTTP.
 */

import type { GameType } from './game.enums';

/** Scénario tel que défini dans scenarios.yml. */
export interface Scenario {
  /** Libellé affiché dans l'UI */
  nom: string;
  /** Identifiant technique stable (snake_case, sans accents) — clé du catalogue.
   *  Référencé par Game.scenarioId (FK logique vers ce catalogue). */
  nom_interne: string;
  /** Type de partie par défaut associé à ce scénario (Événement Télévisé ou Escarmouche) */
  type: GameType;
  /** Texte libre affiché dans l'UI — converti de Markdown en HTML au chargement */
  description: string;
}
