---
id: "p0-7-validation-dto-class-validator-2026-08-02"
status: "review"
priority: "critical"
assignee: null
dueDate: null
created: "2026-08-02T05:39:41.000Z"
modified: "2026-08-05T19:15:00.000Z"
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

- [x] `class-validator` + `class-transformer` installés en `dependencies`.
- [x] **Séquence en 3 étapes, e2e vert après chacune** (piège : activer
      `whitelist: true` avant d'avoir décoré un DTO vide son corps en
      silence — perte de données, pas une 400) — implémentées dans l'arbre de
      travail en une seule session, **pas encore scindées en 3 commits distincts**
      (l'utilisateur a explicitement demandé de ne rien commiter, cf. Notes) :
  1. [x] Décorer les 27 DTO liés par `@Body()`, pipe encore éteint —
         `nx build backend` + `nx test backend` passent (858 tests), comportement
         à l'exécution inchangé.
  2. [x] Activer le pipe permissivement (`transform: true, whitelist: false,
         forbidNonWhitelisted: false, enableImplicitConversion: false`) via
         `APP_PIPE` dans `app.module.ts` — suite e2e **complète** lancée
         (frontend-e2e 44/44, backend-e2e 11/11).
  3. [x] Resserrer (`whitelist: true, forbidNonWhitelisted: true`),
         re-lancé les deux suites e2e (toujours 44/44 et 11/11) ; audit
         préalable des charges utiles Angular (`.post(`/`.patch(`/`.put(` dans
         `apps/frontend/src/app`) confirmant qu'aucun champ non déclaré n'est
         envoyé par le client.
- [x] Frontière DTO/agrégat respectée : le DTO ne valide que ce qui est
      déductible de la charge utile seule (`@IsString`, `@IsInt @Min(1)`,
      `@MaxLength` anti-DoS, `@IsEnum` sur les énumérations de transport
      fermées, `@ValidateNested({ each: true }) @Type(...)
      @ArrayMaxSize(...)` **obligatoire** sur les tableaux imbriqués de
      `record-result.dto.ts`) ; tout ce qui exige de connaître le catalogue
      ou l'état de l'agrégat reste dans l'agrégat (`ReorderGamesDto.gameIds`
      → `Campaign.reorderGames`, clamp de `SabotageSpentDto.pointsSpent` →
      `SabotagePointsSpentEvent`). Point non anticipé par la carte, découvert
      en implémentant : plusieurs champs `vehicleId`/`targetVehicleId`/
      `targetEntityId`/`weaponIds` (côté `campaign/dto/`) référencent des
      entités transientes D-S11 (id = `-event.id`, négatif) — pas de `@Min(1)`
      sur ces champs précis, seulement `@IsInt()` (borne `@Min(1)` conservée
      partout où l'id référence toujours une ligne réelle en base :
      `participantId`, `teamId`, `gameId`).
- [x] Duplication délibérée commentée comme telle : `password` (DTO
      `@MaxLength(200)` anti-DoS, agrégat 6-72 octets), `email` (DTO
      `@MaxLength(254)`, **pas** `@IsEmail()` — le format reste un invariant
      de `User`).
- [x] Messages d'erreur conservés activés (pas de
      `disableErrorMessages`) — affichés à l'utilisateur dans cette UI
      francophone.

## Notes

Effort et risque de régression les plus élevés → volontairement en dernier
des P0 (la suite e2e complète sert de garde-fou). Dépend de P0-6. Voir
`docs/plans/2026-08-02-durcissement-securite-vps-design.md#p0-7--class-validator--validationpipe-global`.

**Vérification** : étape 1 → `nx test backend` + `nx build backend` (✅).
Étapes 2-3 → `npx nx run-many -t lint test build typecheck` (backend:lint et
backend:typecheck échouent, mais à l'identique avant/après ces changements —
confirmé par `git stash`/`git stash pop` : baseline pré-existante du dépôt,
sans rapport avec P0-7 ; frontend:lint/typecheck également pré-existants,
zéro fichier frontend touché par cette carte) puis **les deux** suites e2e (✅).

**Reste à faire, hors du travail de code** : rien n'a été commité (demande
explicite de l'utilisateur) — l'arbre de travail contient les 27 DTO +
`app.module.ts` modifiés, prêts pour relecture. Découper en 3 commits (un par
étape ci-dessus) reste à faire au moment du commit.
