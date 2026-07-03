---
id: "us-a2-editer-supprimer-une-partie-planifiee-2026-07-03"
status: "done"
priority: "medium"
assignee: null
dueDate: null
created: "2026-07-03T19:28:55.333Z"
modified: "2026-07-03T19:28:55.333Z"
completedAt: "2026-07-03T19:28:55.333Z"
labels: ["mode-campagne", "programme-tele"]
order: "a6"
---

# Éditer / supprimer une partie planifiée

En tant qu'organisateur, je veux modifier ou supprimer une partie encore planifiée,
afin de corriger le programme avant qu'elle soit jouée.

## Critères d'acceptation

- [x] Étant donné une partie PLANIFIE, quand je change son scénario ou son type,
      alors le programme reflète le changement.
- [x] Étant donné une partie PLANIFIE, quand je la supprime, alors elle disparaît du
      programme.
- [x] Étant donné une partie JOUE, quand je tente de l'éditer ou de la supprimer,
      alors c'est refusé.
- [x] Étant donné une saison TERMINEE, quand je tente d'éditer ou de supprimer une
      partie, alors c'est refusé.
- [x] Étant donné que je ne suis pas organisateur, quand j'édite ou supprime une
      partie, alors c'est refusé (403/404).
