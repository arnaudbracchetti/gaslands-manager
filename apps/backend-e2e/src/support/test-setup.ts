/**
 * Setup de test Vitest pour les tests e2e backend.
 *
 * Exécuté avant chaque fichier de test.
 * Configure axios pour pointer vers le serveur backend de test.
 */
import axios from 'axios';

// Les variables d'environnement HOST et PORT permettent de cibler
// un serveur différent (ex: CI, staging). Par défaut : localhost:3000.
const host = process.env['HOST'] ?? '127.0.0.1';
const port = process.env['PORT'] ?? '3000';

axios.defaults.baseURL = `http://${host}:${port}`;
