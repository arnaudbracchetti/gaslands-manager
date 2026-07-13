import type { VehicleType } from '../../../team/domain/value-objects/vehicle-type';
import type { WeaponType } from '../../../team/domain/value-objects/weapon-type';
import type { ImprovementType } from '../../../team/domain/value-objects/improvement-type';
import type { AdvantageType } from '../../../team/domain/value-objects/advantage-type';
import type { SequellaType } from '../../../team/domain/value-objects/sequella-type';
import type { WeaponOrientation } from '../../../team/domain/team';
import type { EquipmentOperation, EquipmentEntityType } from '../enums/equipment-change.enums';
import type { GameEvent } from '../events/game-event';

/**
 * Un véhicule ennemi détruit par un participant (exploit, US-B2). `weightClass`
 * n'est PAS transmis par l'appelant — dérivé côté serveur depuis le véhicule réel
 * (recherche à travers toutes les équipes de la campagne), pour empêcher un appelant
 * de désigner n'importe quel véhicule comme `FORTERESSE` (barème +5 PC) sans qu'un
 * tel véhicule existe.
 */
export interface DestroyedVehicleInput {
  vehicleId: number;
}

/** Un rang attribué à un participant lors de l'enregistrement d'un résultat. */
export interface RankingInput {
  participantId: number;
  rank: number;
  /** Portes franchies (exploit, US-B2) — 0/absent si aucune. */
  gatesCrossed?: number;
  /** Véhicules ennemis détruits par poids (exploit, US-B2) — vide/absent si aucun. */
  destroyedVehicles?: DestroyedVehicleInput[];
}

/** Commande d'achat/revente d'équipement en atelier — VO catalogue déjà résolus par le use case. */
export interface ChangeEquipmentInput {
  operation: EquipmentOperation;
  entityType: EquipmentEntityType;
  /** Nom interne du catalogue — requis pour BUY, optionnel pour SELL. */
  nomInterne: string;
  /** Véhicule hôte — requis pour BUY_WEAPON, SELL_WEAPON ; id de la cible pour SELL_VEHICLE. */
  targetVehicleId?: number | null;
  /** Id de l'entité à vendre — requis pour SELL. */
  targetEntityId?: number | null;
  /** WEAPON : 5 valeurs possibles (dont `'tourelle'` — arc à 360°, coût ×3). */
  orientation?: WeaponOrientation | null;
  resolvedVehicleType: VehicleType | null;
  resolvedWeaponType: WeaponType | null;
  resolvedImprovementType: ImprovementType | null;
  resolvedAdvantageType: AdvantageType | null;
  resolvedSequellaType: SequellaType | null;
  /** BUY(SEQUELLE, 'dur_a_cuire') uniquement — avantage gratuit choisi à l'achat. */
  resolvedFreeAdvantageType: AdvantageType | null;
}

/** Une ligne du journal d'une partie — événement traduit en texte lisible. */
export interface GameJournalEntry {
  eventId: number;
  participantId: number;
  description: string;
}

/**
 * Résultat de `Game.changeEquipment` — discrimine annulation d'achat (suppression pure
 * d'un ou plusieurs événements de cette session, `events` vide) vs achat/revente normal
 * (événement créé, `deleteEventIds` vide). Cf. annulation vs revente.
 *
 * `deleteEventIds` est un TABLEAU (pas un simple `number | null`) car l'annulation d'un
 * véhicule acheté cette session doit supprimer, en une seule fois, l'événement d'achat du
 * véhicule ET tout événement de cette partie qui le référence (armes/améliorations/
 * avantages montés dessus, séquelles) — cf. `Game.collectSessionEventsForVehicle`. Pour
 * WEAPON/IMPROVEMENT/ADVANTAGE, ce tableau ne contient jamais qu'un seul id (comportement
 * inchangé).
 */
export interface ChangeEquipmentResult {
  events: GameEvent[];
  deleteEventIds: number[];
}
