/**
 * Contrat de variables d'environnement — validé une seule fois, au démarrage.
 *
 * Pourquoi : `ConfigService.get('X')` renvoie silencieusement `undefined` si
 * `X` est absent du `.env`. Le backend démarrait donc, jusqu'ici, même sans
 * `JWT_SECRET` — un déploiement pouvait tourner des semaines avec un secret
 * `undefined` avant que quiconque ne s'en aperçoive. `EnvVars` (classe
 * `class-validator`) + `validateEnv()` (branchée sur `ConfigModule.forRoot({
 * validate })`, cf. app.module.ts) transforment cette classe d'erreurs en un
 * crash immédiat, au tout premier démarrage, avec un message qui NOMME la
 * variable fautive plutôt qu'une `TypeError` loin en aval dans un use case.
 *
 * `class-validator`/`class-transformer` sont utilisés ici pour la même
 * raison qu'ils le seront pour les DTO HTTP (P0-7, cf. docs/plans/
 * 2026-08-02-durcissement-securite-vps-design.md) : décorer une classe avec
 * des règles de forme, puis un seul point d'entrée (`validateSync`) qui les
 * fait toutes respecter d'un coup. Ici, la "requête" est `process.env`.
 */

import { plainToInstance, Transform } from 'class-transformer';
import {
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsEmail,
  IsNotEmpty,
  ValidateIf,
  validateSync,
} from 'class-validator';

// `'e2e'` n'est pas une valeur "métier" — c'est une valeur que Nx impose
// lui-même : l'exécuteur `@nx/js:node` (cible `serve`, utilisé par
// `frontend-e2e/src/support/backend-process.ts` via
// `nx run backend:serve --configuration=e2e`) fait
// `process.env.NODE_ENV ??= context.configurationName` AVANT même de
// démarrer le process Node (cf. node_modules/@nx/js/src/executors/node/
// node.impl.js) — impossible à corriger depuis `apps/backend/.env`, chargé
// bien plus tard par `ConfigModule` et qui ne peut de toute façon jamais
// écraser une variable de process déjà définie (comportement par défaut de
// dotenv). Sans cette valeur acceptée ici, toute la suite `frontend-e2e`
// échoue au démarrage du backend de test. Tous les points de contrôle du
// code ne testent que `=== 'production'` : `'e2e'` se comporte donc partout
// exactement comme `'development'`, sans branchement dédié à ajouter.
type NodeEnv = 'development' | 'test' | 'production' | 'e2e';

/**
 * Secrets soumis à une règle RENFORCÉE en production (longueur minimale,
 * rejet de la valeur de développement `change_me`) — vérifiés "à la main"
 * dans `validateEnv()`, PAS via un `@ValidateIf` posé sur ces mêmes champs.
 *
 * Piège class-validator : `@ValidateIf(condition)` ne conditionne pas
 * seulement les décorateurs placés après lui, il désactive TOUS les
 * validateurs de la propriété quand la condition est fausse. Empilé sur un
 * champ déjà marqué `@IsNotEmpty()` (toujours requis, dev compris), il
 * aurait donc aussi supprimé cette règle de base hors production — l'exact
 * inverse de l'effet recherché. D'où cette seconde passe manuelle, réservée
 * aux trois secrets qui doivent être simultanément "toujours non vides" ET
 * "renforcés en production".
 */
const PRODUCTION_HARDENED_SECRETS: ReadonlyArray<keyof EnvVars> = [
  'DATABASE_PASSWORD',
  'JWT_SECRET',
  'ADMIN_PASSWORD',
];
const MIN_SECRET_LENGTH = 32;
const FORBIDDEN_DEV_VALUE = 'change_me';

/**
 * `@ValidateIf`, lui, reste le bon outil pour les champs qui n'existent
 * QUE via cette condition (`TURNSTILE_SECRET_KEY`/`CORS_ORIGIN` ci-dessous) :
 * aucun autre décorateur n'est empilé dessus, donc rien à désactiver par
 * erreur. `class-transformer` lit `process.env` (toutes les valeurs sont des
 * chaînes) — `IsInt` est donc converti explicitement via `@Transform`,
 * jamais via une conversion implicite globale qui masquerait une valeur mal
 * formée (ex. "abc" silencieusement transformé en `NaN`).
 */
export class EnvVars {
  // ── Environnement ──────────────────────────────────────────────────────
  @IsIn(['development', 'test', 'production', 'e2e'])
  NODE_ENV: NodeEnv = 'development';

  // ── Base de données (toujours requis) ──────────────────────────────────
  @IsString()
  @IsNotEmpty()
  DATABASE_HOST!: string;

  @IsInt()
  @Transform(({ value }: { value: string }): number => parseInt(value, 10))
  DATABASE_PORT!: number;

  @IsString()
  @IsNotEmpty()
  DATABASE_USER!: string;

  @IsString()
  @IsNotEmpty()
  DATABASE_PASSWORD!: string;

  @IsString()
  @IsNotEmpty()
  DATABASE_NAME!: string;

  // ── Authentification (toujours requis) ─────────────────────────────────
  @IsString()
  @IsNotEmpty()
  JWT_SECRET!: string;

  @IsString()
  @IsOptional()
  JWT_EXPIRATION: string = '7d';

  @IsEmail({}, { message: 'ADMIN_EMAIL doit être une adresse email valide' })
  ADMIN_EMAIL!: string;

  @IsString()
  @IsNotEmpty()
  ADMIN_PASSWORD!: string;

  // ── Requis seulement en production ─────────────────────────────────────
  @IsString()
  @IsNotEmpty()
  @ValidateIf((o: EnvVars): boolean => o.NODE_ENV === 'production')
  TURNSTILE_SECRET_KEY?: string;

  @IsString()
  @IsNotEmpty()
  @ValidateIf((o: EnvVars): boolean => o.NODE_ENV === 'production')
  CORS_ORIGIN?: string;

  // ── Optionnels avec défaut ──────────────────────────────────────────────
  @IsInt()
  @IsOptional()
  @Transform(({ value }: { value: string }): number => parseInt(value, 10))
  PORT: number = 3000;

  @IsString()
  @IsOptional()
  CONTENT_DIR: string = 'content';

  // Pas de défaut en dur ici : `app.module.ts` doit pouvoir distinguer
  // "l'opérateur a fixé DB_SYNCHRONIZE explicitement" (`undefined` sinon)
  // pour appliquer son propre défaut basé sur NODE_ENV (cf. P0-2).
  @IsString()
  @IsOptional()
  DB_SYNCHRONIZE?: string;

  @IsString()
  @IsOptional()
  DB_MIGRATIONS_RUN: string = 'false';

  @IsString()
  @IsOptional()
  DB_SSL: string = 'false';

  @IsString()
  @IsOptional()
  THROTTLE_TTL?: string;

  @IsString()
  @IsOptional()
  THROTTLE_LIMIT?: string;
}

/**
 * Branchée sur `ConfigModule.forRoot({ validate })` : NestJS l'appelle une
 * seule fois au démarrage avec `process.env` (déjà fusionné avec le contenu
 * du fichier `.env`). Toute erreur ici empêche le module de s'initialiser —
 * le serveur ne se met jamais à écouter avec une configuration invalide.
 */
export function validateEnv(raw: Record<string, unknown>): EnvVars {
  const instance = plainToInstance(EnvVars, raw, { enableImplicitConversion: false });
  const errors = validateSync(instance, { skipMissingProperties: false });
  const messages = errors.map(
    (error): string => Object.values(error.constraints ?? {}).join(', '),
  );

  if (instance.NODE_ENV === 'production') {
    for (const key of PRODUCTION_HARDENED_SECRETS) {
      // Le champ de base (@IsNotEmpty) a déjà signalé une valeur absente —
      // ne pas dupliquer l'erreur, et éviter un .length sur `undefined`.
      const value = instance[key];
      if (typeof value !== 'string' || value.length === 0) continue;

      if (value.length < MIN_SECRET_LENGTH) {
        messages.push(`${key} doit faire au moins ${MIN_SECRET_LENGTH} caractères en production`);
      }
      if (value === FORBIDDEN_DEV_VALUE) {
        messages.push(`${key} ne peut pas être "${FORBIDDEN_DEV_VALUE}" en production`);
      }
    }
  }

  if (messages.length > 0) {
    throw new Error(`Configuration d'environnement invalide : ${messages.join(' | ')}`);
  }

  return instance;
}
