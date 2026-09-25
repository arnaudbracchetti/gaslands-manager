---
id: "rm-8-documentation-regles-maison-2026-09-20"
status: "done"
priority: "medium"
assignee: null
dueDate: null
created: "2026-09-20T10:02:28.000Z"
modified: "2026-09-25T00:00:00.000Z"
completedAt: "2026-09-25T00:00:00.000Z"
labels: ["regles-maison", "mode-campagne", "documentation", "wayfinder:task"]
order: "ae"
---
# RM-8 — Documentation des règles maison

Carte parente : [Carte — Règles maison](./regles-maison-carte-2026-09-20.md)

## Question

Mettre la documentation au niveau de ce qui a été livré.

## Critères d'acceptation

- [x] `docs/spec/CAMPAIGN.md` : section « Règles maison » — mécanisme, portée par
      campagne, qui règle et quand, gel du calcul à la clôture de la partie, et la
      règle R1 elle-même. Mettre aussi à jour la section Points de Résistance,
      dont le moment de calcul a changé.
- [x] `docs/DOMAIN_MODEL.md` : le réglage sur l'agrégat campagne, la nouvelle
      Strategy, le catalogue de règles maison dans le diagramme des catalogues.
- [x] `docs/COMPONENTS.md` : les composants ajoutés ou modifiés en RM-6 et RM-7.
- [x] `docs/ARCHITECTURE.md` : le nouveau service de catalogue, s'il en est créé
      un, et le point d'exécution déplacé de la distribution des PR.
- [x] `content/docs/campagnes.md` (documentation **utilisateur**) : une section
      expliquant le **mécanisme** — à quoi servent les règles maison, qui les
      active, quand, et le fait qu'une partie déjà jouée n'est jamais recalculée.
      La liste des règles reste portée par le catalogue et affichée à l'écran,
      jamais recopiée ici (une seule source à maintenir).
- [x] `docs/SPECIFICATION.md` : tableau de suivi des fonctionnalités mis à jour.

## Dépendances

Bloqué par [RM-5](./rm-5-strategie-pr-sans-point-championnat-2026-09-20.md) (**résolue**),
[RM-6](./rm-6-ihm-reglage-regles-maison-2026-09-20.md) (**résolue**) et
[RM-7](./rm-7-ihm-affichage-lecture-seule-2026-09-20.md) (**résolue**) — la
documentation décrit ce qui a effectivement été livré. **Les trois sont
résolues — prenable.**

## Résolution (2026-09-25)

`docs/COMPONENTS.md` était déjà à jour — RM-6/RM-7 avaient documenté
`HouseRulesSelector` et ses points d'intégration (`CampaignForm`,
`EditCampaignModal`, `CampaignDetail`, `CampaignJoin`) au moment de leur propre
résolution. Les cinq autres documents ont été complétés :

- **`docs/spec/CAMPAIGN.md`** : trois nouveaux paragraphes dans « Règles maison »
  — le mécanisme Strategy par point de calcul (`HouseRuleStrategyFactory`, un
  seul point existant à ce jour), la règle R1 elle-même
  (`NoChampionshipPointsStrategy`), et le gel du calcul au moment de l'entrée en
  Atelier (jamais recalculé après coup, y compris si la campagne redevient
  `EN_CONSTRUCTION`). La section « Points de Résistance » (Limitations connues)
  précise désormais que son critère par défaut est remplaçable par R1.
- **`docs/DOMAIN_MODEL.md`** : nouvelle sous-section « Règles maison — Strategy
  de distribution des Points de Résistance » (§4) avec son propre diagramme de
  classes — `GameRulesContext`, `HouseRuleStrategyFactory`,
  `ResistanceDistributionStrategy` + ses deux implémentations — présentée comme
  un quatrième pattern GoF aux côtés de Command/Invoker/Receiver. `Campaign`
  gagne `+strategyFactory` sur son diagramme existant ; `Game.
  distributeResistance(strategy)` corrigé en `distributeResistance()` (le
  paramètre documenté ne correspondait plus à la signature réelle depuis RM-5).
  Catalogue `HouseRuleDefinition` ajouté au diagramme des catalogues en mémoire
  (§2), sans relation avec `Sponsor` (comme `Sequelle`).
- **`docs/ARCHITECTURE.md`** : `HouseRuleCatalogService` documenté comme
  quatrième exemple du pattern singleton-en-mémoire (miroir de
  `ScenarioCatalogService`), ajouté à l'arborescence des modules (§3.1) et au
  tableau « Fichiers clés » (§3.7, avec `game-context.ts` et les trois fichiers
  de `domain/house-rules/`). Le diagramme de flux `EnterAtelierUseCase` (§3.8)
  corrigé pour refléter la signature réelle de `distributeResistance()` (sans
  paramètre, résolution interne via `this.context.strategyFactory`) — le
  paramètre `strategy` documenté à l'origine (RM-4) ne survivait plus à
  l'implémentation de RM-5.
- **`content/docs/campagnes.md`** : nouvelle section « Règles maison » (avant
  « Points de Résistance ») décrivant le mécanisme du point de vue joueur — qui
  active, quand (sans contrainte, y compris après la fin), et la garantie
  qu'une partie déjà jouée n'est jamais recalculée. La liste des règles n'est
  pas recopiée (renvoi à l'écran). La section « Points de Résistance » gagne un
  lien vers cette nouvelle section.
- **`docs/SPECIFICATION.md`** : nouvelle ligne dans le tableau de suivi, juste
  après « Points de Résistance ».

Carte parente entièrement résolue (RM-1 à RM-8) — voir sa mise à jour.
