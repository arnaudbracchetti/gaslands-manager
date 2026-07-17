---
id: "us-e4-echanger-des-chocs-contre-des-sequelles-2026-07-03"
status: "done"
priority: "low"
assignee: null
dueDate: null
created: "2026-07-03T19:28:55.333Z"
modified: "2026-07-17T00:00:00.000Z"
completedAt: "2026-07-17T00:00:00.000Z"
labels: ["mode-campagne", "degats-sequelles"]
order: "a9"
---

# Échanger des Chocs contre des Séquelles

En tant que joueur, je veux dépenser les Chocs d'un véhicule pour acquérir une
Séquelle, afin de garder mon véhicule en jeu plus longtemps (p.169).

## Critères d'acceptation

- [x] Étant donné un véhicule avec assez de Chocs, quand je choisis une Séquelle,
      alors elle est créée avec son coût en Chocs et les Chocs disponibles
      diminuent d'autant.
- [x] Étant donné un véhicule avec trop peu de Chocs, quand je tente l'échange,
      alors c'est refusé.
- [x] Étant donné une Séquelle déjà possédée, quand je tente de la reprendre,
      alors c'est refusé (pas de doublon, p.169).

## Vérification code (2026-07-03)

Repassée de `done` à `backlog` — 2 critères sur 3 tiennent
(`AddSequellaUseCase`/`SequellaAddedEvent`, `Vehicle.addChocs` qui lève une
`DomainException` si le solde deviendrait négatif, testé dans
`sequella-added.event.spec.ts`). En revanche **aucune vérification de doublon**
n'existe : ni `AddSequellaUseCase`, ni `SequellaAddedEvent.execute`, ni
`Vehicle.addSequella()` (simple `push`) ne contrôlent qu'une séquelle n'est pas déjà
présente sur le véhicule — elle peut être ajoutée deux fois, cumulant son effet et
son coût en Chocs.

## Vérification code (2026-07-17)

Implémenté — `Vehicle.canAddSequella` garde désormais explicitement l'unicité (cf. `docs/spec/CAMPAIGN.md#séquelles` : "une même séquelle `ATELIER` ne peut être acquise deux fois"). Le 3ᵉ critère (manquant depuis 2026-07-03) est désormais coché. Tous les critères sont satisfaits.
