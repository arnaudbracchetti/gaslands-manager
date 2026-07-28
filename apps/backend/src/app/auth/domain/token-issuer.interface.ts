import type { User } from './user';

/**
 * Port hexagonal d'émission du jeton de session — même intention
 * qu'`IPasswordHasher` : les use cases `Login`/`Register` doivent produire un
 * token sans importer `@nestjs/jwt`, exactement comme aucun use case de `team/`
 * n'importe NestJS.
 *
 * Implémenté par `JwtTokenIssuer` (infrastructure/), qui encapsule `JwtService`
 * et décide seul du contenu du payload.
 */
export interface ITokenIssuer {
  issue(user: User): string;
}
