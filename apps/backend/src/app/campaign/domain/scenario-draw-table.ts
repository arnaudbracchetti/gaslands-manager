import type { IRandomizer } from './randomizer.interface';
import { GameType } from '../game.enums';

// Table officielle Gaslands (p.128-129) — jet de D6 → nom_interne du scénario.
// Index 0..5 correspond à un résultat de dé 1..6.
const EVENEMENT_TELE_TABLE: readonly string[] = [
  'course_a_la_mort',
  'course_a_la_mort',
  'arene_de_la_mort',
  'capture_du_drapeau',
  'destruction_de_drapeaux',
  'samedi_soir_en_direct',
];

const ESCARMOUCHE_TABLE: readonly string[] = [
  'operation_ferraille',
  'livraison_express',
  'chasse_au_matos',
  'chasse_au_matos',
  'la_revolution_sera_televisee',
  'massacre_de_zombies',
];

/**
 * Tirage aléatoire d'un scénario (Gaslands, p.128-129) — domain service, même famille
 * que `WreckTable` (tirage D6 serveur non-uniforme sur une table fixe).
 *
 * Retourne un `nom_interne` (pas un `Scenario` complet) : cette classe ne connaît pas
 * le catalogue, seulement la table de probabilités — la résolution
 * `nom_interne → Scenario` reste du ressort de `ScenarioCatalogService`.
 */
export class ScenarioDrawTable {
  constructor(private readonly random: IRandomizer) {}

  draw(type: GameType): string {
    const table = type === GameType.EVENEMENT_TELE ? EVENEMENT_TELE_TABLE : ESCARMOUCHE_TABLE;
    return table[this.random.roll(6) - 1];
  }
}
