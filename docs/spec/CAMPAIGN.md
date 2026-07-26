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
(`Scenario.franchissement_portes`/`gain_jerricans`) — jusqu'à 7 écrans
possibles, jamais tous affichés en même temps. Documents de conception :
[`docs/plans/2026-07-04-wizard-fin-partie-design.md`](../plans/2026-07-04-wizard-fin-partie-design.md)
(conception initiale, 3 écrans, Événement Télévisé uniquement),
[`docs/plans/2026-07-17-wizard-fin-partie-e-et-design.md`](../plans/2026-07-17-wizard-fin-partie-e-et-design.md)
(refonte à étapes variables, ajout du parcours Escarmouche) puis
[`docs/plans/2026-07-26-sabotage-points-wizard-design.md`](../plans/2026-07-26-sabotage-points-wizard-design.md)
(ajout de l'écran Sabotage).

| # | Écran | Composant | Visible si |
|---|-------|-----------|-----------|
| 1 | Présence | `PresenceStep` | toujours |
| 2 | Sabotage (points dépensés) | `SabotageStep` | toujours |
| 3 | Classement | `RankingStep` | `EVENEMENT_TELE` uniquement |
| 4 | Portes franchies | `GatesStep` | `EVENEMENT_TELE` **et** `franchissement_portes` |
| 5 | Jerricans (butin manuel) | `JerricansStep` | `gain_jerricans` |
| 6 | Désignation des épaves | `WreckDesignationStep` | toujours |
| 7 | Résolution (revenu + épaves) | `WreckResolutionStep` | toujours |

1. **Présence** (`PresenceStep`) — cases à cocher des participants
   `VALIDATED`, toujours le premier écran. Émet la liste des présents (ordre
   de coche), qui alimente `participant-vehicles` pour l'écran Désignation
   et sert de point de départ à l'écran Classement. **Minimum deux équipes**
   cochées pour continuer (bouton "Suivant" désactivé sinon, avertissement
   affiché) — une partie n'oppose jamais un seul participant.
2. **Sabotage** (`SabotageStep`, toujours affiché — pas de gate scénario,
   contrairement à Portes/Jerricans) — déclaration rétroactive par
   l'organisateur du nombre de points de sabotage dépensés par équipe pendant
   la partie physique (annonce orale à table), cf. [§Points de
   sabotage](#points-de-sabotage) pour la mécanique complète. Un champ
   numérique par participant présent, à 0 par défaut : "Suivant" ne coûte
   qu'un clic si personne n'a rien dépensé — même gabarit que
   `GatesStep`/`JerricansStep`. Le solde de sabotage n'est jamais affiché à
   cet écran (secret, y compris pour l'organisateur) : rien n'est validé
   côté client, le clamp au solde réel se fait entièrement côté serveur.
3. **Classement** (`RankingStep`, Événement Télévisé uniquement) — ordre par
   glisser-déposer des présents (la présence elle-même a été déplacée à
   l'écran 1). Absent pour une Escarmouche, qui n'attribue jamais de PC de
   classement (`Game.recordResult` rejette d'ailleurs tout appel hors
   Événement Télévisé, cf. §Exploits ci-dessus).
4. **Portes franchies** (`GatesStep`, Événement Télévisé + scénario
   `franchissement_portes`) — extrait de l'ancien champ intégré à
   `RankingStep`, désormais son propre écran, gated par le scénario (tous les
   Événements Télévisés n'ont pas de portes, ex. "L'Arène").
5. **Jerricans** (`JerricansStep`, scénario `gain_jerricans`) — butin manuel
   de scénario (ex. pillage de convoi), indépendant du revenu de base D6 de
   l'écran 7 (Escarmouche) — les deux se cumulent.
6. **Désignation des épaves** (`WreckDesignationStep`) — pour chaque véhicule
   des équipes présentes : *Intact* / *Mis en épave par [participant]* / *Mis en
   épave seul*. Le picker destructeur reste actif pour les deux types de
   partie ; une case "Favori du public" apparaît uniquement pour un véhicule
   qui porte réellement ce statut ET pour un Événement Télévisé
   (`showFavoriDuPublic` input, toujours masquée en Escarmouche) — cf.
   §Faveur du Public ci-dessous pour le détail de la règle. Cet écran soumet
   le lot accumulé (`POST .../results`) — les événements de classement/
   exploits/résistance/sabotage (ET) ou de jerricans/destructions à 0 PC/
   sabotage (Escarmouche) sont journalisés à cette étape, **mais la partie
   reste `PLANIFIE`** — voir ci-dessous.
7. **Résolution** (`WreckResolutionStep`) — **synthèse automatique**, sans
   aucun bouton ni sélecteur : dès l'arrivée sur cet écran, un `effect()`
   déclenche les tirages serveur un par un — d'abord le **revenu de base**
   (Escarmouche uniquement, 1D6 par participant présent, `POST
   .../events/income`), puis la **Table des Épaves** (tout type de partie,
   `POST .../events/wreck`, un par véhicule désigné à l'écran précédent).
   Chaque résultat s'affiche dès qu'il est reçu, plus la ligne "Détruit par
   [participant]" si applicable (donnée capturée à l'écran 5). Le bonus
   Favori du Public (+5 PC, cf. §Faveur du Public) est crédité à cette étape
   si applicable. Le bouton "Terminer"
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

**Persistance différée et annulation** : les écrans 1 à 6 sont de l'état
purement client — rien n'est envoyé au serveur avant l'arrivée sur l'écran 7
(Résolution). "Précédent" et "Annuler" restent donc libres jusque-là, sans
aucun appel réseau à défaire. Le lot accumulé (classement + exploits +
sabotage pour un Événement Télévisé, ou jerricans + destructions + sabotage
pour une Escarmouche, construit par `GameResultWizard.buildRecordResultDto`)
n'est envoyé qu'à la transition écran 6 → écran 7. Une fois sur l'écran 7,
"Annuler" reste disponible mais déclenche un **reset serveur** complet
(`DELETE .../games/:gameId/results`, `ResetResultUseCase` — supprime tous les
événements déjà journalisés sur cette partie, classement/exploits/revenus/
épaves/sabotage compris, en une seule opération atomique via
`Game.resultEventIdsForReset`, réservé à une partie encore `PLANIFIE`) ;
"Précédent" n'est en revanche plus disponible à ce stade (l'écran 7 n'a plus
d'action manuelle de retour à défaire, cf. `WreckResolutionStep`, formCancel).

Côté frontend, `CampaignProgram.onWizardCancelled()` décide seul, sans que
`GameResultWizard` ait à le savoir, si un reset est nécessaire — en observant
si `wizardResultRecorded` (signal local, alimenté par la réponse de
`POST .../results`) est non-null au moment du clic "Annuler" : c'est le seul
signal distinguant "rien n'a encore été persisté" de "le lot de l'écran 5 a
déjà été écrit".

**Description textuelle des événements** : chaque `GameEvent` expose une
méthode `describe(): string` (une ligne de texte en français résumant
l'événement — ex. `"Classement : véhicule classé 1 (+10 PC)"`, `"Tirage sur la
table des Épaves pour (Voiture) : Arrachée (D6=5+0 chocs, +1 choc(s))"`,
`"Budget : +4 jerricans (Récompense)"`). `POST
.../events/wreck` et `POST .../events/income` renvoient ces lignes
(`descriptions: string[]`, une par événement généré) et `WreckResolutionStep`
les affiche telles quelles sous chaque entrée (véhicule ou participant).

**Limitation connue** : si l'utilisateur quitte le wizard (ou recharge la
page) entre la soumission de l'écran 6 et le clic "Terminer" de l'écran 7, la
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
reventes, séquelles, renommages de véhicule), contact Résistance — traduits
en une ligne de texte lisible (`GameEvent.describe()`). Accessible à **tout participant `VALIDATED`**
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

## Historique complet d'un participant

En plus du journal d'une partie (ci-dessus, scopé à une seule partie et à
tous ses participants), l'écran `/campaigns/:id` permet de consulter
l'**historique complet d'UN participant, sur TOUTES les parties** de la
campagne, groupé par partie — utile pour reconstituer le parcours complet
d'un joueur sans rouvrir le journal de chaque partie une à une.

- **Sur sa propre ligne** (`ParticipantList`) : un bouton icône 📜, à côté du
  lien "Gérer mon équipe"/Atelier — toujours affiché tant que l'utilisateur a
  une équipe engagée (`participant.teamId`), indépendamment de l'état de la
  campagne ou d'un atelier ouvert.
- **Sur la ligne d'un autre participant** : une entrée "Voir l'historique"
  dans le menu ⋯. Ce menu, jusqu'ici réservé à l'organisateur (Promouvoir/
  Refuser/Retirer), s'affiche désormais pour **tout participant** sur toute
  ligne autre que la sienne — les actions organisateur restent gated
  individuellement à l'intérieur du menu, seule "Voir l'historique" est
  inconditionnelle.
- **Visibilité** : tout participant `VALIDATED` de la campagne peut consulter
  l'historique de n'importe quel autre participant — même règle que le
  journal d'une partie (`assertVisibleParticipant`), **pas réservé à
  l'organisateur**.
- **Regroupement** : par partie, dans l'ordre du Programme (`campaign.games`,
  trié par `order` ASC) ; une partie sans événement pour ce participant est
  omise (pas de groupe vide affiché).

**Aucune nouvelle méthode sur l'agrégat `Campaign`** : l'agrégation
multi-parties est une préoccupation de lecture pure (cf. [ARCHITECTURE.md
§3.8](../ARCHITECTURE.md#38-mode-campagne--event-sourcing-campaign),
"`Campaign` se limite à la navigation"). `CampaignQueryService.
getParticipantJournal` itère elle-même `campaign.games` et réutilise
`Game.journal()` tel quel (déjà utilisé par le journal de partie ci-dessus),
en filtrant chaque résultat sur le `participantId` ciblé.

---

## Consultation en lecture seule de l'atelier d'un participant

Mirroir de [§Historique complet d'un participant](#historique-complet-dun-participant)
appliqué à l'atelier plutôt qu'au journal : depuis l'écran `/campaigns/:id`,
tout participant `VALIDATED` peut consulter l'équipe d'un tiers (véhicules,
armes, améliorations, avantages, séquelles, chocs, cagnotte), en lecture
seule — aucune action d'achat/vente/retrait n'est jamais possible sur cet
écran.

- **Accès** : sur la ligne d'un autre participant, une entrée "Voir l'atelier"
  dans le menu ⋯, visible dès que ce participant a une équipe engagée
  (`participant.teamId`) **et** que la campagne n'est plus `EN_CONSTRUCTION`
  (une équipe en construction libre n'a pas encore de contenu d'atelier
  stabilisé à montrer). Contrairement au lien "Gérer mon équipe" (qui ne
  bascule vers l'Atelier que si une partie y est *actuellement* ouverte), la
  consultation en lecture seule ne dépend d'aucun atelier ouvert précis — les
  données restent consultables à tout moment dès que la campagne a démarré.
- **Écran** (`ParticipantAtelierPage`, `/campaigns/:id/participants/:pid/atelier`) :
  vue maître-détail sur une seule page — colonne de gauche listant tous les
  véhicules de l'équipe consultée (façon onglets), partie droite affichant la
  configuration complète du véhicule sélectionné (armes, améliorations,
  avantages, séquelles), plus un bandeau de synthèse d'équipe (budget total /
  consommé à l'instant t). Pas de sous-route par véhicule : la sélection est
  un état local à la page, contrairement à l'atelier "personnel"
  (`AtelierPage`/`AtelierVehiclePage`, deux routes distinctes).
- **Backend** : `GetWorkshopUseCase` (déjà utilisé par `GET .../workshop`
  pour "mon" atelier) accepte désormais un `participantId` optionnel dans sa
  commande — cf. [§Atelier et épaves](#atelier-et-épaves-partie-5),
  `GET .../participants/:pid/workshop`. Aucun endpoint mutant (achat/revente,
  verdicts de disponibilité) n'existe en version "consultation d'un tiers" :
  seule la lecture est exposée.

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
`PLANIFIE` (séquelle `TABLE_EPAVES` imposée par la Table des Épaves, lignes
"Siège irrécupérable"/"Châssis fragilisé" — coût 0, pas un achat, cf.
`evenement-tele-game.ts`/`escarmouche-game.ts` `canAccept()`) et en `ATELIER` (échange volontaire de
Chocs contre une séquelle `ATELIER`, coût variable selon le type) — seule
sous-catégorie d'`EquipmentChangedEvent` acceptée hors `ATELIER`, puisqu'elle
est générée par le tirage (écran 3 du wizard) *avant* l'entrée en atelier.

L'endpoint `POST .../events/equipment` ne prend plus de `:gameId` en paramètre
de route : le use case retrouve lui-même l'unique partie actuellement en
`ATELIER` dans la campagne (erreur 400 "Aucun atelier ouvert actuellement" si
aucune).

---

## Renommage d'un véhicule en atelier

Un véhicule porte un nom d'affichage propre, distinct de son type catalogue
(`nomInterne`) — cf. [VEHICLES.md — Nom du véhicule](VEHICLES.md#construction-dun-véhicule).
Renommable à tout moment, mais par deux mécanismes distincts selon le
contexte, symétriques au reste du module (mutation directe verrouillable en
construction d'équipe, event-sourcing en atelier) :

- **Construction d'équipe** (équipe non verrouillée) : `PATCH /api/vehicles/:id/name`,
  mutation directe (`Team.renameVehicle`), refusée si l'équipe est verrouillée
  par une campagne en cours (`assertNotLocked`) — cf. [VEHICLES.md](VEHICLES.md#construction-dun-véhicule).
- **Atelier campagne** : `POST /api/campaigns/:id/events/vehicle-rename`
  (`{ vehicleId, nom }`, participant sur sa propre équipe — `assertParticipant`,
  pas `assertOrganizer`, même autorisation que `POST .../events/equipment`).
  Journalisé via un événement dédié, `VehicleRenamedEvent` (`GameEvent`, capture
  `previousName`/`newName` pour un `undo()` symétrique), accepté uniquement en
  statut `ATELIER` par `Game.canAccept()` — **jamais** hors Atelier, y compris
  quand l'équipe reste verrouillée par ailleurs.

**Pourquoi un événement plutôt qu'une écriture directe, même pour un véhicule
pré-existant (ligne réelle en base) ?** Aucune ligne du module `campaign/`
n'appelle jamais `teamRepo.save()` — le principe "l'atelier ne persiste jamais
directement, tout passe par le journal d'événements" (cf.
[ARCHITECTURE.md §3.8](../ARCHITECTURE.md#38-mode-campagne--event-sourcing-campaign))
est une invariante centrale, respectée strictement partout ailleurs dans ce
module. Une écriture directe romprait cette cohérence : le renommage
n'apparaîtrait pas dans le [Journal d'une partie](#journal-dune-partie)
(qui ne lit que `game_events`), et ne serait pas défait par l'annulation
d'achat de la session en cours. `VehicleRenamedEvent` est donc le mécanisme
**uniforme** pour tout renommage en Atelier, que le véhicule ciblé soit
pré-existant (id positif) ou transient de la session en cours (id négatif,
D-S11, cf. [Entités transientes](../DOMAIN_MODEL.md#entités-transientes-d-s11)) —
`Team.findVehicle`/`renameCampaignVehicle` ne distinguent jamais selon le
signe de l'id, donc aucun branchement supplémentaire n'est nécessaire.

**Cascade d'annulation** : un `VehicleRenamedEvent` créé après le `BUY_VEHICLE`
de la même session (véhicule tout juste acheté puis renommé) est inclus dans
la cascade de suppression si cet achat est annulé — `VehicleRenamedEvent`
surcharge `targetsVehicle(vehicleId)`, déjà utilisé par
`Game.collectSessionEventsForVehicle` (cf. [Annulation d'achat vs revente](#annulation-dachat-vs-revente)
ci-dessous) pour retrouver, sans connaître chaque type d'événement, tout ce
qui doit disparaître avec le véhicule annulé.

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

## Points de sabotage

Compteur affiché dans l'Atelier (`AtelierPage`), juste sous la Cagnotte : un
entier **dérivé** des Points de Résistance secrets (cf. [Limitations
connues](#limitations-connues-vérifiées-dans-le-code-le-2026-07-03) —
`CampaignParticipant.sabotagePoints`, `Math.floor(resistancePoints / 3)` — 1
point de sabotage pour 3 Points de Résistance, arrondi à l'inférieur).

**Le total brut de Points de Résistance reste caché**, y compris à son
propriétaire — seul ce compteur dérivé est révélé. Le secret vis-à-vis des
**autres joueurs** reste total : `GetWorkshopUseCase` ne peuple ce champ
(`WorkshopStateDto.sabotagePoints`) que pour le propriétaire consultant son
propre atelier (`GET .../workshop`, sans `participantId`) — `null` sur la
consultation en lecture seule de l'atelier d'un tiers (`GET
.../participants/:pid/workshop`, [§Consultation en lecture seule de l'atelier
d'un participant](#consultation-en-lecture-seule-de-latelier-dun-participant)).

**Dépense — déclaration rétroactive, pas de suivi en direct.** L'usage réel
des Jetons de Sabotage pendant une partie physique reste une "règle de
table" hors périmètre de l'application (cf. décision D2,
[`docs/plans/2026-06-21-mode-campagne-design.md`](../plans/2026-06-21-mode-campagne-design.md)),
au même titre que les Votes du Public — l'application ne suit jamais l'usage
en cours de partie. Elle permet en revanche, depuis l'écran Sabotage du
wizard de fin de partie (cf. [§Wizard de fin de
partie](#wizard-de-fin-de-partie)), d'enregistrer *après coup* combien de
points de sabotage chaque équipe a dépensés durant la partie qui vient de se
jouer — l'organisateur saisit un nombre par équipe présente, sur déclaration
orale à table, comme pour les autres écrans du wizard (Portes, Jerricans).

Cette déclaration **débite réellement** les Points de Résistance secrets
(3 PR bruts par point de sabotage déclaré dépensé, `SabotagePointsSpentEvent`)
— le solde de sabotage reste donc juste dans la durée, pas un simple journal
sans effet. Le solde n'étant jamais affiché à l'écran (secret, y compris pour
l'organisateur), rien n'est validé côté client : le serveur **clampe
silencieusement** toute sur-déclaration au solde réellement disponible au
moment de la partie (`CampaignParticipant.sabotagePoints`), sans jamais
rejeter la saisie — ce qui garantit mathématiquement que
`resistancePoints` ne descend jamais sous 0 (3 × `sabotagePoints` ≤
`resistancePoints`, par construction du `floor()`). Le journal de partie
affiche le montant **réellement appliqué** (déjà clampé), jamais la valeur
brute tapée par l'organisateur — une sur-déclaration ne reste donc visible
qu'indirectement, par un montant plus bas que celui annoncé à voix haute.
Conception détaillée : [`docs/plans/2026-07-26-sabotage-points-wizard-design.md`](../plans/2026-07-26-sabotage-points-wizard-design.md).

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
acquiert en échange de Chocs accumulés en partie — 12 au catalogue
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

- **`TABLE_EPAVES`** (2 séquelles : `siege_irrecuperable`, `chassis_fragilise`)
  — imposée automatiquement par un tirage sur la Table des Épaves (coût
  toujours 0), jamais achetable directement en atelier. `chassis_fragilise`
  (ligne `CHASSIS_FRAGILISE`) est purement descriptive — comme les 10
  séquelles `ATELIER` ci-dessous, elle n'a aucune entrée dans
  `SEQUELLA_BEHAVIORS` (`resolveSequellaBehavior` retombe sur le comportement
  neutre) — contrairement à `siege_irrecuperable`, seule autre séquelle
  `TABLE_EPAVES`, qui modifie une statistique chiffrée du véhicule
  (équipage).
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

**Séquelle `TABLE_EPAVES` — jamais retirable.** Un dommage permanent imposé par
un tirage sur la Table des Épaves ne peut **jamais** être retiré — ni par
revente cross-session (même avec `legende_vivante` active), ni par
l'annulation même-session (une séquelle `TABLE_EPAVES` peut être "de cette
session" si le tirage vient d'avoir lieu sur la partie qui entre en atelier).
`Vehicle.isSequellaRemovable()` porte cette garde absolue, consultée par
`Game.changeEquipment()` **avant** le court-circuit d'annulation même-session
— qui sinon supprimerait silencieusement l'événement sans jamais consulter
cette règle.

**Revente d'une séquelle `ATELIER` — fermée par défaut.** Contrairement aux
armes/améliorations/avantages, la revente cross-session d'une séquelle
`ATELIER` est **rejetée** par `Vehicle.canRemoveSequella()`, sauf si le
véhicule porte encore une séquelle `legende_vivante` active — sa présence
ouvre alors la revente des autres séquelles `ATELIER` de ce véhicule, y
compris celles acquises lors d'une session d'atelier antérieure (jamais les
séquelles `TABLE_EPAVES`, cf. ci-dessus). L'annulation même-session, elle,
suit la règle commune sans exception (toujours possible).

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

## Faveur du Public

Ligne 9 de la Table des Épaves (Événement Télévisé et Escarmouche) : un
véhicule qui obtient le résultat `FAVORI_DU_PUBLIC` acquiert ce statut,
suivi par l'application (`Vehicle.hasFavoriDuPublic`, jamais persisté en
colonne — reconstruit à chaque replay comme `isLost`/`isSold`) plutôt
qu'attesté sur l'honneur par l'organisateur. Le statut reste actif tant
qu'il n'a pas été dépensé, y compris d'une partie à l'autre de la même
campagne.

**Déclenchement** : à l'écran Désignation des épaves (`WreckDesignationStep`)
d'une partie ultérieure, une case "Favori du public" apparaît **uniquement**
pour un véhicule qui (a) est désigné *Mis en épave par [participant]* ou
*Mis en épave seul* à cet écran (jamais *Intact*) ET (b) porte réellement ce
statut — jamais pour les autres véhicules, contrairement au comportement
précédent (case libre sur tout véhicule non-intact). Cocher cette case
déclare que le joueur choisit de dépenser **3 votes du public** pour
l'activer — une ressource utilisée en cours de partie physique, **non
trackée par l'application** (déclaration sur l'honneur, comme le reste de la
mécanique "votes du public" tant que "Lancement de partie" n'est pas
implémenté, cf. Limitations connues ci-dessous).

**Résolution** : dès lors que la case a été cochée et que le véhicule est
réellement éligible, +5 PC sont crédités au propriétaire
(`FavoriDuPublicBonusEvent`) et le statut est consommé sur ce véhicule —
**indépendamment du résultat du tirage de la Table des Épaves de cette
partie** (que ce tirage donne `VEHICULE_DETRUIT`, un simple `DEBOSSELE` ou
n'importe quelle autre ligne, le bonus est crédité de la même façon : seule
la mise en épave déclarée à l'écran précédent compte, pas l'issue du dé). Si
la case n'est pas cochée, aucun événement n'est généré et le statut reste
actif pour une prochaine fois. Réservé à l'Événement Télévisé (la case
n'existe pas côté Escarmouche, `showFavoriDuPublic` toujours faux).

**Revérification serveur** : le booléen envoyé par le client n'est jamais la
seule source de vérité — `Game.creditFavoriDuPublicBonus` relit
`Vehicle.hasFavoriDuPublic` avant de créditer quoi que ce soit, même principe
que `weightClass` (toujours re-dérivé côté serveur, jamais accepté tel quel
d'un appelant). Les "votes du public" eux-mêmes restent hors de ce contrôle
— seule l'éligibilité réelle (le statut Favori du Public) est vérifiée,
jamais le solde de votes.

---

## Fiche d'équipe exportable (mode campagne)

Bouton "Fiche d'équipe" dans `ParticipantList` (cf.
[COMPONENTS.md](../COMPONENTS.md#participantlist--campaignsparticipant-list)),
au même endroit que "Gérer mon équipe"/"Voir mon historique" — **pas** dans le
Programme Télé (`GameList`), qui ne le porte plus. Deux points d'accès :

- **Sur sa propre ligne** : toujours affiché dès qu'une équipe est engagée
  (`participant.teamId`), quel que soit l'état de la campagne ou qu'un atelier
  soit ouvert ou non — le backend n'exige que `me.hasTeam`.
- **Sur la ligne d'un autre participant, via le menu "⋯"** : réservé à
  l'organisateur — rejoint le périmètre `@if (isOrganizer())` déjà appliqué à
  Promouvoir/Refuser/Retirer dans ce même menu, contrairement à "Voir
  l'historique"/"Voir l'atelier" (ouverts à tout participant `VALIDATED`).

**Deux endpoints distincts**, pas un paramètre optionnel sur une route unique :
- `GET /api/campaigns/:id/sheet` — sa propre fiche (inchangé), `playerName`
  résolu depuis `req.user` sans requête DB supplémentaire.
- `GET /api/campaigns/:id/participants/:pid/sheet` — fiche d'un tiers,
  réservée à l'organisateur (`GetCampaignTeamSheetUseCase.resolveTarget`,
  `assertOrganizer` — `NotFoundException` sinon). Le contrôleur résout le nom
  de la CIBLE via `CampaignQueryService.getParticipant(campaignId, pid)`
  (`userName`) avant d'appeler le use case — sans risque de fuite : si
  l'appelant n'est pas organisateur, le use case rejette avant tout rendu, le
  nom résolu n'atteint jamais la réponse HTTP.

Le frontend (`CampaignDetail.onExportSheet(pid)`) détermine lui-même lequel
des deux appeler, en comparant `pid` à l'id de son propre `CampaignParticipant`
(`myParticipant()`) — les deux routes ne sont pas interchangeables.

Génère la fiche via l'état **après replay complet** — seul chemin qui reflète
les chocs/séquelles réels de l'équipe engagée (event-sourcés, jamais persistés
directement sur `Team`/`Vehicle`). Ne passe volontairement pas par
`WorkshopVehicleDto` (taillé pour l'UI achat/revente atelier) : le même mapper
que la fiche "page Équipe" (cf.
[TEAMS.md — Fiche d'équipe exportable](TEAMS.md#fiche-déquipe-exportable) et
[ARCHITECTURE.md §3.4](../ARCHITECTURE.md#34-architecture-ddd--standard-du-projet))
est réutilisé tel quel sur `target.team.vehicles` — un véhicule reconstruit par
replay expose les mêmes objets domaine (`Weapon`/`Improvement`/`Advantage`/
`Sequella`, `.type` déjà résolu) qu'un véhicule chargé directement, donc aucun
branchement n'est nécessaire entre les deux points d'entrée.

Même format HTML imprimable (A4, pas de PDF backend) que le point d'entrée
équipe — cf. TEAMS.md pour le détail du layout.

**Points de sabotage dans l'en-tête** : contrairement à la fiche "construction
d'équipe" (`sabotagePoints` toujours `null`, les Points de Résistance n'existant
pas hors campagne), cette fiche affiche dans son bandeau d'en-tête une case à
cocher par point de sabotage actuellement disponible (`target.sabotagePoints`,
cf. [§Points de sabotage](#points-de-sabotage)) — **y compris sur la fiche d'un
tiers exportée par l'organisateur**. Contrairement à `GetWorkshopUseCase`
(atelier, ouvert en lecture à tout participant `VALIDATED`, où ce compteur reste
secret vis-à-vis des autres joueurs — D-S4), cette route tierce est déjà
réservée à l'organisateur (`resolveTarget`/`assertOrganizer`) : le secret ne
s'applique pas à ce niveau d'accès déjà restreint, donc `sabotagePoints` n'est
**jamais** nullifié ici, que `participantId` soit renseigné ou non. Le nom du
joueur (prénom + nom) est également affiché — le sien pour sa propre fiche,
celui de la cible pour la fiche exportée par l'organisateur.

**Votes du Public à la place du coût total** : le bloc `team-total` du bandeau
d'en-tête, qui affiche le coût total de l'équipe sur la fiche "construction
d'équipe", est **remplacé** sur cette fiche par le nombre de Votes du Public
gagnés en début de partie — dérivé de l'écart de Points de Championnat entre
ce participant (la cible, pas nécessairement l'appelant) et le 1er de la
campagne (`CampaignParticipant.votesPublicFor`, barème officiel Gaslands :
0-10 PC d'écart → 0 VP, 11-15 → 1, 16-20 → 2, 21-25 → 3, 26-30 → 4, 31+ → 5).
Contrairement aux points de sabotage, ce nombre n'est **jamais** secret (déjà
public via `GET .../standings`) — affiché normalement même sur la fiche d'un
tiers. L'écart utilisé est celui du classement courant au moment de l'export
(`Campaign.standings()`, trié PC décroissants), pas figé au lancement d'une
partie précise — cette fiche n'a pas vocation à remplacer le futur écran
"Lancer la partie" (cf. [Limitations
connues](#limitations-connues-vérifiées-dans-le-code-le-2026-07-03)), qui
créditera un jour un solde de VP réellement suivi ; ici, seule la valeur
**affichée** change, aucun solde n'est persisté ni consommé.

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
- **Table des Épaves (US-E1–E5)** — la table complète à 9 lignes est implémentée
  (`WreckResult` : `DEBOSSELE`/`INDEMNE`/`ROUE_CABOSSEE`/`ARRACHEE`/
  `PIGNON_ENDOMMAGE`/`SIEGE_IRRECUPERABLE`/`CHASSIS_FRAGILISE`/`FAVORI_DU_PUBLIC`/
  `VEHICULE_DETRUIT`), avec le tirage D6 serveur et les Chocs dérivés (cf.
  [wizard de fin de partie](#wizard-de-fin-de-partie) ci-dessous). **Deux
  tirages indépendants** : `ARRACHEE` tire aléatoirement dans le pool armes +
  améliorations montées et peut cibler une amélioration (`ImprovementLostEvent`,
  mirroir de `WeaponLostEvent`), jamais un choix de l'organisateur ; `PIGNON_ENDOMMAGE`
  tire aléatoirement dans le pool des avantages montés (`AdvantageLostEvent`,
  nouveau type d'événement). Un avantage perdu libère la contrainte d'unicité
  (rachetable ultérieurement en atelier). **Bugfix persistance** : `ImprovementLostEvent`
  (utilisé par `ARRACHEE` depuis le départ) s'écrivait sous forme de `RESISTANCE_CONTACTED`
  dans la base — persistance corrigée via colonnes `improvementId` et `advantageId`
  dans `GameEventOrm`. « Siège irrécupérable » réutilise le mécanisme Strategy
  existant (`SiegeIrrecuperableBehavior`, réduit l'Équipage). Les modificateurs de
  séquelle spéciaux (« Maintenu par la Rouille » double lancer, « Légende Vivante »
  résultat forcé à 1) et la garde anti-doublon sur les séquelles `ATELIER` sont
  désormais implémentés — cf. [§Séquelles](#séquelles) ci-dessous.
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
  dédié — cohérent avec le secret de cette mécanique. Le **total brut** reste
  caché, y compris à son propriétaire — aucun endpoint ne l'expose tel quel.
  Un dérivé (`sabotagePoints`, cf. [§Points de sabotage](#points-de-sabotage))
  est désormais exposé au propriétaire dans l'Atelier, mais le secret vis-à-vis
  des **autres joueurs** reste total : ce dérivé n'apparaît jamais dans la
  consultation en lecture seule de l'atelier d'un tiers.

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
| GET | `/api/campaigns/:id/participants/:pid/journal` | JWT | Historique complet d'un participant, toutes parties confondues, groupé par partie (tout participant `VALIDATED`, y compris pour consulter l'historique d'un tiers) — cf. [§Historique complet d'un participant](#historique-complet-dun-participant) |

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
| GET | `/api/campaigns/:id/participants/:pid/workshop` | JWT | Atelier d'**un autre participant**, en lecture seule — même forme de réponse que `GET .../workshop` (`WorkshopStateDto`), mais `participantId` de la commande désigne la cible plutôt que l'appelant. Réservé aux appelants `VALIDATED` (même règle de visibilité que `GET .../participants/:pid/journal`, `NotFoundException` dans les deux cas de refus) ; le participant cible n'a lui-même aucune contrainte de statut. Consommé par `ParticipantAtelierPage` (vue maître-détail) |
| GET | `/api/campaigns/:id/sheet` | JWT | Fiche d'équipe exportable (HTML imprimable, `Content-Type: text/html`) du participant connecté, chocs/séquelles réels inclus — cf. [§Fiche d'équipe exportable (mode campagne)](#fiche-déquipe-exportable-mode-campagne) |
| GET | `/api/campaigns/:id/participants/:pid/sheet` | JWT | Fiche d'équipe exportable d'**un autre participant** — réservé à l'organisateur (`NotFoundException` sinon, `GetCampaignTeamSheetUseCase.resolveTarget`), contrairement à `.../participants/:pid/workshop`/`.../journal` (ouverts à tout participant `VALIDATED`). `sabotagePoints` toujours affiché (jamais nullifié), le secret D-S4 ne s'appliquant pas à ce niveau d'accès déjà organisateur-only. Cf. [§Fiche d'équipe exportable (mode campagne)](#fiche-déquipe-exportable-mode-campagne) |
| GET | `/api/campaigns/:id/workshop/vehicles/:vehicleId/available-weapons` | JWT | Armes du sponsor avec verdict de disponibilité pour un véhicule d'atelier (budget = cagnotte du participant). Même forme que le verdict "construction d'équipe" (`AvailableWeaponDto[]`) |
| GET | `/api/campaigns/:id/workshop/vehicles/:vehicleId/available-improvements` | JWT | Améliorations du sponsor avec verdict (`AvailableImprovementDto[]`) |
| GET | `/api/campaigns/:id/workshop/vehicles/:vehicleId/available-advantages` | JWT | Avantages du sponsor avec verdict (`AvailableAdvantageDto[]`) — budget + unicité, et Cascadeur/Sur Deux Roues (`canAddAdvantage`, non réévalué à l'écriture, cf. §Annulation d'achat vs revente ci-dessus) |
| GET | `/api/campaigns/:id/workshop/vehicles/:vehicleId/available-sequelles` | JWT | Séquelles ATELIER (origine `TABLE_EPAVES` exclue) avec verdict (`AvailableSequellaDto[]`) — monnaie Chocs du véhicule, pas la cagnotte (`canAddSequella`, non réévalué à l'écriture) |
| POST | `/api/campaigns/:id/events/equipment` | JWT | Achat/revente `{ operation, entityType, nomInterne, …, orientation?, freeAdvantageNomInterne? }` — 204. `entityType` : `VEHICLE`/`WEAPON`/`IMPROVEMENT`/`ADVANTAGE`/`SEQUELLE` (cf. [§Séquelles](#séquelles) — monnaie Chocs, pas cagnotte). `orientation: 'tourelle'` (WEAPON/BUY uniquement) monte l'arme sur Tourelle (coût ×3, cf. [VEHICLES.md](VEHICLES.md#montage-sur-tourelle-5ème-valeur-dorientation)). `freeAdvantageNomInterne` (SEQUELLE/BUY/`dur_a_cuire` uniquement) : avantage gratuit choisi. Pas de `:gameId` : le use case retrouve lui-même l'unique partie en `ATELIER` de la campagne (400 si aucune) — sauf `entityType: SEQUELLE` d'origine `TABLE_EPAVES`, seule à pouvoir être journalisée hors `ATELIER` (cf. `WreckTable`) |
| POST | `/api/campaigns/:id/events/vehicle-rename` | JWT | Renomme un véhicule en atelier `{ vehicleId, nom }` (participant sur sa propre équipe) — 204. Journalisé via `VehicleRenamedEvent`, accepté uniquement en `ATELIER` (cf. [§Renommage d'un véhicule en atelier](#renommage-dun-véhicule-en-atelier) ci-dessus). Pas de `:gameId` : même résolution d'atelier que `POST .../events/equipment` |
| POST | `/api/campaigns/:id/games/:gameId/events/wreck` | JWT | Table des Épaves (9 lignes) — D6 serveur + tirage aléatoire de l'équipement perdu `{ participantId, vehicleId, pendingFavoriDuPublic? }` (organisateur, déclenché automatiquement par l'écran Résolution du wizard, après les revenus le cas échéant — plus de bouton manuel), retourne `{ outcome, descriptions: string[] }` (une ligne de texte par événement créé, cf. `GameEvent.describe()`) |
