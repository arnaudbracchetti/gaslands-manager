export class RecordVehicleLostDto {
  participantId!: number;
  vehicleId!: number;
  /** Optionnel — armes perdues avec le véhicule. */
  weaponIds?: number[];
}
