/**
 * Environnement de production - substitué à `environment.ts` par
 * `fileReplacements` (project.json, configuration `production` uniquement).
 *
 * `turnstileSiteKey` est PUBLIQUE (pas un secret, cf. environment.ts) : à
 * renseigner une fois le compte Cloudflare Turnstile créé. Tant qu'elle est
 * vide, le build production se comporte comme le build dev - pas de widget.
 */
export const environment = {
  turnstileSiteKey: '', // TODO: renseigner la clé de site Turnstile (publique)
};
