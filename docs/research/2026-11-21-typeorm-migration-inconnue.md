# TypeORM tolère-t-il une migration inconnue de la version précédente ?

> Recherche pour l'issue #17 (carte #16). Date : 2026-11-21.
> Versions vérifiées : `typeorm` **1.0.0** (`package-lock.json`, entrée `node_modules/typeorm`), `@nestjs/typeorm` 11.0.1, `@nestjs/core` 11.1.24, PostgreSQL 16.16.
> Sources primaires : code de `node_modules/typeorm/migration/MigrationExecutor.js` et `data-source/DataSource.js` (version installée), code `@nestjs/typeorm` / `@nestjs/core` installé, config du repo, et une expérience sur un Postgres 16 jetable (conteneur éphémère sur le port 55432, supprimé ensuite). Script reproductible : [`2026-11-21-typeorm-migration-inconnue.exp.js`](2026-11-21-typeorm-migration-inconnue.exp.js).

## Réponse courte

Oui : une image N-1 avec `migrationsRun: true` démarre normalement sur une base où N a appliqué des migrations qu'elle ne connaît pas. TypeORM 1.0.0 ne compare que dans un sens (migrations du code absentes de la table `migrations`), ignore silencieusement les lignes en trop, sans avertissement, et logue `No migrations are pending`. En mode de transaction par défaut (`"all"`), si une migration échoue, toutes les migrations en attente de ce démarrage sont annulées ensemble (DDL compris, Postgres ayant un DDL transactionnel), la table `migrations` n'est pas modifiée, `DataSource.initialize()` rejette, `@nestjs/typeorm` réessaie 9 fois (3 s d'intervalle), puis Nest appelle `process.abort()` et Docker (`restart: unless-stopped`) relance en boucle, chaque tentative étant à nouveau annulée proprement. Le retour arrière "image N-1 sans restaurer la base" est donc viable côté TypeORM, à la même condition que pour Prisma : les migrations de N doivent laisser un schéma que le code de N-1 sait encore utiliser (migrations additives, discipline expand/contract). TypeORM ne le vérifie pas : une incompatibilité se verra à l'exécution des requêtes, pas au démarrage.

## 1. Ligne inconnue dans la table `migrations`

### Code

`DataSource.initialize()` lance les migrations avant toute synchronisation, et ferme la connexion puis relance l'erreur en cas d'échec (`data-source/DataSource.js`, l. 131-171) :

```js
if (this.options.migrationsRun)
    await this.runMigrations({
        transaction: this.options.migrationsTransactionMode,
    });
if (this.options.synchronize)
    await this.synchronize();
}
catch (error) {
    await this.destroy();
    throw error;
}
```

`MigrationExecutor.executePendingMigrations()` (`migration/MigrationExecutor.js`, l. 134-165) ne calcule que les migrations du code absentes de la base :

```js
const executedMigrations = await this.loadExecutedMigrations(queryRunner);
const lastTimeExecutedMigration = this.getLatestTimestampMigration(executedMigrations);
const allMigrations = this.getMigrations();
...
const pendingMigrations = allMigrations.filter((migration) => {
    const executedMigration = executedMigrations.find((executedMigration) => executedMigration.name === migration.name);
    if (executedMigration)
        return false;
    // if (lastTimeExecutedMigration && migration.timestamp < lastTimeExecutedMigration.timestamp)
    //     throw new TypeORMError(`New migration found: ...`);
    return true;
});
if (!pendingMigrations.length) {
    this.dataSource.logger.logSchemaBuild(`No migrations are pending`);
    ...
    return [];
}
```

Aucun code ne parcourt `executedMigrations` pour y chercher un nom absent de `allMigrations` : une ligne en trop n'est ni signalée ni bloquante. `getPendingMigrations()` (l. 78-83, utilisé par `showMigrations`) applique le même filtre à sens unique. Le contrôle d'ordre chronologique est commenté : une migration en attente plus ancienne que la dernière exécutée est jouée quand même.

### Expérience (Postgres 16 jetable)

| Cas | Résultat observé |
|---|---|
| Image N (A, B, C) applique tout, puis image N-1 (A, B) démarre | `No migrations are pending`, `initialize()` OK, table `migrations` inchangée (A, B, C) |
| Image ne connaissant que A sur base (A, B, C) | `No migrations are pending`, OK |
| Image connaissant A et une migration Z (horodatage antérieur à C) jamais jouée | Z est exécutée, OK (le contrôle d'ordre est désactivé) |

Logs bruts : aucune ligne d'avertissement sur B ou C.

### Seule exception : le revert

`undoLastMigration()` (l. 304-309), utilisé par `migration:revert`, lève une erreur si la dernière migration en base est inconnue du code :

```js
const migrationToRevert = allMigrations.find((migration) => migration.name === lastTimeExecutedMigration.name);
if (!migrationToRevert)
    throw new error_1.TypeORMError(`No migration ${lastTimeExecutedMigration.name} was found in the source code. ...`);
```

Conséquence : on ne peut pas défaire une migration de N depuis l'image N-1 ; il faut lancer `migration:revert` avec le code de N (avant de redescendre), ou ne pas défaire du tout (modèle "on garde le schéma de N").

## 2. Échec d'une migration au démarrage

### Mode `"all"` (défaut)

Défaut posé dans le constructeur (`MigrationExecutor.js`, l. 23-28 : `this.transaction = "all";`). Le repo ne fixe pas `migrationsTransactionMode` (cf. §3), donc c'est ce mode qui s'applique. Une seule transaction englobe toutes les migrations en attente, avec `ROLLBACK` sur toute erreur (l. 212-270) :

```js
if (this.transaction === "all" && !queryRunner.isTransactionActive) {
    await queryRunner.beforeMigration();
    await queryRunner.startTransaction();
    transactionStartedByUs = true;
}
try {
    for (const migration of pendingMigrations) {
        ...
        await migration.instance.up(queryRunner)
            .catch((error) => { this.dataSource.logger.logMigration(`Migration "${migration.name}" failed, error: ${error?.message}`); throw error; })
            .then(async () => { await this.insertExecutedMigration(queryRunner, migration); ... })
    }
    if (this.transaction === "all" && transactionStartedByUs) {
        await queryRunner.commitTransaction();
        ...
    }
}
catch (err) {
    if (transactionStartedByUs) {
        try { await queryRunner.rollbackTransaction(); } catch (rollbackError) { }
    }
    throw err;
}
```

L'`INSERT` dans `migrations` se fait dans la même transaction que le DDL : il est annulé avec lui. Seule la création de la table `migrations` elle-même (`createMigrationsTableIfNotExist`, l. 136-137) a lieu avant la transaction.

Expérience : A et B réussissent, puis une migration crée une table et lève une erreur.

| Mode | Tables après échec | Table `migrations` |
|---|---|---|
| `all` (défaut) | aucune (seulement `migrations`) | vide |
| `each` | `a`, `b` | A, B (succès partiel conservé) |

Relancé une deuxième fois en mode `all`, le même scénario rejoue A et B puis échoue, et laisse à nouveau une base vierge : la boucle de redémarrage est idempotente, elle ne laisse pas d'état intermédiaire.

### Ce que fait Nest

- `@nestjs/typeorm` appelle `dataSource.initialize()` dans un `defer` RxJS avec `handleRetry(options.retryAttempts, options.retryDelay, ...)` (`typeorm-core.module.js`, l. 160-182). Défauts (`common/typeorm.utils.js`) : `retryAttempts = 9`, `retryDelay = 3000`. Le filtre `toRetry` n'est pas renseigné dans le repo : **une erreur de migration est réessayée comme une erreur de connexion**, 9 fois, avec le message trompeur `Unable to connect to the database. Retrying (n)...`. Chaque tentative rejoue et annule les migrations.
- Après le dernier essai, l'erreur remonte à `NestFactory.create()` ; avec `abortOnError` à `true` par défaut (`@nestjs/core/nest-factory.js`, l. 31 et 121-125) : `handleInitializationError` appelle `process.abort()`. Le backend ne démarre donc pas et ne sert aucune requête (le HTTP n'écoute qu'après `create`).
- `docker-compose.prod.yml` déclare `restart: unless-stopped` sur `backend` : le conteneur est relancé, d'où une boucle (environ 27 s de tentatives par cycle, plus le temps de démarrage). Ce point Docker est déduit de la config, pas observé dans l'expérience (seule la partie TypeORM a été exécutée).

### Pièges DDL Postgres en mode `"all"`

Vérifiés sur Postgres 16 :

- **`CREATE INDEX CONCURRENTLY`** : échoue (`cannot run inside a transaction block`), toute la transaction est annulée. Il faudrait marquer la migration `transaction = false`, mais en mode `all` TypeORM refuse tout override et lève `ForbiddenTransactionModeOverrideError` avant d'exécuter quoi que ce soit (l. 177-188, vérifié). Seul le mode `each` (ou `none`) permet `transaction = false` ; vérifié : en mode `each`, la migration `CONCURRENTLY` avec `transaction = false` passe.
- **`ALTER TYPE ... ADD VALUE`** : accepté dans une transaction, mais utiliser la nouvelle valeur dans la même transaction échoue (`unsafe use of new value "blue" of enum type color`). En mode `all`, cela inclut une migration ultérieure du même lot. À noter : les enums TypeORM générés pour Postgres sont des types `ENUM` natifs, donc concernés.
- Les autres DDL usuels (`CREATE/ALTER/DROP TABLE`, colonnes, contraintes) sont transactionnels sur Postgres : l'annulation est réelle, comme observé.

Autre point, sans expérience : `MigrationExecutor` ne pose aucun verrou (aucun advisory lock dans le fichier). Deux instances lancées en même temps pourraient jouer les mêmes migrations ; sans objet tant que le backend tourne en une seule réplique.

## 3. Configuration du repo

- [`apps/backend/src/app/app.module.ts`](../../apps/backend/src/app/app.module.ts) : `migrationsRun` piloté par `DB_MIGRATIONS_RUN === 'true'`, `synchronize` par `DB_SYNCHRONIZE` (défaut `false` en production), aucune option `migrationsTransactionMode`, `retryAttempts`, `retryDelay` ni `toRetry`. Donc mode `all` et 9 essais par défaut.
- [`apps/backend/src/data-source.ts`](../../apps/backend/src/data-source.ts) : DataSource de la CLI uniquement, `synchronize: false`, pas de `migrationsRun` ni de mode de transaction. Même comportement `all` pour `migration:run`.
- [`docker-compose.prod.yml`](../../docker-compose.prod.yml) : `DB_SYNCHRONIZE: "false"`, `DB_MIGRATIONS_RUN: "true"`, `restart: unless-stopped`.
- Point de vigilance : si une image N-1 démarrait avec `synchronize: true` (dev), `DataSource.initialize()` appellerait `synchronize()` après les migrations et tenterait d'aligner le schéma sur les entités de N-1, donc de supprimer les colonnes ajoutées par N. En production c'est exclu par `DB_SYNCHRONIZE: "false"` ; c'est la seule option du repo qui changerait la réponse.

## Conséquences pour le modèle "retour à l'image N-1 sans restaurer la base"

- Côté outil : viable. Le prérequis de l'ADR 0021 de Histoires de Chimères (vérifié là-bas pour Prisma) est rempli par TypeORM 1.0.0 : la ligne en trop ne bloque pas le démarrage. Le comportement de Prisma lui-même n'a pas été revérifié ici.
- TypeORM n'émet aucun avertissement : l'écart base/code est silencieux. Un contrôle maison au démarrage (comparer les noms de la table `migrations` à `ALL_MIGRATIONS` et loguer) serait nécessaire si on veut le voir.
- La vraie condition reste la compatibilité du schéma : une migration de N qui supprime ou renomme une colonne, ou ajoute un `NOT NULL` sans défaut, cassera N-1 à la première requête concernée, pas au démarrage.
- Une migration qui échoue en production laisse la base dans l'état d'avant la release (mode `all`) : redescendre en N-1 est alors sans risque côté schéma. Il faut éviter les migrations non transactionnelles (`CONCURRENTLY`, usage d'une valeur d'enum ajoutée) ou basculer en mode `each`, qui perd l'atomicité du lot.
