---
id: "us-g1-lancer-une-partie-2026-07-17"
status: "backlog"
priority: "high"
assignee: null
dueDate: null
created: "2026-07-17T00:00:00.000Z"
modified: "2026-07-17T00:00:00.000Z"
completedAt: null
labels: ["mode-campagne", "programme-tele"]
order: "aB"
---

# Lancer une partie

En tant qu'organisateur, je veux avoir une action explicite "Lancer la partie" pour
initialiser le cycle de jeu, afin que chaque participant reçoive ses points de vote
du public et que l'atelier précédent soit automatiquement clôturé.

## Critères d'acceptation

- [ ] Étant donné une partie PLANIFIE en EN_COURS, quand j'appuie sur « Lancer la
      partie », alors chaque participant présent voit ses points de vote du public
      initiaux (dérivés du classement courant `standings()`) affichés.
- [ ] Étant donné que l'atelier d'une partie précédente est ouvert, quand je lance
      la nouvelle partie, alors l'atelier précédent est automatiquement clôturé
      (`ATELIER → JOUE`), évitant un atelier "orphelin" pendant que le jeu déroule.
- [ ] Étant donné que je ne suis pas organisateur, quand je tente de lancer une
      partie, alors c'est refusé (403/404).

## Notes

Limitation actuelle : seul le passage automatique à ATELIER (fin du wizard) ou la
clôture manuelle existent — aucune action de lancement ni de points de vote publics
(mécanisme Gaslands p.167, non implémenté).
