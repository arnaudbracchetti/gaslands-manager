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
import { Sponsor, Vehicule } from '../catalog/catalog.model';
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
 * catalogue. Le catalogue est encore utilisé pour le nom et le prix de base du
 * véhicule ; les prix des armes et améliorations sont désormais fournis directement
 * par le backend dans `weapon.prix` et `improvement.prix` (cf. `VehicleService.
 * toVehicleDto` — règle de gestion résolue côté serveur, 0 pour les défauts).
 *
 * Cas Tourelle : `Amelioration.prix` vaut `"x3"` dans le catalogue, mais le backend
 * retourne `improvement.prix = 0` pour la Tourelle intégrée du Char d'assaut
 * (amélioration par défaut). Pour les Tourelles ACHETÉES par le joueur, `prix`
 * vaut également `0` dans le DTO (le coût réel ×3 reste non calculable sans lien
 * Tourelle ↔ arme — décision inchangée). On lève `coutApproximatif` si une Tourelle
 * achetée (`!estDefaut`) est présente, pour signaler le « ≈ ».
 */
export function buildVehicleSummary(vehicle: Vehicle, catalog: Sponsor): VehicleSummary {
  const vehiculeCatalogue: Vehicule | undefined = catalog.vehicules.find(
    (v: Vehicule): boolean => v.nom_interne === vehicle.nomInterne,
  );

  // Prix de base du véhicule — toujours depuis le catalogue (non fourni par le DTO).
  let cout: number = vehiculeCatalogue?.prix ?? 0;
  let coutApproximatif = false;

  // Armes : `weapon.prix` est résolu côté backend (catalogue en mémoire → getter).
  // Le frontend additionne directement sans consulter le catalogue.
  for (const weapon of vehicle.weapons) {
    cout += weapon.prix;
  }

  // Améliorations : `improvement.prix` est résolu côté backend.
  // - Défauts (`estDefaut: true`) : `prix` = 0 — pas de contribution au coût.
  // - Tourelle achetée (`estDefaut: false`, `nomInterne: "tourelle"`) : `prix` = 0
  //   aussi (coût réel ×3 non calculable, cf. en-tête). On lève `coutApproximatif`.
  for (const improvement of vehicle.improvements) {
    if (!improvement.estDefaut && improvement.nomInterne === 'tourelle') {
      coutApproximatif = true;
      // On n'ajoute pas `improvement.prix` (= 0 de toute façon) — le ≈ signale la minoration.
    } else {
      cout += improvement.prix;
    }
  }

  return {
    id: vehicle.id,
    nom: vehiculeCatalogue?.nom ?? vehicle.nomInterne,
    cout,
    coutApproximatif,
  };
}
