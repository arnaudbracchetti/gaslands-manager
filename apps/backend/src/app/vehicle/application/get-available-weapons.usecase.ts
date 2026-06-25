import type { IVehicleRepository } from '../domain/vehicle.repository.interface';
import type { ICatalogRepository } from '../domain/catalog.repository.interface';
import type { WeaponType } from '../domain/value-objects/weapon-type';
import type { AvailableWeaponDto } from '../../weapon/dto/available-weapon.dto';
import { LogUseCase } from '../log-use-case.decorator';

export interface GetAvailableWeaponsQuery {
  vehicleId: number;
  userId: number;
}

/**
 * Retourne la liste des armes du sponsor avec un verdict de disponibilité pour
 * chacune — remplace WeaponService.getAvailableWeapons().
 *
 * L'orientation n'est pas fournie ici : la liste répond à "cette arme est-elle
 * accessible par principe ?". Une arme orientable sans slot problème apparaîtra
 * avec disponible:false et raison "orientation requise" — non un refus définitif,
 * mais un signal "information manquante" pour le frontend.
 */
export class GetAvailableWeaponsUseCase {
  constructor(
    private readonly vehicleRepo: IVehicleRepository,
    private readonly catalogRepo: ICatalogRepository,
  ) {}

  @LogUseCase()
  async execute(query: GetAvailableWeaponsQuery): Promise<AvailableWeaponDto[]> {
    const vehicle = await this.vehicleRepo.findByIdForUser(query.vehicleId, query.userId);
    const budget = await this.vehicleRepo.getRemainingBudget(query.vehicleId, query.userId);
    const weaponTypes = this.catalogRepo.getWeaponTypesForSponsor(vehicle.sponsorNom);

    return weaponTypes.map((wt: WeaponType): AvailableWeaponDto => {
      const result = vehicle.canAddWeapon(wt, null, budget);
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
      };
    });
  }
}
