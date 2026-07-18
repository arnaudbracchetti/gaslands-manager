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
import { Amelioration, Arme, Avantage, Sponsor, Vehicule } from '../catalog/catalog.model';
import { Team } from './team.model';

/**
 * Vue affichable d'un véhicule d'équipe — tout ce dont `TeamCard` a besoin
 * pour afficher une ligne de sa liste de véhicules.
 */
export interface VehicleSummary {
  /** Identifiant du véhicule (instance d'équipe) — utilisé pour `@for (...; track ...)`. */
  id: number;
  /** Nom affiché — personnalisé ou nom du type, déjà formaté "Nom (Type)" par le backend si différent (cf. `Vehicle.nom`). */
  nom: string;
  /** Valeur brute du nom personnalisé, `null` si jamais renommé. */
  customName: string | null;
  /** Nom du TYPE catalogue (ex. "Camion") — résolu ici, pour la carte à deux lignes (`VehicleSummaryCard`). */
  typeNom: string;
  /**
   * Coût total EXACT en jerricans : prix de base du véhicule + somme des prix de ses
   * armes et améliorations montées. Une arme montée sur Tourelle (`weapon.orientation
   * === 'tourelle'`) porte déjà son coût ×3 dans `weapon.prix`, résolu côté backend —
   * aucune approximation côté frontend.
   */
  cout: number;
  /**
   * Emplacements consommés par les armes et améliorations ACHETÉES (hors `estDefaut`).
   * Résolu en combinant `weapon` (via catalogue) et `improvement.emplacement` (déjà
   * fourni par le backend dans `VehicleImprovement.emplacement`).
   */
  emplacementsUtilises: number;
  /**
   * Capacité totale EFFECTIVE en emplacements, telle que résolue par le backend
   * (`Vehicle.emplacementsTotal`) — base catalogue + bonus des améliorations montées
   * qui l'augmentent (Remorque Moyenne +1, Remorque Lourde +3). PAS la seule fiche
   * catalogue statique (`Vehicule.emplacements`), qui ignore ce bonus.
   */
  emplacementsTotal: number;
  /**
   * Noms affichables des équipements montés (armes + améliorations non-défaut),
   * résolus depuis le catalogue du sponsor. Ordre : armes en premier, puis améliorations.
   * Utilisé pour les tags d'équipement dans `TeamEditPage`.
   */
  equipements: string[];
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
 * - Armes : `weapon.prix` = prix catalogue direct (×3 si montée sur Tourelle), jamais 0
 *   sauf bug de données ou `estDefaut` (Canon de 125mm intégré du Char d'assaut).
 * - Améliorations/armes par défaut (`estDefaut: true`) : `prix` = 0 — pas de contribution.
 */
export function buildVehicleSummary(vehicle: Vehicle, catalog: Sponsor): VehicleSummary {
  const vehiculeCatalogue: Vehicule | undefined = catalog.vehicules.find(
    (v: Vehicule): boolean => v.nom_interne === vehicle.nomInterne,
  );

  // Prix de base du véhicule — toujours depuis le catalogue (non fourni par le DTO).
  let cout: number = vehiculeCatalogue?.prix ?? 0;
  let emplacementsUtilises: number = 0;
  const equipements: string[] = [];

  // Armes : `weapon.prix` résolu côté backend ; emplacement résolu via le catalogue.
  // `weapon.sold`/`weapon.lost` (atelier uniquement, jamais posés côté construction
  // d'équipe) libèrent l'emplacement — l'arme n'est physiquement plus sur le véhicule —
  // et restent exclues des tags : seul l'équipement encore actif doit y apparaître (le
  // badge "Vendue"/barré est affiché ailleurs, dans `MountedEquipment`, pas ici). Le coût
  // reste néanmoins comptabilisé (prix résiduel auto-ajustant, cf. `Weapon.price` backend).
  // `estDefaut` (Canon de 125mm intégré du Char d'assaut) : même exclusion des tags/slots
  // que les améliorations par défaut ci-dessous — fait partie du profil de base.
  for (const weapon of vehicle.weapons) {
    cout += weapon.prix;
    if (weapon.estDefaut || weapon.sold || weapon.lost) {
      continue;
    }
    const armeCatalogue: Arme | undefined = catalog.armes.find(
      (a: Arme): boolean => a.nom_interne === weapon.nomInterne,
    );
    emplacementsUtilises += armeCatalogue?.emplacement ?? 0;
    equipements.push(armeCatalogue?.nom ?? weapon.nomInterne);
  }

  // Améliorations : `improvement.prix` et `improvement.emplacement` résolus côté backend.
  // Les défauts (`estDefaut`) ne consomment pas d'emplacement (cf. SPECIFICATION.md §5)
  // et ne sont pas listés dans les tags (ils font partie du profil de base du véhicule).
  // `sold`/`lost` sont exclus des tags pour la même raison que les armes ci-dessus.
  for (const improvement of vehicle.improvements) {
    cout += improvement.prix;
    if (improvement.estDefaut || improvement.sold || improvement.lost) {
      continue;
    }
    emplacementsUtilises += improvement.emplacement;
    const amCatalogue: Amelioration | undefined = catalog.ameliorations.find(
      (a: Amelioration): boolean => a.nom_interne === improvement.nomInterne,
    );
    equipements.push(amCatalogue?.nom ?? improvement.nomInterne);
  }

  // Avantages : `advantage.prix` ne baisse JAMAIS avec `sold` (perte totale à la
  // revente, cf. `Advantage.price` backend) — toujours comptabilisé dans le coût,
  // que l'avantage soit vendu ou non. Jamais d'emplacement à ajouter. Exclu des tags
  // une fois vendu, même raison que les armes/améliorations ci-dessus.
  for (const advantage of vehicle.advantages) {
    cout += advantage.prix;
    if (advantage.sold) {
      continue;
    }
    const avCatalogue: Avantage | undefined = catalog.avantages.find(
      (a: Avantage): boolean => a.nom_interne === advantage.nomInterne,
    );
    equipements.push(avCatalogue?.nom ?? advantage.nomInterne);
  }

  return {
    id: vehicle.id,
    nom: vehicle.nom,
    customName: vehicle.customName,
    typeNom: vehiculeCatalogue?.nom ?? vehicle.nomInterne,
    cout,
    emplacementsUtilises,
    emplacementsTotal: vehicle.emplacementsTotal,
    equipements,
  };
}
