---
id: "rm-3-persistance-houserules-campagne-2026-09-20"
status: "done"
priority: "medium"
assignee: null
dueDate: null
created: "2026-09-20T10:02:28.000Z"
modified: "2026-09-23T20:57:32.000Z"
completedAt: "2026-09-23T20:57:32.000Z"
labels: ["regles-maison", "mode-campagne", "wayfinder:task"]
order: "a1"
---
# RM-3 — Persistance du réglage des règles maison sur la campagne

Carte parente : [Carte — Règles maison](./regles-maison-carte-2026-09-20.md)

## Question

Stocker et exposer, par campagne, l'état des règles maison — sur le modèle de
bout en bout déjà en place pour le budget de campagne.

## Critères d'acceptation

- [x] Colonne sur l'entité campagne, champ correspondant dans l'agrégat avec son
      accesseur, hydratation par le mapper.
- [x] Mutation portée par l'agrégat, **sans contrainte d'état** : modifiable en
      construction, en cours et jusqu'à la fin — contrairement au budget, dont la
      restriction `EN_CONSTRUCTION` tient à l'éligibilité des équipes, sans objet
      ici.
- [x] Une clé absente du catalogue est rejetée en HTTP 400, jamais ignorée
      silencieusement.
- [x] Réglable à la création de la campagne **et** à sa modification.
- [x] Exposé dans les réponses de campagne, y compris sur la route de consultation
      par code d'invitation — l'écran d'inscription en a besoin (cf. RM-7).
- [x] Migration de production, conformément à la procédure du projet.
- [x] Tests unitaires : agrégat (mutation, rejet d'une clé inconnue) et use cases.

## Dépendances

Bloqué par [RM-1](../rm-1-conception-ddd-regles-maison-2026-09-20.md) (forme du
stockage) et [RM-2](./rm-2-catalogue-yaml-regles-maison-2026-09-20.md) — le
catalogue est la référence contre laquelle les clés sont validées. **Résolu.**

## Résolution

Implémenté sur le modèle de bout en bout de `Campaign.budget`, avec une différence
délibérée : une **route dédiée** plutôt que la réutilisation de
`PUT /api/campaigns/:id` (nom/budget, réservée à `EN_CONSTRUCTION`) — décision prise
pour que « aucune contrainte d'état » soit vraie de bout en bout, pas seulement au
niveau de l'agrégat.

- **`HouseRules.fromUserInput(keys, validKeys)`** (`domain/house-rules/house-rules.ts`)
  — seconde factory du Value Object posé par anticipation en RM-4 (qui n'avait que
  `none()`/`fromPersisted()`) : rejette (`DomainException`) toute clé absente de
  `validKeys`, l'instantané du catalogue courant fourni par l'appelant. Le domaine
  ne connaît jamais `HouseRuleCatalogService`.
- **`Campaign.setHouseRules(keys, validKeys)`** — nouvelle commande, **sans aucune
  garde d'état** contrairement à `changeBudget`. `_houseRules` devient un champ
  mutable, initialisé par le 8e paramètre (optionnel, `HouseRules.none()` par
  défaut) du constructeur.
- **Colonne `houseRules` (`jsonb NOT NULL DEFAULT '[]'`)** sur `campaigns` —
  première colonne jsonb du projet ; migration
  `1790196361073-AddCampaignHouseRules` (générée par
  `migration:generate`, vérifiée par diff manuel avant ajout à `index.ts`) ;
  `CampaignMapper.toCampaign` hydrate via `HouseRules.fromPersisted` ;
  `CampaignRepository.createCampaign`/`saveStructural` sérialisent via
  `.toArray()`.
- **Route dédiée `PUT /api/campaigns/:id/house-rules`** (`SetHouseRulesDto`,
  `SetHouseRulesUseCase` — même forme que `UpdateCampaignUseCase`, organisateur
  uniquement, `DomainException` → `BadRequestException`) — jamais bloquée par les
  gardes `EN_CONSTRUCTION` de `rename()`/`changeBudget()`.
- **`POST /api/campaigns`** (`CreateCampaignDto.houseRules?`) — validé de la même
  façon avant persistance (`CreateCampaignUseCase`, aucun agrégat n'existe encore à
  ce stade, validation directe via `HouseRules.fromUserInput`).
- **Exposition** : `CampaignResponseDto` (spread de `CampaignOrm`, comme `budget`)
  et `CampaignSummaryDto.houseRules` (route par code d'invitation,
  `findByInviteCode`).
- **`HouseRuleCatalogService.validKeys()`** — méthode ajoutée pour éliminer la
  duplication `getAll().map(r => r.nom_interne)` entre les deux use cases
  (relevé en revue de code, axe Standards).
- **Tests** : `house-rules.spec.ts` (nouveau), bloc `Campaign - setHouseRules`
  dans `campaign.spec.ts` (3 états, clé inconnue, remplacement intégral),
  `set-house-rules.usecase.spec.ts` (nouveau), ajouts à
  `create-campaign.usecase.spec.ts`, ajout à `house-rule-catalog.service.spec.ts`.

Suite complète backend verte (981 tests, aucune régression), lint propre sur tout
le code nouveau/modifié (erreurs `typedef`/`explicit-function-return-type`
restantes préexistantes, mêmes fichiers/lignes qu'avant ce changement).
Documentation mise à jour : [spec/CAMPAIGN.md](../../../docs/spec/CAMPAIGN.md#règles-maison)
(nouvelle section + tableau des endpoints) et
[DOMAIN_MODEL.md](../../../docs/DOMAIN_MODEL.md) (ERD `CAMPAIGN`, diagramme de
classe `Campaign`).

Revue à deux axes (skill `code-review`, comparé à `ee4eab2`) : 0 finding Spec, 1
finding Standards (duplication mineure `validKeys`, corrigée ci-dessus avant
commit).

RM-5/RM-6 restent en `backlog` : RM-5 dépendait de RM-3 et RM-4 (les deux
désormais résolues) ; RM-6 dépend de RM-2 et RM-3 (idem).
