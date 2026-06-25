import type { VehicleType } from './value-objects/vehicle-type';
import type { WeaponType } from './value-objects/weapon-type';
import type { ImprovementType } from './value-objects/improvement-type';

/**
 * Contrat d'accès au catalogue de jeu depuis la couche domaine.
 *
 * Le domaine a besoin de consulter le catalogue (véhicules, armes, améliorations)
 * pour appliquer ses règles métier — par exemple vérifier si une arme est de type
 * équipage, ou quel est le coût d'une amélioration. Mais il ne doit pas dépendre
 * directement de CatalogService (une classe NestJS qui lit des fichiers YAML).
 *
 * Cette interface est le contrat que le domaine définit. CatalogService l'implémente
 * en production ; une implémentation fictive peut l'implémenter en test sans toucher
 * au système de fichiers.
 *
 * Toutes les méthodes retournent des Value Objects du domaine (VehicleType, WeaponType,
 * ImprovementType) et non les types raw du catalogue — le domaine ne manipule jamais
 * les interfaces YAML directement.
 */
export interface ICatalogRepository {
  /**
   * Résout un type de véhicule par son identifiant technique (nom_interne).
   * Utilisé à la création d'un véhicule pour valider que le type demandé existe
   * dans le catalogue et récupérer ses caractéristiques (slots, prix, stats).
   * Retourne undefined si le nom_interne est inconnu.
   */
  getVehicleType(nomInterne: string): VehicleType | undefined;

  /**
   * Résout un type d'arme par son identifiant technique (nom_interne).
   * Utilisé lors de l'ajout d'une arme à un véhicule pour accéder à ses
   * propriétés métier (prix, emplacements, isEquipage, requiresOrientation).
   * Retourne undefined si le nom_interne est inconnu.
   */
  getWeaponType(nomInterne: string): WeaponType | undefined;

  /**
   * Résout un type d'amélioration par son identifiant technique (nom_interne).
   * Utilisé lors de l'ajout d'une amélioration pour accéder à ses propriétés
   * métier (prix, emplacements, isTourelle, comportement du décorateur).
   * Retourne undefined si le nom_interne est inconnu.
   */
  getImprovementType(nomInterne: string): ImprovementType | undefined;

  /**
   * Liste tous les types de véhicules autorisés pour un sponsor donné.
   * Utilisé pour présenter les choix disponibles lors de la création d'un véhicule,
   * et pour valider que le véhicule choisi est bien dans le catalogue du sponsor.
   * Retourne un tableau vide si le sponsor est inconnu.
   */
  getVehicleTypesForSponsor(sponsorNom: string): VehicleType[];

  /**
   * Liste tous les types d'armes autorisés pour un sponsor donné.
   * Utilisé pour calculer les verdicts de disponibilité (GET /available-weapons)
   * et valider qu'une arme ajoutée appartient bien au catalogue du sponsor.
   * Retourne un tableau vide si le sponsor est inconnu.
   */
  getWeaponTypesForSponsor(sponsorNom: string): WeaponType[];

  /**
   * Liste tous les types d'améliorations autorisés pour un sponsor donné.
   * Utilisé pour calculer les verdicts de disponibilité (GET /available-improvements)
   * et valider qu'une amélioration ajoutée appartient bien au catalogue du sponsor.
   * Retourne un tableau vide si le sponsor est inconnu.
   */
  getImprovementTypesForSponsor(sponsorNom: string): ImprovementType[];
}
