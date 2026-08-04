/**
 * Environnement par défaut - résolu en `development` ET en `e2e` (les deux
 * configurations `serve`/`build` qui n'écrasent pas ce fichier via
 * `fileReplacements`, cf. project.json). Clé de site vide = widget Turnstile
 * jamais rendu (`captchaEnabled()` faux côté `Register`) : c'est tout le
 * mécanisme de neutralisation du captcha en dev et en e2e.
 *
 * `turnstileSiteKey` est une clé PUBLIQUE (pas un secret) - à l'inverse de
 * `TURNSTILE_SECRET_KEY` (backend, `.env`), elle peut vivre ici, committée.
 */
export const environment = {
  turnstileSiteKey: '',
};
