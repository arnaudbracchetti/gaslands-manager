---
id: "us-c1-consulter-le-classement-2026-07-03"
status: "done"
priority: "high"
assignee: null
epic: null
dueDate: null
created: "2026-07-03T19:28:55.333Z"
modified: "2026-07-04T06:56:19.344Z"
completedAt: "2026-07-04T06:56:19.345Z"
labels: ["mode-campagne", "classement"]
order: "a8"
---
# Consulter le classement

En tant que joueur, je veux voir le classement des équipes par Points de Championnat, afin de suivre qui mène la saison.

## Critères d'acceptation

- \[ \] Étant donné une saison avec des parties jouées, quand j'ouvre l'onglet « Season », alors je vois les équipes triées par PC décroissants.
- \[ \] Étant donné qu'aucune partie n'a été jouée, quand j'ouvre le classement, alors toutes les équipes sont à 0 PC.
- \[ \] Étant donné des PC, quand je les consulte, alors ils sont calculés à la volée depuis les GameResult (cohérence garantie, aucune désynchronisation).