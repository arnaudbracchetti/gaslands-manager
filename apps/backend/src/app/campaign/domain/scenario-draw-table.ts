import type { IRandomizer } from './randomizer.interface';

/** Ce dont le tirage a besoin d'un candidat : son poids (nombre de « faces » du dé). */
export interface WeightedCandidate {
  poids_tirage: number;
}

/**
 * Tirage aléatoire pondéré d'un scénario - domain service, même famille que `WreckTable`
 * (tirage serveur non uniforme).
 *
 * Généralise la table D6 officielle (Gaslands, p.128-129) : un scénario de poids 2 occupe
 * deux faces d'un dé à `somme des poids` faces. Avec les poids de scenarios.yml, le tirage
 * reproduit exactement les tables officielles ; un scénario ajouté élargit simplement le dé.
 *
 * La classe ne connaît pas le catalogue : elle reçoit les candidats (déjà filtrés par type
 * par le use case) et en renvoie un. Générique pour rester indépendante du type `Scenario`.
 */
export class ScenarioDrawTable {
  constructor(private readonly random: IRandomizer) {}

  draw<T extends WeightedCandidate>(candidats: readonly T[]): T {
    const total = candidats.reduce((somme, c) => somme + c.poids_tirage, 0);
    if (total <= 0) {
      throw new Error(
        'Tirage de scénario impossible : aucun candidat de poids non nul.',
      );
    }

    // Jet de 1 à total, puis parcours cumulatif : le candidat i couvre les faces
    // ]cumul avant i ; cumul avant i + poids_i]. Un poids 0 ne couvre aucune face.
    const jet = this.random.roll(total);
    let cumul = 0;
    for (const candidat of candidats) {
      cumul += candidat.poids_tirage;
      if (jet <= cumul) {
        return candidat;
      }
    }
    // Inatteignable si roll() respecte son contrat (1..total).
    throw new Error(`Jet hors bornes : ${jet} sur ${total}.`);
  }
}
