// Experience jetable : comportement de TypeORM (version du repo) avec migrationsRun.
// Lancer depuis la racine du repo (node docs/research/...exp.js) contre un Postgres 16 jetable sur localhost:55432 :
//   docker run -d --rm --name typeorm-research-pg -e POSTGRES_PASSWORD=pw -e POSTGRES_DB=t -p 55432:5432 postgres:16-alpine
const { DataSource } = require('typeorm');

class A1000000000001 { name = 'A1000000000001'; async up(q) { await q.query('CREATE TABLE a (id int)'); } async down(q) { await q.query('DROP TABLE a'); } }
class B1000000000002 { name = 'B1000000000002'; async up(q) { await q.query('CREATE TABLE b (id int)'); } async down(q) { await q.query('DROP TABLE b'); } }
class C1000000000003 { name = 'C1000000000003'; async up(q) { await q.query('CREATE TABLE c (id int)'); } async down(q) { await q.query('DROP TABLE c'); } }
class Boom1000000000004 { name = 'Boom1000000000004'; async up(q) { await q.query('CREATE TABLE d (id int)'); throw new Error('boom volontaire'); } async down() {} }
class Enum1000000000005 { name = 'Enum1000000000005'; async up(q) {
  await q.query("CREATE TYPE color AS ENUM ('red')");
  await q.query("CREATE TABLE e (c color)");
  await q.query("ALTER TYPE color ADD VALUE 'blue'");
  await q.query("INSERT INTO e VALUES ('blue')");
} async down() {} }
class Conc1000000000006 { name = 'Conc1000000000006'; async up(q) { await q.query('CREATE INDEX CONCURRENTLY idx_a ON a (id)'); } async down() {} }
class Override1000000000007 { name = 'Override1000000000007'; transaction = false; async up(q) { await q.query('SELECT 1'); } async down() {} }

const base = { type: 'postgres', host: 'localhost', port: 55432, username: 'postgres', password: 'pw', synchronize: false, logging: ['schema', 'migration', 'error'] };

async function reset(db) {
  const admin = new DataSource({ ...base, database: 't' });
  await admin.initialize();
  await admin.query(`DROP DATABASE IF EXISTS ${db}`);
  await admin.query(`CREATE DATABASE ${db}`);
  await admin.destroy();
}
async function boot(db, migrations, extra = {}) {
  const ds = new DataSource({ ...base, database: db, migrations, migrationsRun: true, ...extra });
  try { await ds.initialize(); console.log(`  -> initialize() OK, isInitialized=${ds.isInitialized}`); await ds.destroy(); return 'ok'; }
  catch (e) { console.log(`  -> initialize() REJETTE: ${e.constructor.name}: ${e.message}`); console.log(`  -> isInitialized apres echec=${ds.isInitialized}`); return 'ko'; }
}
async function state(db) {
  const ds = new DataSource({ ...base, database: db }); await ds.initialize();
  const t = await ds.query("SELECT table_name FROM information_schema.tables WHERE table_schema='public' ORDER BY 1");
  let m = [];
  try { m = await ds.query('SELECT id, name FROM migrations ORDER BY id'); } catch { m = '(pas de table migrations)'; }
  console.log('  tables:', t.map(r => r.table_name).join(', ') || '(aucune)');
  console.log('  migrations:', Array.isArray(m) ? m.map(r => r.name).join(', ') || '(vide)' : m);
  await ds.destroy();
}

(async () => {
  console.log('== Exp 1 : N applique A,B,C puis N-1 (A,B) redemarre ==');
  await reset('exp1');
  await boot('exp1', [A1000000000001, B1000000000002, C1000000000003]);
  await state('exp1');
  console.log('  -- demarrage image N-1 (connait A,B) :');
  await boot('exp1', [A1000000000001, B1000000000002]);
  await state('exp1');
  console.log('  -- demarrage image N-1 (connait A seulement, C inconnue au milieu) :');
  await boot('exp1', [A1000000000001]);

  console.log('== Exp 1b : N-1 ne connait PAS B (inconnue) mais a une migration en attente X ==');
  // simule : base a A,B,C ; image N-1' connait A et une migration pending Z plus ancienne que C
  class Z1000000000002 { name = 'Z1000000000002'; async up(q) { await q.query('CREATE TABLE z (id int)'); } async down() {} }
  await boot('exp1', [A1000000000001, Z1000000000002]);
  await state('exp1');

  console.log('== Exp 2 : mode "all" par defaut, A,B OK puis Boom echoue ==');
  await reset('exp2');
  await boot('exp2', [A1000000000001, B1000000000002, Boom1000000000004]);
  await state('exp2');

  console.log('== Exp 2b : mode "each", meme sequence ==');
  await reset('exp2b');
  await boot('exp2b', [A1000000000001, B1000000000002, Boom1000000000004], { migrationsTransactionMode: 'each' });
  await state('exp2b');

  console.log('== Exp 2c : redemarrage repete (boucle) apres echec en mode all ==');
  await boot('exp2', [A1000000000001, B1000000000002, Boom1000000000004]);
  await state('exp2');

  console.log('== Exp 3 : ALTER TYPE ADD VALUE puis usage dans la meme transaction (mode all) ==');
  await reset('exp3');
  await boot('exp3', [Enum1000000000005]);
  await state('exp3');

  console.log('== Exp 4 : CREATE INDEX CONCURRENTLY en mode all ==');
  await reset('exp4');
  await boot('exp4', [A1000000000001, Conc1000000000006]);
  await state('exp4');

  console.log('== Exp 5 : migration avec transaction=false en mode all ==');
  await reset('exp5');
  await boot('exp5', [A1000000000001, Override1000000000007]);
  await state('exp5');
  console.log('== Exp 5b : meme chose en mode each (CONCURRENTLY + transaction=false) ==');
  class Conc2_1000000000008 { name = 'ConcB1000000000008'; transaction = false; async up(q) { await q.query('CREATE INDEX CONCURRENTLY idx_a ON a (id)'); } async down() {} }
  await reset('exp5b');
  await boot('exp5b', [A1000000000001, Conc2_1000000000008], { migrationsTransactionMode: 'each' });
  await state('exp5b');
})().catch(e => { console.error('ERREUR SCRIPT', e); process.exit(1); });
