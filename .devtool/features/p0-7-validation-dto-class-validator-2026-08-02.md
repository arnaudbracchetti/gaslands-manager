---
id: "p0-7-validation-dto-class-validator-2026-08-02"
status: "backlog"
priority: "critical"
assignee: null
dueDate: null
created: "2026-08-02T05:39:41.000Z"
modified: "2026-08-02T05:39:41.000Z"
completedAt: null
labels: ["securite"]
order: "aN"
---
# P0-7 — `class-validator` + `ValidationPipe` global

En tant qu'exploitant de l'application, je veux que toute requête entrante
soit validée en forme (type, présence, taille), afin qu'aucune des 45 routes
campagne/teams/auth n'accepte silencieusement des données malformées ou
surdimensionnées — les 27 DTO actuels n'ont aujourd'hui zéro décorateur.

## Critères d'acceptation

- [ ] `class-validator` + `class-transformer` installés en `dependencies`.
- [ ] **Séquence en 3 commits, e2e vert après chacun** (piège : activer
      `whitelist: true` avant d'avoir décoré un DTO vide son corps en
      silence — perte de données, pas une 400) :
  1. [ ] Décorer les 27 DTO liés par `@Body()`, pipe encore éteint —
         `nx build backend` + `nx test backend` doivent passer, comportement
         à l'exécution inchangé.
  2. [ ] Activer le pipe permissivement (`transform: true, whitelist: false,
         forbidNonWhitelisted: false, enableImplicitConversion: false`) via
         `APP_PIPE` dans `app.module.ts` — suite e2e **complète** lancée.
  3. [ ] Resserrer (`whitelist: true, forbidNonWhitelisted: true`),
         re-lancer les deux suites e2e ; auditer au préalable les charges
         utiles Angular (`.post(`/`.patch(`) pour anticiper les 400.
- [ ] Frontière DTO/agrégat respectée : le DTO ne valide que ce qui est
      déductible de la charge utile seule (`@IsString`, `@IsInt @Min(1)`,
      `@MaxLength` anti-DoS, `@IsEnum` sur les énumérations de transport
      fermées, `@ValidateNested({ each: true }) @Type(...)
      @ArrayMaxSize(...)` **obligatoire** sur les tableaux imbriqués de
      `record-result.dto.ts`) ; tout ce qui exige de connaître le catalogue
      ou l'état de l'agrégat reste dans l'agrégat (`ReorderGamesDto.gameIds`
      → `Campaign.reorderGames`, clamp de `SabotageSpentDto.pointsSpent` →
      `SabotagePointsSpentEvent`).
- [ ] Duplication délibérée commentée comme telle : `password` (DTO
      `@MaxLength(200)` anti-DoS, agrégat 6-72 octets), `email` (DTO
      `@MaxLength(254)`, **pas** `@IsEmail()` — le format reste un invariant
      de `User`).
- [ ] Messages d'erreur conservés activés (pas de
      `disableErrorMessages`) — affichés à l'utilisateur dans cette UI
      francophone.

## Notes

Effort et risque de régression les plus élevés → volontairement en dernier
des P0 (la suite e2e complète sert de garde-fou). Dépend de P0-6. Voir
`docs/plans/2026-08-02-durcissement-securite-vps-design.md#p0-7--class-validator--validationpipe-global`.

**Vérification** : étape 1 → `nx test backend` + `nx build backend`.
Étapes 2-3 → `npx nx run-many -t lint test build typecheck` puis **les deux**
suites e2e.
