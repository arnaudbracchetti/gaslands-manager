# Campagnes

> Sous-document de [SPECIFICATION.md](../SPECIFICATION.md) - **propriétaire** des règles
> du mode campagne (comportement observable). La conception (classes, Strategy,
> event-sourcing) est dans [DOMAIN_MODEL.md §4](../DOMAIN_MODEL.md#4-domaine-campagne-event-sourcing),
> les composants dans [COMPONENTS.md](../COMPONENTS.md).

---

## Vue d'ensemble

Une **Campagne** est une ligue : plusieurs équipes (une par utilisateur) jouent une suite
de parties. Le créateur en devient organisateur, invite par un code partageable et valide
les inscriptions.

**Cycle de vie** (`CampaignState`) : `EN_CONSTRUCTION` (initial) → `EN_COURS` → `TERMINEE`.
Les transitions sont **bidirectionnelles** (`Campaign.changeState()`) : l'organisateur peut
revenir en arrière (ex. rouvrir les inscriptions).

---

## Budget de campagne

L'organisateur fixe à la création un **budget en jerricans** (`Campaign.budget`, défaut 50)
qui remplace `Team.cans` pour tout calcul en contexte campagne (construction d'une équipe
engagée, atelier, cagnotte). Résolution par `Team.budget` : budget de la campagne engageante,
sinon `cans` (qui reste la valeur saisie, inerte tant que l'équipe est engagée).

**Éligibilité** : une équipe n'est engagée (demande d'inscription, changement d'équipe,
validation d'une demande) que si `Team.vehiclesCost ≤ budget`. Portée par
`Campaign.assertTeamFitsBudget(team, budget?)` ; la validation revérifie car l'équipe a pu
grossir entre-temps. Violation → HTTP 400.

**Modification nom/budget** (`PUT /api/campaigns/:id`, organisateur, `EN_CONSTRUCTION`
uniquement) : `changeBudget` revérifie **chaque** équipe engagée contre le nouveau budget et
refuse (400) **avant** toute mutation si une seule deviendrait illégale. Le budget n'est
jamais recopié : il est relu à chaque chargement via `Team.campaignBudget` (hydraté par
`TeamRepository`, même mécanisme que le verrouillage).

**Écran** : bouton « Modifier » (organisateur, **tout état**) ouvrant une modale nom + budget
+ règles maison. Nom/budget en lecture seule hors `EN_CONSTRUCTION` ; « Enregistrer » reste
actif (il soumet au moins les règles maison) ; « Annuler » ne persiste rien. En cas de refus
serveur, la modale reste ouverte avec l'erreur.

---

## Règles maison

Variante optionnelle du règlement, activable par l'organisateur. Catalogue en mémoire
(`database_init/data/regles-maison.yml`, `GET /api/catalog/regles-maison`, public).
`Campaign.houseRules` ne stocke que l'ensemble des clés (`nom_interne`) activées : une règle
absente = comportement par défaut, donc une règle ajoutée au catalogue est décochée partout
sans reprise de données.

- **Aucune contrainte d'état** : réglable à tout moment, d'où une route dédiée
  `PUT /api/campaigns/:id/house-rules` (distincte de nom/budget, réservés à `EN_CONSTRUCTION`).
  Aussi réglable à la création (`POST /api/campaigns`, `houseRules?`).
- **Validation stricte à l'écriture** (clé hors catalogue → 400), **tolérante à la lecture**
  (une clé retirée du catalogue reste en base, inerte, jusqu'au prochain réglage).
- **Exposition** : dans toutes les réponses de campagne et sur `GET .../by-code/:code` (affichées
  avant de rejoindre). Affichées en lecture seule sur `/campaigns/:id` à tout participant.
- **Effet** : une règle ne fait rien seule ; chaque point de calcul du domaine résout sa
  Strategy (défaut ou règle maison active, au plus une par point) - mécanisme :
  [DOMAIN_MODEL.md §4 - Règles maison](../DOMAIN_MODEL.md#règles-maison--strategy-par-point-de-calcul).
- **Gel** : le résultat d'une règle devient un fait journalisé au moment du calcul, jamais
  recalculé ; changer le réglage n'affecte que les parties suivantes.

| Règle | `nom_interne` | Effet si activée | Calculé quand |
|---|---|---|---|
| R1 | `distribution_points_resistance` | Les +3 Points de Résistance (Événement Télévisé) vont aux participants dont le total de PC de **cette** partie (classement + exploits + Favori du Public) vaut 0, au lieu de la seconde moitié du classement | entrée en Atelier (le total de PC n'est complet qu'après l'écran Résolution) |
| R2 | `cagnotte_collective_evenement_tele` | +5 jerricans (`CAGNOTTE_TELE`) à **tout** participant `VALIDATED`, présent ou non, à la fin d'un Événement Télévisé (par défaut : rien) | enregistrement du résultat (`POST .../results`) |
| R3 | `escarmouche_bonus_jerricans` | Supprime le revenu de base D6 d'une Escarmouche (le butin de scénario reste) | à chaque tirage de revenu |
| R4 | `plafond_jerricans_escarmouche` | Plafonne à 15 le total de jerricans « récompense » (revenu D6 + butin manuel) par participant sur une même Escarmouche ; l'excédent est réduit **silencieusement** (jusqu'à 0, auquel cas rien n'est journalisé) | à chaque gain, cumul recalculé depuis le journal de la partie |

R1 trace la règle appliquée (`ResistanceContactedEvent.strategyKey`, `"defaut"` pour la règle
par défaut, `null` pour un contact manuel) et la mentionne dans le journal, pour comparer deux
parties malgré un réglage modifiable en cours de campagne. Annuler le wizard (`DELETE .../results`)
supprime aussi les événements de R2.

---

## Inscription

`ParticipantStatus` : `PENDING` | `VALIDATED` | `REJECTED`.

- Avec le code d'invitation, tout utilisateur demande à rejoindre avec une de ses équipes → `PENDING`.
- L'organisateur valide (`→ VALIDATED`) ou refuse (`→ REJECTED`). Il peut aussi refuser un
  `VALIDATED` (réversible, `EN_CONSTRUCTION` uniquement) et revalider un `REJECTED` (sans
  contrainte d'état).
- **Retirer** (`DELETE`) : suppression définitive, organisateur, `EN_CONSTRUCTION` uniquement.
- **Jamais de campagne sans organisateur** : le dernier organisateur `VALIDATED` ne peut pas
  être refusé (`Campaign.assertNotLastOrganizer`). Même invariant appliqué à la suppression
  d'un compte ([AUTH.md](AUTH.md#suppression-dun-compte-engagé-comme-organisateur-de-campagne))
  et d'une équipe ([TEAMS.md](TEAMS.md#crud-équipes)).

**Changer l'équipe engagée** (`EN_CONSTRUCTION`, tout participant `VALIDATED`) : refusé (400)
dès que le participant a au moins un événement journalisé, même si la campagne est revenue en
`EN_CONSTRUCTION` - sinon le replay ne retrouverait plus les véhicules référencés par ses
événements dans la nouvelle équipe. Changer vers la même équipe reste un no-op autorisé.

---

## Écran `/campaigns/:id` - structure par visibilité

- En-tête : nom, état, badge budget, badge « Organisateur » et « Supprimer la campagne » (organisateurs).
- « Votre équipe » : modifiable en `EN_CONSTRUCTION`, lecture seule sinon.
- Liste des participants triée par PC décroissants, avec actions selon le rôle (cf. [COMPONENTS.md](../COMPONENTS.md#participantlist)).
- « En attente » et « Refusé » : **absentes du DOM** pour un non-organisateur.

Sécurité : seul un participant `VALIDATED` accède à une campagne (ou à ses infos minimales via
le code) ; sinon HTTP 404, sans fuite d'information.

---

## Programme Télé

Section affichée dans **tous les états** : l'organisateur planifie des parties (`Game`), chacune
liée à un scénario du catalogue (`database_init/data/scenarios.yml`, `GET /api/catalog/scenarios`,
type `EVENEMENT_TELE` ou `ESCARMOUCHE`).

- Gestion (ajout, édition, suppression, réordonnancement) : organisateur, `EN_CONSTRUCTION`/`EN_COURS` ;
  lecture seule en `TERMINEE` (400 sur toute écriture). Consultation : tout participant `VALIDATED`.
- Ajout : partie `PLANIFIE`, en fin de programme, type repris du scénario.
- Une partie `ATELIER`/`JOUE` ne peut être ni modifiée ni supprimée (400).
- **Réordonnancement** (`PUT .../games/reorder`, `{ gameIds }`) : porte uniquement sur les parties
  `PLANIFIE` ; le corps doit contenir exactement toutes les parties `PLANIFIE` (sinon 400). Les
  parties `PLANIFIE` se répartissent les valeurs d'`order` qu'elles occupaient déjà ; une partie
  `ATELIER`/`JOUE` ne bouge jamais. Chaque déplacement est persisté immédiatement.

Autorisation : `assertOrganizer`/`assertParticipant` dans les use cases (sur l'état rejoué),
`assertVisibleParticipant` côté lecture ; refus → 404.

---

## Exploits de partie

Saisis dans la même soumission que le classement (`POST .../results`) :

- **Portes franchies** : +1 PC par porte.
- **Véhicules ennemis détruits** : l'organisateur sélectionne le véhicule détruit (roster actuel
  des **autres** participants présents) ; le client n'envoie que `vehicleId`, le poids
  (`LEGER`/`MOYEN`/`LOURD`/`FORTERESSE`) est **redérivé côté serveur** et rapporte +1/+2/+3/+5 PC
  au destructeur - jamais accepté de l'appelant, pour empêcher des PC indus. `FORTERESSE` n'a
  encore aucun véhicule au catalogue.
- La sélection ne marque **jamais** le véhicule perdu : la perte relève de la Table des Épaves.
- Les PC sont toujours dérivés du journal (`GatesCrossedEvent`, `VehicleDestroyedEvent`, PC figés
  à l'écriture) ; `Campaign.standings()` les additionne.

---

## Wizard de fin de partie

Enregistrement du résultat d'une partie (campagne `EN_COURS`) en étapes variables selon le type
de partie et le scénario (`franchissement_portes`, `gain_jerricans`). Conception :
[`docs/plans/2026-07-17-wizard-fin-partie-e-et-design.md`](../plans/2026-07-17-wizard-fin-partie-e-et-design.md),
[`docs/plans/2026-07-26-sabotage-points-wizard-design.md`](../plans/2026-07-26-sabotage-points-wizard-design.md).

| # | Écran | Visible si | Contenu |
|---|---|---|---|
| 1 | Présence | toujours | participants présents, **au moins 2** |
| 2 | Sabotage | toujours | points de sabotage dépensés par équipe (0 par défaut, cf. [§Points de sabotage](#points-de-sabotage)) |
| 3 | Classement | Événement Télévisé | ordre des présents (une Escarmouche n'attribue jamais de PC de classement) |
| 4 | Portes franchies | Événement Télévisé **et** `franchissement_portes` | portes par équipe |
| 5 | Jerricans | `gain_jerricans` | butin manuel de scénario, cumulé avec le revenu D6 |
| 6 | Désignation des épaves | toujours | par véhicule : intact / mis en épave par X / seul ; case Favori du Public si éligible (cf. [§Faveur du Public](#faveur-du-public)) |
| 7 | Résolution | toujours | synthèse automatique : revenu de base D6 (Escarmouche, par présent) puis Table des Épaves (par véhicule désigné) |

**Persistance différée** : les écrans 1 à 6 sont purement client (« Précédent »/« Annuler »
libres). Le lot est envoyé (`POST .../results`) au passage 6 → 7 ; la partie reste `PLANIFIE`.
À l'écran 7, les tirages serveur sont déclenchés automatiquement un par un ; « Terminer » appelle
`POST .../enter-atelier` - **seul moment** où la partie passe `PLANIFIE → ATELIER` (avant, plus
aucun événement de résultat ne serait accepté). « Annuler » à l'écran 7 déclenche un reset serveur
(`DELETE .../results`, supprime tous les événements de la partie en une opération) ; « Précédent »
n'y est plus disponible.

Chaque événement a une description textuelle (`GameEvent.describe()`), renvoyée par
`.../events/wreck` et `.../events/income` et affichée sous chaque résultat.

**Limitation connue** : quitter le wizard entre l'envoi du lot et « Terminer » laisse la partie
`PLANIFIE` ; la ré-ouvrir et resoumettre sans « Annuler » crée des doublons (pas d'idempotence).

---

## Journal d'une partie

Pour une partie `ATELIER` ou `JOUE`, le bouton « Journal » liste **tous** ses événements
(classement, exploits, épaves, atelier, renommages, contact Résistance) en texte lisible.
Accessible à tout participant `VALIDATED`, même absent de la partie. Groupé par participant
(ordre de première apparition), chronologique dans chaque groupe. Le contact Résistance y figure :
seul le **total** de Points de Résistance est secret.

Construction : `Game.journal()` traduit les événements ; `CampaignQueryService.getJournal` ajoute
`userName`/`teamName`/`createdAt`.

---

## Historique complet d'un participant

Historique d'**un** participant sur **toutes** les parties, groupé par partie (ordre du Programme,
parties sans événement omises). Consultable par tout participant `VALIDATED` pour n'importe quel
participant (sa propre ligne ou menu ⋯ d'un autre). Pure lecture : `CampaignQueryService.getParticipantJournal`
réutilise `Game.journal()` filtré sur le participant.

---

## Consultation en lecture seule de l'atelier d'un participant

Tout participant `VALIDATED` peut consulter l'équipe d'un autre (véhicules, équipement, séquelles,
chocs, cagnotte), **sans aucune action**, dès que la campagne n'est plus `EN_CONSTRUCTION` - qu'un
atelier soit ouvert ou non. Écran maître-détail `/campaigns/:id/participants/:pid/atelier`
(`GET .../participants/:pid/workshop`). Aucun endpoint mutant n'existe pour un tiers. Les points de
sabotage n'y sont jamais exposés.

---

## Cycle de vie d'une partie et phase Atelier

`Game` : `PLANIFIE → ATELIER → JOUE`. La phase garage post-partie (achats/reventes, séquelles,
renommages) est un **statut** de la partie qui vient d'être jouée, pas une entité séparée.

- **`PLANIFIE → ATELIER`** (`POST .../enter-atelier`, organisateur) : fin du wizard (écran 7,
  « Terminer »). Distribue aussi les Points de Résistance automatiques.
- **Un seul atelier à la fois** : entrer en atelier clôture automatiquement l'autre partie encore
  en `ATELIER` (`→ JOUE`) ; la réponse renvoie `autoClosedGameId` pour avertir l'organisateur.
- **`ATELIER → JOUE`** (`POST .../close-atelier`) : clôture manuelle ; aussi automatique au passage
  de la campagne en `TERMINEE`.
- Une partie `JOUE` refuse tout événement.
- Les événements d'atelier portent le `gameId` de la partie jouée : le replay (tri par `order`
  puis `eventOrder`) les remet dans l'ordre sans mécanisme supplémentaire.
- Seule exception hors `ATELIER` : une séquelle `TABLE_EPAVES` imposée par la Table des Épaves
  est journalisée en `PLANIFIE` (pendant le wizard).
- `POST .../events/equipment` et `.../events/vehicle-rename` n'ont pas de `:gameId` : le use case
  trouve l'unique partie en `ATELIER` (400 « Aucun atelier ouvert » sinon).

**Écrans** : `/campaigns/:id/atelier` liste les véhicules de l'équipe engagée (achat d'un véhicule
via la cagnotte, vente/annulation) ; `/campaigns/:id/atelier/vehicles/:vehicleId` réutilise le
configurateur d'équipement de la construction d'équipe, payé par la cagnotte. Acheter un véhicule
en atelier applique aussi son équipement intégré (Arceaux du Buggy, Canon du Char d'assaut), comme
en construction.

---

## Renommage d'un véhicule en atelier

Le nom d'un véhicule ([VEHICLES.md](VEHICLES.md#construction-dun-véhicule)) se change par deux
voies : en construction d'équipe `PATCH /api/vehicles/:id/name` (refusé si l'équipe est
verrouillée) ; en atelier `POST /api/campaigns/:id/events/vehicle-rename` (`{ vehicleId, nom }`,
participant sur sa propre équipe), journalisé par `VehicleRenamedEvent`, accepté **uniquement**
en `ATELIER`.

Pourquoi un événement même pour un véhicule existant en base : le module campagne n'écrit
**jamais** directement les équipes, tout passe par le journal - sinon le renommage n'apparaîtrait
pas au journal et ne serait pas défait par une annulation. Fonctionne pareil pour un véhicule
acheté dans la session (id négatif). Annuler l'achat d'un véhicule annule aussi ses renommages de
la session (`targetsVehicle`).

---

## Annulation d'achat vs revente

Retirer un élément en atelier (`POST .../events/equipment`, même endpoint dans les deux cas,
décision côté serveur par `Game.wasPurchasedThisSession`) :

- **Acheté dans la session d'atelier en cours** → **annulation** : l'événement d'achat est
  supprimé du journal, remboursement intégral, invisible au journal.
- **Pré-existant** (construction ou atelier antérieur) → **revente** :
  - arme/amélioration : remboursement de la moitié du prix arrondie à l'inférieur (p.170) ; elle
    reste visible (barrée, « Vendue »), son coût devient le résiduel `ceil(prix/2)` et son
    emplacement est libéré ;
  - avantage : **perte totale**, aucun remboursement ; reste visible « Vendu » (son prix ne varie
    jamais, ce qui suffit à porter la règle).

**Véhicules entiers** :
- acheté dans la session → annulation **en cascade** : l'achat et tous les événements de la session
  qui le ciblent (équipement, séquelles, renommages) sont supprimés atomiquement - sinon ils
  deviendraient orphelins et casseraient le prochain replay ;
- pré-existant → revente **par élément** : châssis et chaque arme/amélioration encore active à
  moitié prix, avantages à 0 ; les éléments déjà revendus ne sont pas recomptés. Tout l'équipement
  du véhicule est marqué vendu avec lui.
- Un véhicule vendu ou **détruit** (Table des Épaves) reste listé en fin de liste, badge
  « Vendu »/« Perdu », carte inactive ; remboursement exposé à 0.
- **Vendre ou annuler un véhicule détruit est interdit** (400), vérifié avant tout calcul de
  remboursement.

Les DTO d'atelier exposent `isSold` et `purchasedThisSession` - ce dernier sert seulement au texte
de confirmation (« Annuler l'achat » / « Revendre pour N » / « perte totale »), jamais à décider.

**Cagnotte dérivée** : `CampaignParticipant.wallet` = budget non dépensé de l'équipe + récompenses
cumulées (`WalletMovementEvent`). Achat et revente ne touchent jamais la cagnotte directement :
créer l'entité ou la marquer vendue suffit à faire varier le budget dérivé.

---

## Points de sabotage

Compteur affiché dans l'atelier sous la cagnotte : `CampaignParticipant.sabotagePoints` =
`floor(resistancePoints / 3)`. Le total brut de Points de Résistance reste **caché**, y compris au
propriétaire ; le compteur dérivé n'est exposé qu'au propriétaire dans son propre atelier (`null`
sur l'atelier d'un tiers) - exception : la fiche d'équipe exportée par l'organisateur.

**Points de Résistance** : +3 automatiques à l'entrée en Atelier (Événement Télévisé) pour chaque
participant hors du top `ceil(n/2)` du classement (critère remplaçable par R1). Contact manuel
possible par l'organisateur (`POST .../events/resistance`).

**Dépense - déclaration rétroactive** : l'usage en partie physique reste une règle de table non
suivie (comme les Votes du Public). À l'écran Sabotage du wizard, l'organisateur saisit les points
dépensés par équipe ; chaque point **débite** 3 PR (`SabotagePointsSpentEvent`). Aucune validation
client (solde secret, même pour l'organisateur) : le serveur **clampe silencieusement** au solde
disponible, ce qui garantit que les PR ne passent jamais sous 0. Le journal affiche le montant
réellement appliqué.

---

## Séquelles

Inconvénient permanent (Gaslands p.170), 12 au catalogue (`database_init/data/sequelle.yml`),
chacune avec `description` (carte) et `regles` (modale de détail). Champ `origine` :

- **`TABLE_EPAVES`** (`siege_irrecuperable`, `chassis_fragilise`) : imposée par un tirage de la
  Table des Épaves, coût 0, jamais achetable. **Jamais retirable**, ni revente ni annulation
  même-session (garde `Vehicle.isSequellaRemovable()`, vérifiée avant le court-circuit
  d'annulation). Seule `siege_irrecuperable` a un effet chiffré (Équipage).
- **`ATELIER`** (10 : Suicidaire, Impopulaire, Dingue, Lâche, Vieille Blessure de Guerre,
  Vibrations, Convulsions, Maintenu par la Rouille, Dur à Cuire, Légende Vivante) : achat en
  atelier contre des **Chocs du véhicule** (pas la cagnotte), via `EquipmentChangedEvent`
  (`entityType: SEQUELLE`). Gardes : origine, unicité, Chocs suffisants (`Vehicle.canAddSequella`).

**Revente d'une séquelle `ATELIER`** : fermée par défaut ; ouverte (perte totale de Chocs) si le
véhicule porte une `legende_vivante` active. L'annulation même-session reste toujours possible.

**Dur à Cuire** : un seul événement crée la séquelle **et** l'avantage gratuit choisi
(`freeAdvantageNomInterne`, tagué `grantedBySequellaNomInterne`) ; annuler défait les deux, revendre
marque aussi l'avantage vendu. L'interface limite le choix aux 6 avantages « Dur à Cuire » (tous
sponsors, conforme au livre) ; le backend ne filtre pas la catégorie.

**Effets permanents sur la Table des Épaves** :
- **Légende Vivante** : le D6 vaut 1 à chaque tirage ;
- **Maintenu par la Rouille** : second tirage après le premier (Chocs mis à jour), sauf si le
  premier a détruit le véhicule.
Les deux se cumulent (deux résultats « 1 »).

---

## Table des Épaves

Tirage D6 serveur (+ Chocs) à l'écran Résolution, 9 résultats (`WreckResult`) : `DEBOSSELE`,
`INDEMNE`, `ROUE_CABOSSEE`, `ARRACHEE`, `PIGNON_ENDOMMAGE`, `SIEGE_IRRECUPERABLE`,
`CHASSIS_FRAGILISE`, `FAVORI_DU_PUBLIC`, `VEHICULE_DETRUIT`.

- `ARRACHEE` : perte tirée au hasard parmi armes + améliorations montées.
- `PIGNON_ENDOMMAGE` : perte tirée au hasard parmi les avantages (un avantage perdu redevient
  achetable).
- `SIEGE_IRRECUPERABLE` / `CHASSIS_FRAGILISE` : séquelle `TABLE_EPAVES` imposée.
- Jamais un choix de l'organisateur.

---

## Faveur du Public

Le résultat `FAVORI_DU_PUBLIC` donne au véhicule un statut suivi par l'application
(`Vehicle.hasFavoriDuPublic`, reconstruit au replay), conservé de partie en partie tant qu'il n'est
pas dépensé.

- **Déclenchement** (Événement Télévisé uniquement) : à l'écran Désignation d'une partie suivante,
  une case « Favori du public » apparaît seulement pour un véhicule mis en épave (pas intact) **et**
  portant ce statut. La cocher = le joueur dépense 3 Votes du Public (non suivis, déclaration sur
  l'honneur).
- **Résolution** : +5 PC au propriétaire (`FavoriDuPublicBonusEvent`) et statut consommé, **quel que
  soit** le résultat du tirage de cette partie. Case non cochée → statut conservé.
- Le serveur revérifie le statut réel avant de créditer (jamais la seule parole du client) ; le
  solde de votes, lui, n'est pas contrôlé.

---

## Fiche d'équipe exportable (mode campagne)

Même document HTML imprimable que la fiche d'équipe ([TEAMS.md](TEAMS.md#fiche-déquipe-exportable)),
mais construit à partir de l'état **après replay** (seul à refléter chocs et séquelles réels) avec le
même mapper.

- Sa propre fiche : `GET /api/campaigns/:id/sheet`, dès qu'une équipe est engagée, quel que soit
  l'état. Nom du joueur = `req.user.callName`.
- Fiche d'un tiers : `GET /api/campaigns/:id/participants/:pid/sheet`, **organisateur uniquement**
  (404 sinon, vérifié avant tout rendu). Nom = `callName` de la cible.
- **Points de sabotage** : une case à cocher par point disponible, y compris sur la fiche d'un tiers
  (déjà réservée à l'organisateur).
- **Votes du Public à la place du coût total** : dérivés de l'écart de PC avec le 1er du classement
  courant (`CampaignParticipant.votesPublicFor`, barème : 0-10 PC d'écart → 0, 11-15 → 1, 16-20 → 2,
  21-25 → 3, 26-30 → 4, 31+ → 5). Valeur affichée seulement, aucun solde suivi ; jamais secrète.

---

## Limitations connues

- **Atelier - règles de pose non revérifiées à l'écriture** : un achat n'est gardé que par la
  cagnotte (ou les Chocs). Emplacements, orientation, autorisation sponsor (y compris pour un
  véhicule), Cascadeur/Sur Deux Roues ne sont vérifiés qu'au listing des disponibilités. Pas de
  limite de 8 véhicules.
- **Revente d'un véhicule pré-existant portant un équipement acheté dans la session** : cet
  équipement est remboursé à moitié au lieu d'être annulé à 100 %. Contournement : le retirer
  d'abord individuellement.
- **Annulation non rejouée contre la suite de la session** : annuler un achat (ex. Remorque Moyenne,
  +1 emplacement) ne vérifie pas que les achats suivants (une arme qui utilise cet emplacement)
  restent légaux. Correctif envisagé : rejouer la suite de la session et refuser l'annulation si un
  événement devient illégal.
- **Wizard non idempotent** (cf. [§Wizard](#wizard-de-fin-de-partie)).
- **Lancement de partie - non implémenté** : il manque une action « Lancer la partie » qui
  afficherait les Votes du Public de chaque présent et **fermerait l'atelier ouvert**
  (aujourd'hui fermé seulement quand la partie suivante entre elle-même en atelier).
- **Hors scope** : visibilité partielle pour un `PENDING`, quitter une campagne, rotation du code
  d'invitation. `CampaignParticipant.isLocked` est une colonne inutilisée (le verrouillage réel est
  calculé, cf. [TEAMS.md](TEAMS.md#crud-équipes)).

---

## Modèles de données

### `Campaign`

| Champ | Type | Contraintes |
|---|---|---|
| `id` | number | PK |
| `name` | string(100) | obligatoire |
| `state` | `EN_CONSTRUCTION \| EN_COURS \| TERMINEE` | défaut `EN_CONSTRUCTION` |
| `inviteCode` | string | unique, indexé, généré à la création |
| `budget` | number | défaut 50 ; modifiable en `EN_CONSTRUCTION` (`PUT /api/campaigns/:id`) |
| `houseRules` | json (string[]) | clés activées, défaut `[]` |
| `createdAt` / `updatedAt` | Date | auto |

Calculés dans la réponse : `participantCount` (participants `VALIDATED`), `myRole` (`organizer` | `participant`).

### `CampaignParticipant`

Une ligne par utilisateur inscrit ; unique `(campaignId, userId)`.

| Champ | Type | Contraintes |
|---|---|---|
| `id` | number | PK |
| `campaignId` / `userId` | number | FK `CASCADE` |
| `teamId` | number \| null | FK `CASCADE` ; null possible pour un organisateur sans équipe |
| `status` | `PENDING \| VALIDATED \| REJECTED` | défaut `PENDING` |
| `isOrganizer` | boolean | défaut `false` |
| `isLocked` | boolean | inutilisé |
| `createdAt` / `updatedAt` | Date | auto |

Calculés : `userName` (`callName`, cf. [AUTH.md](AUTH.md#nom-daffichage-callname)), `teamName`.

### `Game`

| Champ | Type | Contraintes |
|---|---|---|
| `id` | number | PK |
| `campaignId` | number | FK `CASCADE` |
| `scenarioId` | string \| null | `Scenario.nom_interne` |
| `type` | `EVENEMENT_TELE \| ESCARMOUCHE` | |
| `status` | `PLANIFIE \| ATELIER \| JOUE` | |
| `order` | double precision | colonne SQL `displayOrder` ; ajout en MAX+1 |
| `playedAt` | Date \| null | horodatage du passage en `ATELIER` |
| `createdAt` / `updatedAt` | Date | auto |

Calculés : `scenarioName`, `franchissementPortes`, `gainJerricans` (repris du scénario, pilotent les écrans du wizard).

### `Scenario` (catalogue en mémoire)

`nom`, `nom_interne`, `type`, `description` (Markdown → HTML), `franchissement_portes`, `gain_jerricans`.

---

## API Endpoints

Toutes les routes : JWT. Écriture : `assertOrganizer`/`assertParticipant` dans le use case ;
lecture : `assertVisibleParticipant` ; refus → 404. Domaine refusé → 400. Les routes littérales
(`participants/me`, `games/reorder`) sont déclarées avant leurs homologues paramétrées.

### Campagnes et participants

| Méthode | Route | Qui | Description |
|---|---|---|---|
| GET | `/api/catalog/regles-maison` | public | catalogue des règles maison |
| GET | `/api/campaigns` | | mes campagnes (`VALIDATED`) |
| POST | `/api/campaigns` | | créer (`name`, `teamId`, `budget?`, `houseRules?`) ; créateur organisateur ; 400 si équipe hors budget ou clé inconnue |
| GET | `/api/campaigns/pending` | | mes demandes en attente |
| GET | `/api/campaigns/organizing/pending-requests` | | demandes en attente dans mes campagnes |
| GET | `/api/campaigns/by-code/:code` | | infos minimales (dont `budget`, `houseRules`) |
| GET | `/api/campaigns/:id` | participant | détail |
| PUT | `/api/campaigns/:id` | organisateur | nom/budget (`EN_CONSTRUCTION`) |
| PUT | `/api/campaigns/:id/house-rules` | organisateur | règles maison (tout état) |
| PUT | `/api/campaigns/:id/state` | organisateur | transition d'état |
| DELETE | `/api/campaigns/:id` | organisateur | supprimer (cascade) |
| GET | `/api/campaigns/:id/participants` | participant | liste |
| POST | `/api/campaigns/:id/participants` | | demande d'inscription (`{ teamId }`) |
| PUT | `/api/campaigns/:id/participants/me` | participant | changer d'équipe (`EN_CONSTRUCTION`) |
| PUT | `/api/campaigns/:id/participants/:pid/validate` | organisateur | `{ accept }` |
| PUT | `/api/campaigns/:id/participants/:pid/promote` | organisateur | promouvoir co-organisateur |
| DELETE | `/api/campaigns/:id/participants/:pid` | organisateur | retirer (`EN_CONSTRUCTION`) |
| GET | `/api/campaigns/:id/participants/:pid/journal` | participant | historique d'un participant |
| GET | `/api/campaigns/:id/standings` | participant | classement (alimente la liste des participants) |

### Programme et wizard

| Méthode | Route | Qui | Description |
|---|---|---|---|
| GET | `/api/catalog/scenarios` | public | scénarios |
| GET | `/api/campaigns/:id/games` | participant | programme trié |
| POST | `/api/campaigns/:id/games` | organisateur | ajouter (`{ scenarioId, type? }`) |
| PUT | `/api/campaigns/:id/games/reorder` | organisateur | réordonner les `PLANIFIE` (`{ gameIds }`) - 204 |
| PUT / DELETE | `/api/campaigns/:id/games/:gameId` | organisateur | éditer / supprimer une partie `PLANIFIE` |
| POST | `/api/campaigns/:id/games/:gameId/results` | organisateur | lot du wizard : `results` (classement + exploits, Événement Télévisé uniquement), `jerricanGains` et `destroyedVehicles` à plat (Escarmouche, destructions à 0 PC), dépenses de sabotage ; la partie reste `PLANIFIE` |
| DELETE | `/api/campaigns/:id/games/:gameId/results` | organisateur | reset du wizard (partie `PLANIFIE`) - 204 |
| GET | `/api/campaigns/:id/games/:gameId/results` | participant | résultats triés, dérivés du journal |
| GET | `/api/campaigns/:id/games/:gameId/participant-vehicles` | organisateur | véhicules courants (hors perdus et vendus) des `?participantIds=` |
| POST | `/api/campaigns/:id/games/:gameId/events/income` | organisateur | revenu de base D6 (`{ participantId }`) → `{ amount, descriptions }` |
| POST | `/api/campaigns/:id/games/:gameId/events/wreck` | organisateur | Table des Épaves (`{ participantId, vehicleId, pendingFavoriDuPublic? }`) → `{ outcome, descriptions }` |
| POST | `/api/campaigns/:id/games/:gameId/enter-atelier` | organisateur | `PLANIFIE → ATELIER` → `{ autoClosedGameId }` |
| POST | `/api/campaigns/:id/games/:gameId/close-atelier` | organisateur | `ATELIER → JOUE` - 204 |
| GET | `/api/campaigns/:id/games/:gameId/journal` | participant | journal de la partie |

### Atelier

| Méthode | Route | Qui | Description |
|---|---|---|---|
| GET | `/api/campaigns/:id/workshop` | participant | mon atelier (véhicules, équipement, chocs, séquelles, cagnotte, sabotage) |
| GET | `/api/campaigns/:id/participants/:pid/workshop` | participant | atelier d'un tiers, lecture seule (`sabotagePoints: null`) |
| GET | `/api/campaigns/:id/sheet` | participant | ma fiche d'équipe (HTML) |
| GET | `/api/campaigns/:id/participants/:pid/sheet` | organisateur | fiche d'un tiers (HTML) |
| GET | `/api/campaigns/:id/workshop/vehicles/:vehicleId/available-{weapons,improvements,advantages,sequelles}` | participant | disponibilités avec verdict (budget = cagnotte ; Chocs pour les séquelles) |
| POST | `/api/campaigns/:id/events/equipment` | participant | achat/revente `{ operation, entityType (VEHICLE/WEAPON/IMPROVEMENT/ADVANTAGE/SEQUELLE), nomInterne, …, orientation?, freeAdvantageNomInterne? }` - 204 |
| POST | `/api/campaigns/:id/events/vehicle-rename` | participant | `{ vehicleId, nom }` - 204 |

### Event-sourcing brut (non utilisés par le frontend)

| Méthode | Route | Description |
|---|---|---|
| POST | `/api/campaigns/:id/games/:gameId/events/wallet` | mouvement de cagnotte `{ participantId, amount, reason }` |
| POST | `/api/campaigns/:id/games/:gameId/events/vehicle-lost` | perte d'un véhicule `{ participantId, vehicleId, weaponIds? }` |
| POST | `/api/campaigns/:id/games/:gameId/events/resistance` | contact Résistance `{ participantId }` (+3 PR) |

Il n'existe volontairement pas de route d'enregistrement de classement avec PC fournis par
l'appelant : seul `POST .../results` (barème 10/5/2/1 calculé serveur) enregistre un classement.
