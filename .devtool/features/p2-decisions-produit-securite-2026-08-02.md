---
id: "p2-decisions-produit-securite-2026-08-02"
status: "backlog"
priority: "low"
assignee: null
dueDate: null
created: "2026-08-02T05:39:41.000Z"
modified: "2026-08-02T05:39:41.000Z"
completedAt: null
labels: ["securite"]
order: "aQ"
---
# P2 — Décisions produit sécurité (différées)

En tant que porteur produit, je veux statuer sur des mécanismes qui touchent
à l'expérience utilisateur (pas seulement à la sécurité technique), afin de
décider consciemment de leur priorité plutôt que de les traiter par défaut.

## Critères d'acceptation

- [ ] Vérification d'email à l'inscription — décision produit à prendre ;
      corrigerait proprement le risque d'énumération de comptes actuellement
      accepté (409 à l'inscription, cf. Notes).
- [ ] Réinitialisation de mot de passe (flux "mot de passe oublié").
- [ ] Verrouillage de compte après un nombre d'échecs de connexion.
- [ ] Jetons de rafraîchissement (permettrait de raccourcir le TTL du JWT
      sans déconnexions brutales, cf. item P1 correspondant).

## Notes

Ces items ne sont **pas** des bugs à corriger mais des choix de produit à
arbitrer — volontairement hors du périmètre P0/P1. Voir
`docs/plans/2026-08-02-durcissement-securite-vps-design.md` (section "P2
(décisions produit)").

**Risques déjà acceptés et documentés** (à ne pas reproposer comme nouveaux
tickets tant que le contexte ne change pas — cf. section "Décisions
assumées" du document source) :
- Le 409 à l'inscription (énumération de comptes) — TODO posé à
  `user.repository.ts:61`, à corriger gratuitement quand la vérification
  d'email (ci-dessus) existera.
- Le JWT en `localStorage` (pas de migration vers un cookie `httpOnly`) — à
  revoir si rendu de markdown/HTML saisi par l'utilisateur, script tiers
  au-delà de Turnstile, ou upload de fichier apparaît.
- pgAdmin retiré de la production (déjà acté dans P0-8).
