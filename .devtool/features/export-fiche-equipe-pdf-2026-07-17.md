---
id: "export-fiche-equipe-pdf-2026-07-17"
status: "backlog"
priority: "low"
assignee: null
dueDate: null
created: "2026-07-17T00:00:00.000Z"
modified: "2026-07-17T00:00:00.000Z"
completedAt: null
labels: ["frontend", "export"]
order: "aH"
---

# Export de fiche d'équipe (HTML/PDF)

En tant que joueur, je veux pouvoir exporter une fiche complète et imprimable de
mon équipe, afin d'avoir un support physique pendant une partie de Gaslands.

## Critères d'acceptation

- [ ] Étant donné une équipe, quand je clique « Exporter », alors un menu me propose
      « HTML » ou « PDF ».
- [ ] Étant donné le format HTML, quand j'exporte, alors un fichier `.html`
      téléchargeable contient :
  - En-tête : nom de l'équipe, sponsor, budget total
  - Pour chaque véhicule : nom, stats effectives (carrosserie, manoeuvrabilité,
    vitesse, équipage, emplacements), armes et améliorations montées (noms +
    prix), avantages, séquelles, total de coût
  - Mise en page propre et lisible, optimisée pour l'impression recto-verso
- [ ] Étant donné le format PDF, quand j'exporte, alors le fichier `.pdf` contient
      les mêmes informations que la version HTML (utiliser un service de conversion
      ou une librairie PDF backend, ex. `pdfkit`, `puppeteer`).
- [ ] Étant donné que l'équipe change après export, quand je rouvre le fichier
      physique en partie, alors je peux la synchroniser manuellement ou ré-exporter
      (pas de synchronisation en temps réel).

## Notes

Backlog déclaré dans `docs/spec/NAVIGATION.md` — utilitaire de jeu à faible
impact sur la mécanique du jeu, forte valeur pour l'expérience utilisateur en
partie physique. Priorité basse — reste très optionnel.
