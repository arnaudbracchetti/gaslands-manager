/**
 * DTO de réponse pour `GET /api/vehicles/:id/available-weapons`.
 *
 * Mirroir de `AvailableImprovementDto` (cf. `vehicle/dto/available-improvement.dto.ts`,
 * dont la note d'en-tête détaille le raisonnement `disponible`/`raison` — on ne le
 * répète pas ici). Deux différences assumées par rapport à son modèle :
 *
 *  - `prix: number` — jamais `number | string` : contrairement à `Amelioration.prix`
 *    (qui peut valoir `"x3"` pour la Tourelle, cf. SPECIFICATION.md §4.2/§7), `Arme.prix`
 *    est TOUJOURS un nombre fixe (cf. `catalog.interfaces.ts`, doc de `Arme`). Pas besoin
 *    de porter ici une variabilité qui n'existe pas côté armes — un type plus précis
 *    qu'utile serait une fausse rigueur, mais un type plus large qu'utile serait un
 *    mensonge sur les données réellement renvoyées.
 *  - `type: Arme['type']` — absent de son modèle, ajouté ICI à dessein : c'est ce qui
 *    permet au frontend de savoir, AVANT même de tenter l'ajout, si un sélecteur
 *    d'orientation doit être affiché (`type !== 'équipage'`) — cf. `weapon.entity.ts`,
 *    note d'en-tête sur la nuance d'orientation propre aux armes.
 */
import type { Arme } from '../catalog/catalog.interfaces';

export interface AvailableWeaponDto {
  nom: string;
  /** Référence catalogue stable (cf. `Vehicle.nomInterne` pour la convention `nomInterne`). */
  nomInterne: string;
  /** Coût en Jerricans — toujours un nombre pour les armes (cf. note d'en-tête). */
  prix: number;
  emplacement: number;
  /** Catégorie de l'arme — pilote l'affichage du sélecteur d'orientation côté frontend. */
  type: Arme['type'];
  /** `true` si cette arme peut être montée sur le véhicule TEL QU'IL EST actuellement. */
  disponible: boolean;
  /** Présente uniquement si `disponible` est `false` — la raison du refus, lisible par un humain. */
  raison?: string;
}
