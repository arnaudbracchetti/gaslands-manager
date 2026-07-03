---
id: "us-c1-consulter-le-classement-2026-07-03"
status: "done"
priority: "high"
assignee: null
dueDate: null
created: "2026-07-03T19:28:55.333Z"
modified: "2026-07-03T19:28:55.333Z"
completedAt: "2026-07-03T19:28:55.333Z"
labels: ["mode-campagne", "classement"]
order: "a4"
---

# Consulter le classement

En tant que joueur, je veux voir le classement des équipes par Points de
Championnat, afin de suivre qui mène la saison.

## Critères d'acceptation

- [x] Étant donné une saison avec des parties jouées, quand j'ouvre l'onglet
      « Classement », alors je vois les équipes triées par PC décroissants.
- [x] Étant donné qu'aucune partie n'a été jouée, quand j'ouvre le classement, alors
      toutes les équipes sont à 0 PC.
- [x] Étant donné des PC, quand je les consulte, alors ils sont calculés à la volée
      depuis les GameResult (cohérence garantie, aucune désynchronisation).
