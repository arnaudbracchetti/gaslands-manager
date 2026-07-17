---
id: "us-f1-contacter-la-resistance-2026-07-03"
status: "backlog"
priority: "low"
assignee: null
dueDate: null
created: "2026-07-03T19:28:55.333Z"
modified: "2026-07-17T00:00:00.000Z"
completedAt: null
labels: ["mode-campagne", "resistance"]
order: "aA"
---

# Contacter la Résistance

En tant que joueur n'ayant pas marqué de PC lors d'une partie, je veux contacter la
Résistance, afin de gagner 3 Points de Résistance secrets.

## Critères d'acceptation

- [ ] Étant donné une équipe n'ayant marqué aucun PC lors d'une partie, quand elle
      choisit de contacter la Résistance, alors elle gagne +3 Points de Résistance.
- [ ] Étant donné une équipe ayant marqué des PC, quand elle tente de contacter la
      Résistance, alors c'est refusé (p.167 : réservé aux équipes non classées).
- [x] Étant donné mes Points de Résistance, quand un autre joueur consulte la
      saison, alors ils ne lui sont pas visibles (mécanique secrète).
- [ ] Étant donné mes Points de Résistance, quand je les consulte moi-même, alors
      je peux les lire (ils valent 3 × nombre de contacts).

## Vérification code (2026-07-03)

Repassée de `done` à `backlog` — 1 critère sur 4 seulement tient pleinement.

- Le crédit de +3 PR fonctionne (`ResistanceContactedEvent`, `PR_BONUS = 3`), mais
  **la condition d'éligibilité (0 PC marqué) n'est jamais vérifiée** :
  `ContactResistanceUseCase.execute` ne fait que `assertOrganizer`, sans lire
  `participant.championshipPoints`. Un commentaire dans
  `escarmouche-game.ts:14` indique que cette règle était *prévue* côté use case
  (« règle write-time ») mais elle n'a jamais été implémentée, et aucun test
  (`contact-resistance.usecase.spec.ts` n'existe pas) ne l'aurait détecté. Un
  organisateur peut donc créditer la Résistance à une équipe ayant déjà marqué des
  points.
- Le secret vis-à-vis des autres joueurs est correctement respecté
  (`StandingsEntry` exclut délibérément `resistancePoints`, commentaire "D-S4").
- **Mais cette exclusion a été appliquée trop largement** : `GetWorkshopUseCase`
  (le read-model self-service) exclut lui aussi `resistancePoints`
  (commentaire "exclu (D-S4)" en ligne 14), alors qu'il s'agit de la vue du
  participant sur **sa propre** équipe. Résultat : aucun endpoint ne permet
  aujourd'hui à un joueur de lire ses propres Points de Résistance.

## Vérification code (2026-07-17)

Le mécanisme réellement livré diffère de la story d'origine — le crédit de +3 PR est désormais **automatique** (`Game.recordResult()`, tout participant hors du top `ceil(n/2)`, `docs/spec/CAMPAIGN.md#limitations-connues`), pas une action volontaire de "contacter la Résistance" gatée par "0 PC marqué". Les 2 premiers critères Gherkin décrivent donc une interaction qui ne correspond plus au code. Les critères ne sont pas cochés pour cette raison (ils visent un appel volontaire qui n'existe plus). Le 4ᵉ critère (lire ses propres PR) reste non satisfait et bien d'actualité : confirmé qu'aucun endpoint n'expose `resistancePoints`, même au propriétaire (`GetWorkshopUseCase` l'exclut aussi, pas seulement `StandingsEntry`). À reformuler dans une future passe pour aligner avec l'implémentation actuelle (crédit auto) et relever le manque de consultation des PR par le propriétaire.
