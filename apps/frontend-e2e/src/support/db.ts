/**
 * Prépare la base PostgreSQL de test (`gaslands_test`) utilisée par les
 * tests e2e frontend authentifiés.
 *
 * Réutilise la même instance Postgres que le dev (`gaslands_db`, cf.
 * docker-compose.yml) mais une base distincte, pour ne jamais toucher aux
 * données de développement. Le comportement par défaut de `dotenv` (ne
 * jamais écraser une variable déjà présente dans process.env) permet au
 * backend de pointer vers cette base sans modifier apps/backend/.env :
 * il suffit d'exporter DATABASE_NAME=gaslands_test avant de le démarrer
 * (cf. backend-process.ts).
 */
import { Client } from 'pg';

const TEST_DB_NAME = 'gaslands_test';

// Tables applicatives à vider entre deux runs, dans un ordre qui respecte
// les FK (les tables enfants d'abord) — TRUNCATE ... CASCADE couvre de
// toute façon les dépendances, l'ordre n'est donc qu'une question de lisibilité.
const APP_TABLES = [
  'game_events',
  'games',
  'campaign_participants',
  'campaigns',
  'vehicle_improvements',
  'weapons',
  'vehicles',
  'teams',
  'users',
];

function adminConnectionConfig(): {
  host: string;
  port: number;
  user: string;
  password: string;
} {
  return {
    host: process.env['DATABASE_HOST'] ?? 'localhost',
    port: process.env['DATABASE_PORT'] ? Number(process.env['DATABASE_PORT']) : 5432,
    user: process.env['DB_USER'] ?? 'gaslands',
    password: process.env['DB_PASSWORD'] ?? 'gaslands_pass',
  };
}

/** Crée la base `gaslands_test` si elle n'existe pas déjà. */
async function ensureTestDatabaseExists(): Promise<void> {
  // Connexion à la base de maintenance "postgres" : on ne peut pas créer
  // une base depuis une connexion ouverte sur elle-même.
  const client = new Client({ ...adminConnectionConfig(), database: 'postgres' });
  await client.connect();
  try {
    const { rowCount } = await client.query(
      'SELECT 1 FROM pg_database WHERE datname = $1',
      [TEST_DB_NAME],
    );
    if (rowCount === 0) {
      // Le nom de la base est un identifiant SQL, pas une valeur — non
      // paramétrable via placeholder ($1), d'où l'interpolation directe.
      // TEST_DB_NAME est une constante contrôlée par ce fichier, pas une
      // entrée utilisateur : pas de risque d'injection ici.
      await client.query(`CREATE DATABASE ${TEST_DB_NAME}`);
      console.log(`\n✅ Base de test "${TEST_DB_NAME}" créée.\n`);
    }
  } finally {
    await client.end();
  }
}

/** Vide toutes les tables applicatives de `gaslands_test` pour repartir d'un état propre. */
async function truncateTestDatabase(): Promise<void> {
  const client = new Client({ ...adminConnectionConfig(), database: TEST_DB_NAME });
  await client.connect();
  try {
    // Si le backend de test n'a encore jamais tourné, aucune table n'existe
    // encore (TypeORM synchronize les crée au démarrage) — on ignore alors
    // silencieusement l'erreur "relation does not exist".
    const { rows } = await client.query<{ tablename: string }>(
      `SELECT tablename FROM pg_tables WHERE schemaname = 'public'`,
    );
    const existingTables = new Set(rows.map((r) => r.tablename));
    const tablesToTruncate = APP_TABLES.filter((t) => existingTables.has(t));
    if (tablesToTruncate.length > 0) {
      await client.query(`TRUNCATE TABLE ${tablesToTruncate.join(', ')} RESTART IDENTITY CASCADE`);
      console.log(`\n✅ Base de test "${TEST_DB_NAME}" vidée (${tablesToTruncate.length} tables).\n`);
    }
  } finally {
    await client.end();
  }
}

/** Point d'entrée appelé par global-setup.ts : garantit une base de test propre. */
export async function prepareTestDatabase(): Promise<void> {
  await ensureTestDatabaseExists();
  await truncateTestDatabase();
}
