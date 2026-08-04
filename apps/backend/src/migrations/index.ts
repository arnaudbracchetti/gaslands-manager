/**
 * Tableau explicite des migrations — PAS un glob. Le backend est empaqueté
 * en un `main.js` unique par `NxAppWebpackPlugin` (compiler `tsc`, cf.
 * apps/backend/webpack.config.js) : un glob `dist/migrations/*.js` exécuté
 * au runtime dans le conteneur ne trouverait rien, seul `main.js` existe
 * dans l'image (cf. Dockerfile, étage runner). En import statique ici, ces
 * classes entrent dans le graphe de dépendances de `app.module.ts` →
 * `main.ts`, et webpack les compile/bundle réellement dans `main.js`.
 */
import type { MigrationInterface } from 'typeorm';
import { InitSchema1785808811325 } from './1785808811325-InitSchema';

export const ALL_MIGRATIONS: (new () => MigrationInterface)[] = [InitSchema1785808811325];
