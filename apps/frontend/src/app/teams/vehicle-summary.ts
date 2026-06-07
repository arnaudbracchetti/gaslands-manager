/**
 * VehicleSummary — résumé d'un véhicule d'équipe pour l'affichage sur `TeamCard`.
 *
 * `Teams` charge, pour chaque équipe possédant au moins un véhicule, la liste
 * brute de ses véhicules (`Vehicle[]`, entités avec `nomInterne`) ET le catalogue
 * complet de son sponsor (`Sponsor`, qui contient `vehicules`/`armes`/`ameliorations`
 * avec leurs `nom`/`prix` résolus). Ce module fait le pont entre les deux : il
 * réduit chaque `Vehicle` brut en un `VehicleSummary` directement affichable —
 * EXACTEMENT le même principe de résolution que `VehicleBuilder.chosenVehicule`
 * (cf. son en-tête), mais appliqué ici à une LISTE de véhicules plutôt qu'à un seul,
 * et au coût plutôt qu'aux emplacements.
 *
 * Fonction PURE plutôt que méthode de service ou de composant : aucune dépendance
 * à Angular (pas d'injection, pas de signal) — juste une réduction de données.
 * Cela la rend trivialement testable en isolation (cf. `vehicle-summary.spec.ts`,
 * mirroir de la philosophie qui sous-tend `vehicle-build.ts`/`ok`/`fail` côté backend :
 * séparer le calcul pur de son orchestration).
 */
import { Vehicle } from './vehicle-configurator/vehicle-builder.model';
import { Sponsor, Vehicule, Arme, Amelioration } from '../catalog/catalog.model';
import { Team } from './team.model';

/**
 * Vue affichable d'un véhicule d'équipe — tout ce dont `TeamCard` a besoin
 * pour afficher une ligne de sa liste de véhicules.
 */
export interface VehicleSummary {
  /** Identifiant du véhicule (instance d'équipe) — utilisé pour `@for (...; track ...)`. */
  id: number;
  /** Nom affiché, résolu depuis le catalogue (ex. "Camion") — PAS `nomInterne`. */
  nom: string;
  /**
   * Coût total en jerricans : prix de base du véhicule + somme des prix de ses
   * armes et améliorations montées. Les Tourelles sont EXCLUES de cette somme
   * (cf. `coutApproximatif` ci-dessous) — leur coût réel ("3× le prix de l'arme
   * associée") ne peut pas être déterminé avec le modèle de données actuel.
   */
  cout: number;
  /**
   * `true` si au moins une Tourelle équipe ce véhicule — signale que `cout` est
   * un MINORANT, pas le coût réel. `TeamCard` doit alors préfixer l'affichage
   * d'un "≈" (décision actée avec l'utilisateur : ignorer la Tourelle plutôt que
   * deviner — cf. la note "Tourelle, à reprendre plus tard" dans
   * `VehicleService.getAvailableImprovements`, backend, qui documente déjà
   * l'absence de lien Tourelle ↔ Arme dans `VehicleImprovement`).
   */
  coutApproximatif: boolean;
}

/**
 * Paire (équipe, résumé de véhicule) — portée par les outputs `editVehicleClicked`/
 * `deleteVehicleClicked` de `TeamCard` (cf. leur doc).
 *
 * Pourquoi ce détour plutôt qu'émettre directement le `VehicleSummary` ou son
 * `id` ? Parce que `Teams` a besoin des DEUX informations pour agir : le
 * véhicule visé (id pour l'appel API, nom pour le message de confirmation) ET
 * l'équipe propriétaire (`VehicleEditor` exige `team` en input — cf. son en-tête,
 * elle y résout le sponsor/catalogue ; `loadTeams` après suppression a aussi
 * besoin de savoir quelle liste resynchroniser). Or `VehicleSummary` ne porte
 * délibérément PAS `teamId` (cf. sa doc, "tout ce dont `TeamCard` a besoin" —
 * une carte n'affiche qu'une seule équipe, inutile de la lui répéter par véhicule).
 * `TeamCard` connaît les deux (elle reçoit `team` en input) : c'est donc elle qui
 * doit les assembler au moment d'émettre, pas `Teams` qui devrait sinon les
 * retrouver après coup par une recherche fragile.
 */
export interface TeamVehiclePair {
  team: Team;
  vehicle: VehicleSummary;
}

/**
 * Construit le `VehicleSummary` d'un véhicule à partir du catalogue de son sponsor.
 *
 * Recoupement par `nom_interne` — même technique que `VehicleBuilder.chosenVehicule`
 * (cf. son en-tête) : c'est la clé stable qui distingue les variantes sponsor
 * (ex. "voiture" vs "voiture_prison") et relie une instance d'équipe à sa fiche
 * catalogue. Trois recherches de ce type ici (véhicule, puis une par arme/amélioration) —
 * le catalogue d'un sponsor est petit (quelques dizaines d'entrées), `find()` suffit
 * largement sans structure d'index dédiée.
 *
 * Items introuvables dans le catalogue (`nom_interne` orphelin) : repli sur
 * `nomInterne` brut pour le nom, et contribution de coût nulle. Ce cas ne devrait
 * JAMAIS se produire — le backend valide chaque ajout contre le catalogue du
 * sponsor au moment de la persistance (cf. `VehicleService.checkCandidate`/
 * `WeaponService.canAddWeapon`) — mais une incohérence de données ne doit pas
 * faire planter l'affichage : on dégrade proprement plutôt que de lancer une erreur.
 */
export function buildVehicleSummary(vehicle: Vehicle, catalog: Sponsor): VehicleSummary {
  const vehiculeCatalogue: Vehicule | undefined = catalog.vehicules.find(
    (v: Vehicule): boolean => v.nom_interne === vehicle.nomInterne,
  );

  let cout: number = vehiculeCatalogue?.prix ?? 0;
  let coutApproximatif = false;

  // Armes : `Arme.prix` est TOUJOURS un nombre (cf. `catalog.model.ts`, doc de `Arme.prix`)
  // — pas de cas particulier à gérer ici, contrairement aux améliorations ci-dessous.
  for (const weapon of vehicle.weapons) {
    const arme: Arme | undefined = catalog.armes.find(
      (a: Arme): boolean => a.nom_interne === weapon.nomInterne,
    );
    cout += arme?.prix ?? 0;
  }

  // Améliorations : `Amelioration.prix` est `number | string` — la Tourelle vaut
  // `"x3"` (cf. doc de `Amelioration.prix`). On l'EXCLUT de la somme et on lève
  // le drapeau `coutApproximatif` plutôt que de tenter une approximation hasardeuse
  // (décision actée avec l'utilisateur — cf. en-tête de `coutApproximatif`).
  for (const improvement of vehicle.improvements) {
    const amelioration: Amelioration | undefined = catalog.ameliorations.find(
      (a: Amelioration): boolean => a.nom_interne === improvement.nomInterne,
    );
    if (amelioration === undefined) continue;

    if (typeof amelioration.prix === 'number') {
      cout += amelioration.prix;
    } else {
      coutApproximatif = true;
    }
  }

  return {
    id: vehicle.id,
    nom: vehiculeCatalogue?.nom ?? vehicle.nomInterne,
    cout,
    coutApproximatif,
  };
}
