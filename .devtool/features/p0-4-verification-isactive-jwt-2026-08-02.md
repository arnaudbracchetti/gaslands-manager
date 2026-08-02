---
id: "p0-4-verification-isactive-jwt-2026-08-02"
status: "backlog"
priority: "critical"
assignee: null
dueDate: null
created: "2026-08-02T05:39:41.000Z"
modified: "2026-08-02T05:39:41.000Z"
completedAt: null
labels: ["securite", "auth"]
order: "aK"
---
# P0-4 — Vérifier `isActive` à chaque requête authentifiée

En tant qu'administrateur, je veux que désactiver un compte coupe
immédiatement l'accès de cet utilisateur, afin qu'un compte désactivé ne
puisse pas continuer à utiliser l'application pendant jusqu'à 7 jours (durée
de vie actuelle du JWT) après sa désactivation.

## Critères d'acceptation

- [ ] `auth/domain/user.ts` : nouvelle méthode `assertCanHoldSession()`
      levant `DomainException` si le compte est inactif — règle métier dans
      l'agrégat, pas dans la stratégie Passport (cf. CLAUDE.md).
- [ ] `assertCanAuthenticate` refactoré pour appeler `assertCanHoldSession()`
      après la comparaison du mot de passe (le message de désactivation
      n'apparaît qu'après un mot de passe valide — pas d'énumération de
      comptes désactivés).
- [ ] `jwt.strategy.ts` : après `findById`, appel à
      `user.assertCanHoldSession()`, `DomainException` → traduite en
      `UnauthorizedException`.
- [ ] Tests : nouveaux cas dans `user.spec.ts` + nouveau
      `jwt.strategy.spec.ts` avec un faux `IUserRepository`.

## Notes

Seul bug d'autorisation franc identifié dans l'audit (`jwt.strategy.ts:66-68`
recharge l'utilisateur mais ne vérifie jamais `isActive` aujourd'hui). Dépend
de P0-3. Voir
`docs/plans/2026-08-02-durcissement-securite-vps-design.md#p0-4--isactive-vérifié-à-chaque-requête`.

**Vérification manuelle** : se connecter, `UPDATE users SET "isActive"=false`,
prochain `GET /api/auth/me` → 401 (200 avant correctif).
