---
id: "rm-2-catalogue-yaml-regles-maison-2026-09-20"
status: "done"
priority: "medium"
assignee: null
dueDate: null
created: "2026-09-20T10:02:28.000Z"
modified: "2026-09-21T20:25:00.000Z"
completedAt: "2026-09-21T20:25:00.000Z"
labels: ["regles-maison", "mode-campagne", "wayfinder:task"]
order: "aY"
---
# RM-2 - Catalogue YAML des règles maison

Carte parente : [Carte - Règles maison](./regles-maison-carte-2026-09-20.md)

## Question

Créer le catalogue de définitions des règles maison et son exposition en lecture
publique, sur le modèle des catalogues déjà en place (sponsors, véhicules, armes,
améliorations, avantages, séquelles, scénarios).

## Critères d'acceptation

- [x] Fichier `database_init/data/regles-maison.yml`, chaque règle portant : nom
      affiché, nom interne, description courte « décochée » (rappel du
      comportement par défaut) et description courte « cochée » (comportement
      alternatif).
- [x] Chargement au démarrage en singleton mémoire, indexé par nom interne,
      conversion Markdown → HTML des textes - même mécanisme que les catalogues
      existants, patron Template Method compris pour rendre le service testable
      sans simuler le système de fichiers.
- [x] Endpoint public (sans JWT), aligné sur les autres routes de catalogue.
- [x] Première entrée : `resistance_sans_points_championnat`, libellée
      « Points de Résistance aux équipes sans point de championnat ».
- [x] Textes courts de cette première règle :
      décochée - « Les participants classés dans la seconde moitié du classement
      gagnent 3 Points de Résistance. » ;
      cochée - « Les participants qui n'ont gagné aucun point de championnat sur
      la partie gagnent 3 Points de Résistance. »
- [x] Tests unitaires du service de chargement.

## Notes

Pas de champ de règles détaillées : écarté au cadrage (cf. *Out of scope* de la
carte parente), il serait de la donnée morte tant qu'aucun écran ne l'affiche.

## Dépendances

Bloquait sur [RM-1](./rm-1-conception-ddd-regles-maison-2026-09-20.md) - **résolu**.
Conception retenue (§2 du document de conception, cf. résolution RM-1) : service
singleton dédié dans `campaign/`, calqué fichier pour fichier sur
`ScenarioCatalogService` - pas une extension du `CatalogService` du module équipe.
Détail complet :
[docs/plans/2026-09-21-regles-maison-mecanisme-design.md](../../../docs/plans/2026-09-21-regles-maison-mecanisme-design.md#2-catalogue-yaml-des-règles-maison).

## Résolution

Implémenté à l'identique de la conception retenue lors de RM-1 :

- **`HouseRuleCatalogService`** (`apps/backend/src/app/campaign/house-rule-catalog.service.ts`)
  - miroir fichier pour fichier de `ScenarioCatalogService` : `OnModuleInit`, `Map`
  indexée par `nom_interne`, Template Method `protected readFileContent()`,
  conversion Markdown → HTML des deux champs description (seule différence avec
  le scénario, qui n'en convertit qu'un).
- **`database_init/data/regles-maison.yml`** - une entrée,
  `resistance_sans_points_championnat`, textes courts conformes à ceux demandés
  ci-dessus.
- **Route publique** `GET /api/catalog/regles-maison` dans `campaign.controller.ts`,
  juste après `catalog/scenarios`, sans garde JWT.
- **Câblage** dans `campaign.module.ts` (providers + exports, par symétrie avec
  `ScenarioCatalogService`).
- **Tests** : `house-rule-catalog.service.spec.ts` (chargement, indexation,
  conversion des deux descriptions, clé inconnue) et un test de câblage ajouté à
  `campaign.controller.spec.ts` (`getHouseRules` délègue au catalogue).

Suite complète backend (943 tests) verte, aucune régression. RM-3 débloquée -
son seul bloquant restant était RM-2.
