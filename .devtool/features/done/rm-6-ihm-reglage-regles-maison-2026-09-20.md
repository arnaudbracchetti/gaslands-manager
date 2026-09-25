---
id: "rm-6-ihm-reglage-regles-maison-2026-09-20"
status: "done"
priority: "medium"
assignee: null
dueDate: null
created: "2026-09-20T10:02:28.000Z"
modified: "2026-09-25T00:00:00.000Z"
completedAt: "2026-09-25T00:00:00.000Z"
labels: ["regles-maison", "mode-campagne", "frontend", "wayfinder:task"]
order: "ac"
---
# RM-6 — IHM : régler les règles maison d'une campagne

Carte parente : [Carte — Règles maison](../regles-maison-carte-2026-09-20.md)

## Question

Permettre à l'organisateur d'activer ou désactiver chaque règle maison, à la
création de la campagne et après coup.

## Critères d'acceptation

- [x] Un composant de liste alimenté par le catalogue : une case à cocher par
      règle, avec son nom.
- [x] Sous chaque case, **une seule ligne courte, qui change selon l'état de la
      case** — cochée : le comportement alternatif ; décochée : le rappel du
      comportement par défaut. Bascule immédiate au clic, de sorte que
      l'utilisateur découvre l'autre comportement en cochant/décochant.
- [x] Intégré au formulaire de création de campagne **et** à la modale d'édition.
      Attention : cette dernière est déjà une modale — tout reste en ligne, pas de
      modale imbriquée ni d'écran de détail.
- [x] Aucune règle codée en dur côté frontend : ajouter une entrée au catalogue
      suffit à la faire apparaître.
- [x] Mode zoneless : tout changement d'état passe par des Signals.
- [x] Tests unitaires du composant.

## Dépendances

Bloqué par [RM-2](./rm-2-catalogue-yaml-regles-maison-2026-09-20.md) — le
catalogue alimente la liste — et
[RM-3](./rm-3-persistance-houserules-campagne-2026-09-20.md) — le réglage doit
être persistable. **Les deux sont résolues — prenable.**

## Résolu (2026-09-25)

`HouseRulesSelector` (`apps/frontend/src/app/campaigns/house-rules-selector/`) —
composant dumb entièrement contrôlé par le parent (`definitions`/`enabledKeys`/
`toggled`, même pattern que `SponsorCarousel`), sans état local ni appel HTTP.
Porte l'input `locked` (pattern déjà en place dans le projet) pour une
réutilisation en lecture seule par RM-7, désormais débloquée, sans dupliquer le
rendu.

Deux points d'intégration, deux mécaniques de sauvegarde différentes :
- `CampaignForm` (création) — clés cochées accumulées dans un signal local,
  incluses dans le `CreateCampaignDto` émis à la soumission.
- `EditCampaignModal` (édition) — chaque bascule est auto-sauvegardée
  immédiatement (`PUT .../house-rules`, output dédié `houseRuleToggled` relayé
  par `CampaignDetail.onHouseRuleToggled`), sans passer par
  `UpdateCampaignDto`/le bouton "Enregistrer" (réservé à nom/budget) — cohérent
  avec la route backend séparée, conçue en RM-3 pour n'avoir aucune contrainte
  d'état.

**Décision prise pendant l'implémentation, validée avec l'utilisateur** : le
bouton "✏️ Modifier"/la modale d'édition, jusque-là réservés à `EN_CONSTRUCTION`
(`CampaignDetail.canEditCampaign()`), sont élargis pour rester accessibles à
l'organisateur dans tout état de la campagne — fidèle à la règle "sans
contrainte d'état" du cadrage jusqu'à l'IHM, pas seulement l'API. Seuls les
champs nom/budget, à l'intérieur de la modale, restent réservés à
`EN_CONSTRUCTION` (`EditCampaignModal.canEditNameBudget`, champs en lecture
seule + note explicative hors cet état) ; la section règles maison y reste
toujours active.

**Piège rencontré** : `[disabled]` (et `[attr.disabled]`) posé sur un champ lié
par `[ngModel]` est silencieusement écrasé par `FormsModule` — `NgModel` pilote
lui-même la propriété DOM `disabled` du contrôle sous-jacent (toujours
"enabled" ici, aucun formulaire réactif) et la réinitialise à chaque cycle de
détection de changements, quelle que soit la liaison posée séparément. Détecté
par un test unitaire qui asserte le DOM (`nameInput.disabled`), pas seulement
le computed source. Corrigé en utilisant `[readonly]` à la place (non géré par
`ControlValueAccessor`, jamais réécrit), stylé via une classe `.is-readonly`
plutôt que le pseudo-sélecteur `:disabled`.

**Bug attrapé en revue de code** (axe Spec) : `EditCampaignModal.onConfirm()`
ne vérifiait pas `canEditNameBudget()` avant d'émettre `confirmed` — hors
`EN_CONSTRUCTION`, le bouton "Enregistrer" restait actif et soumettait un
nom/budget inchangés, que le backend rejette de toute façon (400). Corrigé en
ajoutant `!canEditNameBudget()` au `[confirmDisabled]` du bouton (`ModalShell`),
avec deux tests de régression (bouton désactivé hors `EN_CONSTRUCTION`, actif
sinon).

Documentation mise à jour : [spec/CAMPAIGN.md — Règles
maison](../../../docs/spec/CAMPAIGN.md#règles-maison) (paragraphe IHM,
correction du bouton "✏️ Modifier"), [COMPONENTS.md](../../../docs/COMPONENTS.md)
(nouvelle entrée `HouseRulesSelector`, mise à jour `CampaignForm`/
`EditCampaignModal`/`CampaignDetail`, diagramme de dépendances). RM-7 débloquée.
