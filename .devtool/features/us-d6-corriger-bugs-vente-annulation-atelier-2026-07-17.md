---
id: "us-d6-corriger-bugs-vente-annulation-atelier-2026-07-17"
status: "backlog"
priority: "medium"
assignee: null
dueDate: null
created: "2026-07-17T00:00:00.000Z"
modified: "2026-07-17T00:00:00.000Z"
completedAt: null
labels: ["mode-campagne", "cagnotte-atelier"]
order: "aE"
---

# Corriger les bugs de vente/annulation en Atelier

En tant que joueur, je veux que les opérations de vente et d'annulation d'achat en
Atelier respectent les règles métier sans incohérences, afin que mon équipe reste
toujours dans un état légal.

## Critères d'acceptation

- [ ] Étant donné un véhicule pré-existant dont une arme/amélioration a été
      achetée *dans la session en cours*, quand je revends le véhicule entier,
      alors les éléments achetés cette session sont remboursés au plein tarif
      (annulation), pas à moitié prix (revente).
- [ ] Étant donné un équipement acheté cette session, quand j'annule son achat,
      alors les événements de la même session survenus *après* lui sont revérifiés
      — si l'un devient illégal (ex. capacité dépassée), l'annulation est rejetée
      avec un message explicite à l'utilisateur.

## Notes

Bugs documentés dans `docs/spec/CAMPAIGN.md#annulation-dachat-vs-revente` comme
"limitations connues". Priorité moyenne — impacts marginaux pour la majorité des
flux de jeu, mais cas pathologiques possibles.
