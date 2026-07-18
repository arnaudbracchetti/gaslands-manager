---
id: "export-fiche-equipe-pdf-2026-07-17"
status: "done"
priority: "low"
assignee: null
epic: null
dueDate: null
created: "2026-07-17T00:00:00.000Z"
modified: "2026-07-18T10:15:00.000Z"
completedAt: "2026-07-18T10:15:00.000Z"
labels: ["frontend", "export"]
order: "aA"
---
# Export de fiche d'équipe (HTML/PDF)

En tant que joueur, je veux pouvoir exporter une fiche complète et imprimable de
mon équipe, afin d'avoir un support physique pendant une partie de Gaslands.

## Critères d'acceptation

- [x] Étant donné une équipe, quand je clique « Exporter la fiche d'équipe »,
      alors un document HTML complet s'ouvre dans un nouvel onglet — **pas de
      menu de choix de format** (HTML/PDF) : un seul bouton, un seul document,
      le format PDF s'obtient ensuite via l'impression native du navigateur
      (cf. critère PDF ci-dessous). Deux points d'entrée : page Équipe
      (équipe non engagée) et page Campagne (équipe engagée, chocs/séquelles
      réels) — cf. `docs/spec/TEAMS.md`/`docs/spec/CAMPAIGN.md`.
- [x] Étant donné le format HTML, quand j'exporte, alors le document contient :
  - En-tête : nom de l'équipe, sponsor, coût total tous véhicules confondus
  - Pour chaque véhicule : nom, stats effectives (carrosserie, manoeuvrabilité,
    vitesse, équipage, emplacements), armes et améliorations montées (noms +
    prix via la colonne "Effet"), avantages, séquelles, coût total du véhicule
  - Mise en page compacte optimisée pour l'impression A4 (2 véhicules par
    ligne, cases à cocher pour la carrosserie/les munitions, carré à dé pour
    la vitesse courante, annexe de règles dédupliquée)
- [x] Étant donné le format PDF — **décision de conception** : pas de service de
      conversion ni de librairie PDF backend (`pdfkit`/`puppeteer` évoqués à la
      création de cette carte, écartés ensuite). Le backend ne génère QUE du
      HTML ; le CSS `@page`/A4 déjà présent produit un rendu imprimé propre via
      la fonction native "Imprimer → Enregistrer en PDF" du navigateur. Choix
      assumé pour éviter toute nouvelle dépendance lourde (Chromium headless en
      Docker) sur ce projet pédagogique — cf. `docs/ARCHITECTURE.md` §3.4.
- [x] Étant donné que l'équipe change après export, quand je rouvre le fichier
      physique en partie, alors je peux la synchroniser manuellement ou ré-exporter
      (pas de synchronisation en temps réel) — satisfait par construction : chaque
      export est un instantané HTML statique, ré-exporter re-génère depuis l'état
      courant.

## Notes

Backlog déclaré dans `docs/spec/NAVIGATION.md` — utilitaire de jeu à faible
impact sur la mécanique du jeu, forte valeur pour l'expérience utilisateur en
partie physique. Priorité basse — reste très optionnel.

Implémentation : `apps/backend/src/app/team/infrastructure/team-sheet.mapper.ts`
+ `team-sheet.renderer.ts` (fonctions pures, partagées entre les deux points
d'entrée), `GetTeamSheetUseCase`/`GetCampaignTeamSheetUseCase`, routes
`GET /api/teams/:id/sheet` / `GET /api/campaigns/:id/sheet`. Catalogue enrichi
de deux champs optionnels (`munitions` sur les armes, `effet_court` sur les 4
catalogues d'équipement) pour la colonne "Effet" de la fiche.
