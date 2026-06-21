# Mode Campagne Gaslands — Backlog (User Stories & priorisation)

> Découpage en User Stories du document de conception
> [2026-06-21-mode-campagne-design.md](2026-06-21-mode-campagne-design.md).
> Chaque story suit le format *En tant que… je veux… afin de…* + critères d'acceptation
> (Gherkin Étant donné / Quand / Alors). Le backlog est priorisé en fin de document.

---

## Personae

- **Organisateur** — `SeasonParticipant` avec `isOrganizer = true`. Crée le Programme Télé,
  enregistre les résultats des parties.
- **Joueur** — `SeasonParticipant` `VALIDATED` (organisateur ou non). Gère son équipe entre
  les parties, consulte le classement.

---

## Épopée A — Programme Télé (calendrier de la saison)

### US-A1 — Définir le Programme Télé
**En tant qu'**organisateur, **je veux** ajouter des parties (Événements Télévisés ou
Escarmouches) au programme de la saison, **afin de** structurer le calendrier de la campagne.

**Critères d'acceptation**
- Étant donné une saison `EN_COURS` dont je suis organisateur, quand j'ajoute une partie avec
  un scénario et un type (`EVENEMENT_TELE` | `ESCARMOUCHE`), alors une partie `PLANIFIE` est
  créée et apparaît dans le programme, ordonnée.
- Étant donné que je ne suis pas organisateur, quand j'appelle l'endpoint de création, alors
  je reçois une erreur d'autorisation (403/404).
- Étant donné une partie déjà `JOUE`, quand je tente de la modifier, alors la modification est
  refusée.
- Étant donné une saison `EN_CONSTRUCTION` ou `TERMINEE`, quand je tente d'ajouter une partie,
  alors c'est refusé (le programme ne se gère qu'`EN_COURS`).

### US-A2 — Réordonner / éditer une partie planifiée
**En tant qu'**organisateur, **je veux** modifier ou réordonner une partie encore planifiée,
**afin de** corriger le programme avant qu'elle soit jouée.

**Critères d'acceptation**
- Étant donné une partie `PLANIFIE`, quand je change son scénario, son type ou son ordre,
  alors le programme reflète le changement.
- Étant donné une partie `JOUE`, quand je tente de l'éditer, alors c'est refusé.

### US-A3 — Consulter le Programme Télé
**En tant que** joueur, **je veux** voir la liste des parties de la saison avec leur statut,
**afin de** savoir ce qui est planifié et ce qui a été joué.

**Critères d'acceptation**
- Étant donné une saison où je suis participant `VALIDATED`, quand j'ouvre l'onglet
  « Programme », alors je vois les parties ordonnées avec scénario, type et statut
  (`PLANIFIE` / `JOUE`).
- Étant donné une saison `EN_CONSTRUCTION`, quand je l'ouvre, alors l'onglet « Programme »
  n'est pas affiché (comportement actuel inchangé).

---

## Épopée B — Enregistrement d'une partie (classement & exploits)

### US-B1 — Saisir le classement d'une partie
**En tant qu'**organisateur, **je veux** saisir le rang final de chaque équipe ayant joué une
partie, **afin que** l'appli calcule les Points de Championnat de classement.

**Critères d'acceptation**
- Étant donné une partie `PLANIFIE` de type `EVENEMENT_TELE`, quand je saisis le rang de
  chaque équipe et valide, alors un `GameResult` est créé par équipe avec son `rank`.
- Étant donné les rangs saisis, quand la partie est validée, alors les Points de Championnat
  de classement sont attribués (10/5/2/1 selon position, p.167) **uniquement** pour un
  `EVENEMENT_TELE`.
- Étant donné une partie de type `ESCARMOUCHE`, quand je saisis les rangs, alors **aucun**
  Point de Championnat de classement n'est attribué.
- Étant donné que je ne suis pas organisateur, quand j'enregistre un résultat, alors c'est
  refusé.

### US-B2 — Saisir les exploits d'une partie
**En tant qu'**organisateur, **je veux** saisir les exploits réalisés (portes franchies,
véhicules adverses détruits par poids), **afin que** l'appli calcule les Points de Championnat
d'exploits et les jerricans gagnés.

**Critères d'acceptation**
- Étant donné un `GameResult`, quand je saisis le nombre de portes franchies, alors +1 PC par
  porte est ajouté (Course à la Mort, p.167).
- Étant donné un `GameResult`, quand je saisis les véhicules adverses détruits par poids,
  alors +1/+2/+3/+5 PC sont ajoutés (Léger/Moyen/Lourd/Forteresse, p.167).
- Étant donné une partie validée, quand je consulte les PC d'une équipe, alors ils égalent la
  somme classement + exploits dérivée de ses `GameResult` (jamais une valeur stockée).

### US-B3 — Finaliser l'enregistrement d'une partie
**En tant qu'**organisateur, **je veux** valider l'enregistrement complet d'une partie,
**afin de** figer ses faits et passer la partie à `JOUE`.

**Critères d'acceptation**
- Étant donné un enregistrement complet, quand je valide, alors `Game.status` passe à `JOUE`
  et `playedAt` est renseigné.
- Étant donné une partie `JOUE`, quand je tente de la ré-enregistrer, alors c'est refusé (les
  faits sont immuables).

---

## Épopée C — Classement de la saison

### US-C1 — Consulter le classement
**En tant que** joueur, **je veux** voir le classement des équipes par Points de Championnat,
**afin de** suivre qui mène la saison.

**Critères d'acceptation**
- Étant donné une saison avec des parties jouées, quand j'ouvre l'onglet « Classement », alors
  je vois les équipes triées par PC décroissants.
- Étant donné qu'aucune partie n'a été jouée, quand j'ouvre le classement, alors toutes les
  équipes sont à 0 PC.
- Étant donné des PC, quand je les consulte, alors ils sont **calculés à la volée** depuis les
  `GameResult` (cohérence garantie, aucune désynchronisation).

---

## Épopée D — Cagnotte & Atelier (dépense entre les parties)

### US-D1 — Consulter la cagnotte et son journal
**En tant que** joueur, **je veux** voir la cagnotte courante de mon équipe et l'historique de
ses mouvements, **afin de** savoir de combien je dispose et d'où viennent les gains/dépenses.

**Critères d'acceptation**
- Étant donné mon équipe en campagne, quand j'ouvre « Mon Atelier », alors la cagnotte affichée
  = `Team.cans` + Σ `CampaignTransaction.amount`.
- Étant donné des transactions, quand je consulte le journal, alors chaque ligne montre montant
  (+/−), raison (`RECOMPENSE`/`ACHAT`/`REVENTE`) et la partie/véhicule liés le cas échéant.

### US-D2 — Recevoir les récompenses d'une partie
**En tant que** joueur, **je veux** que les jerricans gagnés lors d'une partie créditent
automatiquement ma cagnotte, **afin de** financer mes prochains achats.

**Critères d'acceptation**
- Étant donné une partie validée rapportant des jerricans à mon équipe, quand elle est
  enregistrée, alors une `CampaignTransaction` `RECOMPENSE` positive est créée.
- Étant donné cette récompense, quand je consulte ma cagnotte, alors elle est augmentée du
  montant correspondant.

### US-D3 — Acheter du matériel via l'Atelier
**En tant que** joueur, **je veux** acheter de nouveaux véhicules/armes/améliorations avec ma
cagnotte, **afin de** faire évoluer mon équipe entre les parties.

**Critères d'acceptation**
- Étant donné une cagnotte suffisante, quand j'achète un item autorisé par mon sponsor, alors
  la ligne est créée et une `CampaignTransaction` `ACHAT` négative est enregistrée.
- Étant donné une cagnotte insuffisante, quand je tente un achat, alors il est refusé (cagnotte
  ne peut pas devenir négative).
- Étant donné un item non autorisé par mon sponsor, quand je tente de l'acheter, alors il est
  refusé (réutilisation des règles du configurateur existant).
- Étant donné une équipe avec 8 véhicules, quand je tente d'acheter un 9e, alors c'est refusé
  (limite p.165).
- Étant donné l'Atelier, quand je le valide, alors le budget contrôlé est la **cagnotte
  dérivée**, pas le `Team.cans` figé.

### US-D4 — Mise à la Casse (revente)
**En tant que** joueur, **je veux** revendre un véhicule/arme/amélioration, **afin de**
récupérer une partie de la cagnotte.

**Critères d'acceptation**
- Étant donné un item acheté, quand je le mets à la casse, alors je reçois la moitié de son
  coût d'achat arrondie à l'inférieur (p.170) via une `CampaignTransaction` `REVENTE`, et la
  ligne est soft-deleted.
- Étant donné un véhicule revendu, quand je consulte son équipement, alors ses avantages sont
  perdus (transfert d'avantages interdit, p.170).

---

## Épopée E — Dégâts & Séquelles

### US-E1 — Désigner les véhicules devenus Épaves
**En tant qu'**organisateur, **je veux** cocher quels véhicules sont devenus Épaves pendant une
partie, **afin de** déclencher la résolution du Tableau des Épaves.

**Critères d'acceptation**
- Étant donné l'étape 3 de l'enregistrement, quand je coche un véhicule comme Épave, alors un
  `GameVehicleOutcome` avec `becameWreck = true` est créé.
- Étant donné un véhicule non coché, quand la partie est validée, alors aucune résolution
  d'Épave ne lui est appliquée.

### US-E2 — Résoudre le Tableau des Épaves (D6 serveur)
**En tant que** joueur, **je veux** que l'appli lance le D6 du Tableau des Épaves et applique
le résultat, **afin de** connaître le sort de mes véhicules abîmés sans tricher.

**Critères d'acceptation**
- Étant donné un véhicule Épave, quand la résolution se lance, alors l'appli génère un D6 et y
  ajoute les Chocs actuels du véhicule ± modificateur de poids (Léger +1, Lourd −1, p.168).
- Étant donné le total, quand l'appli consulte le Tableau des Épaves, alors la ligne obtenue
  est enregistrée (`wreckRoll`, `wreckTableResult`, `chocsGained`) et affichée à l'organisateur.
- Étant donné un résultat « Arrachée », quand il s'applique, alors une arme/amélioration est
  soft-deleted (`lostInGameId`).
- Étant donné un résultat « Siège irrécupérable », quand il s'applique, alors une
  `VehicleSequela` réduisant l'équipage de 1 est créée (équipage borné à 1 minimum).
- Étant donné un résultat « Véhicule détruit, pilote mort », quand il s'applique, alors le
  véhicule est soft-deleted et disparaît des vues actives.

### US-E3 — Chocs dérivés et modificateurs de tirage
**En tant que** joueur, **je veux** que les Chocs cumulés et les Séquelles spéciales
influencent correctement les futurs tirages, **afin que** la mécanique du livre soit respectée.

**Critères d'acceptation**
- Étant donné un véhicule, quand je consulte ses Chocs, alors ils = Σ `chocsGained` des
  outcomes − Σ `VehicleSequela.chocsCost` (dérivés, jamais stockés).
- Étant donné un véhicule avec « Maintenu par la Rouille », quand il devient Épave, alors le
  résolveur applique deux lancers au lieu d'un (p.169).
- Étant donné un véhicule avec « Légende Vivante », quand il devient Épave, alors le résolveur
  force le résultat à « 1 » avant application (p.169).
- Étant donné une Séquelle de pure règle de table (Vibrations, Suicidaire…), quand elle est
  présente, alors elle est affichée en rappel mais n'altère aucun calcul de l'appli.

### US-E4 — Échanger des Chocs contre des Séquelles
**En tant que** joueur, **je veux** dépenser les Chocs d'un véhicule pour acquérir une Séquelle,
**afin de** garder mon véhicule en jeu plus longtemps (p.169).

**Critères d'acceptation**
- Étant donné un véhicule avec assez de Chocs, quand je choisis une Séquelle, alors une
  `VehicleSequela` est créée avec son `chocsCost` et les Chocs disponibles diminuent d'autant.
- Étant donné un véhicule avec trop peu de Chocs, quand je tente l'échange, alors c'est refusé.
- Étant donné une Séquelle déjà possédée, quand je tente de la reprendre, alors c'est refusé
  (pas de doublon, p.169).

---

## Épopée F — Points de Résistance (mécanique secrète)

### US-F1 — Contacter la Résistance
**En tant que** joueur n'ayant pas marqué de PC lors d'une partie, **je veux** contacter la
Résistance, **afin de** gagner 3 Points de Résistance secrets.

**Critères d'acceptation**
- Étant donné une équipe n'ayant marqué aucun PC lors d'une partie, quand elle choisit de
  contacter la Résistance, alors un `ResistanceContact` est créé (+3 Pts Résistance).
- Étant donné une équipe ayant marqué des PC, quand elle tente de contacter la Résistance,
  alors c'est refusé (p.167 : réservé aux équipes non classées).
- Étant donné mes Points de Résistance, quand un autre joueur consulte la saison, alors ils ne
  lui sont **pas** visibles (mécanique secrète).
- Étant donné mes Points de Résistance, quand je les consulte moi-même, alors ils = 3 × count
  `ResistanceContact`.

---

## Backlog priorisé

Priorisation par **valeur livrée** et **dépendances techniques**. Chaque phase est un
incrément cohérent et testable de bout en bout. MoSCoW indicatif entre parenthèses.

### Phase 1 — Squelette de campagne (MVP du suivi de saison)
*Objectif : une saison peut dérouler des parties et produire un classement.*

| Ordre | Story | MoSCoW | Dépend de |
|---|---|---|---|
| 1 | US-A1 Définir le Programme Télé | Must | — |
| 2 | US-A3 Consulter le Programme Télé | Must | A1 |
| 3 | US-B1 Saisir le classement | Must | A1 |
| 4 | US-B3 Finaliser l'enregistrement | Must | B1 |
| 5 | US-C1 Consulter le classement | Must | B1 |
| 6 | US-B2 Saisir les exploits | Should | B1 |
| 7 | US-A2 Réordonner/éditer une partie | Could | A1 |

> Justification : c'est le cœur de valeur. Sans Programme ni classement, il n'y a pas de
> « campagne » perceptible. US-B2 (exploits) enrichit le calcul mais le classement de base
> (US-B1) suffit à livrer de la valeur. US-A2 est confort.

### Phase 2 — Économie (cagnotte & atelier)
*Objectif : les équipes évoluent en dépensant entre les parties.*

| Ordre | Story | MoSCoW | Dépend de |
|---|---|---|---|
| 1 | US-D1 Consulter cagnotte + journal | Must | Phase 1 |
| 2 | US-D2 Recevoir les récompenses | Must | B3, D1 |
| 3 | US-D3 Acheter via l'Atelier | Must | D1 |
| 4 | US-D4 Mise à la Casse | Should | D3 |

> Justification : la cagnotte (`CampaignTransaction`) est le socle ; récompenses et achats en
> découlent. La revente (D4) est secondaire mais peu coûteuse une fois D3 en place.

### Phase 3 — Usure (dégâts & séquelles)
*Objectif : les véhicules s'abîment, le risque devient réel.*

| Ordre | Story | MoSCoW | Dépend de |
|---|---|---|---|
| 1 | US-E1 Désigner les Épaves | Must | Phase 1 |
| 2 | US-E2 Résoudre le Tableau des Épaves | Must | E1 |
| 3 | US-E3 Chocs dérivés & modificateurs | Should | E2 |
| 4 | US-E4 Échanger Chocs → Séquelles | Could | E2 |

> Justification : c'est le **cœur de risque technique** (résolveur, décorateurs, soft-delete).
> Placé en Phase 3 car il dépend de l'enregistrement de partie (Phase 1) et bénéficie d'une base
> stable. E3/E4 affinent la mécanique mais E1+E2 livrent déjà l'essentiel.

### Phase 4 — Profondeur narrative (résistance)
*Objectif : la mécanique secrète de la Résistance.*

| Ordre | Story | MoSCoW | Dépend de |
|---|---|---|---|
| 1 | US-F1 Contacter la Résistance | Could | B3 |

> Justification : valeur de niche, isolable, sans dépendance structurelle forte. Dépriorisé en
> dernier — la campagne est pleinement jouable sans lui.

---

## Notes de priorisation

- **Découpage vertical** : chaque phase traverse backend + frontend pour livrer une valeur
  démontrable, conformément à la stratégie incrémentale du document de conception.
- **Risque concentré en Phase 3** : on stabilise d'abord le suivi (Phase 1) et l'économie
  (Phase 2), plus simples, avant d'attaquer le résolveur d'Épave et les décorateurs de séquelles.
- **Hors backlog** (cf. §13 du design) : avantages achetables, compagnon live, équipe
  multi-saison.
