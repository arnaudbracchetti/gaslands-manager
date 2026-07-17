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

En plus du classement (US-B1), l'organisateur saisit les exploits réalisés par
chaque participant présent — Course à la Mort, p.167 — dans la **même
soumission** `POST .../results` que le classement (converge dans
`RecordResultDto.results`, même si le wizard de fin de partie les répartit
aujourd'hui sur des écrans séparés, cf. [§Wizard de fin de
partie](#wizard-de-fin-de-partie)) :

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
- Les **jerricans gagnés par exploit restent hors scope** de cette US
  spécifique (portes/véhicules détruits) : traités séparément par le butin
  manuel de scénario et le revenu de base Escarmouche, tous deux intégrés au
  wizard de fin de partie (cf. [§Wizard de fin de
  partie](#wizard-de-fin-de-partie)), via le même `WalletReason.RECOMPENSE`.

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

L'enregistrement du résultat d'une partie (`EN_COURS`) est un **wizard à
étapes variables** (`GameResultWizard`), pilotées par le type de partie
(`EVENEMENT_TELE`/`ESCARMOUCHE`) et par les métadonnées du scénario
(`Scenario.franchissement_portes`/`gain_jerricans`) — jusqu'à 6 écrans
possibles, jamais tous affichés en même temps. Documents de conception :
[`docs/plans/2026-07-04-wizard-fin-partie-design.md`](../plans/2026-07-04-wizard-fin-partie-design.md)
(conception initiale, 3 écrans, Événement Télévisé uniquement) puis
[`docs/plans/2026-07-17-wizard-fin-partie-e-et-design.md`](../plans/2026-07-17-wizard-fin-partie-e-et-design.md)
(refonte à étapes variables, ajout du parcours Escarmouche).

| # | Écran | Composant | Visible si |
|---|-------|-----------|-----------|
| 1 | Présence | `PresenceStep` | toujours |
| 2 | Classement | `RankingStep` | `EVENEMENT_TELE` uniquement |
| 3 | Portes franchies | `GatesStep` | `EVENEMENT_TELE` **et** `franchissement_portes` |
| 4 | Jerricans (butin manuel) | `JerricansStep` | `gain_jerricans` |
| 5 | Désignation des épaves | `WreckDesignationStep` | toujours |
| 6 | Résolution (revenu + épaves) | `WreckResolutionStep` | toujours |

1. **Présence** (`PresenceStep`) — cases à cocher des participants
   `VALIDATED`, toujours le premier écran. Émet la liste des présents (ordre
   de coche), qui alimente `participant-vehicles` pour l'écran Désignation
   et sert de point de départ à l'écran Classement. **Minimum deux équipes**
   cochées pour continuer (bouton "Suivant" désactivé sinon, avertissement
   affiché) — une partie n'oppose jamais un seul participant.
2. **Classement** (`RankingStep`, Événement Télévisé uniquement) — ordre par
   glisser-déposer des présents (la présence elle-même a été déplacée à
   l'écran 1). Absent pour une Escarmouche, qui n'attribue jamais de PC de
   classement (`Game.recordResult` rejette d'ailleurs tout appel hors
   Événement Télévisé, cf. §Exploits ci-dessus).
3. **Portes franchies** (`GatesStep`, Événement Télévisé + scénario
   `franchissement_portes`) — extrait de l'ancien champ intégré à
   `RankingStep`, désormais son propre écran, gated par le scénario (tous les
   Événements Télévisés n'ont pas de portes, ex. "L'Arène").
4. **Jerricans** (`JerricansStep`, scénario `gain_jerricans`) — butin manuel
   de scénario (ex. pillage de convoi), indépendant du revenu de base D6 de
   l'écran 6 (Escarmouche) — les deux se cumulent.
5. **Désignation des épaves** (`WreckDesignationStep`) — pour chaque véhicule
   des équipes présentes : *Intact* / *Détruit par [participant]* / *Mis en
   épave seul*. Le picker destructeur reste actif pour les deux types de
   partie ; la case "Favori du public" (bonus PC, ET uniquement) est masquée
   pour une Escarmouche (`showFavoriDuPublic` input). Cet écran soumet le lot
   accumulé (`POST .../results`) — les événements de classement/exploits/
   résistance (ET) ou de jerricans/destructions à 0 PC (Escarmouche) sont
   journalisés à cette étape, **mais la partie reste `PLANIFIE`** — voir
   ci-dessous.
6. **Résolution** (`WreckResolutionStep`) — **synthèse automatique**, sans
   aucun bouton ni sélecteur : dès l'arrivée sur cet écran, un `effect()`
   déclenche les tirages serveur un par un — d'abord le **revenu de base**
   (Escarmouche uniquement, 1D6 par participant présent, `POST
   .../events/income`), puis la **Table des Épaves** (tout type de partie,
   `POST .../events/wreck`, un par véhicule désigné à l'écran précédent).
   Chaque résultat s'affiche dès qu'il est reçu, plus la ligne "Détruit par
   [participant]" si applicable (donnée capturée à l'écran 5). Si un véhicule
   est confirmé "Favori du public" et que le tirage donne `VEHICULE_DETRUIT`,
   +5 PC sont crédités à son propriétaire (`FavoriDuPublicBonusEvent`, ET
   uniquement — la case n'existe pas côté Escarmouche). Le bouton "Terminer"
   (actif une fois tous les tirages reçus) appelle `POST .../enter-atelier` —
   **c'est à ce moment, et seulement à ce moment, que la partie passe
   `PLANIFIE → ATELIER`**, ouvrant la phase garage post-partie *sur cette
   même partie* (pas d'entité séparée, cf. §Cycle de vie ci-dessous).

**Pourquoi l'entrée en atelier est déplacée en fin de wizard** : faire entrer
la partie en atelier avant l'écran de résolution rendrait ce dernier
structurellement impossible — une fois la partie hors `PLANIFIE`,
`Game.addEvent()` refuse tout événement de classement/épaves/revenus, et rien
ne permettrait de sortir du wizard bloqué. L'entrée en atelier est donc une
action explicite et séparée (`EnterAtelierUseCase`), déclenchée uniquement à
la fin complète du wizard.

**Persistance différée et annulation** : les écrans 1 à 5 sont de l'état
purement client — rien n'est envoyé au serveur avant l'arrivée sur l'écran 6
(Résolution). "Précédent" et "Annuler" restent donc libres jusque-là, sans
aucun appel réseau à défaire. Le lot accumulé (classement + exploits pour un
Événement Télévisé, ou jerricans + destructions pour une Escarmouche,
construit par `GameResultWizard.buildRecordResultDto`) n'est envoyé qu'à la
transition écran 5 → écran 6. Une fois sur l'écran 6, "Annuler" reste
disponible mais déclenche un **reset serveur** complet
(`DELETE .../games/:gameId/results`, `ResetResultUseCase` — supprime tous les
événements déjà journalisés sur cette partie, classement/exploits/revenus/
épaves compris, en une seule opération atomique via `Game.resultEventIdsForReset`,
réservé à une partie encore `PLANIFIE`) ; "Précédent" n'est en revanche plus
disponible à ce stade (l'écran 6 n'a plus d'action manuelle de retour à
défaire, cf. `WreckResolutionStep`, formCancel).

Côté frontend, `CampaignProgram.onWizardCancelled()` décide seul, sans que
`GameResultWizard` ait à le savoir, si un reset est nécessaire — en observant
si `wizardResultRecorded` (signal local, alimenté par la réponse de
`POST .../results`) est non-null au moment du clic "Annuler" : c'est le seul
signal distinguant "rien n'a encore été persisté" de "le lot de l'écran 5 a
déjà été écrit".

**Description textuelle des événements** : chaque `GameEvent` expose une
méthode `describe(): string` (une ligne de texte en français résumant
l'événement — ex. `"Classé 1 (+10 PC)"`, `"Table des Épaves : Arrachée
(D6=5+0 chocs, +1 choc(s))"`, `"+4 jerricans (Récompense)"`). `POST
.../events/wreck` et `POST .../events/income` renvoient ces lignes
(`descriptions: string[]`, une par événement généré) et `WreckResolutionStep`
les affiche telles quelles sous chaque entrée (véhicule ou participant).

**Limitation connue** : si l'utilisateur quitte le wizard (ou recharge la
page) entre la soumission de l'écran 5 et le clic "Terminer" de l'écran 6, la
partie reste `PLANIFIE` (par design) et réapparaît comme "à enregistrer" —
rouvrir le wizard sans passer par "Annuler" (donc sans déclencher le reset
serveur) et resoumettre le lot créerait des événements en double (aucune
garde d'idempotence, cohérent avec les autres lacunes déjà documentées de ce
module, ex. séquelles).

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
  s'ouvre. Événement accepté dès lors : `EquipmentChangedEvent` (achat/revente
  d'équipement **et** de séquelles `ATELIER`, cf. [§Séquelles](#séquelles)).
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

Comme les événements d'atelier (`EquipmentChangedEvent`) sont journalisés avec
le `gameId` de la partie qui vient d'être jouée, le replay (`Campaign.replay()`,
tri par `Game.order` puis par `eventOrder` interne à la partie) les reconstitue
dans le bon ordre chronologique sans aucun mécanisme supplémentaire —
contrairement à l'ancien design, qui nécessitait un `order` fractionnaire
(`partie.order + 0.5`) pour positionner la fausse partie atelier entre deux
vraies parties.

`EquipmentChangedEvent(entityType: SEQUELLE)` est accepté à la fois en
`PLANIFIE` (séquelle `TABLE_EPAVES` imposée par la Table des Épaves, ligne
"Siège irrécupérable" — coût 0, pas un achat, cf. `evenement-tele-game.ts`/
`escarmouche-game.ts` `canAccept()`) et en `ATELIER` (échange volontaire de
Chocs contre une séquelle `ATELIER`, coût variable selon le type) — seule
sous-catégorie d'`EquipmentChangedEvent` acceptée hors `ATELIER`, puisqu'elle
est générée par le tirage (écran 3 du wizard) *avant* l'entrée en atelier.

L'endpoint `POST .../events/equipment` ne prend plus de `:gameId` en paramètre
de route : le use case retrouve lui-même l'unique partie actuellement en
`ATELIER` dans la campagne (erreur 400 "Aucun atelier ouvert actuellement" si
aucune).

---

## Annulation d'achat vs revente

Retirer un équipement (arme, amélioration ou avantage) en atelier est **deux
opérations distinctes** selon son origine — conception détaillée :
[`docs/plans/2026-07-11-atelier-annulation-revente-design.md`](../plans/2026-07-11-atelier-annulation-revente-design.md)
et, pour la spécificité des avantages,
[`docs/plans/2026-07-12-avantages-vehicule-design.md`](../plans/2026-07-12-avantages-vehicule-design.md).

- **Acheté pendant la session d'atelier en cours** (son événement `BUY` est
  encore dans le journal de la partie actuellement en `ATELIER`) : **annulation**
  — l'événement `BUY` est supprimé du journal, aucun événement de vente n'est
  créé, remboursement intégral et invisible dans le journal (comme si l'achat
  n'avait jamais eu lieu). Comportement identique quel que soit le type
  d'équipement, avantages compris.
- **Pré-existant** (construction d'équipe, ou atelier antérieur déjà clôturé) :
  **revente**, dont le montant récupéré dépend du type d'équipement :
  - **Arme/Amélioration** : moitié prix arrondie à l'inférieur (p.170) —
    `Weapon`/`Improvement` gagnent un flag `isSold`, mirroir d'`isLost` : l'objet
    reste visible sur la fiche du véhicule (barré, badge "Vendue"), son prix
    devient le résiduel `ceil(prix/2)` et son emplacement est libéré (`slots = 0`).
  - **Avantage** : **perte totale** — aucun remboursement. `Advantage` gagne le
    même flag `isSold`, mais son `price` reste **toujours** le prix catalogue
    plein (`Advantage.price` ne dépend jamais d'`isSold`) : contrairement à une
    arme/amélioration, il n'existe pas de second nombre "prix résiduel" à
    calculer — la perte totale tient entièrement au fait que ce prix ne varie
    jamais. Reste visible sur la fiche véhicule (barré, badge "Vendu"), comme
    tout autre équipement revendu.

  Étendu aux **véhicules entiers** : acheter puis équiper un véhicule (armes,
  améliorations, avantages, séquelles) est possible dans la même session ou sur
  plusieurs. Retirer un véhicule suit la même distinction annulation/revente que
  les autres équipements, avec une nuance propre à son statut d'agrégat parent :
  - **Acheté pendant la session d'atelier en cours** : annulation **cascade** —
    l'événement d'achat du véhicule est supprimé, ET tout événement de cette
    session qui le référence (armes/améliorations/avantages montés dessus,
    séquelles ajoutées) l'est aussi, en une seule opération atomique. Sans cette
    cascade, ces événements deviendraient orphelins (ils ciblent un véhicule qui
    n'existe plus) et casseraient le PROCHAIN replay de la campagne
    (`Team.findVehicle` lève alors une `DomainException`). Remboursement intégral,
    invisible au journal — cf. `Game.collectSessionEventsForVehicle`.
  - **Véhicule pré-existant** (construction d'équipe, ou atelier antérieur déjà
    clôturé) : revente **par élément**, même règle que pour chaque pièce
    d'équipement — châssis à moitié prix arrondi à l'inférieur, chaque arme/
    amélioration encore active à moitié prix, chaque avantage à 0 (perte
    totale). Les éléments déjà revendus individuellement ne sont pas
    recomptés (déjà remboursés à leur propre vente) — cf. `Vehicle.resaleRefund`.
    `Vehicle` porte désormais, comme `Weapon`/`Improvement`/`Advantage`, un flag
    `isSold` : `markSold()` cascade sur toute arme/amélioration/avantage pas
    encore vendu(e) (cohérence d'état — un véhicule vendu voit tout son
    équipement vendu avec lui), et le châssis contribue son propre prix résiduel
    `ceil(prix/2)` au coût du véhicule (`Vehicle.cost`), exactement comme
    `Weapon.price`/`Improvement.price` pour une arme/amélioration individuelle.
    Seule différence avec une arme/amélioration vendue : un véhicule vendu est
    **filtré** de la liste exposée par l'atelier (`GetWorkshopUseCase`) — il
    disparaît entièrement, plutôt que de rester visible barré avec un badge
    "Vendu".

    **Limitation connue** — `Game.changeEquipment()` ne vérifie le statut
    "acheté cette session" (→ annulation 100 %, cf. ci-dessus) qu'au niveau du
    véhicule LUI-MÊME pour une opération de vente du véhicule entier ; si le
    véhicule est pré-existant mais qu'une arme/amélioration/avantage montée
    dessus a été achetée PENDANT la session en cours, revendre le véhicule
    entier la rembourse à moitié prix (règle "revente") au lieu du plein tarif
    (règle "annulation"). Contournement actuel : vendre l'objet individuellement
    avant de vendre le véhicule.

    **À faire — annulation non rejouée contre les événements suivants** :
    annuler un achat (suppression de l'événement `BUY` du journal, cf.
    ci-dessus) ne vérifie jamais que les événements de la même session
    intervenus APRÈS lui restent légaux une fois cet événement retiré.
    Exemple concret : achat d'une Remorque Moyenne (+1 emplacement) suivi de
    l'achat d'une arme qui consomme précisément cet emplacement supplémentaire
    — annuler l'achat de la remorque retire l'événement sans recalculer les
    emplacements, et le véhicule se retrouve avec une arme montée qui dépasse
    sa capacité réelle, sans qu'aucune règle ne le détecte ni ne le bloque.
    Correctif à envisager : `Game.changeEquipment()` (ou le use case
    `ChangeEquipmentUseCase`) devrait, avant de supprimer l'événement `BUY`,
    rejouer les événements de la session postérieurs à celui-ci sur l'état
    résultant et rejeter l'annulation (erreur explicite à l'utilisateur) si
    l'un d'eux devient illégal (emplacements dépassés, orientation requise
    manquante, etc.) — plutôt que de laisser un véhicule dans un état
    incohérent après coup.

Le critère de décision (BUY de cette session ou non) est déterminé côté serveur
uniquement (`Game.wasPurchasedThisSession`) — le frontend appelle toujours le
même endpoint `POST .../events/equipment`, sans savoir laquelle des deux
opérations aura lieu. `WorkshopWeaponDto`/`WorkshopImprovementDto`/
`WorkshopAdvantageDto` exposent `isSold` et `purchasedThisSession` (ce dernier
uniquement pour adapter le texte de confirmation *avant* le clic — "Annuler
l'achat" vs "Revendre pour N jerricans (50%)" pour une arme/amélioration,
"Revendre ? Le prix total est perdu, aucun remboursement" pour un avantage —
jamais pour décider côté client).

**Limitation connue — Cascadeur/Sur Deux Roues non réévalués en atelier** : les
2 avantages à comportement mécanique (Cascadeur, Sur Deux Roues, cf.
[VEHICLES.md](VEHICLES.md#avantages-de-véhicule-72-au-total)) sont correctement
grisés dans la liste des avantages disponibles (`GetWorkshopAvailableAdvantagesUseCase`
appelle la règle complète `canAddAdvantage`), mais `Game.changeEquipment()` ne
revérifie **pas** ces 2 règles à l'écriture — seul le budget de la cagnotte,
comme pour toute arme/amélioration aujourd'hui (cf. limitation déjà documentée
pour l'Atelier ci-dessous). Ce n'est pas une régression propre aux avantages :
c'est le même périmètre "Temps 1" que le reste de l'équipement atelier.

**Cagnotte dérivée** — `CampaignParticipant.wallet` n'est plus un compteur
mutable : c'est un getter dérivé de `Team.remainingBudget` (budget non dépensé
de l'équipe, qui reflète déjà le prix résiduel des objets vendus) plus les
récompenses cumulées (`WalletMovementEvent`, seul mouvement sans contrepartie
dans l'arbre d'équipement). Achat et revente n'écrivent donc plus jamais
directement sur le wallet — seule la mutation de l'entité (créée, ou flaguée
`isSold`) suffit à faire varier le budget dérivé du bon montant.

---

## Séquelles

> Conception détaillée (mécanique backend) :
> [`docs/plans/2026-07-13-sequelles-design.md`](../plans/2026-07-13-sequelles-design.md).
> L'atelier expose désormais une IHM intégrée directement à `EquipmentManager`
> (cf. [COMPONENTS.md](../COMPONENTS.md)) — 4ᵉ catégorie d'équipement, gated par
> son input `campaignId`, au même niveau qu'Armes/Améliorations/Avantages
> (carte catalogue à droite, ligne montée dans `MountedEquipment` à gauche) —
> achat, annulation même-session, revente cross-session gardée par Légende
> Vivante, et un picker dédié (`SequellaAdvantagePicker`) pour le choix de
> l'avantage gratuit de Dur à Cuire. Cf.
> [Limitations connues](#limitations-connues-vérifiées-dans-le-code-le-2026-07-03).

Une **Séquelle** (Gaslands, p.170) est un inconvénient permanent qu'un véhicule
acquiert en échange de Chocs accumulés en partie — 14 au catalogue
(`database_init/data/sequelle.yml`), chargées par `CatalogService` comme tout
autre catalogue d'équipement. Chaque séquelle porte un champ `origine` :

**Description courte / règles détaillées** : comme les armes, améliorations et
avantages, chaque séquelle porte désormais deux champs catalogue distincts —
`description` (phrase d'ambiance courte, affichée sur la carte catalogue) et
`regles` (effet mécanique précis, Markdown, affiché uniquement dans une modale
de détail ouverte au clic sur la carte). Même modèle d'interaction que les 3
autres catégories d'équipement (`EquipmentOption` → `EquipmentDetailModal`),
via un composant dédié `SequellaDetailModal` (cf.
[COMPONENTS.md](../COMPONENTS.md#sequelladetailmodal--teamsvehicle-configuratorequipment-managersequella-detail-modal))
— la carte séquelle reste `em-sequella-card` (dédiée, monnaie Chocs plutôt que
jerricans/emplacement) plutôt que de basculer sur `EquipmentOption`.

- **`TABLE_EPAVES`** (4 séquelles : `moteur_endommage`, `direction_endommage`,
  `blindage_arrache`, `siege_irrecuperable`) — imposée automatiquement par un
  tirage sur la Table des Épaves (coût toujours 0), jamais achetable
  directement en atelier.
- **`ATELIER`** (10 séquelles : Suicidaire, Impopulaire, Dingue, Lâche,
  Vieille Blessure de Guerre, Vibrations, Convulsions, Maintenu par la Rouille,
  Dur à Cuire, Légende Vivante) — achat volontaire contre des Chocs, en
  échange dans le même mécanisme que les autres équipements (cf.
  [Annulation d'achat vs revente](#annulation-dachat-vs-revente) ci-dessus) :
  **entityType `SEQUELLE`** de `EquipmentChangedEvent`, monnaie `vehicle.chocs`
  au lieu de la cagnotte du participant. `Vehicle.canAddSequella` garde
  l'origine (rejette un achat direct d'une séquelle `TABLE_EPAVES`), l'unicité
  (une même séquelle `ATELIER` ne peut être acquise deux fois) et les Chocs
  suffisants.

**Revente — fermée par défaut.** Contrairement aux armes/améliorations/
avantages, la revente cross-session d'une séquelle est **rejetée** par
`Vehicle.canRemoveSequella()`, sauf si le véhicule porte encore une séquelle
`legende_vivante` active — sa présence ouvre alors la revente des autres
séquelles de ce véhicule, y compris celles acquises lors d'une session
d'atelier antérieure. L'annulation même-session, elle, suit la règle commune
sans exception (toujours possible).

**Dur à Cuire** — un seul événement porte les deux effets (achat de la
séquelle **et** octroi d'un avantage gratuit de son choix) : `BUY(SEQUELLE,
'dur_a_cuire')` crée la séquelle et, si `freeAdvantageNomInterne` est fourni,
crée aussi l'avantage (`Advantage.grantedBySequellaNomInterne` le tagge).
Annuler cet achat dans la même session défait les deux d'un coup (un seul
événement supprimé du journal) ; le revendre (cross-session, via Légende
Vivante) marque aussi l'avantage taggé vendu (`Vehicle.markGrantedAdvantageSold`,
retrouvé par tag — pas par un id partagé entre événements).

Côté IHM, `SequellaAdvantagePicker` restreint le choix aux 6 avantages de
catégorie "Dur à Cuire" (tous sponsors confondus — conforme à la règle du
livre, qui accorde cet avantage "même si ce pilote ne peut normalement pas y
avoir accès"). Le backend, lui, n'impose aucune vérification de catégorie à
l'écriture (`ChangeEquipmentUseCase` résout `freeAdvantageNomInterne` via
`catalog.getAdvantageType`, sans filtrer sur `categorie`) — seul le picker
contraint le choix affiché.

**Maintenu par la Rouille / Légende Vivante — effets permanents sur la Table
des Épaves.** Les deux séquelles modifient le protocole de tirage
(`WreckTable`) tant qu'elles restent actives sur le véhicule, sans aucune
consommation :
- **Légende Vivante** force la valeur du D6 à 1 à **chaque** tirage (le
  randomizer n'est même pas appelé).
- **Maintenu par la Rouille** déclenche un second tirage après le premier
  (Chocs mis à jour entre les deux), sauf si le premier a déjà détruit le
  véhicule.

Les deux se composent sans se connaître (chaque tirage élémentaire vérifie
Légende Vivante indépendamment) : un véhicule qui porte les deux séquelles
obtient deux résultats "1", chacun avec son propre total de Chocs.

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
  d'armes, d'améliorations **et d'avantages** sont gérés (le buy/sell backend supporte
  désormais `IMPROVEMENT` et `ADVANTAGE`, cf. `EquipmentChangedEvent`) ; le budget
  affiché est calibré sur la cagnotte. La phase atelier reste un statut du
  cycle de vie de la partie (`PLANIFIE → ATELIER → JOUE`, cf.
  [Cycle de vie d'une partie et phase Atelier](#cycle-de-vie-dune-partie-et-phase-atelier))
  plutôt qu'une entité séparée. La revente à moitié prix (p.170) et la distinction
  annulation-d'achat/revente sont désormais implémentées (cf.
  [§Annulation d'achat vs revente](#annulation-dachat-vs-revente) ci-dessous), **étendues
  aux véhicules entiers** : un bouton "+ Ajouter un véhicule" permet d'en acheter un
  nouveau (parmi ceux du sponsor, payé via la cagnotte), et chaque véhicule de la liste
  peut être vendu (véhicule pré-existant, revente par élément) ou son achat annulé
  (véhicule acheté cette session, cascade sur tout son équipement — cf. ci-dessus).
  L'achat d'un véhicule en atelier applique aussi son équipement intégré éventuel
  (`estDefaut: true`, gratuit, non retirable — Arceaux du Buggy, Canon de 125mm sur
  Tourelle du Char d'assaut, cf. [VEHICLES.md — Améliorations et armes par
  défaut](VEHICLES.md#améliorations-et-armes-par-défaut)), symétriquement à la
  construction d'équipe (`AddVehicleUseCase`) — corrige un bug où un véhicule acheté
  en atelier restait "nu". **Reste en Temps 2** (cf.
  [design](../plans/2026-07-07-atelier-reutilisation-configurateur-design.md)) :
  enforcement des règles de pose au write (emplacements/orientation/sponsor — l'achat
  n'est aujourd'hui gardé que par la cagnotte, y compris pour l'achat d'un véhicule :
  aucune vérification d'autorisation sponsor à l'écriture, seulement au listing), limite
  de 8 véhicules, et l'UI des véhicules perdus (Table des Épaves). Le montage sur
  Tourelle, lui, n'est pas une fonctionnalité à part entière à ajouter en atelier :
  c'est une valeur d'orientation de l'arme (`Weapon.orientation = 'tourelle'`, cf.
  [VEHICLES.md](VEHICLES.md#montage-sur-tourelle-5ème-valeur-dorientation)), acheter une
  arme montée sur Tourelle en atelier passe par le `POST .../events/equipment` **existant**
  (`orientation: 'tourelle'` dans le corps), sans endpoint ni événement dédié.
  **L'UI des Chocs et séquelles est désormais implémentée**, intégrée à
  `EquipmentManager` (cf. [§Séquelles](#séquelles) ci-dessus) — retiré du
  périmètre Temps 2 restant.
- **Table des Épaves (US-E1–E4)** — la table complète à 9 lignes est implémentée
  (`WreckResult` : `DEBOSSELE`/`INDEMNE`/`ROUE_CABOSSEE`/`ARRACHEE`/
  `PIGNON_ENDOMMAGE`/`SIEGE_IRRECUPERABLE`/`CHASSIS_FRAGILISE`/`FAVORI_DU_PUBLIC`/
  `VEHICULE_DETRUIT`), avec le tirage D6 serveur et les Chocs dérivés (cf.
  [wizard de fin de partie](#wizard-de-fin-de-partie) ci-dessous). Toute perte
  d'équipement (`ARRACHEE`) est tirée aléatoirement dans le pool armes +
  améliorations montées (jamais un choix de l'organisateur), et peut désormais
  cibler une amélioration (`ImprovementLostEvent`, mirroir de `WeaponLostEvent`),
  pas seulement une arme. « Siège irrécupérable » réutilise le mécanisme Strategy
  existant (`SiegeIrrecuperableBehavior`, réduit l'Équipage). Reste hors
  périmètre : la perte d'amélioration sur la ligne « Pignon endommagé » (commentaire
  explicite dans le code, pas un marqueur `TODO` littéral - nécessiterait de distinguer les deux lignes du livre).
  Les modificateurs de séquelle spéciaux (« Maintenu par la Rouille » double
  lancer, « Légende Vivante » résultat forcé à 1) et la garde anti-doublon sur les
  séquelles `ATELIER` sont désormais implémentés — cf. [§Séquelles](#séquelles)
  ci-dessous.
- **Lancement de partie — non implémenté** — il n'existe aujourd'hui aucune
  action explicite de "démarrage" d'une partie `PLANIFIE`. À ajouter : un
  écran/bouton "Lancer la partie" qui affiche à chaque participant présent les
  points de vote du public qu'il gagne en tout début de partie, calculés
  depuis son classement courant (`standings()`) — mécanique distincte des
  Points de Championnat déjà crédités en fin de partie. Cette action devrait
  aussi **fermer immédiatement l'atelier actuellement ouvert** sur la
  campagne, s'il y en a un (`ATELIER → JOUE`, même effet que
  `CloseAtelierUseCase`), plutôt que d'attendre que la partie suivante entre
  elle-même en atelier pour le clôturer automatiquement (comportement actuel
  d'`EnterAtelierUseCase`, cf. [Cycle de vie d'une partie et phase
  Atelier](#cycle-de-vie-dune-partie-et-phase-atelier)). Objectif : garantir
  qu'aucun atelier ne reste ouvert pendant qu'une partie est en cours de jeu,
  du lancement jusqu'à l'enregistrement de son résultat.
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
| `teamId` | number \| null | FK → Team (`CASCADE`), nullable - un organisateur peut créer une campagne sans engager d'équipe immédiatement |
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
| `order` | number | `double precision` — auto-append MAX+1. Colonne SQL sous-jacente nommée `displayOrder` (`@Column({ name: 'displayOrder' })`) - c'est ce nom que reflète l'ERD de [DOMAIN_MODEL.md](../DOMAIN_MODEL.md), alors que la propriété TypeScript exposée par l'entité est `order` |
| `playedAt` | Date \| null | horodatage du passage à `ATELIER` — null tant que `PLANIFIE` |
| `createdAt` / `updatedAt` | Date | auto |

**Champ calculé dans la réponse API** (non stocké en base) :

| Champ (DTO) | Type | Description |
|-------------|------|-------------|
| `scenarioName` | string | Libellé du scénario résolu depuis `ScenarioCatalogService`. |
| `franchissementPortes` | boolean | Flag du scénario résolu (mirroir de `scenarioName`) — pilote l'affichage de l'écran Portes du wizard de fin de partie, cf. [§Wizard de fin de partie](#wizard-de-fin-de-partie). |
| `gainJerricans` | boolean | Flag du scénario résolu — pilote l'affichage de l'écran Jerricans du wizard. |

### `Scenario` _(catalogue en mémoire, pas en base)_

Chargé depuis `database_init/data/scenarios.yml` au démarrage par
`ScenarioCatalogService`. Champs : `nom`, `nom_interne`, `type`
(`EVENEMENT_TELE` \| `ESCARMOUCHE`), `description` (Markdown → HTML au
chargement), `franchissement_portes` (boolean — l'écran Portes du wizard de
fin de partie n'apparaît que si vrai, Événement Télévisé uniquement),
`gain_jerricans` (boolean — l'écran Jerricans du wizard n'apparaît que si vrai,
tout type de partie).

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
| POST | `/api/campaigns/:id/games/:gameId/results` | JWT | Enregistre le lot accumulé par le wizard (organisateur). `results` (classement + exploits, `{ participantId, rank, gatesCrossed?, destroyedVehicles?: [{ vehicleId }] }[]`) est optionnel — Événement Télévisé uniquement, `Game.recordResult` rejette (400) tout appel avec `results` sur une Escarmouche. `jerricanGains` (`{ participantId, amount }[]`) et `destroyedVehicles` (à plat, `{ destroyerId, vehicleId }[]`) sont optionnels — Escarmouche uniquement (`Game.recordJerricanGains`/`recordDestroyedVehicleTraces`, ce dernier à **0 PC**, trace journal uniquement). `weightClass` n'est jamais transmis, toujours dérivé côté serveur depuis le véhicule réel (cf. §Exploits de partie). Ne finalise pas la partie (reste `PLANIFIE`, cf. §Wizard de fin de partie) |
| DELETE | `/api/campaigns/:id/games/:gameId/results` | JWT | Annule le wizard en cours de résolution (organisateur, partie `PLANIFIE`) : supprime tous les événements déjà journalisés sur cette partie (`ResetResultUseCase`, `Game.resultEventIdsForReset`) — 204 |
| GET | `/api/campaigns/:id/games/:gameId/results` | JWT | Résultats triés par rang (participant `VALIDATED`) — **dérivés du journal `game_events`** (`eventType = RANKING_ASSIGNED`), plus de table `game_results` |
| GET | `/api/campaigns/:id/games/:gameId/participant-vehicles` | JWT | Véhicules courants (hors perdus) des participants indiqués (`?participantIds=1,2,3`, organisateur) — alimente le picker "véhicules ennemis détruits" (US-B2) |
| POST | `/api/campaigns/:id/games/:gameId/events/income` | JWT | Revenu de base Escarmouche — 1D6 serveur crédité en jerricans à un participant (`{ participantId }`, organisateur), déclenché automatiquement par l'écran Résolution du wizard, retourne `{ amount, descriptions: string[] }` (`RollIncomeUseCase`, `Game.rollBaseIncome`) |
| POST | `/api/campaigns/:id/games/:gameId/enter-atelier` | JWT | Fait entrer la partie en atelier `PLANIFIE → ATELIER` (organisateur) — appelé par le frontend à la toute fin du wizard (écran Résolution, "Terminer"), retourne `{ autoClosedGameId }` (id de la partie auto-clôturée s'il y en avait une, sinon `null`) |
| POST | `/api/campaigns/:id/games/:gameId/close-atelier` | JWT | Clôture manuelle de l'atelier d'une partie `ATELIER → JOUE` (organisateur) — 204 |
| GET | `/api/campaigns/:id/games/:gameId/journal` | JWT | Journal complet de la partie (tout participant `VALIDATED`, même absent de la partie) — cf. [§Journal d'une partie](#journal-dune-partie) |

> Ce sont ces routes (`/results` POST/DELETE, `/participant-vehicles`, `/events/income`,
> `/enter-atelier`) — plus `/events/wreck` (cf. tableau "Atelier et épaves" ci-dessous) —
> que consomme le frontend Angular pour le wizard de fin de partie. La forme de réponse de
> `POST /results` (`Game`, statut désormais `PLANIFIE`) est inchangée malgré la bascule
> vers l'event-sourcing.

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
| GET | `/api/campaigns/:id/workshop` | JWT | État campagne de l'équipe du participant connecté (véhicules transients avec armes, améliorations **et avantages**, chocs, séquelles, wallet, sponsor) — consommé par `AtelierPage` (liste) et `AtelierVehiclePage` (configuration) |
| GET | `/api/campaigns/:id/workshop/vehicles/:vehicleId/available-weapons` | JWT | Armes du sponsor avec verdict de disponibilité pour un véhicule d'atelier (budget = cagnotte du participant). Même forme que le verdict "construction d'équipe" (`AvailableWeaponDto[]`) |
| GET | `/api/campaigns/:id/workshop/vehicles/:vehicleId/available-improvements` | JWT | Améliorations du sponsor avec verdict (`AvailableImprovementDto[]`) |
| GET | `/api/campaigns/:id/workshop/vehicles/:vehicleId/available-advantages` | JWT | Avantages du sponsor avec verdict (`AvailableAdvantageDto[]`) — budget + unicité, et Cascadeur/Sur Deux Roues (`canAddAdvantage`, non réévalué à l'écriture, cf. §Annulation d'achat vs revente ci-dessus) |
| GET | `/api/campaigns/:id/workshop/vehicles/:vehicleId/available-sequelles` | JWT | Séquelles ATELIER (origine `TABLE_EPAVES` exclue) avec verdict (`AvailableSequellaDto[]`) — monnaie Chocs du véhicule, pas la cagnotte (`canAddSequella`, non réévalué à l'écriture) |
| POST | `/api/campaigns/:id/events/equipment` | JWT | Achat/revente `{ operation, entityType, nomInterne, …, orientation?, freeAdvantageNomInterne? }` — 204. `entityType` : `VEHICLE`/`WEAPON`/`IMPROVEMENT`/`ADVANTAGE`/`SEQUELLE` (cf. [§Séquelles](#séquelles) — monnaie Chocs, pas cagnotte). `orientation: 'tourelle'` (WEAPON/BUY uniquement) monte l'arme sur Tourelle (coût ×3, cf. [VEHICLES.md](VEHICLES.md#montage-sur-tourelle-5ème-valeur-dorientation)). `freeAdvantageNomInterne` (SEQUELLE/BUY/`dur_a_cuire` uniquement) : avantage gratuit choisi. Pas de `:gameId` : le use case retrouve lui-même l'unique partie en `ATELIER` de la campagne (400 si aucune) — sauf `entityType: SEQUELLE` d'origine `TABLE_EPAVES`, seule à pouvoir être journalisée hors `ATELIER` (cf. `WreckTable`) |
| POST | `/api/campaigns/:id/games/:gameId/events/wreck` | JWT | Table des Épaves (9 lignes) — D6 serveur + tirage aléatoire de l'équipement perdu `{ participantId, vehicleId, pendingFavoriDuPublic? }` (organisateur, déclenché automatiquement par l'écran Résolution du wizard, après les revenus le cas échéant — plus de bouton manuel), retourne `{ outcome, descriptions: string[] }` (une ligne de texte par événement créé, cf. `GameEvent.describe()`) |
