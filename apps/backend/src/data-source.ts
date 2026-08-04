/**
 * DataSource utilisée UNIQUEMENT par la CLI TypeORM (`migration:generate`,
 * `migration:run`, `migration:revert`, `schema:log` — cf. les cibles Nx
 * dans project.json). Tourne hors du contexte Nest : pas de ConfigModule,
 * pas de validation via `EnvVars` (cf. app/config/env.validation.ts) — on
 * lit `process.env` directement, avec les mêmes valeurs par défaut que la
 * factory TypeOrmModule.forRootAsync dans app.module.ts (à garder
 * synchronisées à la main). `entities`/`migrations` viennent de la même
 * source (`ALL_ENTITIES`/`ALL_MIGRATIONS`) que app.module.ts, pour éviter
 * que la CLI et le serveur Nest ne voient jamais deux schémas différents.
 *
 * `synchronize: false` est non négociable ici : le but même de ce fichier
 * est de piloter le schéma par migrations, jamais par synchronisation.
 */
import { DataSource } from 'typeorm';
import { ALL_ENTITIES } from './app/entities';
import { ALL_MIGRATIONS } from './migrations';

export default new DataSource({
  type: 'postgres',
  host: process.env.DATABASE_HOST ?? 'localhost',
  port: parseInt(process.env.DATABASE_PORT ?? '5432', 10),
  username: process.env.DATABASE_USER ?? 'gaslands',
  password: process.env.DATABASE_PASSWORD,
  database: process.env.DATABASE_NAME ?? 'gaslands',
  ssl: process.env.DB_SSL === 'true',
  entities: [...ALL_ENTITIES],
  migrations: [...ALL_MIGRATIONS],
  synchronize: false,
});
