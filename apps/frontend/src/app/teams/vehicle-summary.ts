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
   * Coût total EXACT en jerricans : prix de base du véhicule + somme des prix de ses
   * armes et améliorations montées.
   *
   * Désormais toujours précis : le backend résout le prix de chaque Tourelle
   * (`improvement.prix` = 3× le prix catalogue de l'arme assignée, ou 0 si orpheline).
   * `VehicleService.toVehicleDto` garantit que `prix` est toujours un `number` réel —
   * plus de cas `"x3"` string ni d'approximation côté frontend.
   */
  cout: number;
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
 * véhicule ; les prix des armes et améliorations sont fournis directement par le
 * backend dans `weapon.prix` et `improvement.prix` (cf. `VehicleService.toVehicleDto` —
 * règle de gestion résolue côté serveur, 0 pour les défauts).
 *
 * Le calcul est TOUJOURS exact :
 * - Armes : `weapon.prix` = prix catalogue direct (jamais 0 sauf bug de données).
 * - Améliorations par défaut (`estDefaut: true`) : `prix` = 0 — pas de contribution.
 * - Tourelle orpheline : `prix` = 0 (aucune arme assignée — coût en attente).
 * - Tourelle assignée : `prix` = 3× le prix catalogue de l'arme choisie — coût total,
 *   arme incluse (l'arme n'existe pas comme entité Weapon séparée, cf. architecture).
 */
export function buildVehicleSummary(vehicle: Vehicle, catalog: Sponsor): VehicleSummary {
  const vehiculeCatalogue: Vehicule | undefined = catalog.vehicules.find(
    (v: Vehicule): boolean => v.nom_interne === vehicle.nomInterne,
  );

  // Prix de base du véhicule — toujours depuis le catalogue (non fourni par le DTO).
  let cout: number = vehiculeCatalogue?.prix ?? 0;

  // Armes : `weapon.prix` est résolu côté backend (catalogue en mémoire → getter).
  for (const weapon of vehicle.weapons) {
    cout += weapon.prix;
  }

  // Améliorations : `improvement.prix` est résolu côté backend — toujours un number réel.
  // La Tourelle y est incluse avec son prix exact (3× arme ou 0 si orpheline/défaut).
  // Aucune logique spéciale ici — on additionne sans distinction.
  for (const improvement of vehicle.improvements) {
    cout += improvement.prix;
  }

  return {
    id: vehicle.id,
    nom: vehiculeCatalogue?.nom ?? vehicle.nomInterne,
    cout,
  };
}
