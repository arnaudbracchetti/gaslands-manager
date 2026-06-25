/**
 * Tokens d'injection NestJS pour les interfaces du module Vehicle.
 *
 * TypeScript efface les interfaces à la compilation — NestJS ne peut pas les
 * utiliser directement comme tokens. Ces chaînes de caractères jouent le rôle
 * de clés d'injection pour IVehicleRepository et ICatalogRepository.
 *
 * Usage dans les use cases et contrôleurs :
 *   @Inject(VEHICLE_REPOSITORY) private readonly vehicleRepo: IVehicleRepository
 *   @Inject(CATALOG_REPOSITORY) private readonly catalogRepo: ICatalogRepository
 */
export const VEHICLE_REPOSITORY = 'VEHICLE_REPOSITORY';
export const CATALOG_REPOSITORY = 'CATALOG_REPOSITORY';
