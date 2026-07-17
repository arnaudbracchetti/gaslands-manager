---
id: "us-a1-definir-le-programme-tele-2026-07-03"
status: "done"
priority: "high"
assignee: null
epic: null
dueDate: null
created: "2026-07-03T19:28:55.333Z"
modified: "2026-07-17T00:00:00.000Z"
completedAt: "2026-07-17T00:00:00.000Z"
labels: ["mode-campagne", "programme-tele"]
order: "a1"
---
# Définir le Programme Télé

En tant qu'organisateur, je veux ajouter des parties (Événements Télévisés ou
Escarmouches) au programme de la saison, afin de structurer le calendrier de la
campagne.

## Critères d'acceptation

- [x] Étant donné une saison EN_CONSTRUCTION ou EN_COURS dont je suis organisateur,
      quand j'ajoute une partie avec un scénario et un type (EVENEMENT_TELE |
      ESCARMOUCHE), alors une partie PLANIFIE est créée et apparaît dans le
      programme, ordonnée.
- [x] Étant donné que je ne suis pas organisateur, quand j'appelle l'endpoint de
      création, alors je reçois une erreur d'autorisation (403/404).
- [x] Étant donné une partie déjà JOUE, quand je tente de la modifier, alors la
      modification est refusée.
- [x] Étant donné une saison TERMINEE, quand je tente d'ajouter une partie, alors
      c'est refusé (le programme n'est plus gérable une fois la saison terminée).