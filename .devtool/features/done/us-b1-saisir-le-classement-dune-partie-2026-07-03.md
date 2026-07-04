---
id: "us-b1-saisir-le-classement-dune-partie-2026-07-03"
status: "done"
priority: "high"
assignee: null
epic: null
dueDate: null
created: "2026-07-03T19:28:55.333Z"
modified: "2026-07-04T06:08:04.726Z"
completedAt: "2026-07-04T06:08:04.726Z"
labels: ["mode-campagne", "enregistrement-partie"]
order: "a7"
---
# Saisir le classement d'une partie

En tant qu'organisateur, je veux saisir le rang final de chaque équipe ayant joué une
partie, afin que l'appli calcule les Points de Championnat de classement.

## Critères d'acceptation

- [x] Étant donné une partie PLANIFIE de type EVENEMENT_TELE, quand je saisis le
      rang de chaque équipe et valide, alors un GameResult est créé par équipe avec
      son rank.
- [x] Étant donné les rangs saisis, quand la partie est validée, alors les Points de
      Championnat de classement sont attribués (10/5/2/1 selon position, p.167)
      uniquement pour un EVENEMENT_TELE.
- [x] Étant donné une partie de type ESCARMOUCHE, quand je saisis les rangs, alors
      aucun Point de Championnat de classement n'est attribué.
- [x] Étant donné que je ne suis pas organisateur, quand j'enregistre un résultat,
      alors c'est refusé.