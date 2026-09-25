---
id: "rm-7-ihm-affichage-lecture-seule-2026-09-20"
status: "done"
priority: "medium"
assignee: null
dueDate: null
created: "2026-09-20T10:02:28.000Z"
modified: "2026-09-25T00:00:00.000Z"
completedAt: "2026-09-25T00:00:00.000Z"
labels: ["regles-maison", "mode-campagne", "frontend", "wayfinder:task"]
order: "ad"
---
# RM-7 — IHM : afficher les règles maison actives en lecture seule

Carte parente : [Carte — Règles maison](../regles-maison-carte-2026-09-20.md)

## Question

Un joueur doit savoir sous quelles règles il joue, sans pouvoir les modifier.

## Critères d'acceptation

- [x] Sur la page de détail d'une campagne : les règles maison actives, visibles
      par **tout participant validé**, avec la ligne explicative correspondant à
      leur état effectif.
- [x] Sur l'écran d'inscription par code d'invitation : la même information, avant
      même de rejoindre la campagne — comme le budget aujourd'hui.
- [x] Le rendu construit en RM-6 est réutilisé en mode non modifiable, pas
      dupliqué.
- [x] Tests unitaires.

## Dépendances

Bloqué par [RM-6](./rm-6-ihm-reglage-regles-maison-2026-09-20.md) — le rendu
partagé y est construit (**résolue**) — et
[RM-3](./rm-3-persistance-houserules-campagne-2026-09-20.md) — la route de
consultation par code doit exposer le réglage (**résolue**). **Les deux sont
résolues — prenable.**

## Résolution (2026-09-25)

Tâche purement frontend : le backend exposait déjà `houseRules: string[]` sur
`GET /api/campaigns/:id` (`CampaignResponseDto`) et `GET
/api/campaigns/by-code/:code` (`CampaignSummaryDto`) depuis RM-3, et
`HouseRulesSelector` (RM-6) portait déjà l'input `locked` anticipant cet usage
— aucune modification du composant n'a été nécessaire.

- `CampaignDetail` : nouvelle section dans le rail (`aside.campaign-detail-rail`,
  sous "Participants"), `<app-house-rules-selector [locked]="true"
  [definitions]="houseRuleCatalog()" [enabledKeys]="campaign()!.houseRules" />`.
  Le catalogue était déjà chargé pour `EditCampaignModal` — réutilisé tel quel.
  Aucun gate `isOrganizer()`/`canEditCampaign()` : visible par tout participant
  validé, contrairement au bouton "✏️ Modifier".
- `CampaignJoin` : ce composant ne chargeait pas encore le catalogue des règles
  maison — ajouté (`houseRuleCatalog` signal, appel `getHouseRules()` dans
  `ngOnInit()`, non bloquant, même pattern que `CampaignDetail`). Sélecteur
  inséré juste après la ligne budget, avant le bloc d'erreur de soumission.
- Tests unitaires étendus dans `campaign-detail.spec.ts` et
  `campaign-join.spec.ts` (rendu verrouillé, cases cochées/décochées selon
  `houseRules`, visibilité pour un non-organisateur) — `house-rules-selector.spec.ts`
  couvrait déjà le cas `locked` depuis RM-6, inchangé.
- Documentation (`docs/COMPONENTS.md`) mise à jour : nouveaux consommateurs de
  `HouseRulesSelector`, nouvelle section décrite sur `CampaignDetail`/
  `CampaignJoin`.

RM-8 (Documentation utilisateur) débloquée.
