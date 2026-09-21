---
id: "rm-7-ihm-affichage-lecture-seule-2026-09-20"
status: "backlog"
priority: "medium"
assignee: null
dueDate: null
created: "2026-09-20T10:02:28.000Z"
modified: "2026-09-20T10:02:28.000Z"
completedAt: null
labels: ["regles-maison", "mode-campagne", "frontend", "wayfinder:task"]
order: "ad"
---
# RM-7 — IHM : afficher les règles maison actives en lecture seule

Carte parente : [Carte — Règles maison](./regles-maison-carte-2026-09-20.md)

## Question

Un joueur doit savoir sous quelles règles il joue, sans pouvoir les modifier.

## Critères d'acceptation

- [ ] Sur la page de détail d'une campagne : les règles maison actives, visibles
      par **tout participant validé**, avec la ligne explicative correspondant à
      leur état effectif.
- [ ] Sur l'écran d'inscription par code d'invitation : la même information, avant
      même de rejoindre la campagne — comme le budget aujourd'hui.
- [ ] Le rendu construit en RM-6 est réutilisé en mode non modifiable, pas
      dupliqué.
- [ ] Tests unitaires.

## Dépendances

Bloqué par [RM-6](./rm-6-ihm-reglage-regles-maison-2026-09-20.md) — le rendu
partagé y est construit — et
[RM-3](./rm-3-persistance-houserules-campagne-2026-09-20.md) — la route de
consultation par code doit exposer le réglage.
