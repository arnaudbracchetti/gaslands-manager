---
id: "us-d5-afficher-les-vehicules-perdus-en-atelier-2026-07-17"
status: "backlog"
priority: "medium"
assignee: null
dueDate: null
created: "2026-07-17T00:00:00.000Z"
modified: "2026-07-17T00:00:00.000Z"
completedAt: null
labels: ["mode-campagne", "cagnotte-atelier"]
order: "aD"
---

# Afficher les véhicules perdus (épaves) dans l'Atelier

En tant que joueur, je veux voir mes véhicules devenus épaves/détruits dans
l'interface Atelier, afin de traiter les conséquences (séquelles) ou de les retirer
définitivement.

## Critères d'acceptation

- [ ] Étant donné un véhicule marqué `isLost` suite à un tirage de Table des
      Épaves, quand je consulte mon Atelier, alors il apparaît dans une section
      distincte « Véhicules perdus » ou similaire.
- [ ] Étant donné un véhicule perdu, quand je le sélectionne, alors je ne peux
      ajouter/retirer que des séquelles (pas d'équipement additionnel), conformément
      aux règles du jeu.
- [ ] Étant donné un véhicule perdu, quand je le vends, alors il disparaît
      entièrement (cf. spec CAMPAIGN.md — les véhicules vendus ne restent pas
      visibles barré, contrairement aux armes/améliorations/avantages).

## Notes

Limitation actuelle : `GetWorkshopUseCase` expose `isLost` sur les véhicules mais
ne les filtre pas de la liste (contrairement au filtrage des vendus). Reste à
implémenter : UI de distinction et regroupement.
