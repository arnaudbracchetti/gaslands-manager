import type { Vehicle } from './vehicle';

/**
 * Contrat d'accès aux véhicules persistés depuis la couche domaine.
 *
 * Le domaine a besoin de charger et sauvegarder des agrégats Vehicle, mais
 * ne doit pas dépendre de TypeORM. Cette interface définit le contrat ;
 * VehicleRepository l'implémente via TypeORM en infrastructure.
 *
 * Toutes les méthodes de chargement vérifient l'appartenance via userId :
 * un véhicule introuvable ou n'appartenant pas à l'utilisateur lève une
 * NotFoundException — les deux cas sont indiscernables pour l'appelant
 * (principe de non-divulgation d'existence).
 */
export interface IVehicleRepository {
  /**
   * Charge un agrégat Vehicle par son id, uniquement s'il appartient
   * (via son équipe) à l'utilisateur connecté.
   * Lève NotFoundException si introuvable ou appartenance échouée.
   */
  findByIdForUser(id: number, userId: number): Promise<Vehicle>;

  /**
   * Liste tous les agrégats Vehicle d'une équipe.
   * Vérifie au préalable que l'équipe appartient à userId.
   * Lève NotFoundException si l'équipe est introuvable ou n'appartient pas à userId.
   */
  findAllForTeam(teamId: number, userId: number): Promise<Vehicle[]>;

  /**
   * Calcule le budget restant de l'équipe propriétaire du véhicule.
   * Budget restant = team.cans - somme des coûts de tous les véhicules de l'équipe.
   * Nécessite de charger tous les véhicules de l'équipe pour sommer leurs coûts.
   */
  getRemainingBudget(vehicleId: number, userId: number): Promise<number>;

  /**
   * Persiste l'état courant de l'agrégat (armes et améliorations incluses).
   * Utilisé après chaque mutation (addWeapon, addImprovement, etc.).
   */
  save(vehicle: Vehicle): Promise<Vehicle>;

  /**
   * Charge l'agrégat Vehicle propriétaire d'une arme donnée.
   * Nécessaire pour la route DELETE /weapons/:id qui reçoit un weaponId.
   * Lève NotFoundException si introuvable ou appartenance échouée.
   */
  findByWeaponId(weaponId: number, userId: number): Promise<Vehicle>;

  /**
   * Supprime le véhicule et tout son équipement (cascade).
   * Lève NotFoundException si introuvable ou appartenance échouée.
   */
  remove(id: number, userId: number): Promise<void>;
}
