---
id: "p0-6-captcha-turnstile-inscription-2026-08-02"
status: "backlog"
priority: "critical"
assignee: null
dueDate: null
created: "2026-08-02T05:39:41.000Z"
modified: "2026-08-02T05:39:41.000Z"
completedAt: null
labels: ["securite", "auth"]
order: "aM"
---
# P0-6 — Captcha Cloudflare Turnstile à l'inscription

En tant qu'exploitant de l'application, je veux qu'un humain doive résoudre
un défi avant de créer un compte, afin de rendre impraticable la création de
comptes en masse — contrôle principal anti-abus, la limite de débit de
P0-5 n'étant qu'un filet de secours.

## Critères d'acceptation

- [ ] Backend — port/adaptateur (calqué sur `IPasswordHasher`) :
      `auth/domain/captcha-verifier.interface.ts`
      (`ICaptchaVerifier.assertHuman(token?, remoteIp?)`, lève
      `DomainException`), `TurnstileVerifier` (appel `fetch` vers
      `challenges.cloudflare.com/turnstile/v0/siteverify`, secret passé par
      la factory, `AbortSignal.timeout(5000)`, **échec fermé**),
      `NoopCaptchaVerifier` (sélectionné si `TURNSTILE_SECRET_KEY` absent).
- [ ] Appelé depuis `RegisterUseCase`, **avant** `User.register()` (bcrypt
      coût 10 ne doit pas être brûlé avant rejet) — pas depuis le contrôleur
      ni un guard. `RegisterDto` gagne `captchaToken?: string` (optionnel).
- [ ] Frontend : `environments/environment.ts`/`environment.prod.ts`
      (`turnstileSiteKey`), `fileReplacements` Nx (configuration
      `production` uniquement — `development`/`e2e` gardent la clé vide).
      Widget rendu explicitement (`api.js?render=explicit`), injection
      paresseuse (pas dans `index.html`).
- [ ] `register.ts`/`register.html` : `captchaEnabled`/`captchaToken` en
      Signals (les callbacks Cloudflare sont hors zone Angular — sans
      `signal.set()`, aucun rendu ne se déclenche en mode zoneless), reset du
      widget sur erreur (jetons Turnstile à usage unique), conserver
      verbatim les `<label for>` et le libellé « Créer mon compte »
      (localisés par `frontend-e2e/src/support/auth.ts:28-37`).
- [ ] Chaîne de neutralisation dev/e2e vérifiée aux 4 niveaux (build Angular,
      composant, factory backend, schéma env) — aucune modification des
      suites de test existantes.

## Notes

Dépend de P0-3 (`@Ip()` correct grâce à `trust proxy`). Voir
`docs/plans/2026-08-02-durcissement-securite-vps-design.md#p0-6--turnstile`.

**Vérification** : `npx nx e2e frontend-e2e`/`backend-e2e` inchangés et
verts. Nouveau `register.usecase.spec.ts` avec un faux `ICaptchaVerifier` qui
lève → `BadRequestException` **et** assertion que `hasher.hash` n'a jamais
été appelé. Sur le VPS : `curl -X POST .../auth/register` sans
`captchaToken` → 400 ; test du rejeu après 409 (widget réinitialisé).
