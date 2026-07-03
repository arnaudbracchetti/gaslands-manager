---
name: ddd
description: "Guide de conception Domain-Driven Design (théorie DDD + règles de conception générales, mode brainstorming). Agnostique de toute stack. Invoquer avant d'écrire du code impliquant des règles métier ou un nouvel agrégat."
---

# Skill — Domain-Driven Design (mode brainstorming)

## Quand invoquer ce skill

- Avant d'écrire la moindre ligne de code pour un module portant des règles métier
- Quand on débat "où mettre cette règle métier ?" (service ? entité ? use case ?)
- Quand on ajoute une nouvelle entité ou relation qui touche un agrégat existant
- Quand on sent qu'un service grossit et devient flou dans ses responsabilités

## Cadrage

Ces patterns tactiques vivent à l'intérieur d'un **contexte délimité** (bounded context) : noms
et règles n'y sont non-ambigus que dans ses frontières. Le context mapping entre plusieurs
contextes est hors périmètre de ce skill — pertinent seulement pour un système multi-domaines.

---

## Comportement attendu

**Ne pas affirmer — explorer.** Ce skill conduit un dialogue de conception avec l'utilisateur. Chaque phase est une conversation, pas un exposé. Utiliser `AskUserQuestion` dès qu'un choix peut être formulé comme options concrètes. Une seule question à la fois.

---

## Phase 1 — Comprendre la feature

Commencer par lire le code et la spécification liés à la demande. Puis poser une première question ouverte pour cadrer :

> "Peux-tu décrire en une phrase ce que doit faire cette nouvelle fonctionnalité ?"

**Établir le vocabulaire.** Avant de parler de frontières techniques, fixer les mots du métier :

> "Comment le métier nomme-t-il cette chose ? Quels sont ses états et ses actions, dans ses
> propres termes ?"

Réutiliser **ces mots exacts** (pas de traduction technique) pour les noms de classes, méthodes
et événements tout au long du design — c'est le langage ubiquitaire (voir
[theory/concepts.md](theory/concepts.md)).

Ensuite poser, **avec AskUserQuestion** :

```
Question : "Cette fonctionnalité introduit-elle quelque chose de nouveau dans le domaine ?"
Options :
  - Un nouvel agrégat (entité avec son propre cycle de vie)
    → une entité qui peut exister indépendamment (ex : une commande, un compte)
  - Une nouvelle règle dans un agrégat existant
    → ex : nouvelle contrainte ou nouvelle action sur un agrégat déjà en place
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
    → signe d'une entité enfant (ex : une ligne de commande dépend de sa commande)
  - Ça dépend d'une relation que je ne maîtrise pas encore
    → on explore ensemble
```

**2b. Test des invariantes**

Demander à l'utilisateur d'écrire 1 à 3 règles qui ne doivent jamais être violées, en langage simple. Exemples à proposer pour guider :

- "Le total ne dépasse jamais le plafond"
- "Le statut ne peut progresser que dans un sens"
- "Un champ X ne peut pas changer une fois Y rempli"

Puis poser :

```
Question : "Qui possède les données nécessaires pour vérifier ces règles ?"
Options :
  - L'entité elle-même (ses propres champs suffisent)
    → les invariantes vont dans le domaine — méthodes de l'agrégat
  - Elle a besoin de données d'une autre entité
    → mauvaise frontière, il faut redesigner l'agrégat
  - C'est une règle de coordination entre entités
    → ça va dans un use case (orchestration), pas dans le domaine
```

**2c. Test de cascade**

```
Question : "Que se passe-t-il si le parent est supprimé ?"
Options :
  - L'enfant est supprimé en cascade
    → confirme que c'est une entité enfant
  - L'enfant survit indépendamment
    → confirme que c'est un agrégat racine séparé
  - La relation est plus complexe (référence optionnelle, nullable)
    → explorer ensemble
```

### Si nouvelle règle dans un agrégat existant

Demander d'abord de lister les agrégats existants, puis poser :

```
Question : "Dans quel agrégat cette règle doit-elle vivre ?"
→ Choisir l'agrégat qui POSSÈDE toutes les données nécessaires à la règle.
  Si aucun agrégat existant ne possède ces données, c'est peut-être un nouvel
  agrégat (ou une mauvaise frontière — revenir à la Phase 2a).
```

Puis demander : "Peux-tu formuler la règle en une phrase ? Ex : 'On ne peut pas faire X si Y est vrai.'"

### Si requête / lecture

```
Question : "Quel type de read model faut-il ?"
Options :
  - Un DTO simple retourné par une requête directe (pas d'agrégat chargé)
    → ex : une liste avec un compteur agrégé
  - Un calcul dérivé depuis un agrégat déjà chargé
    → ex : un solde restant calculé depuis l'agrégat en mémoire
  - Une jointure entre plusieurs entités
    → requête directe, read model dédié
```

---

## Phase 3 — Cartographier les opérations

Une fois le domaine identifié, lister ensemble les opérations. Proposer un tableau à compléter collaborativement :

| Opération | Commande ou requête ? | Charge l'agrégat complet ? | Use case ou requête directe ? |
|-----------|----------------------|---------------------------|-------------------------------|
| *(exemples à remplir avec l'utilisateur)* | | | |

Poser pour chaque opération ambiguë :

```
Question : "Cette opération mute-t-elle l'état du domaine ?"
Options :
  - Oui (créer, modifier, supprimer, valider, changer un statut)
    → Commande : charger l'agrégat → muter → sauvegarder
  - Non (lire, lister, calculer sans effet de bord)
    → Requête : lecture directe → DTO → pas d'agrégat
```

---

## Phase 4 — Définir l'interface de repository

Demander :

> "Pour chaque commande identifiée, de quoi le use case a-t-il besoin du repository ?"

Guider vers les méthodes nécessaires :
- `findById(id)` → charge l'agrégat complet (pour toute commande sur l'agrégat)
- `findByChildId(childId)` → localise l'agrégat via un de ses enfants (voir ci-dessous)
- `findSummaries(...)` → liste légère (requête directe, pas d'agrégat)
- `save(aggregate)` → persiste l'agrégat entier (avec ses enfants)
- `remove(id)` → suppression

```
Question : "Y a-t-il des cas où on accède à l'agrégat via un de ses enfants
            (ex : 'trouve la commande qui contient cette ligne') ?"
Options :
  - Oui — résoudre d'abord l'id de la RACINE, puis recharger l'agrégat complet par cet id.
    → charger directement "par l'enfant" tend à hydrater un agrégat partiel (piège).
  - Non — on accède toujours par l'id de la racine.
    → plus simple, findById suffit.
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
5. Inversion de dépendance : le domaine définit les interfaces (repository, accès externe) ; l'infrastructure les implémente. Le domaine reste **sans framework**.

---

## Phase 6 — Documenter

Une fois le design validé :

1. Écrire un document de conception (design doc) reprenant le design complet.
2. Mettre à jour la documentation d'architecture si un nouveau module/agrégat est créé.
3. Mettre à jour le diagramme de domaine (agrégats, entités, relations).

Demander :

> "Je peux écrire le document de conception maintenant. Tu veux qu'on continue directement vers l'implémentation ensuite ?"

---

## Règles de conception transversales

Au-delà de la délimitation de l'agrégat, appliquer ces règles pendant la conception et la revue. Chaque règle = un principe + le piège qu'il évite.

1. **Traduire l'erreur domaine à la frontière avec un `catch` discriminé.** Le domaine lève une exception de domaine ; la couche appelante la traduit en erreur de transport (ex. 400). Jamais un `catch` aveugle (qui avale aussi « introuvable » / « conflit » / un bug en une erreur générique), jamais un `catch` absent (qui laisse fuir l'erreur domaine en 500). Discriminer explicitement : *si c'est une erreur domaine → traduire, sinon → propager*.
2. **Une garde vit sur l'objet qui possède l'état**, pas dupliquée chez chaque appelant. Si deux use cases répètent le même « si l'état n'est pas X, refuser », cette garde appartient à l'agrégat/entité concerné(e).
3. **Déplacer une règle dans le domaine sans perdre de précondition.** En remontant une règle depuis un service/use case vers l'agrégat, vérifier que le nouvel emplacement dispose de *toutes* les données de l'ancien contrôle — un validateur partiel qui remplace un validateur complet est une régression silencieuse.
4. **Le domaine ne dépend d'aucun framework.** Tout helper, fabrique ou registre réutilisé par l'agrégat doit être pur (aucun décorateur ni annotation de framework). Si une fabrique n'a pas de dépendance, en faire une fonction/méthode statique pure — pas un service géré par le conteneur.
5. **Supprimer le code mort qui peut contourner l'agrégat.** Un service qui écrit la persistance hors de la racine (ex. un `update` par affectation directe des champs) court-circuite les invariants — c'est un danger latent, même s'il n'est plus appelé aujourd'hui.
6. **Un Value Object possède ses conversions de données brutes.** Les casts / accès aux données brutes du catalogue vivent *dans* le VO qui possède le type. N'exposer un accès brut (`toRaw()`) qu'au collaborateur qui en a légitimement besoin, jamais par commodité.
7. **Au mapping domaine ↔ persistance, préserver l'identité** des entités enfants. Sans l'`id` d'origine, le store ne distingue plus création et mise à jour → doublons ou écrasements silencieux.
8. **Un domaine sans framework se teste trivialement.** `new Aggregate(...)`, appeler la méthode, asserter l'invariant — sans mock ni base de données. C'est le retour sur investissement direct de la règle 4 (aucune dépendance à un framework) et de l'inversion de dépendance (Phase 5, point 5) : si un test de domaine a besoin d'un mock, une dépendance s'est glissée là où elle ne devrait pas être.

---

## Principes à respecter pendant tout le brainstorming

- **Une question à la fois** — ne pas empiler plusieurs questions dans un message
- **AskUserQuestion quand c'est possible** — formulaire interactif plutôt que texte libre
- **Proposer des exemples concrets** tirés du domaine de l'utilisateur pour ancrer les concepts abstraits
- **Ne pas coder avant validation** — le brainstorming se termine par un design documenté, pas par du code
- **YAGNI** — éliminer activement ce qui n'est pas nécessaire pour la feature actuelle
- **Reformuler ce qu'on a compris** après chaque réponse, avant de poser la question suivante

---

## Références

| Sujet | Fichier |
|-------|---------|
| Concepts DDD (agrégat, entité, VO, use case, repository, domain event) | [theory/concepts.md](theory/concepts.md) |
| Comment identifier et délimiter un agrégat + anti-patterns | [theory/aggregate-design.md](theory/aggregate-design.md) |
| CQRS léger — commandes vs requêtes, read models | [theory/cqrs.md](theory/cqrs.md) |
