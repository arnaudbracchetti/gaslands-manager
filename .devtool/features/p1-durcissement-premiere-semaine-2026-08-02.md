---
id: "p1-durcissement-premiere-semaine-2026-08-02"
status: "backlog"
priority: "high"
assignee: null
dueDate: null
created: "2026-08-02T05:39:41.000Z"
modified: "2026-08-02T05:39:41.000Z"
completedAt: null
labels: ["securite"]
order: "aP"
---
# P1 — Durcissement additionnel (première semaine post-lancement)

En tant qu'exploitant de l'application, je veux traiter les correctifs de
sécurité non bloquants pour la mise en ligne mais importants à court terme,
afin de réduire la surface d'attaque résiduelle sans retarder la MEP initiale
(P0).

## Critères d'acceptation

- [ ] Oracle temporel du login corrigé (temps de réponse identique
      compte inexistant / mot de passe invalide).
- [ ] Longueur maximale imposée sur le mot de passe (agrégat `User`, cf.
      duplication DTO/agrégat de P0-7 — le DTO borne déjà à 200, l'agrégat
      doit borner strictement à 72 octets).
- [ ] Format d'email validé dans l'agrégat `User` (invariant d'identité,
      distinct de la validation de forme du DTO en P0-7).
- [ ] TTL du jeton JWT réduit à 24 h (actuellement 7 jours) — pas de jeton
      de rafraîchissement, donc pas plus court (déconnexions brutales).
- [ ] Journal d'audit des événements d'authentification (connexions,
      échecs, désactivations).
- [ ] Rédaction des secrets (mot de passe, token) dans les logs de
      `@LogUseCase()` — actuellement en clair pour toute commande décorée.
- [ ] Sauvegardes automatisées `pg_dump` planifiées sur le VPS.
- [ ] Resserrage de la CSP (`docker/caddy/Caddyfile`) après une période
      d'observation en production.

## Notes

Non bloquant pour la mise en ligne — à traiter dans la semaine suivant le
déploiement de P0-8. Voir
`docs/plans/2026-08-02-durcissement-securite-vps-design.md` (section "P1
(première semaine)").
