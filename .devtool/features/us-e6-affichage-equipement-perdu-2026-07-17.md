---
id: "us-e6-affichage-equipement-perdu-2026-07-17"
status: "review"
priority: "low"
assignee: null
epic: null
dueDate: null
created: "2026-07-17T00:00:00.000Z"
modified: "2026-07-17T15:40:51.366Z"
completedAt: null
labels: ["mode-campagne", "atelier-ui"]
order: "a1"
---
# Afficher les équipements perdus distinctement des équipements vendus

En tant que joueur, je veux voir visuellement la différence entre un équipement
perdu à la Table des Épaves et un équipement revendu en atelier, afin de mieux
comprendre l'historique de mon véhicule et ses contraintes actuelles.

## Critères d'acceptation

- [ ] Une arme/amélioration/avantage marquée `isLost` affiche un filigrane
      "Perdu" (distinct du filigrane "Vendu" pour les équipements revendus).
- [ ] Le bouton « Retirer » est désactivé pour tout équipement perdu (comme pour
      les équipements vendus), car la perte est irréversible — aucune annulation
      ou revente possible en atelier.
- [ ] Le compteur d'équipements masqués ("Afficher les vendus/perdus") inclut
      les deux catégories (`isSold` ou `isLost`).
- [ ] L'affichage "Perdu" fonctionne pour les 3 types d'équipement :
      - Armes perdues (Table des Épaves, résultat ARRACHEE)
      - Améliorations perdues (Table des Épaves, résultat ARRACHEE)
      - Avantages perdus (Table des Épaves, résultat PIGNON_ENDOMMAGE)

## Notes

Bénéficie rétroactivement à tous les équipements perdus, y compris ceux créés
avant l'implémentation de Pignon endommagé. Le styling et la couleur du badge
"Perdu" doivent utiliser les design tokens CSS existants (`--clr-*`), jamais des
couleurs en dur (cf. CLAUDE.md — CSS design tokens).