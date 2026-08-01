---
id: "us-a4-reordonner-les-parties-du-programme-2026-07-03"
status: "done"
priority: "low"
assignee: null
epic: null
dueDate: null
created: "2026-07-03T19:28:55.333Z"
modified: "2026-07-28T18:40:52.539Z"
completedAt: "2026-07-28T18:40:52.542Z"
labels: ["mode-campagne", "programme-tele"]
order: "Zu"
---
# Réordonner les parties du Programme

En tant qu'organisateur, je veux changer l'ordre des parties encore planifiées,
afin de réorganiser le calendrier au-delà de l'ajout en fin de liste (auto-append).

US-A1 ajoute toute nouvelle partie en fin de programme (auto-append). Cette story
ajoute le réordonnancement explicite, volontairement séparé pour rester hors du
périmètre d'US-A1. Explicitement listée comme hors scope de l'itération actuelle
dans `docs/spec/CAMPAIGN.md`.

## Critères d'acceptation

- [ ] Étant donné plusieurs parties PLANIFIE, quand je change l'ordre de l'une
      d'elles, alors le programme est réaffiché dans le nouvel ordre, de façon
      stable et sans collision d'indices.
- [ ] Étant donné une partie JOUE, quand je tente de la déplacer, alors c'est
      refusé (les parties jouées gardent leur position historique).
- [ ] Étant donné que je ne suis pas organisateur, quand je tente de réordonner,
      alors c'est refusé (403/404).