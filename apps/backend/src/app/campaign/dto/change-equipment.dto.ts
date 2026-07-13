import type { EquipmentOperation, EquipmentEntityType } from '../domain/events/equipment-changed.event';
import type { WeaponOrientation } from '../../team/domain/team';

export class ChangeEquipmentDto {
  operation!: EquipmentOperation;
  entityType!: EquipmentEntityType;
  nomInterne!: string;
  targetVehicleId?: number | null;
  targetEntityId?: number | null;
  /** WEAPON : 5 valeurs possibles (dont `'tourelle'` — arc à 360°, coût ×3). */
  orientation?: WeaponOrientation | null;
  /** BUY(SEQUELLE, 'dur_a_cuire') uniquement — nom_interne de l'avantage gratuit choisi. */
  freeAdvantageNomInterne?: string | null;
}
