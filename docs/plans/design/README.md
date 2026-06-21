# Handoff : Feature Saisons — Gaslands

## Vue d'ensemble

Ce package contient les wireframes lo-fi de la feature **Saisons** (ligue de parties Gaslands).
Il couvre l'ensemble du périmètre défini dans `saisons-design.md` : création, invitation par code,
gestion des participants, cycle de vie de la saison, et ajout de parties.

## À propos des fichiers de design

Les fichiers HTML inclus (`Wireframes Saisons.html`, `wf-styles.css`, `wf-nav.js`) sont des
**références de design lo-fi** — des wireframes croquis montrant la structure, les parcours
et les décisions UX prises lors des sessions de design. Ce **ne sont pas** des fichiers à
copier en production.

La tâche est de **recréer ces écrans dans la codebase Angular/NestJS existante**, en suivant
les conventions établies (`team.model.ts`, `teams.service.ts`, `team-form`, etc.) et le design
system en place.

## Fidélité

**Lo-fi (wireframes).** La structure, les parcours, les états et les libellés sont définitifs.
Le style visuel (couleurs, typographie, espacement, icônes) est à appliquer depuis le design
system existant.

---

## ⚠️ Divergences par rapport au doc de conception original

Ces décisions ont été prises pendant la session de wireframing et **remplacent** le doc :

| Point | Doc original | Décision wireframe |
|---|---|---|
| Équipe de l'organisateur | obligatoire à la création | **optionnelle** — l'orga peut gérer sans équipe |
| Création d'équipe | hors scope de la modale | **création à la volée** depuis la modale de saison |
| Transitions d'état | séquentielles, irréversibles | **bidirectionnelles** — retour arrière autorisé |
| Flux "rejoindre" | page unique | **3 étapes** : saisie code → infos + équipe → confirmation |

---

## Écrans et vues

### 1. `/seasons` — Liste des saisons

**Route :** `/seasons` | **Composant :** `Seasons` (smart)

**Objectif :** point d'entrée unique regroupant toutes les saisons où l'utilisateur est impliqué.

**Layout : grille de cartes (2 colonnes desktop)**

Chaque carte affiche :
- Nom de la saison (titre)
- Badge d'état : `EN_CONSTRUCTION` / `EN_COURS` / `TERMINÉE`
- Badge de rôle :
  - `★ Organisateur` si `isOrganizer=true`
  - `▲ Participant · [Nom équipe]` si `status=VALIDATED`
  - `◷ En attente` si `status=PENDING`
- Alerte `"X demandes à valider"` si l'utilisateur est organisateur et qu'il existe des participants `PENDING`

**Actions globales (en-tête de page) :**
- `+ Créer une saison` → ouvre la modale de création
- `⌗ Rejoindre via code` → ouvre la modale de saisie de code (étape 1 du flux rejoindre)

**Données requises :**
- `GET /api/seasons` — saisons où je suis participant `VALIDATED`
- `GET /api/seasons/pending` — mes demandes en attente (`PENDING`)
- `GET /api/seasons/organizing/pending-requests` — mes saisons avec des `PENDING` à valider

---

### 2. Modale — Créer une saison

**Déclencheur :** bouton `+ Créer une saison` sur `/seasons`

**Champs :**
| Champ | Type | Obligatoire | Notes |
|---|---|---|---|
| Nom de la saison | text input | oui | max 100 caractères |
| Mon équipe engagée | select | **non** | liste de mes équipes ; peut rester vide |

**Action secondaire dans le champ équipe :** lien/bouton `+ Créer une nouvelle équipe` qui ouvre la modale `team-form` (flux imbriqué), puis revient avec la nouvelle équipe sélectionnée.

**Soumission :** `POST /api/seasons` avec `{ name, teamId? }`

**Après création :** rediriger vers `/seasons/:id` — la page s'affiche avec :
- L'organisateur seul dans la liste des participants (déjà `VALIDATED`)
- Si sans équipe : ligne `[Nom utilisateur]` sans équipe mentionnée
- Si avec équipe : ligne `[Nom utilisateur] · [Nom équipe]`
- La carte d'état EN_CONSTRUCTION avec le code d'invitation et le bouton de transition

---

### 3. Flux "Rejoindre via code" — 3 étapes

#### Étape 1 — Saisie du code

**Deux points d'entrée :**

**A) Modale depuis `/seasons`** (bouton `⌗ Rejoindre via code`) :
- Input texte : code d'invitation (ex : `ABCD-1234`)
- Bouton `Valider le code →` → résout le code via `GET /api/seasons/by-code/:code` et navigue vers `/seasons/join/:code`

**B) Lien direct** `/seasons/join/:code` (partagé par l'organisateur) :
- Le code est dans l'URL → saute directement à l'étape 2

#### Étape 2 — Confirmation & choix d'équipe

**Route :** `/seasons/join/:code` | **Composant :** `SeasonJoin` (smart)

Affiche :
- Nom de la saison
- État (`EN_CONSTRUCTION` / `EN_COURS`)
- Organisateur
- Nombre de participants validés
- Select : "Avec quelle équipe ?" — liste de mes équipes non déjà engagées dans cette saison

**Bouton :** `Demander à rejoindre →` → `POST /api/seasons/:id/participants` avec `{ teamId }`

**Cas d'erreur à gérer (page dédiée ou inline) :**
| Cas | Message |
|---|---|
| Code invalide / inexistant | "Code invalide ou expiré" |
| Saison `EN_COURS` ou `TERMINÉE` | "Inscriptions fermées pour cette saison" |
| Déjà participant `VALIDATED` | "Tu es déjà participant de cette saison" |
| Demande `PENDING` existante | "Demande déjà envoyée — en attente de validation" |

#### Étape 3 — Confirmation PENDING

Écran affiché après soumission réussie :
- Message : "Demande envoyée !"
- Rappel : nom de la saison + équipe choisie
- Aperçu de la ligne telle qu'elle apparaîtra dans la liste (`◷ En attente`)
- Bouton `← Retour à mes saisons`

---

### 4. `/seasons/:id` — Détail de la saison

**Route :** `/seasons/:id` | **Composant :** `SeasonDetail` (smart)

**Structure : sections empilées** (pas d'onglets). Scroll vertical naturel.

#### Carte d'état (organisateur uniquement)

Affichée en haut de page, avant toutes les sections. Style : carte avec fond, **visible uniquement si `isOrganizer=true`**.

Contenu de la carte selon l'état :

| État | Contenu | Boutons |
|---|---|---|
| `EN_CONSTRUCTION` | "Inscriptions ouvertes. Valide les demandes avant de lancer." + code `🔗 ABCD-1234` | `Lancer → EN_COURS` |
| `EN_COURS` | "Inscriptions fermées. Les parties restent ajoutables." + code | `← Rouvrir EN_CONSTRUCTION` · `Clôturer → TERMINÉE` |
| `TERMINÉE` | "Saison archivée. Lecture seule." | `← Rouvrir EN_COURS` |

**Transitions :** toutes bidirectionnelles. Une **confirmation** est requise avant chaque transition (modale ou dialog natif). Appel : `PUT /api/seasons/:id/state` avec `{ state: newState }`.

Pour les participants non-organisateurs : afficher uniquement l'état courant + "Gérée par [Nom orga]", sans code ni bouton.

#### Section Participants

Header : `Participants (N validés · M en attente)`

Chaque ligne affiche :
- Avatar initiales
- `[Prénom] · [Nom équipe]` — si l'utilisateur n'a pas d'équipe engagée : `[Prénom]` seul
- Badge de rôle/état

Actions par ligne (organisateur uniquement) :

| Ligne | Actions disponibles |
|---|---|
| Soi-même (organisateur) | aucune action |
| Autre organisateur | `Retirer` |
| Participant `VALIDATED` | `Promouvoir` · `Retirer` |
| Participant `PENDING` | `Valider` · `Refuser` |

**Endpoints :**
- `PUT /api/seasons/:id/participants/:pid/validate` (`{ accept: true/false }`)
- `PUT /api/seasons/:id/participants/:pid/promote`
- `DELETE /api/seasons/:id/participants/:pid`

**Garde-fou :** désactiver `Retirer` sur la propre ligne de l'organisateur s'il est le seul organisateur restant.

#### Section Parties

Header : `Parties (N)` + bouton `+ Ajouter` (organisateur uniquement)

Chaque ligne :
- Nom de la partie
- Date prévue (si renseignée) + nombre d'équipes engagées

Actions par ligne (organisateur uniquement) : `Modifier` · `Supprimer`

**Endpoint :** `GET /api/seasons/:id/games`

#### Section Paramètres (organisateur uniquement)

- Bouton `Renommer` (modale simple, `PATCH /api/seasons/:id`)
- Bouton `Supprimer la saison` (confirmation requise, `DELETE /api/seasons/:id`, cascade)

---

### 5. Modale — Ajouter / Modifier une partie (game-form)

**Déclencheur :** `+ Ajouter` ou `Modifier` depuis la section Parties du détail.

**Champs :**
| Champ | Type | Obligatoire | Notes |
|---|---|---|---|
| Nom | text input | oui | ex : "Manche 3 — Démolition" |
| Date prévue | date picker | non | `scheduledAt` nullable |
| Équipes engagées | multi-select / checkboxes | non | **uniquement les `SeasonParticipant` avec `status=VALIDATED`** |

**Endpoints :**
- Créer : `POST /api/seasons/:id/games` avec `{ name, scheduledAt?, participantIds: number[] }`
- Modifier : `PUT /api/seasons/:id/games/:gameId`
- Supprimer : `DELETE /api/seasons/:id/games/:gameId`

---

## Interactions & comportements transverses

### Accès et guards
- Toutes les routes sous `authGuard`
- `/seasons/:id` : accessible aux participants `VALIDATED` uniquement. Les `PENDING` n'y ont pas accès (hors scope — traiter comme un accès interdit silencieux, rediriger vers `/seasons`)
- Les actions organisateur : vérification côté backend + masquage côté front si `isOrganizer=false`

### États vides
- `/seasons` sans aucune saison → message d'invitation à créer ou rejoindre
- Section Parties vide → message "Aucune partie pour l'instant"
- Section Participants vide (impossible — au moins l'orga) → n/a

### Feedback utilisateur
- Toast/snackbar sur chaque action réussie (validation, transition, création…)
- Spinner pendant les appels API
- Désactivation des boutons pendant la soumission

---

## Gestion d'état frontend

```
SeasonListState {
  mySeasons: SeasonResponseDto[]       // GET /api/seasons
  pendingSeasons: SeasonResponseDto[]  // GET /api/seasons/pending
  pendingRequests: SeasonResponseDto[] // GET /api/seasons/organizing/pending-requests
}

SeasonDetailState {
  season: SeasonResponseDto
  participants: SeasonParticipantResponseDto[]
  games: GameResponseDto[]
  myParticipant: SeasonParticipantResponseDto  // ma propre ligne
}
```

---

## Design tokens à appliquer

Appliquer le design system existant. Les valeurs ci-dessous sont celles des wireframes lo-fi — **ne pas les copier telles quelles**, utiliser leurs équivalents dans le DS en place.

| Token wireframe | Rôle |
|---|---|
| `--accent: #b5532a` | couleur principale (organisateur, CTA, état EN_COURS) |
| `--ok: #3c7a4e` | succès, validé |
| `--warn: #c2611f` | alerte, danger, refus |
| `--muted` | texte secondaire, états désactivés |

---

## Fichiers dans ce package

| Fichier | Description |
|---|---|
| `README.md` | ce document |
| `Wireframes Saisons.html` | wireframes interactifs (nav latérale par écran) |
| `wf-styles.css` | styles des wireframes (ne pas réutiliser en prod) |
| `wf-nav.js` | navigation entre écrans des wireframes |
| `saisons-design.md` | document de conception original (modèle de données, routes, DTOs) |
