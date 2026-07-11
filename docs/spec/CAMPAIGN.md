# Campagnes

> Sous-document de [SPECIFICATION.md](../SPECIFICATION.md).
> Mettre à jour après tout changement du module Campaign.
> Document de conception détaillé : [`docs/plans/2026-06-14-saisons-design.md`](../plans/2026-06-14-saisons-design.md) (conception initiale, terminologie "saison" — renommée `Campaign` depuis, cf. commit `727d6e3`).

---

## Vue d'ensemble

Une **Campagne** est une "ligue" regroupant plusieurs équipes (chacune appartenant à un
utilisateur différent) qui jouent ensemble plusieurs parties au fil du temps. Un
utilisateur crée la campagne (devenant automatiquement son organisateur), peut y inviter
d'autres joueurs via un code partageable, et valide leurs demandes d'inscription.

**Cycle de vie** (`CampaignState`) : `EN_CONSTRUCTION` (état initial — gestion libre des
inscriptions) → `EN_COURS` → `TERMINEE` (séquentiel, pas de retour en arrière).

---

## Inscription

`ParticipantStatus` : `PENDING` | `VALIDATED` | `REJECTED`

- Toute personne disposant du code d'invitation peut soumettre une demande
  d'inscription (choix d'une de ses équipes) → crée un `CampaignParticipant` `PENDING`.
- Un organisateur valide (`PENDING → VALIDATED`) ou refuse (`PENDING → REJECTED`) chaque
  demande.
- **"Refuser" un participant validé** (`VALIDATED → REJECTED`) : action réversible,
  distincte du retrait définitif (`DELETE`). Réservée aux organisateurs,
  `EN_CONSTRUCTION` uniquement. Un organisateur ne peut pas se refuser lui-même s'il est
  le dernier organisateur `VALIDATED` de la campagne (pas de campagne "orpheline").
- **"Valider" un participant refusé** (`REJECTED → VALIDATED`) : revalidation, sans
  contrainte d'état supplémentaire.
- **Retirer un participant** (`DELETE`) : suppression définitive de la ligne
  `CampaignParticipant`, réservée aux organisateurs, `EN_CONSTRUCTION` uniquement.

**Changer l'équipe engagée** : tant que la campagne est `EN_CONSTRUCTION`, chaque
participant `VALIDATED` (organisateur ou non) peut changer l'équipe qu'il engage parmi
ses propres équipes, via le sélecteur "Votre équipe" de l'écran `/campaigns/:id`.

---

## Écran `/campaigns/:id` — structure par visibilité

- En-tête : nom, état, badge "🏆 Organisateur" et bouton "🗑 Supprimer la campagne"
  (organisateurs uniquement).
- "Votre équipe" : sélecteur modifiable (`EN_CONSTRUCTION`) ou affichage en lecture
  seule sinon.
- "Les autres équipes" : participants `VALIDATED` autres que l'utilisateur courant,
  avec un bouton "Refuser" (organisateurs uniquement, masqué sur le dernier
  organisateur).
- "En attente de validation" et "Refusé" : **visibles uniquement par les
  organisateurs** — entièrement absentes du DOM pour les autres participants, pas
  seulement masquées. Boutons Valider/Refuser/Retirer (en attente) et Valider
  (refusé) respectivement.

Sécurité : un utilisateur ne peut accéder qu'aux campagnes où il est `CampaignParticipant`
`VALIDATED` (ou via le code d'invitation pour les infos minimales). Toute autre
tentative d'accès retourne HTTP 404 (pas de fuite d'information).

---

## Programme Télé (mode campagne — US-A1)

Une section **Programme Télé** est affichée sur `/campaigns/:id` **dans tous les
états** de la campagne. L'organisateur y planifie des **parties** (`Game`) — chacune
rattachée à un *scénario* du catalogue (`EVENEMENT_TELE` ou `ESCARMOUCHE`). La
gestion est possible en `EN_CONSTRUCTION` et `EN_COURS` ; en `TERMINEE`, le
programme reste **visible en lecture seule**.

- **Catalogue de scénarios** : chargé au démarrage depuis
  `database_init/data/scenarios.yml` par `ScenarioCatalogService` (même mécanisme
  que le catalogue de jeu, cf. ARCHITECTURE.md §3.3). Exposé en lecture publique
  via `GET /api/catalog/scenarios`.
- **Ajout d'une partie** (`POST /api/campaigns/:id/games`) : organisateur, campagne
  `EN_CONSTRUCTION` ou `EN_COURS` (refusé en `TERMINEE`, HTTP 400). La partie est
  créée `PLANIFIE`, en **fin de programme** (ordre auto-append = MAX+1). Le type
  est repris du scénario par défaut.
- **Édition / suppression** (`PUT`/`DELETE .../games/:gameId`) : organisateur,
  `EN_CONSTRUCTION` ou `EN_COURS` (refusé en `TERMINEE`, HTTP 400). Une partie
  `JOUE` est **figée** (HTTP 400 si on tente de la modifier ou supprimer). *Le
  statut `JOUE` n'est pas encore atteignable — l'enregistrement de résultat est
  une story ultérieure ; la garde est posée dès maintenant.*
- **Consultation** (`GET /api/campaigns/:id/games`) : tout participant `VALIDATED`
  voit le programme trié, en lecture seule, **quel que soit l'état** de la campagne.
  Les actions de gestion ne s'affichent que pour l'organisateur et hors `TERMINEE`.
- **Réordonnancement** (changer l'ordre au-delà de l'auto-append) : **hors
  périmètre d'US-A1**, suivi en US-A4 (cf.
  [backlog](../plans/2026-06-21-mode-campagne-backlog.md)).

Sécurité : autorisation assurée dans chaque use case (écritures) via les helpers
`assertOrganizer` / `assertParticipant` opérant sur l'état replay, et dans
`CampaignQueryService` (lectures) via `assertVisibleParticipant` — toute tentative
non autorisée retourne HTTP 404 (pas de fuite d'information), même pattern que le
reste du module Campaign.

---

## Exploits de partie (mode campagne — US-B2)

En plus du classement (US-B1), l'organisateur saisit sur le **même écran** (même
soumission `POST .../results`) les exploits réalisés par chaque participant
présent — Course à la Mort, p.167 :

- **Portes franchies** : +1 PC par porte, saisie en nombre libre par participant
  (`gatesCrossed`, optionnel — 0/absent si aucune).
- **Véhicules ennemis détruits** : l'organisateur **sélectionne le véhicule
  ennemi détruit** dans une liste (pas seulement un compteur par poids) — le
  client ne transmet que `vehicleId` ; le poids (`WeightClass` :
  `LEGER`/`MOYEN`/`LOURD`/`FORTERESSE`) est **redérivé côté serveur**
  (recherché par `Game.recordResult` dans les équipes réelles de la
  campagne) et attribue +1/+2/+3/+5 PC au **destructeur** — jamais accepté tel
  que fourni par l'appelant, pour empêcher un organisateur malveillant de
  désigner n'importe quel véhicule comme `FORTERESSE` afin d'obtenir +5 PC
  indus. `FORTERESSE` n'existe pas encore dans le catalogue de véhicules
  (aucun n'y est classé — cf. `docs/spec/VEHICLES.md`), mais la valeur et son
  barème sont posés dès maintenant : le code n'aura rien à changer le jour où
  un véhicule y sera classé.
- **Aucun effet sur l'état du véhicule ciblé** : la sélection ne marque jamais
  ce véhicule `isLost` — seul le calcul de PC est concerné. La perte réelle
  d'un véhicule reste gérée séparément par la Table des Épaves (US-E1–E4).
- La liste de véhicules proposée pour la sélection est le **roster actuel** des
  **autres participants présents à cette partie** (pas l'ensemble de la
  campagne, pas de notion de "véhicules engagés pour la partie" séparée du
  roster) — exposée par `GET .../participant-vehicles` (cf. table
  d'endpoints ci-dessous).
- Les **jerricans gagnés par exploit sont hors scope** de cette US : restent
  saisis manuellement via l'endpoint cagnotte existant
  (`WalletReason.RECOMPENSE`).

**Modèle event-sourcing** : deux nouveaux types d'événement, journalisés par
`Game.recordResult` en plus du `RankingAssignedEvent` — `GatesCrossedEvent`
(`gatesCrossed`, `championshipPoints` figé à l'écriture) et
`VehicleDestroyedEvent` (`vehicleId` informatif, `weightClass` dérivé côté
serveur — jamais transmis par l'appelant, cf. ci-dessus —,
`championshipPoints` figé selon le barème). Les PC restent **toujours dérivés
du journal** : `Campaign.standings()` ne change pas, elle lit déjà
`participant.championshipPoints`, incrémenté par tout événement qui appelle
`addPoints()` (classement et exploits confondus).

---

## Wizard de fin de partie

L'enregistrement du résultat d'une partie (`EN_COURS`) est un **wizard à 3
écrans séquentiels** (`GameResultWizard`, remplace l'ancienne modale unique),
document de conception : [`docs/plans/2026-07-04-wizard-fin-partie-design.md`](../plans/2026-07-04-wizard-fin-partie-design.md).

1. **Classement** (`RankingStep`) — inchangé : présence, ordre par
   glisser-déposer, portes franchies (US-B2).
2. **Désignation des épaves** (`WreckDesignationStep`) — pour chaque véhicule
   des équipes présentes : *Intact* / *Détruit par [participant]* / *Mis en
   épave seul*, plus une case "Favori du public (partie précédente)". C'est ici
   (et non plus à l'écran classement) que le picker "véhicules ennemis
   détruits" de l'US-B2 est saisi — le contrat backend (`destroyedVehicles`
   dans `RecordResultDto`, `{ vehicleId }` uniquement) est inchangé depuis
   l'écran classement, seul son point d'entrée UI a bougé.
   Cet écran soumet aussi le classement (`POST .../results`) : les événements
   de classement/exploits/résistance (US-F1) sont journalisés à cette étape,
   **mais la partie reste `PLANIFIE`** — voir ci-dessous.
3. **Résolution de la Table des Épaves** (`WreckResolutionStep`) — **synthèse
   automatique**, sans aucun bouton ni sélecteur : dès l'arrivée sur cet écran,
   un tirage D6 serveur est déclenché automatiquement pour chaque véhicule
   désigné à l'écran 2 (`POST .../events/wreck`), un par un. Pour chaque
   véhicule, l'écran affiche le résultat (Chocs, perte d'équipement, etc.) dès
   qu'il est reçu, plus la ligne "Détruit par [participant]" si applicable
   (donnée capturée à l'écran 2). Si un véhicule est confirmé "Favori du
   public" et que le tirage donne `VEHICULE_DETRUIT`, +5 PC sont crédités à son
   propriétaire (`FavoriDuPublicBonusEvent`). Le bouton "Terminer" (actif une
   fois tous les tirages reçus) appelle `POST .../enter-atelier` — **c'est à
   ce moment, et seulement à ce moment, que la partie passe `PLANIFIE →
   ATELIER`**, ouvrant la phase garage post-partie *sur cette même partie*
   (plus d'entité séparée, cf. §Cycle de vie ci-dessous).

**Pourquoi l'entrée en atelier est déplacée en fin de wizard** : faire entrer
la partie en atelier dès l'écran 2 rendait l'écran 3 structurellement
impossible — une fois la partie hors `PLANIFIE`, `Game.addEvent()` refuse tout
événement de classement/épaves (y compris les tirages de la Table des
Épaves), et rien ne permettait de sortir du wizard bloqué. L'entrée en atelier
est donc désormais une action explicite et séparée (`EnterAtelierUseCase`),
déclenchée uniquement à la fin complète du wizard — cohérent avec l'intention
du document de conception d'origine.

Retour en arrière possible entre écrans 1 et 2 (rien n'est encore persisté) ;
plus au-delà de l'écran 2 une fois le classement soumis avec succès (choix de
conception conservé, l'écran 3 n'ayant plus d'action manuelle à annuler).

**Description textuelle des événements** : chaque `GameEvent` expose une
méthode `describe(): string` (une ligne de texte en français résumant
l'événement — ex. `"Classé 1 (+10 PC)"`, `"Table des Épaves : Arrachée
(D6=5+0 chocs, +1 choc(s))"`). `POST .../events/wreck` renvoie ces lignes
(`descriptions: string[]`, une par événement généré par ce tirage) et
`WreckResolutionStep` les affiche telles quelles sous chaque véhicule.

**Limitation connue** : si l'utilisateur quitte le wizard (ou recharge la
page) entre la soumission de l'écran 2 et le clic "Terminer" de l'écran 3, la
partie reste `PLANIFIE` (par design) et réapparaît comme "à enregistrer" —
mais rouvrir le wizard et resoumettre le classement créerait des événements
`RankingAssignedEvent`/etc. en double (aucune garde d'idempotence, cohérent
avec les autres lacunes déjà documentées de ce module, ex. séquelles).

---

## Journal d'une partie

Pour toute partie en statut `ATELIER` ou `JOUE`, un bouton "📜 Journal"
(`GameList`) ouvre une modale listant **tous** les événements journalisés sur
cette partie — classement, exploits, table des épaves, atelier (achats/
reventes, séquelles), contact Résistance — traduits en une ligne de texte
lisible (`GameEvent.describe()`). Accessible à **tout participant `VALIDATED`**
de la campagne, même absent de cette partie précise — cohérent avec le
Programme Télé déjà visible par tous.

**Organisation** : groupé par participant, dans l'ordre d'apparition (le
participant dont le premier événement chronologique vient en premier). À
l'intérieur d'un groupe, les événements restent triés chronologiquement.

**Contact Résistance inclus** : l'événement `ResistanceContactedEvent`
apparaît dans le journal. La mécanique elle-même n'est pas secrète — seul le
**total cumulé** de Points de Résistance d'un joueur doit rester caché (cf.
[Limitations connues](#limitations-connues-vérifiées-dans-le-code-le-2026-07-03)
et `standings()`, qui continue de l'exclure). Voir un contact ponctuel dans le
journal ne révèle pas ce total.

`Game.journal()` transforme le journal brut d'une partie en `{ eventId,
participantId, description }[]`, dans l'ordre déjà garanti par `Game.events`
(trié par `eventOrder`) — c'est la partie elle-même, pas la couche lecture,
qui sait traduire ses événements en texte. `CampaignQueryService.
getJournal` (via `campaign.findGame(gameId).journal()`) enrichit ensuite ce
résultat avec `userName`/`teamName` (jointure
user/team) et `createdAt` (résolu depuis `GameEventOrm`, l'horodatage n'existant
pas sur le domaine `GameEvent`).

---

## Cycle de vie d'une partie et phase Atelier

Une partie (`Game`) traverse trois statuts : `PLANIFIE → ATELIER → JOUE`. Il
n'existe **pas d'entité "atelier" séparée** — la phase garage post-partie
(achats/reventes d'équipement, échange de Chocs contre une séquelle)
appartient à la partie elle-même, comme un statut supplémentaire de son
propre cycle de vie, plutôt qu'à une fausse partie intercalée entre deux
vraies parties (ancien design `AtelierGame`, abandonné — cf.
[design doc](../plans/2026-07-05-atelier-lifecycle-design.md)).

- **`PLANIFIE → ATELIER`** (`POST .../games/:gameId/enter-atelier`,
  organisateur) : déclenché à la toute fin du wizard de fin de partie
  (écran 3, "Terminer"). Le résultat est enregistré, la phase garage
  s'ouvre. Événements acceptés dès lors : `EquipmentChangedEvent`,
  `SequellaAddedEvent` (achat volontaire, via `POST .../events/sequella`).
- **Un seul atelier actif à la fois** par campagne : si une partie entre en
  atelier alors qu'une autre y est encore, **l'ancienne est automatiquement
  clôturée** (`ATELIER → JOUE`) — pas de blocage dur. La réponse
  d'`enter-atelier` inclut `autoClosedGameId` (id de la partie auto-clôturée,
  ou `null`) pour que le frontend puisse en avertir l'organisateur.
- **`ATELIER → JOUE`** (`POST .../games/:gameId/close-atelier`,
  organisateur) : clôture manuelle explicite, verrouille définitivement la
  phase garage de cette partie. Également déclenchée automatiquement au
  passage de la campagne en `TERMINEE` (`closeCampaign()`), pour ne jamais
  laisser un atelier ouvert sur une campagne terminée.
- Une partie `JOUE` est figée : `Game.addEvent()` refuse tout événement, quel
  qu'il soit.

Comme les événements d'atelier (`EquipmentChangedEvent`, `SequellaAddedEvent`)
sont journalisés avec le `gameId` de la partie qui vient d'être jouée, le
replay (`Campaign.replay()`, tri par `Game.order` puis par `eventOrder` interne
à la partie) les reconstitue dans le bon ordre chronologique sans aucun
mécanisme supplémentaire — contrairement à l'ancien design, qui nécessitait un
`order` fractionnaire (`partie.order + 0.5`) pour positionner la fausse partie
atelier entre deux vraies parties.

`SequellaAddedEvent` est accepté à la fois en `PLANIFIE` (séquelle imposée
par la Table des Épaves, ligne "Siège irrécupérable" — coût 0, pas un achat)
et en `ATELIER` (échange volontaire de Chocs contre une séquelle, via
`AddSequellaUseCase`, coût variable selon le type de séquelle).

Les endpoints `POST .../events/equipment` et `POST .../events/sequella` ne
prennent plus de `:gameId` en paramètre de route : le use case retrouve
lui-même l'unique partie actuellement en `ATELIER` dans la campagne (erreur
400 "Aucun atelier ouvert actuellement" si aucune).

---

## Annulation d'achat vs revente

Retirer un équipement (arme ou amélioration) en atelier est **deux opérations
distinctes** selon son origine — conception détaillée :
[`docs/plans/2026-07-11-atelier-annulation-revente-design.md`](../plans/2026-07-11-atelier-annulation-revente-design.md).

- **Acheté pendant la session d'atelier en cours** (son événement `BUY` est
  encore dans le journal de la partie actuellement en `ATELIER`) : **annulation**
  — l'événement `BUY` est supprimé du journal, aucun événement de vente n'est
  créé, remboursement intégral et invisible dans le journal (comme si l'achat
  n'avait jamais eu lieu).
- **Pré-existant** (construction d'équipe, ou atelier antérieur déjà clôturé) :
  **revente** à moitié prix arrondie à l'inférieur (p.170) — `Weapon`/
  `Improvement` gagnent un flag `isSold`, mirroir d'`isLost` : l'objet reste
  visible sur la fiche du véhicule (barré, badge "Vendue"), son prix devient le
  résiduel `ceil(prix/2)` et son emplacement est libéré (`slots = 0`). Scopé aux
  **armes et améliorations uniquement** — jamais aux véhicules (invariant de
  sécurité de la suppression physique du `BUY`, cf. commentaire sur `canAccept()`
  dans `evenement-tele-game.ts`/`escarmouche-game.ts`).

Le critère de décision (BUY de cette session ou non) est déterminé côté serveur
uniquement (`Game.wasPurchasedThisSession`) — le frontend appelle toujours le
même endpoint `POST .../events/equipment`, sans savoir laquelle des deux
opérations aura lieu. `WorkshopWeaponDto`/`WorkshopImprovementDto` exposent
`isSold` et `purchasedThisSession` (ce dernier uniquement pour adapter le texte
de confirmation *avant* le clic — "Annuler l'achat" vs "Revendre pour N
jerricans (50%)" — jamais pour décider côté client).

**Cagnotte dérivée** — `CampaignParticipant.wallet` n'est plus un compteur
mutable : c'est un getter dérivé de `Team.remainingBudget` (budget non dépensé
de l'équipe, qui reflète déjà le prix résiduel des objets vendus) plus les
récompenses cumulées (`WalletMovementEvent`, seul mouvement sans contrepartie
dans l'arbre d'équipement). Achat et revente n'écrivent donc plus jamais
directement sur le wallet — seule la mutation de l'entité (créée, ou flaguée
`isSold`) suffit à faire varier le budget dérivé du bon montant.

---

## Hors scope de l'itération actuelle

Réordonnancement du Programme (US-A4), visibilité partielle pour un `PENDING`,
quitter une campagne volontairement, rotation du code d'invitation.

Le verrouillage de l'équipe engagée (interdiction de toute modification directe
dès que la campagne n'est plus `EN_CONSTRUCTION`) est désormais **implémenté**,
mais **pas** via la colonne `CampaignParticipant.isLocked` ci-dessous (qui reste
un champ posé mais inutilisé) — cf.
[TEAMS.md — Verrouillage par une campagne en cours](TEAMS.md#crud-équipes).

Le classement (rang + Points de Championnat 10/5/2/1, US-B1/B3/C1) est
**implémenté et consommé par le frontend** — cf. tables d'endpoints ci-dessous.
Pas de vue séparée : `GET .../standings` alimente directement la liste unifiée
des participants (`ParticipantList`, cf. [COMPONENTS.md](../COMPONENTS.md)),
triée par PC décroissants (tri stable — ordre inchangé tant qu'aucun point
n'existe). L'Atelier, la Table des Épaves et les Points de Résistance existent
au niveau des endpoints/event-sourcing mais comportent des lacunes
significatives par rapport aux User Stories d'origine — voir
« Limitations connues » ci-dessous.

---

## Limitations connues (vérifiées dans le code le 2026-07-03)

Cette section documente l'écart entre les User Stories du
[backlog mode-campagne](../plans/2026-06-21-mode-campagne-backlog.md) et
l'implémentation réelle, constaté en relisant le code (pas seulement la doc — la
doc avait dérivé du code sur ces points). Détail complet par story et par critère
d'acceptation dans les cartes kanban `.devtool/features/*.md`.

- **Atelier (US-D1–D4)** — logique de cagnotte/achat/revente présente côté backend
  (`GetWorkshopUseCase`, `ChangeEquipmentUseCase`). Une **UI Temps 1** l'expose
  désormais, en deux écrans (même principe que la construction d'équipe,
  `TeamEditPage` → configurateur dédié) : la page `/campaigns/:id/atelier`
  (`AtelierPage`) liste les véhicules de l'équipe engagée (`VehicleSummaryCard`,
  sans bouton de suppression — aucun véhicule n'est supprimable en atelier) ;
  cliquer sur un véhicule navigue vers `/campaigns/:id/atelier/vehicles/:vehicleId`
  (`AtelierVehiclePage`), qui **réutilise le même composant `EquipmentManager`**
  que la construction d'équipe, via l'abstraction `EquipmentDataSource` (token DI)
  — l'implémentation `AtelierEquipmentDataSource` traduit chaque achat/retrait en
  `POST .../events/equipment` puis relit `GET .../workshop`. Achat **et** retrait
  d'armes et d'améliorations sont gérés (le buy/sell backend supporte désormais
  `IMPROVEMENT`, cf. `EquipmentChangedEvent`) ; le budget affiché est calibré sur
  la cagnotte. La phase atelier reste un statut du
  cycle de vie de la partie (`PLANIFIE → ATELIER → JOUE`, cf.
  [Cycle de vie d'une partie et phase Atelier](#cycle-de-vie-dune-partie-et-phase-atelier))
  plutôt qu'une entité séparée. La revente à moitié prix (p.170) et la distinction
  annulation-d'achat/revente sont désormais implémentées (cf.
  [§Annulation d'achat vs revente](#annulation-dachat-vs-revente) ci-dessous). **Reste
  en Temps 2** (cf.
  [design](../plans/2026-07-07-atelier-reutilisation-configurateur-design.md)) :
  enforcement des règles de pose au write (emplacements/orientation/sponsor — l'achat
  n'est aujourd'hui gardé que par la cagnotte), limite de 8 véhicules, gestion de la
  **Tourelle** en atelier (exclue au Temps 1), et l'UI des Chocs/séquelles/véhicules
  perdus.
- **Table des Épaves (US-E1–E4)** — la table complète à 9 lignes est implémentée
  (`WreckResult` : `DEBOSSELE`/`INDEMNE`/`ROUE_CABOSSEE`/`ARRACHEE`/
  `PIGNON_ENDOMMAGE`/`SIEGE_IRRECUPERABLE`/`CHASSIS_FRAGILISE`/`FAVORI_DU_PUBLIC`/
  `VEHICULE_DETRUIT`), avec le tirage D6 serveur et les Chocs dérivés (cf.
  [wizard de fin de partie](#wizard-de-fin-de-partie) ci-dessous). Toute perte
  d'équipement (`ARRACHEE`) est tirée aléatoirement dans le pool armes +
  améliorations montées (jamais un choix de l'organisateur), et peut désormais
  cibler une amélioration (`ImprovementLostEvent`, mirroir de `WeaponLostEvent`),
  pas seulement une arme. « Siège irrécupérable » réutilise le pattern Décorateur
  existant (`SiegeIrrecuperableDecorator`, réduit l'Équipage). Restent hors
  périmètre : la perte d'amélioration sur la ligne « Pignon endommagé » (TODO
  explicite dans le code — nécessiterait de distinguer les deux lignes du livre),
  les modificateurs de séquelle spéciaux (« Maintenu par la Rouille » double
  lancer, « Légende Vivante » résultat forcé à 1), et toute garde anti-doublon
  sur les séquelles.
- **Points de Résistance (US-F1)** — le crédit de +3 PR est désormais
  **automatique** : `Game.recordResult()` crédite tout participant hors du
  top `classified` (rang > `ceil(n/2)`), sans action de l'organisateur ni écran
  dédié — cohérent avec le secret de cette mécanique. Le secret vis-à-vis des
  autres joueurs est bien respecté, mais appliqué trop largement : un participant
  ne peut pas non plus lire **ses propres** Points de Résistance (aucun endpoint
  ne les expose, y compris au propriétaire).

---

## Modèles de données

### `Campaign`

| Champ | Type | Contraintes |
|-------|------|-------------|
| `id` | number | PK, auto-incrémenté |
| `name` | string(100) | obligatoire |
| `state` | `'EN_CONSTRUCTION' \| 'EN_COURS' \| 'TERMINEE'` | défaut `EN_CONSTRUCTION` |
| `inviteCode` | string | unique, indexé — token généré à la création |
| `createdAt` / `updatedAt` | Date | auto |

**Champs calculés dans la réponse API** (non stockés en base) :

| Champ (DTO) | Type | Description |
|-------------|------|-------------|
| `participantCount` | number | Nombre de participants `VALIDATED`. |
| `myRole` | `'organizer' \| 'participant'` | Rôle de l'utilisateur connecté dans cette campagne. |

### `CampaignParticipant`

Une ligne par (utilisateur, équipe choisie) inscrit à une campagne. Contrainte unique
`(campaignId, userId)` : un utilisateur ne peut engager qu'une seule de ses équipes par
campagne — modifiable (`teamId`) tant que la campagne est `EN_CONSTRUCTION`.

| Champ | Type | Contraintes |
|-------|------|-------------|
| `id` | number | PK, auto-incrémenté |
| `campaignId` | number | FK → Campaign (`CASCADE`) |
| `userId` | number | FK → User (`CASCADE`) |
| `teamId` | number | FK → Team (`CASCADE`) |
| `status` | `'PENDING' \| 'VALIDATED' \| 'REJECTED'` | défaut `PENDING` |
| `isOrganizer` | boolean | défaut `false` |
| `isLocked` | boolean | défaut `false` — posé pour `EN_COURS`, aucune logique d'application pour l'instant |
| `createdAt` / `updatedAt` | Date | auto |

**Champs calculés dans la réponse API** (non stockés en base) :

| Champ (DTO) | Type | Description |
|-------------|------|-------------|
| `userName` | string | Prénom + nom de l'utilisateur. |
| `teamName` | string | Nom de l'équipe engagée. |

### `Game` _(mode campagne — Programme Télé)_

Une partie du Programme d'une campagne. Le scénario est référencé par
`scenarioId` (FK logique vers `Scenario.nom_interne`, catalogue en mémoire).
Le statut porte aussi la phase garage post-partie (`ATELIER`) — cf.
[Cycle de vie d'une partie et phase Atelier](#cycle-de-vie-dune-partie-et-phase-atelier).

| Champ | Type | Contraintes |
|-------|------|-------------|
| `id` | number | PK, auto-incrémenté |
| `campaignId` | number | FK → Campaign (`CASCADE`) |
| `scenarioId` | string \| null | référence `Scenario.nom_interne` |
| `type` | `'EVENEMENT_TELE' \| 'ESCARMOUCHE'` | |
| `status` | `'PLANIFIE' \| 'ATELIER' \| 'JOUE'` | `PLANIFIE → ATELIER` (`enter-atelier`) `→ JOUE` (`close-atelier`, manuel ou auto) |
| `order` | number | `double precision` — auto-append MAX+1 |
| `playedAt` | Date \| null | horodatage du passage à `ATELIER` — null tant que `PLANIFIE` |
| `createdAt` / `updatedAt` | Date | auto |

**Champ calculé dans la réponse API** (non stocké en base) :

| Champ (DTO) | Type | Description |
|-------------|------|-------------|
| `scenarioName` | string | Libellé du scénario résolu depuis `ScenarioCatalogService`. |

### `Scenario` _(catalogue en mémoire, pas en base)_

Chargé depuis `database_init/data/scenarios.yml` au démarrage par
`ScenarioCatalogService`. Champs : `nom`, `nom_interne`, `type`
(`EVENEMENT_TELE` \| `ESCARMOUCHE`), `description` (Markdown → HTML au chargement).

---

## API Endpoints — Campagnes

| Méthode | Route | Auth | Description |
|---------|-------|------|-------------|
| GET | `/api/campaigns` | JWT | Mes campagnes (participant `VALIDATED`) |
| POST | `/api/campaigns` | JWT | Créer une campagne (`name` + `teamId` du créateur, devient organisateur) |
| GET | `/api/campaigns/pending` | JWT | Mes demandes d'inscription en attente |
| GET | `/api/campaigns/organizing/pending-requests` | JWT | Inscriptions en attente dans mes campagnes (organisateur) |
| GET | `/api/campaigns/by-code/:code` | JWT | Infos minimales d'une campagne par son code d'invitation |
| GET | `/api/campaigns/:id` | JWT | Détail d'une campagne (participant `VALIDATED`) |
| DELETE | `/api/campaigns/:id` | JWT | Supprimer la campagne (organisateur, cascade sur les participants) |
| PUT | `/api/campaigns/:id/state` | JWT | Transition d'état (organisateur) |
| GET | `/api/campaigns/:id/participants` | JWT | Liste des participants |
| POST | `/api/campaigns/:id/participants` | JWT | Demande d'inscription (`{ teamId }`) |
| PUT | `/api/campaigns/:id/participants/me` | JWT | Changer l'équipe engagée par l'utilisateur connecté (`{ teamId }`, `EN_CONSTRUCTION` uniquement) |
| PUT | `/api/campaigns/:id/participants/:pid/validate` | JWT | Valider/refuser (`{ accept }`, organisateur) — couvre `PENDING→VALIDATED/REJECTED`, `VALIDATED→REJECTED`, `REJECTED→VALIDATED` |
| PUT | `/api/campaigns/:id/participants/:pid/promote` | JWT | Promouvoir co-organisateur (organisateur) |
| DELETE | `/api/campaigns/:id/participants/:pid` | JWT | Retirer un participant (organisateur, `EN_CONSTRUCTION` uniquement) |

> Routes participants déclarées dans cet ordre dans `campaign.controller.ts` : la route
> `PUT :id/participants/me` est définie **avant** `PUT :id/participants/:pid/validate`,
> pour éviter que NestJS ne capture `me` comme valeur de `:pid`.

## API Endpoints — Programme Télé (mode campagne)

Tous déclarés dans le **`campaign.controller.ts` unique** (le second controller `game.controller.ts`
a été supprimé au basculement Phase 2). Le contrôle d'accès en écriture est assuré dans chaque
use case via `assertOrganizer` / `assertParticipant` opérant sur l'état replay (pas d'accès SQL
supplémentaire) ; en lecture via `CampaignQueryService.assertVisibleParticipant`.

### Gestion du Programme (CRUD parties)

| Méthode | Route | Auth | Description |
|---------|-------|------|-------------|
| GET | `/api/catalog/scenarios` | Non | Liste publique des scénarios du catalogue |
| GET | `/api/campaigns/:id/games` | JWT | Programme trié (participant `VALIDATED`) |
| POST | `/api/campaigns/:id/games` | JWT | Ajouter une partie (`{ scenarioId, type? }`, organisateur, `EN_CONSTRUCTION`/`EN_COURS`) |
| PUT | `/api/campaigns/:id/games/:gameId` | JWT | Éditer une partie `PLANIFIE` (organisateur, `EN_CONSTRUCTION`/`EN_COURS`) |
| DELETE | `/api/campaigns/:id/games/:gameId` | JWT | Supprimer une partie `PLANIFIE` (organisateur, `EN_CONSTRUCTION`/`EN_COURS`) |
| POST | `/api/campaigns/:id/games/:gameId/results` | JWT | Enregistrer le résultat (`{ results: [{ participantId, rank, gatesCrossed?, destroyedVehicles?: [{ vehicleId }] }] }`, organisateur) — `weightClass` n'est **pas** transmis, dérivé côté serveur depuis le véhicule réel (cf. §Exploits de partie). — **ne finalise plus la partie** (reste `PLANIFIE`, cf. §Wizard de fin de partie). Crée des `RankingAssignedEvent` + `GatesCrossedEvent`/`VehicleDestroyedEvent` (exploits, US-B2) via `Game.recordResult` (convergence event-sourcing) |
| GET | `/api/campaigns/:id/games/:gameId/results` | JWT | Résultats triés par rang (participant `VALIDATED`) — **dérivés du journal `game_events`** (`eventType = RANKING_ASSIGNED`), plus de table `game_results` |
| GET | `/api/campaigns/:id/games/:gameId/participant-vehicles` | JWT | Véhicules courants (hors perdus) des participants indiqués (`?participantIds=1,2,3`, organisateur) — alimente le picker "véhicules ennemis détruits" (US-B2) |
| POST | `/api/campaigns/:id/games/:gameId/enter-atelier` | JWT | Fait entrer la partie en atelier `PLANIFIE → ATELIER` (organisateur) — appelé par le frontend à la toute fin du wizard (écran 3, "Terminer"), retourne `{ autoClosedGameId }` (id de la partie auto-clôturée s'il y en avait une, sinon `null`) |
| POST | `/api/campaigns/:id/games/:gameId/close-atelier` | JWT | Clôture manuelle de l'atelier d'une partie `ATELIER → JOUE` (organisateur) — 204 |
| GET | `/api/campaigns/:id/games/:gameId/journal` | JWT | Journal complet de la partie (tout participant `VALIDATED`, même absent de la partie) — cf. [§Journal d'une partie](#journal-dune-partie) |

> Ce sont ces trois routes (`/results`, `/participant-vehicles`, `/enter-atelier`) — plus
> `/events/wreck` (cf. tableau "Atelier et épaves" ci-dessous) — que consomme le frontend
> Angular pour le wizard de fin de partie. La forme de réponse de `/results` (`Game`,
> statut désormais `PLANIFIE`) est inchangée malgré la bascule vers l'event-sourcing.

### Résultats et classement — endpoints event-sourcing (Partie 4)

> Endpoints granulaires du système event-sourcing, **non consommés par le frontend**
> (usage API direct) — à l'exception de `GET .../standings` (dernière ligne de la table
> ci-dessous), qui alimente `ParticipantList` sur `/campaigns/:id` (cf.
> [COMPONENTS.md](../COMPONENTS.md)). `POST .../enter-atelier` (consommé par le frontend)
> est listé dans le tableau précédent, avec les autres routes du wizard de fin de partie.
> `POST .../events/ranking` a existé puis a été **supprimée** (2026-07-10) : elle
> acceptait `championshipPoints` comme valeur fournie par l'appelant, sans appliquer le
> barème 10/5/2/1 — un organisateur pouvait s'auto-attribuer des PC arbitraires. Aucun
> consommateur (frontend ni e2e) ne l'utilisait ; seul `POST .../results`
> (`Game.recordResult`, qui calcule les PC correctement) permet désormais
> d'enregistrer un classement.

| Méthode | Route | Auth | Description |
|---------|-------|------|-------------|
| POST | `/api/campaigns/:id/games/:gameId/events/wallet` | JWT | Mouvement de cagnotte `{ participantId, amount, reason }` (organisateur) — 204 |
| POST | `/api/campaigns/:id/games/:gameId/events/vehicle-lost` | JWT | Perte d'un véhicule `{ participantId, vehicleId, weaponIds? }` (organisateur) — 204 |
| POST | `/api/campaigns/:id/games/:gameId/events/resistance` | JWT | Contact Résistance `{ participantId }` (+3 PR secrets, organisateur) — 204 |
| GET | `/api/campaigns/:id/standings` | JWT | Classement après replay complet (tout participant `VALIDATED`) |

### Atelier et épaves (Partie 5)

| Méthode | Route | Auth | Description |
|---------|-------|------|-------------|
| GET | `/api/campaigns/:id/workshop` | JWT | État campagne de l'équipe du participant connecté (véhicules transients avec armes **et améliorations**, chocs, séquelles, wallet, sponsor) — consommé par `AtelierPage` (liste) et `AtelierVehiclePage` (configuration) |
| GET | `/api/campaigns/:id/workshop/vehicles/:vId/available-weapons` | JWT | Armes du sponsor avec verdict de disponibilité pour un véhicule d'atelier (budget = cagnotte du participant). Même forme que le verdict "construction d'équipe" (`AvailableWeaponDto[]`) |
| GET | `/api/campaigns/:id/workshop/vehicles/:vId/available-improvements` | JWT | Améliorations du sponsor avec verdict (`AvailableImprovementDto[]`) — **Tourelle exclue** au Temps 1 |
| POST | `/api/campaigns/:id/events/equipment` | JWT | Achat/revente `{ operation, entityType, nomInterne, … }` — 204. `entityType` : `VEHICLE`/`WEAPON`/`IMPROVEMENT`. Pas de `:gameId` : le use case retrouve lui-même l'unique partie en `ATELIER` de la campagne (400 si aucune) |
| POST | `/api/campaigns/:id/games/:gameId/events/wreck` | JWT | Table des Épaves (9 lignes) — D6 serveur + tirage aléatoire de l'équipement perdu `{ participantId, vehicleId, pendingFavoriDuPublic? }` (organisateur, déclenché automatiquement par l'écran 3 du wizard — plus de bouton manuel), retourne `{ outcome, descriptions: string[] }` (une ligne de texte par événement créé, cf. `GameEvent.describe()`) |
| POST | `/api/campaigns/:id/events/sequella` | JWT | Séquelle permanente `{ vehicleId, sequellaTypeNom }` — 204. Même résolution automatique de l'atelier courant que `/events/equipment` |
