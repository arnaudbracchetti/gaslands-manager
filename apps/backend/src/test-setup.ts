/**
 * Fichier d'initialisation des tests backend.
 *
 * reflect-metadata est nécessaire pour les décorateurs TypeScript de NestJS.
 * Il doit être importé AVANT tout autre code NestJS/TypeORM dans les tests.
 *
 * Sans ce fichier, vous verriez des erreurs comme :
 * "Reflect.metadata is not a function"
 * "Cannot read property 'getMetadata' of undefined"
 */
import 'reflect-metadata';
