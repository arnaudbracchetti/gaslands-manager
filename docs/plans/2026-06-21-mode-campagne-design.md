# Mode Campagne Gaslands — Document de conception (Saison Télévisée)

> Document de conception issu d'une session de brainstorming du 2026-06-21.
> Il capture le **raisonnement complet** : contexte, questions explorées, décisions prises
> et leur justification. Aucune implémentation n'a encore été faite — ce document sert de
> référence pour démarrer le développement ultérieurement.
>
> Spécifications fonctionnelles de rattachement : [../spec/SEASONS.md](../spec/SEASONS.md),
> [../spec/VEHICLES.md](../spec/VEHICLES.md). Architecture : [../../ARCHITECTURE.md](../../ARCHITECTURE.md).

---

## 1. Contexte et motivation

Gaslands (le jeu de plateau) propose un **mode campagne** où plusieurs équipes s'affrontent
sur une série de parties au fil d'une « saison ». Le livre de règles (section *Modes de jeu*
et *Campagnes*, p.128-170) décrit trois systèmes de campagne de complexité croissante :

1. **Saison Évolutive** (p.160) — chaque équipe reçoit des jerricans bonus avant chaque
   partie pour acheter du matériel. Pas de score global, pas de séquelles.
2. **Saison de Championnat** (p.161) — ajoute des Points de Championnat attribués selon le
   classement de chaque partie, pour désigner un grand vainqueur.
3. **Saison Télévisée** (p.162-170) — le système le plus riche et immersif : un *Programme
   Télé* (calendrier d'Événements Télévisés + Escarmouches libres), une cagnotte qui évolue,
   des Points de Championnat, des **Chocs & Séquelles** sur les véhicules abîmés, et des
   **Points de Résistance** (mécanique secrète).

### État de l'application avant ce travail

L'application gère déjà les saisons comme une **structure** :
- Entités `Season` (états `EN_CONSTRUCTION` → `EN_COURS` → `TERMINEE`) et
  `SeasonParticipant` (statuts `PENDING`/`VALIDATED`/`REJECTED`, rôle organisateur, équipe
  engagée, champ `isLocked` posé en fondation mais non exploité).
- Inscriptions via code d'invitation, validation par l'organisateur, changement d'équipe
  engagée tant que la saison est `EN_CONSTRUCTION`.

Mais elle ne gère **aucune progression entre les parties** :
- Aucune entité « partie jouée » (`Game`).
- Aucun Point de Championnat ni de Résistance.
- Aucun Choc / Séquelle sur les véhicules.
- La cagnotte n'évolue pas : `Team.cans` est un budget **figé** à la création, et les
  véhicules sont éditables librement.

### Objectif retenu

Faire de l'application le **moteur de campagne entre les parties**. L'application **ne joue
pas** la partie (qui se déroule sur table physique) : elle est un **carnet d'après-partie**.
L'organisateur saisit les *faits* d'une partie jouée, et l'application applique mécaniquement
les règles du livre — récompenses, Tableau des Épaves, évolution de la cagnotte.

---

## 2. Décisions de conception et leur justification

Chaque décision ci-dessous a été prise en dialogue. La justification est conservée car elle
conditionne la cohérence de l'ensemble.

### D1 — Périmètre : Saison Télévisée complète

Parmi les trois systèmes, c'est le plus ambitieux qui a été retenu : Programme Télé, cagnotte
évolutive, Points de Championnat, Chocs & Séquelles, Points de Résistance. Le développement
sera **découpé en phases** (cf. §6) pour livrer par incréments sans tout construire d'un bloc.

### D2 — Rôle de l'appli : carnet d'après-partie uniquement

Beaucoup de mécaniques du livre (Jetons Sabotage, Votes du Public, prix spéciaux, bonus de
handicap…) sont des **règles de table** qui n'ont de sens que *pendant* une partie physique.
L'appli ne suit donc **pas** le déroulé d'une partie en direct. Elle intervient **après** :
l'organisateur saisit le résultat, l'appli applique les conséquences durables (points,
cagnotte, séquelles). C'est le périmètre le plus net et le plus réaliste.

> Alternative écartée : « compagnon en direct » (suivi temps réel des points/votes pendant la
> partie) — jugé hors de portée et déconnecté de l'usage réel.

### D3 — Une équipe = une saison → on étend `Team`/`Vehicle`

**Problème identifié** : une `Team` sert aujourd'hui à deux usages qui divergent en campagne :
un *brouillon réutilisable* (liste éditable librement) et une *instance de campagne* (figée à
l'engagement, modifiée uniquement par les règles). Conflit concret : si un pilote meurt dans
la Saison A (véhicule retiré définitivement, p.168), cette perte doit-elle affecter la même
équipe rejouée dans une Saison B ?

**Décision de l'utilisateur** : une équipe engagée en campagne est **dédiée à cette saison**.
Si on veut rejouer ailleurs, on crée une nouvelle équipe.

**Conséquence architecturale** : pas besoin de *snapshot* (copie de l'équipe à l'engagement).
On **étend `Team` et `Vehicle`** avec un état campagne. Plus simple, pas de duplication de
données ni de logique de copie.

> Deux approches avaient été mises en balance :
> - **A (retenue)** — étendre `Team`/`Vehicle`. Simple, réutilise tout l'existant (configurateur,
>   `vehicle-summary`). Contrainte : une équipe ne peut être engagée que dans une seule saison.
> - **B (écartée)** — snapshot à l'engagement (entités campagne dédiées). Plus propre
>   conceptuellement (même liste jouable dans N saisons indépendamment) mais nettement plus de
>   travail. Le choix « une équipe = une saison » rend cette robustesse inutile.

### D4 — Automatisation maximale

L'organisateur saisit les **faits bruts** (classement, qui a détruit quoi, quels véhicules
sont devenus Épaves). L'application **calcule** les jerricans et Points de Championnat, **lance
les dés** du Tableau des Épaves et **applique** les effets. C'est un vrai moteur de règles,
fidèle au livre.

> Alternatives écartées : « assisté » (calculs proposés mais ajustables) et « saisie libre +
> mémo des règles » (l'appli ne calcule rien). L'automatisation maximale a été préférée pour la
> fidélité au livre, malgré l'effort de modélisation des tables.

### D5 — Modèle « event-sourced » : tout est dérivé, rien n'est stocké

**Question de fond soulevée par l'utilisateur** : les compteurs (Chocs, jerricans, Points de
Championnat) doivent-ils être des attributs qu'on *mute*, ou des valeurs *calculées* à partir
de l'état initial + tous les résultats ? Calculer évite les erreurs de mise à jour et les
désynchronisations.

**Décision** : modèle **dérivé** partout. On ne stocke que des **faits** ; les compteurs sont
**calculés à la volée**. C'est cohérent avec l'ADN du projet — `vehicleCount`,
`participantCount`, le `prix` des véhicules sont *déjà* calculés (COUNT SQL / getters sur le
catalogue) et jamais stockés (ARCHITECTURE.md : « jamais stocké en colonne pour éviter la
désynchronisation »).

Analyse des trois compteurs (tous ne sont pas identiques) :

| Compteur | Dérivable ? | Source de vérité |
|---|---|---|
| **Points de Championnat** | ✅ purement | Σ classement + exploits sur les `GameResult`. Rien hors-partie ne les modifie. |
| **Chocs d'un véhicule** | ✅ sous condition | Σ `chocsGained` des outcomes − Σ Chocs dépensés en Séquelles (à condition que l'échange Chocs→Séquelle soit lui-même un fait enregistré). |
| **Cagnotte** | ⚠️ cas épineux | Les récompenses sont dérivables des `GameResult`, mais les **achats/reventes** doivent être des faits horodatés **immuables** — sinon un véhicule détruit plus tard fausserait le calcul « Σ prix des véhicules vivants ». D'où un **journal de transactions** (`CampaignTransaction`). |

**Décision finale** : tout dérivé + **journal de cagnotte immuable**. Prix à payer : tout ce
qui modifie l'état doit s'écrire comme un **fait** (`GameResult`, `GameVehicleOutcome`,
`VehicleSequela`, `CampaignTransaction`, `ResistanceContact`), jamais comme une mutation de
compteur. En échange : zéro désynchronisation et un historique de campagne complet et gratuit.

### D6 — Lancer du D6 du Tableau des Épaves : côté serveur

L'application est l'**arbitre** : elle génère le D6, ajoute les Chocs et le modificateur de
poids, applique la règle, et **affiche le résultat** à l'organisateur (transparence).
Infalsifiable, fidèle au calcul du livre. (Une saisie manuelle du dé physique a été envisagée
puis écartée au profit de l'arbitrage serveur.)

### D7 — Avantages achetables : hors v1 (YAGNI)

Le livre permet d'acheter des « avantages » avec la cagnotte (p.170). Or le catalogue actuel
**n'a pas** d'avantages individuels achetables — seulement les *avantages sponsorisés*
(règles textuelles du sponsor) et les restrictions encodées dans `sponsors_autorises`. Les
modéliser exigerait un nouveau fichier YAML + entité + UI. **Reporté hors v1** : on s'appuie
sur les véhicules / armes / améliorations existants.

### D8 — Soft-delete pour l'équipement et les véhicules perdus

Les effets structurels du Tableau des Épaves (arme arrachée, pilote mort → véhicule retiré)
ne **suppriment pas physiquement** les lignes : on les **marque** (`lostInGameId`) et on les
**filtre** des vues actives. On ne détruit jamais un fait — cohérent avec D5 (event-sourcing)
et nécessaire pour que les cagnottes passées restent recalculables.

---

## 3. Modèle de données

### 3.1 Faits stockés (sources de vérité, immuables une fois écrits)

| Entité | Rôle | Champs clés |
|---|---|---|
| `Game` | une partie planifiée/jouée | `seasonId` (FK CASCADE), `scenario` (enum), `type` (`EVENEMENT_TELE` \| `ESCARMOUCHE`), `order`, `status` (`PLANIFIE` \| `JOUE`), `playedAt` |
| `GameResult` | participation d'une équipe à une partie | `gameId` (FK CASCADE), `participantId` (FK → `SeasonParticipant`), `rank`, faits saisis (portes franchies, véhicules adverses détruits par poids…) |
| `GameVehicleOutcome` | sort d'un véhicule dans une partie | `gameResultId` (FK CASCADE), `vehicleId` (FK), `becameWreck`, `wreckRoll`, `wreckTableResult` (enum), `chocsGained` |
| `VehicleSequela` | une Séquelle acquise (échange Chocs → Séquelle) | `vehicleId` (FK CASCADE), `type` (enum), `chocsCost`, `gameId` |
| `CampaignTransaction` | mouvement de cagnotte immuable | `participantId` (FK CASCADE), `amount` (+/−), `reason` (`RECOMPENSE` \| `ACHAT` \| `REVENTE`), `gameId?`, `vehicleId?` |
| `ResistanceContact` | gain de 3 Pts Résistance (secret) | `participantId` (FK CASCADE), `gameId` |

> **Pourquoi `GameVehicleOutcome` existe** (point soulevé par l'utilisateur en cours de
> conception) : les Épaves se déterminent **au niveau du véhicule**, alors que `GameResult` est
> au niveau **équipe**. Il faut donc un maillon véhicule pour porter le fait « ce véhicule est
> devenu une Épave » (`becameWreck`), entrée du Tableau des Épaves. Les **Chocs cumulés** vivent
> en dérivé sur le véhicule (cf. §3.3) ; `GameVehicleOutcome.chocsGained` trace ce qu'**une**
> partie a ajouté. Cela sépare l'historique (par partie) de l'état courant (du véhicule).

### 3.2 Modifications d'entités existantes

- `Vehicle` : ajouter `lostInGameId: number | null` (soft-delete — pilote mort).
- `Weapon` / `VehicleImprovement` : ajouter `lostInGameId: number | null` (arme/amélioration
  arrachée).
- `Team.cans` : **conservé tel quel** = point de départ figé de la cagnotte (30 par défaut en
  campagne, p.160). **Jamais muté.**

### 3.3 Valeurs dérivées (calculées, jamais stockées)

- `championshipPoints(participant)` = Σ (classement + exploits) sur ses `GameResult`
  — *seules les parties `EVENEMENT_TELE` rapportent des Points de Championnat* (p.167).
- `cagnotte(participant)` = `Team.cans` + Σ `CampaignTransaction.amount`.
- `chocs(vehicle)` = Σ `chocsGained` des outcomes − Σ `VehicleSequela.chocsCost`.
- `resistancePoints(participant)` = 3 × count `ResistanceContact`.

---

## 4. Séquelles & Épaves : trois familles distinctes

Point d'attention majeur soulevé par l'utilisateur : **les effets du Tableau des Épaves et des
Séquelles ne sont pas de simples nombres** — certains modifient le *périmètre* de l'équipe
(armes détruites, équipage réduit) ou *la façon dont d'autres règles se calculent* (« Maintenu
par la Rouille » change le tirage sur le Tableau des Épaves).

L'utilisateur a également identifié la bonne piste d'implémentation : **réutiliser le Pattern
Décorateur déjà en place** pour les améliorations qui modifient les stats du véhicule. Ce
pattern existe et a été confirmé dans le code :

- `improvement-decorators.ts` — une classe par comportement (`BlindageDecorator` +2
  carrosserie, `ChenillesDecorator` +1 manœuvrabilité/−1 vitesse, `MembreEquipageDecorator`
  +1 équipage…), chacune override `get stats()`.
- `improvement-decorator.factory.ts` — un `REGISTRE` mappe la clé `comportement` (YAML) → la
  classe décorateur. Extension = 1 classe + 1 ligne au registre.
- `vehicle-build.factory.ts` — `create()` empile les décorateurs sur `CatalogVehicleBuild`.

Les Séquelles/Épaves se répartissent en **trois familles**, dont **une seule** relève du
décorateur :

| Famille | Exemples (livre) | Traitement |
|---|---|---|
| **1. Modificateurs de stats** | Siège irrécupérable (−1 équipage, p.168), Châssis fragilisé | **Nouveau décorateur** ajouté au `REGISTRE`, empilé par `VehicleBuildFactory.create()` à partir des `VehicleSequela`/`GameVehicleOutcome`. Bornes via `validateSelf()` (équipage min 1). **Réutilisation directe du pattern existant.** |
| **2. Pertes structurelles** | Arrachée → arme/amélioration perdue (p.168, Épave 5), Pilote mort → véhicule retiré (Épave 10+) | **Soft-delete filtré** (`lostInGameId`, cf. D8) : la ligne perdue n'entre simplement pas dans la liste passée à la factory. Pas un décorateur. |
| **3. Modificateurs de tirage** | Maintenu par la Rouille (2 lancers sur le Tableau des Épaves, p.169), Légende Vivante (résultat forcé à « 1 ») | **Résolveur d'Épave** (cf. §5) : lit les séquelles du véhicule *avant* de lancer et adapte le tirage. Ni décorateur, ni soft-delete. |

> Beaucoup d'autres Séquelles (Vibrations, Suicidaire, Lâche, Convulsions… p.169) sont de
> **pures règles de table** sans impact sur l'appli : elles sont **stockées comme faits** et
> **affichées en rappel**, mais jamais interprétées par le moteur.

---

## 5. Moteur de résolution d'Épave (cœur de risque)

Pour chaque `GameVehicleOutcome` avec `becameWreck = true` :

1. Lit les Séquelles existantes du véhicule (Maintenu par la Rouille, Légende Vivante).
2. Lance le D6 **serveur**, ajoute `chocs(vehicle)` ± modificateur de poids (Léger +1, Lourd −1, p.168).
3. Applique les modificateurs de tirage (famille 3).
4. Consulte le **Tableau des Épaves** (p.168) → ligne obtenue.
5. Écrit le fait (`wreckRoll`, `wreckTableResult`, `chocsGained`).
6. Applique l'effet structurel : soft-delete de l'équipement/véhicule (famille 2) ou création
   d'une `VehicleSequela` (famille 1).

C'est la partie la plus risquée et la plus testée (cf. §9).

---

## 6. Flux d'enregistrement d'une partie (assistant 4 étapes, p.167)

Pré-requis : saison `EN_COURS`, Programme Télé défini. L'organisateur clique « Enregistrer le
résultat » sur une partie `PLANIFIE`. La séquence d'après-partie du livre est suivie :

1. **Participants & classement** — saisie du `rank` par équipe → Points de Championnat de
   classement (Événements Télévisés uniquement).
2. **Exploits** — faits saisis (portes franchies → +1 PC/porte ; véhicules adverses détruits
   par poids → Léger +1, Moyen +2, Lourd +3, Forteresse +5 ; bonus uniques) → PC d'exploits +
   jerricans gagnés.
3. **Sort des véhicules (Épaves)** — cocher les véhicules devenus Épaves → le **résolveur
   serveur** (§5) lance, applique, et affiche les résultats.
4. **Contacter la Résistance** — si l'équipe n'a **pas** marqué de PC cette partie : option
   +3 Pts Résistance (secret) → `ResistanceContact`.

Validation finale → faits persistés, `Game.status` = `JOUE`. L'Atelier reste ouvert ensuite.

---

## 7. L'Atelier — dépense de la cagnotte entre les parties (p.169-170)

- **Achat** d'un véhicule/arme/amélioration → `CampaignTransaction` négative + création de la ligne.
- **Mise à la Casse** → revente à **moitié prix** (arrondi inférieur, p.170) → transaction positive + soft-delete.
- **Échange Chocs → Séquelle** → `VehicleSequela`.
- **Règles imposées par l'appli** : achats limités aux listes du sponsor (configurateur
  existant), cagnotte ≥ 0, **8 véhicules max** par équipe (p.165), transfert d'avantages
  interdit (revendre un véhicule perd ses avantages, p.170).
- **Réutilisation forte** : l'Atelier réutilise le `VehicleConfigurator` existant. Seule
  différence — le budget validé devient la **cagnotte dérivée** (`Team.cans` + journal) au lieu
  du `Team.cans` figé. C'est un changement de *source du budget*, pas de logique.
- **Disponibilité** : ouvert dès que la saison est `EN_COURS` (l'appli n'a pas de notion de
  « pendant la partie », cf. D2).

---

## 8. API & Frontend

### 8.1 Nouveaux endpoints backend (conventions existantes : JWT, accès par `userId`/organisateur)

| Méthode | Route | Rôle |
|---|---|---|
| POST | `/api/seasons/:id/games` | Créer une partie au Programme (organisateur) |
| PUT | `/api/seasons/:id/games/:gameId` | Éditer/ordonner une partie planifiée |
| POST | `/api/seasons/:id/games/:gameId/result` | Enregistrer le résultat (assistant 4 étapes) |
| GET | `/api/seasons/:id/games` | Programme Télé + statuts |
| GET | `/api/seasons/:id/standings` | Classement dérivé (Points de Championnat) |
| GET | `/api/seasons/:id/my-workshop` | État campagne de mon équipe (cagnotte dérivée, véhicules + chocs/séquelles, journal) |
| POST | `/api/seasons/:id/workshop/scrap` | Mise à la Casse (revente) |
| POST | `/api/vehicles/:id/sequelae` | Échange Chocs → Séquelle |

Les achats réutilisent les endpoints `/api/vehicles` existants ; le budget validé devient la
cagnotte dérivée si le véhicule appartient à une équipe en campagne.

### 8.2 Nouveaux composants Angular (conventions COMPONENTS.md — Smart/Dumb, Signals, zoneless)

- `SeasonProgram` (smart) — gère le Programme Télé dans `SeasonDetail`.
- `GameResultWizard` (smart) — l'assistant 4 étapes d'après-partie.
- `Standings` (dumb) — tableau de classement.
- `TeamWorkshop` (smart) — l'Atelier (cagnotte, journal, véhicules, Mise à la Casse).
- `VehicleCampaignCard` (dumb) — carte véhicule enrichie (chocs, séquelles, pilote mort).
- Réutilise `VehicleConfigurator`, `ConfirmModal`, `Breadcrumb`, `SlotGauge`.
- **Ancrage** : sur `/seasons/:id`, des onglets « Programme / Classement / Mon Atelier » sont
  révélés quand la saison passe `EN_COURS`. Le comportement `EN_CONSTRUCTION` reste inchangé.

---

## 9. Découpage en phases (proposé)

- **Phase 1** — Programme Télé + entités `Game`/`GameResult`/`GameVehicleOutcome` (champ
  `becameWreck` seul) + Points de Championnat dérivés + classement. Frontend : `SeasonProgram`,
  `GameResultWizard` (étapes 1-2), `Standings`.
- **Phase 2** — Cagnotte (`CampaignTransaction`) + Atelier (`TeamWorkshop`, Mise à la Casse,
  achats via configurateur sur budget dérivé).
- **Phase 3** — Dégâts & Séquelles : résolveur d'Épave serveur, décorateurs de séquelles,
  soft-delete (`lostInGameId`), `VehicleSequela`. `GameResultWizard` étape 3.
- **Phase 4** — Points de Résistance (`ResistanceContact`, compteur secret).

---

## 10. Fichiers clés à modifier / créer

**Backend (NestJS)** :
- Nouveau module `game/` : `game.entity.ts`, `game-result.entity.ts`,
  `game-vehicle-outcome.entity.ts`, `game.service.ts`, `game.controller.ts`, DTOs. À importer
  dans `app.module.ts` + ajouter aux entités TypeORM.
- Nouveau résolveur : `game/wreck-resolver.service.ts` (+ spec — cœur de risque).
- Étendre `apps/backend/src/app/vehicle/vehicle.entity.ts` (`lostInGameId` sur `Vehicle`,
  `Weapon`, `VehicleImprovement`) + nouvelle entité `VehicleSequela`.
- Étendre `apps/backend/src/app/vehicle/improvement-decorators.ts` +
  `improvement-decorator.factory.ts` (REGISTRE) : décorateurs de séquelles structurelles.
- Étendre `apps/backend/src/app/vehicle/vehicle-build.factory.ts` : empiler les séquelles.
- Nouveau `campaign/` (ou dans `season/`) : `campaign-transaction.entity.ts`,
  `resistance-contact.entity.ts`, service de cagnotte dérivée + workshop.
- `apps/backend/src/app/vehicle/vehicle.service.ts` : budget validé = cagnotte dérivée si le
  véhicule est en campagne (`getRemainingBudget`).

**Frontend (Angular)** :
- `apps/frontend/src/app/seasons/` : composants ci-dessus + services.
- Réutiliser `apps/frontend/src/app/teams/vehicle-configurator/`.

**Données / règles** :
- Enums scénarios (5 Événements Télévisés + 5 Escarmouches sur les Terres Dévastées), Tableau
  des Épaves (9 lignes, p.168), Séquelles (10 types, p.169). **Encodés côté backend (TS)**, pas
  en YAML — ce sont des *règles*, pas du catalogue achetable.

---

## 11. Tests (règle projet : module NestJS → tests service + controller)

Priorité au **risque** :
- `wreck-resolver.service.spec.ts` : D6 + chocs + modificateur de poids, Maintenu par la
  Rouille (2 lancers), Légende Vivante (forçage à 1), chaque ligne du Tableau des Épaves.
- Décorateurs de séquelles : `improvement-decorators.spec.ts` (étendu) — Siège irrécupérable
  borné à 1.
- Calculs dérivés : championnat (classement + exploits), cagnotte (initial + journal), chocs
  (outcomes − séquelles), résistance.
- Controller : câblage des endpoints, accès organisateur, soft-delete filtré.

---

## 12. Vérification end-to-end (quand l'implémentation aura lieu)

1. `npx nx test backend` — résolveur, décorateurs, calculs dérivés verts.
2. `npx nx test frontend` — composants campagne (wizard, atelier, standings).
3. Manuel via `./dev.sh` :
   - Créer une saison, l'engager `EN_COURS`, définir un Programme (2 Événements).
   - Enregistrer une partie : saisir classement + exploits + cocher une Épave → vérifier que
     les Points de Championnat, la cagnotte et les Chocs se recalculent correctement, et que le
     résultat du D6 Épave s'affiche.
   - Atelier : acheter une amélioration (cagnotte décroît), Mise à la Casse (cagnotte remonte de
     la moitié), vérifier la limite de 8 véhicules.
   - Vérifier le soft-delete : un véhicule « pilote mort » disparaît des vues actives mais la
     cagnotte passée reste cohérente.
4. Mettre à jour `docs/spec/SEASONS.md`, `docs/spec/VEHICLES.md`, `ARCHITECTURE.md`,
   `docs/COMPONENTS.md` après chaque phase.

---

## 13. Hors périmètre / reporté

- **Avantages achetables** individuellement (p.170) — nécessiterait un nouveau catalogue YAML
  + entité (cf. D7).
- **Compagnon en direct** pendant la partie (Votes du Public, Jetons Sabotage en temps réel,
  prix spéciaux, bonus de handicap) — l'appli reste un carnet d'après-partie (cf. D2).
- **Équipe jouable dans plusieurs saisons** simultanément (snapshot) — écarté par D3.
