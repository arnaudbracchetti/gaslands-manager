import type { EquipmentOperation, EquipmentEntityType } from '../domain/events/equipment-changed.event';
import type { Orientation } from '../../team/domain/team';

export class ChangeEquipmentDto {
  operation!: EquipmentOperation;
  entityType!: EquipmentEntityType;
  nomInterne!: string;
  targetVehicleId?: number | null;
  targetEntityId?: number | null;
  orientation?: Orientation | null;
}
