---
id: "us-b3-finaliser-lenregistrement-dune-partie-2026-07-03"
status: "done"
priority: "high"
assignee: null
dueDate: null
created: "2026-07-03T19:28:55.333Z"
modified: "2026-07-03T19:28:55.333Z"
completedAt: "2026-07-03T19:28:55.333Z"
labels: ["mode-campagne", "enregistrement-partie"]
order: "a3"
---

# Finaliser l'enregistrement d'une partie

En tant qu'organisateur, je veux valider l'enregistrement complet d'une partie, afin
de figer ses faits et passer la partie à JOUE.

## Critères d'acceptation

- [x] Étant donné un enregistrement complet, quand je valide, alors Game.status
      passe à JOUE et playedAt est renseigné.
- [x] Étant donné une partie JOUE, quand je tente de la ré-enregistrer, alors c'est
      refusé (les faits sont immuables).
