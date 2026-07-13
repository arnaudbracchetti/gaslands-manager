import type { ITeamRepository } from '../domain/team.repository.interface';
import type { ICatalogRepository } from '../domain/catalog.repository.interface';
import type { WeaponType } from '../domain/value-objects/weapon-type';
import type { AvailableWeaponDto } from '../dto/available-weapon.dto';
import { LogUseCase } from '../log-use-case.decorator';

export interface GetAvailableWeaponsQuery {
  vehicleId: number;
  userId: number;
}

/**
 * Retourne la liste des armes du sponsor avec un verdict de disponibilité.
 *
 * Le budget restant est calculé depuis team.remainingBudget (in-aggregate).
 * Le sponsor est porté par team.sponsor.
 */
export class GetAvailableWeaponsUseCase {
  constructor(
    private readonly teamRepo: ITeamRepository,
    private readonly catalogRepo: ICatalogRepository,
  ) {}

  @LogUseCase()
  async execute(query: GetAvailableWeaponsQuery): Promise<AvailableWeaponDto[]> {
    const team = await this.teamRepo.findByVehicleId(query.vehicleId, query.userId);
    const weaponTypes = this.catalogRepo.getWeaponTypesForSponsor(team.sponsor);

    return weaponTypes.map((wt: WeaponType): AvailableWeaponDto => {
      const result = team.canAddWeaponToVehicle(query.vehicleId, wt, null);
      return {
        nom: wt.nom,
        nomInterne: wt.nomInterne,
        prix: wt.price,
        emplacement: wt.slots,
        type: wt.type,
        description: wt.description,
        regles: wt.regles,
        disponible: result.ok,
        raison: result.ok ? undefined : result.reason,
        montableSurTourelle: wt.montableSurTourelle,
      };
    });
  }
}
