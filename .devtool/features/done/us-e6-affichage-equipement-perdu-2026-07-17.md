---
id: "us-e6-affichage-equipement-perdu-2026-07-17"
status: "done"
priority: "low"
assignee: null
epic: null
dueDate: null
created: "2026-07-17T00:00:00.000Z"
modified: "2026-07-29T00:00:00.000Z"
completedAt: "2026-07-20T22:01:57.038Z"
labels: ["mode-campagne", "atelier-ui"]
order: "Zx"
---
# Afficher les équipements perdus distinctement des équipements vendus

En tant que joueur, je veux voir visuellement la différence entre un équipement
perdu à la Table des Épaves et un équipement revendu en atelier, afin de mieux
comprendre l'historique de mon véhicule et ses contraintes actuelles.

## Critères d'acceptation

- [x] Une arme/amélioration/avantage marquée `isLost` affiche un filigrane
      "Perdu" (distinct du filigrane "Vendu" pour les équipements revendus).
- [x] Le bouton « Retirer » est désactivé pour tout équipement perdu (comme pour
      les équipements vendus), car la perte est irréversible — aucune annulation
      ou revente possible en atelier.
- [x] Le compteur d'équipements masqués ("Afficher les vendus/perdus") inclut
      les deux catégories (`isSold` ou `isLost`).
- [x] L'affichage "Perdu" fonctionne pour les 3 types d'équipement :
      - Armes perdues (Table des Épaves, résultat ARRACHEE)
      - Améliorations perdues (Table des Épaves, résultat ARRACHEE)
      - Avantages perdus (Table des Épaves, résultat PIGNON_ENDOMMAGE)

## Notes

Bénéficie rétroactivement à tous les équipements perdus, y compris ceux créés
avant l'implémentation de Pignon endommagé. Le styling et la couleur du badge
"Perdu" doivent utiliser les design tokens CSS existants (`--clr-*`), jamais des
couleurs en dur (cf. CLAUDE.md — CSS design tokens).

## Vérification code (2026-07-29)

Les 4 critères sont confirmés dans `mounted-equipment.html`/`.ts` : filigrane
"Perdu" distinct de "Vendu" pour armes (l.32-37), améliorations (l.87-92) et
avantages (l.142-147) ; bouton "Retirer" masqué (`!weapon.sold && !weapon.lost`,
même motif pour les 2 autres types) ; compteur `hiddenSoldCount()`
(`mounted-equipment.ts:156`) agrégeant bien `.filter((w) => !!w.sold || !!w.lost)`
sur les 3 collections.

Réserve mineure (cosmétique, ne remet pas en cause le statut `done`) : le
libellé du bouton de bascule dit "Afficher les équipements **vendus**"
(`mounted-equipment.html:12`) et les messages d'état vide disent "ont été
vendues" (l.28, 83, 138) — sans mentionner "perdus", alors que le compteur
englobe bien les deux catégories. Wording à corriger dans un futur passage UI.