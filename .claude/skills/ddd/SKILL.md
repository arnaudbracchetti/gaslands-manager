---
name: ddd
description: "Guide de conception Domain-Driven Design pour Gaslands Manager — théorie DDD + patterns NestJS du projet. Invoquer avant toute nouvelle fonctionnalité backend."
---

# Skill — Domain-Driven Design (mode brainstorming)

## Quand invoquer ce skill

- Avant d'écrire la moindre ligne de code pour un nouveau module backend
- Quand on débat "où mettre cette règle métier ?" (service ? entité ? use case ?)
- Quand on ajoute une nouvelle entité ou relation qui touche un agrégat existant
- Quand on sent qu'un service grossit et devient flou dans ses responsabilités

---

## Comportement attendu

**Ne pas affirmer — explorer.** Ce skill conduit un dialogue de conception avec l'utilisateur. Chaque phase est une conversation, pas un exposé. Utiliser `AskUserQuestion` dès qu'un choix peut être formulé comme options concrètes. Une seule question à la fois.

---

## Phase 1 — Comprendre la feature

Commencer par lire les fichiers du projet liés à la demande (spéc, code existant, ARCHITECTURE.md). Puis poser une première question ouverte pour cadrer :

> "Peux-tu décrire en une phrase ce que doit faire cette nouvelle fonctionnalité ?"

Ensuite poser, **avec AskUserQuestion** :

```
Question : "Cette fonctionnalité introduit-elle quelque chose de nouveau dans le domaine ?"
Options :
  - Un nouvel agrégat (entité avec son propre cycle de vie)
    → ex : Season, Team, Game — peuvent exister indépendamment
  - Une nouvelle règle dans un agrégat existant
    → ex : nouvelle contrainte sur Vehicle, nouvelle action sur Team
  - Une lecture / requête (pas de mutation d'état)
    → ex : filtrer, calculer un total, agréger des données
  - Je ne sais pas encore
    → on va explorer ensemble
```

---

## Phase 2 — Identifier les contours du domaine

Selon la réponse de la Phase 1, poser les questions de conception adaptées **une par une**.

### Si nouvel agrégat potentiel

Poser successivement (une question à la fois) :

**2a. Test du cycle de vie**

```
Question : "Cette entité peut-elle exister sans être rattachée à une autre ?"
Options :
  - Oui — elle a son propre cycle de vie (création, évolution, suppression indépendants)
    → signe d'un agrégat racine
  - Non — elle n'a pas de sens sans son parent
    → signe d'une entité enfant (ex : Vehicle dépend de Team)
  - Ça dépend d'une relation que je ne maîtrise pas encore
    → on explore ensemble
```

**2b. Test des invariantes**

Demander à l'utilisateur d'écrire 1 à 3 règles qui ne doivent jamais être violées, en français simple. Exemples à proposer pour guider :

- "Le coût total ne dépasse jamais le budget"
- "Le statut ne peut progresser que dans un sens"
- "Un champ X ne peut pas changer une fois Y rempli"

Puis poser :

```
Question : "Qui possède les données nécessaires pour vérifier ces règles ?"
Options :
  - L'entité elle-même (ses propres champs suffisent)
    → les invariantes vont dans domain/ — méthodes de l'agrégat
  - Elle a besoin de données d'une autre entité
    → mauvaise frontière, il faut redesigner l'agrégat
  - C'est une règle de coordination entre entités
    → ça va dans un use case (orchestration), pas dans le domaine
```

**2c. Test de cascade**

```
Question : "Que se passe-t-il si le parent est supprimé ?"
Options :
  - L'enfant est supprimé en cascade (OneToMany, CASCADE delete)
    → confirme que c'est une entité enfant
  - L'enfant survit indépendamment
    → confirme que c'est un agrégat racine séparé
  - La relation est plus complexe (nullable FK, relation optionnelle)
    → explorer ensemble
```

### Si nouvelle règle dans un agrégat existant

Poser :

```
Question : "Dans quel agrégat existant cette règle doit-elle vivre ?"
Options :
  - Team (racine — véhicules, armes, budget, sponsor)
  - Season (saisons, participants, transitions d'état)
  - Game (parties du programme télé)
  - Aucun des trois — peut-être un nouvel agrégat
```

Puis demander : "Peux-tu formuler la règle en une phrase ? Ex : 'On ne peut pas faire X si Y est vrai.'"

### Si requête / lecture

```
Question : "Quel type de read model faut-il ?"
Options :
  - Un DTO simple retourné par une requête SQL directe (pas d'agrégat chargé)
    → ex : TeamSummaryDto via COUNT SQL
  - Un calcul dérivé depuis un agrégat déjà chargé
    → ex : remainingBudget calculé depuis Team chargé en mémoire
  - Une jointure entre plusieurs entités
    → requête SQL directe, read model dédié
```

---

## Phase 3 — Cartographier les opérations

Une fois le domaine identifié, lister ensemble les opérations. Proposer un tableau à compléter collaborativement :

| Opération | Commande ou requête ? | Charge l'agrégat complet ? | Use case ou SQL direct ? |
|-----------|----------------------|---------------------------|--------------------------|
| *(exemples à remplir avec l'utilisateur)* | | | |

Poser pour chaque opération ambiguë :

```
Question : "Cette opération mute-t-elle l'état du domaine ?"
Options :
  - Oui (créer, modifier, supprimer, valider, changer un statut)
    → Commande : charger l'agrégat → muter → sauvegarder
  - Non (lire, lister, calculer sans effet de bord)
    → Requête : SQL direct → DTO → pas d'agrégat
```

---

## Phase 4 — Définir l'interface de repository

Demander :

> "Pour chaque commande identifiée, de quoi le use case a-t-il besoin du repository ?"

Guider vers les méthodes nécessaires :
- `findByIdForUser(id, userId)` → charge l'agrégat complet (commandes sur l'agrégat)
- `findByChildId(childId, userId)` → localise l'agrégat via un enfant (double-find — cf. ARCHITECTURE.md §3.4)
- `findSummariesForUser(userId)` → liste légère (requête directe)
- `save(aggregate)` → persistance avec cascade TypeORM
- `remove(id, userId)` → suppression

```
Question : "Y a-t-il des cas où on accède à l'agrégat via un de ses enfants (ex : 'trouve l'équipe qui contient ce véhicule') ?"
Options :
  - Oui — il faudra un double-find (résoudre l'ID parent d'abord, puis recharger)
    → cf. ARCHITECTURE.md §3.4 — piège TypeORM sur les relations hydratées
  - Non — on accède toujours par l'ID de la racine
    → plus simple, findByIdForUser suffit
```

---

## Phase 5 — Présenter le design et valider

Présenter le design en **petites sections** (200–300 mots), en demandant après chaque section :

> "Est-ce que ça correspond à ce que tu as en tête, ou il y a quelque chose à ajuster ?"

Sections à couvrir :
1. Structure de l'agrégat (racine + entités enfants + value objects)
2. Liste des invariantes et où elles vivent
3. Tableau commandes / requêtes
4. Interface de repository
5. Câblage NestJS (tokens, useFactory — cf. [project/nestjs-patterns.md](project/nestjs-patterns.md))

---

## Phase 6 — Documenter

Une fois le design validé :

1. Écrire `docs/plans/YYYY-MM-DD-<feature>-design.md` avec le design complet
2. Mettre à jour `docs/ARCHITECTURE.md` si un nouveau module est créé
3. Mettre à jour `docs/DOMAIN_MODEL.md` avec les diagrammes Mermaid

Demander :

> "Je peux écrire le document de conception maintenant. Tu veux qu'on continue directement vers l'implémentation ensuite ?"

---

## Principes à respecter pendant tout le brainstorming

- **Une question à la fois** — ne pas empiler plusieurs questions dans un message
- **AskUserQuestion quand c'est possible** — formulaire interactif plutôt que texte libre
- **Proposer des exemples concrets** tirés du projet (Team, Vehicle, Season) pour ancrer les concepts abstraits
- **Ne pas coder avant validation** — le brainstorming se termine par un design documenté, pas par du code
- **YAGNI** — éliminer activement ce qui n'est pas nécessaire pour la feature actuelle
- **Reformuler ce qu'on a compris** après chaque réponse, avant de poser la question suivante

---

## Références

| Sujet | Fichier |
|-------|---------|
| Concepts DDD (agrégat, entité, VO, use case, repository) | [theory/concepts.md](theory/concepts.md) |
| Comment identifier et délimiter un agrégat | [theory/aggregate-design.md](theory/aggregate-design.md) |
| Patterns NestJS du projet (tokens, useFactory, DomainException) | [project/nestjs-patterns.md](project/nestjs-patterns.md) |
| CQRS léger — commandes vs requêtes, read models | [project/cqrs-light.md](project/cqrs-light.md) |
| Architecture DDD existante (module `team/`) | [ARCHITECTURE.md §3.4](../../../../docs/ARCHITECTURE.md) |
