/**
 * Proxy Angular /api -> backend NestJS.
 *
 * Port cible configurable via BACKEND_PORT (défaut 3000, valeur historique) -
 * lu au démarrage du dev-server Angular (ce fichier est un module CommonJS,
 * pas du JSON statique, précisément pour pouvoir lire process.env ici).
 *
 * Permet de lancer `frontend-e2e` sur un backend de test isolé, sur un port
 * différent de celui utilisé par `dev.sh`, sans avoir à l'arrêter au
 * préalable (cf. docs/E2E_TESTING.md) : `BACKEND_PORT=3456 FRONTEND_PORT=4201
 * npx nx e2e frontend-e2e`. Sans ces variables, comportement strictement
 * identique à l'ancien proxy.conf.json (cible localhost:3000).
 */
const backendPort = process.env.BACKEND_PORT || '3000';

module.exports = {
  '/api': {
    target: `http://localhost:${backendPort}`,
    secure: false,
    changeOrigin: true,
    logLevel: 'info',
  },
};
