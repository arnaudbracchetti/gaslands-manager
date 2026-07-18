import type { Vehicle } from '../domain/vehicle';
import type { Weapon } from '../domain/weapon';
import type { Improvement } from '../domain/improvement';
import type { Advantage } from '../domain/advantage';
import type { Sequella } from '../domain/sequella';
import type { Orientation, WeaponOrientation } from '../domain/team';
import type { EquipmentRowDto, TeamSheetDto, VehicleSheetDto } from './team-sheet.interfaces';

const FACING_LABELS: Record<Orientation | 'tourelle', string> = {
  avant: 'Avant',
  arrière: 'Arrière',
  gauche: 'Gauche',
  droite: 'Droite',
  tourelle: 'Tourelle',
};

/**
 * Une arme sans orientation (`orientation === null`) est soit une arme d'équipage
 * (arc 360° porté par un membre d'équipage), soit une arme montée sur châssis à
 * arc automatique (ex. Boule de démolition) — les deux se distinguent uniquement
 * via `type.type`, jamais via `orientation` seul.
 */
function weaponFacing(weapon: Weapon): string {
  if (weapon.orientation !== null) return FACING_LABELS[weapon.orientation as WeaponOrientation];
  return weapon.type.type === 'équipage' ? 'Équipage' : '360°';
}

function improvementFacing(improvement: Improvement): string {
  return improvement.orientation !== null ? FACING_LABELS[improvement.orientation] : '—';
}

function weaponToRow(weapon: Weapon): EquipmentRowDto {
  return {
    category: 'arme',
    nomInterne: weapon.type.nomInterne,
    nom: weapon.type.nom,
    facing: weaponFacing(weapon),
    shortLabel: weapon.type.effetCourt ?? null,
    munitions: weapon.type.munitions ?? null,
    ruleHtml: weapon.type.regles,
  };
}

function improvementToRow(improvement: Improvement): EquipmentRowDto {
  return {
    category: 'amelioration',
    nomInterne: improvement.type.nomInterne,
    nom: improvement.type.nom,
    facing: improvementFacing(improvement),
    shortLabel: improvement.type.effetCourt ?? null,
    munitions: improvement.type.munitions ?? null,
    ruleHtml: improvement.type.regles,
  };
}

function advantageToRow(advantage: Advantage): EquipmentRowDto {
  return {
    category: 'avantage',
    nomInterne: advantage.type.nomInterne,
    nom: advantage.type.nom,
    facing: '—',
    shortLabel: advantage.type.effetCourt ?? null,
    munitions: null,
    ruleHtml: advantage.type.regles,
  };
}

function sequellaToRow(sequella: Sequella): EquipmentRowDto {
  return {
    category: 'sequelle',
    nomInterne: sequella.type.nomInterne,
    nom: sequella.type.nom,
    facing: '—',
    shortLabel: sequella.type.effetCourt ?? null,
    munitions: null,
    ruleHtml: sequella.type.regles,
  };
}

/**
 * Traduit un `Vehicle` (agrégat domaine) en données de fiche — fonction pure,
 * sans dépendance catalogue : `weapon.type`/`improvement.type`/etc. sont déjà des
 * Value Objects résolus, que le véhicule vienne d'un chargement ORM direct ou
 * d'un replay campagne (cf. `TeamMapper.weaponToDomain`, `EquipmentChangedEvent`
 * — les deux résolvent le catalogue une seule fois, à la construction). C'est ce
 * qui rend cette fonction valable pour les deux points d'entrée de la fiche
 * (page Équipe, page Campagne) sans branchement.
 */
export function vehicleToSheetDto(vehicle: Vehicle): VehicleSheetDto {
  const stats = vehicle.effectiveStats;
  const equipment: EquipmentRowDto[] = [
    ...vehicle.weapons.filter((w) => !w.isSold && !w.isLost).map(weaponToRow),
    ...vehicle.improvements.filter((i) => !i.isSold && !i.isLost).map(improvementToRow),
    ...vehicle.advantages.filter((a) => !a.isSold && !a.isLost).map(advantageToRow),
    ...vehicle.sequellas.filter((s) => !s.isSold).map(sequellaToRow),
  ];

  return {
    id: vehicle.id,
    nom: vehicle.nom,
    typeNom: vehicle.type.nom,
    poids: stats.poids,
    cost: vehicle.cost,
    chocs: vehicle.chocs,
    carrosserie: stats.carrosserie,
    manoeuvrabilite: stats.manoeuvrabilite,
    gearMax: stats.vitesse_max,
    equipage: stats.equipage,
    emplacementsUtilises: vehicle.usedSlots,
    emplacementsTotal: stats.emplacements,
    equipment,
  };
}

/** Véhicules vendus exclus — mirroir du filtre déjà appliqué par `GetWorkshopUseCase`. */
export function teamToSheetDto(
  teamName: string,
  sponsor: string,
  vehicles: readonly Vehicle[],
): TeamSheetDto {
  return {
    teamName,
    sponsor,
    vehicles: vehicles.filter((v) => !v.isSold).map(vehicleToSheetDto),
  };
}
