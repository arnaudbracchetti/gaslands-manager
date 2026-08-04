/**
 * Port hexagonal de vérification anti-robot - même rôle qu'`IPasswordHasher`
 * (cf. ARCHITECTURE.md §3.8) : isoler un appel réseau tiers (Cloudflare
 * Turnstile) derrière une interface définie PAR le domaine, pour que
 * `RegisterUseCase` reste testable sans dépendre du réseau ni de Cloudflare.
 *
 * « Le demandeur est un humain » est une propriété de la requête HTTP, pas de
 * l'agrégat `User` - ce port est donc consommé par le use case, jamais par
 * `User.register()` lui-même.
 *
 * Implémenté par `TurnstileVerifier` (production) et `NoopCaptchaVerifier`
 * (dev/e2e, sélectionné quand `TURNSTILE_SECRET_KEY` est absent).
 */
export interface ICaptchaVerifier {
  /**
   * Lève `DomainException` si la vérification échoue (jeton absent, invalide,
   * ou erreur réseau - toujours échec fermé) plutôt que de retourner un
   * booléen : `RegisterUseCase` réutilise ainsi son `catch (e instanceof
   * DomainException)` existant sans branche supplémentaire.
   */
  assertHuman(token?: string, remoteIp?: string): Promise<void>;
}
