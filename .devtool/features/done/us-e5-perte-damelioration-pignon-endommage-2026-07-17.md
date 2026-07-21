---
id: "us-e5-perte-damelioration-pignon-endommage-2026-07-17"
status: "done"
priority: "low"
assignee: null
epic: null
dueDate: null
created: "2026-07-17T00:00:00.000Z"
modified: "2026-07-20T22:01:44.578Z"
completedAt: "2026-07-20T22:01:44.578Z"
labels: ["mode-campagne", "degats-sequelles"]
order: "Zy"
---
# Perte d'avantage sur "Pignon endommagé"

En tant que joueur, je veux que la ligne "Pignon endommagé" de la Table des
Épaves retire un avantage monté du véhicule (tirage aléatoire), distinctement de
la ligne « Arrachée » qui retire une arme ou une amélioration, afin que chaque
tirage soit traité correctement selon les règles du jeu (Gaslands p.168).

## Critères d'acceptation

- [ ] Étant donné un véhicule tirant sur la ligne « Pignon endommagé », quand je
      lance la résolution, alors un avantage est retiré (tirage aléatoire dans
      le pool monté) — distinct de la ligne « Arrachée » (arme/amélioration).
- [ ] Étant donné un véhicule sans avantage monté, quand la ligne « Pignon
      endommagé » est obtenue, alors aucune perte d'équipement ne s'applique (seul
      le gain de +1 Choc du tirage reste effectif).
- [ ] Un avantage perdu apparaît barré avec un badge/filigrane "Perdu" distinct de
      "Vendu" dans l'interface d'atelier — le bouton « Retirer » est désactivé (comme
      pour un équipement vendu).
- [ ] Un avantage perdu ne compte plus dans la contrainte d'unicité (rachetable une
      fois perdu, sans attendre qu'un tirage suivant le détruise complètement).
- [ ] Bug de persistance corrigé : `ImprovementLostEvent` (perte d'amélioration sur
      Arrachée) est maintenant persité correctement dans la base (colonne `improvementId`
      + dispatcher `eventToOrm`/`toEvent`).

## Notes

Tirage indépendant sur les avantages (pool distinct du pool armes/améliorations).
L'affichage "Perdu" bénéficie rétroactivement à tous les équipements perdus
(armes/améliorations déjà via Arrachée, avantages via Pignon endommagé).