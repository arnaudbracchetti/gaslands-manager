---
name: todo
description: "Traite les commentaires TODO/FIXME du code un par un : recense, analyse (répond aux TODO-questions), demande avant chaque correction, puis supprime le commentaire une fois traité. Invoquer pour « traiter/nettoyer les TODO »."
---

# Skill — Traiter les commentaires TODO

## Quand invoquer ce skill

- « Traite / nettoie les TODO » (ou FIXME) du code
- Apurer la dette de commentaires laissés en cours de développement
- Reprendre une question de conception notée en commentaire et la trancher

Ce skill est **agnostique de la stack** : il ne présume aucun outil de test/build
particulier — il les découvre depuis le dépôt.

---

## Comportement attendu

**Ne jamais corriger en silence.** Pour chaque TODO : analyser d'abord, présenter le
constat, **puis demander** avant toute modification. Un TODO à la fois. Utiliser
`AskUserQuestion` dès qu'une décision peut être formulée en options concrètes.

Un TODO n'est pas toujours une tâche : c'est souvent **une question** laissée par
l'auteur. Dans ce cas, on **y répond** — avec un raisonnement motivé — puis on
**enchaîne** une ou plusieurs questions pour décider quoi faire de cette réponse.

---

## Phase 1 — Recenser

Rechercher `TODO`/`FIXME` dans les **répertoires de sources** du dépôt, en **excluant le
bruit** : dépendances (`node_modules`, `vendor`, `.venv`…), sorties de build (`dist`,
`build`, `target`, `test-output`…) et rapports/artefacts générés (une recherche naïve
remonte souvent des mégaoctets de HTML minifié de rapports — les exclure).

Adapter les dossiers et exclusions à l'arborescence réelle du projet :

```bash
grep -rn -E "TODO|FIXME" <dossiers-sources> --exclude-dir=node_modules --exclude-dir=dist
```

Puis :
- **Lister** les TODO trouvés à l'utilisateur (fichier:ligne + texte).
- **Proposer un ordre** de traitement : du plus simple/localisé (erreur évidente,
  renommage) au plus impactant (changement de comportement, refactor multi-fichiers).

---

## Phase 2 — Classer et traiter chaque TODO

Classer chaque TODO dans l'un des quatre types, et adopter la conduite associée :

### 1. Question de conception (« ne faut-il pas plutôt… ? »)
- **Y répondre** de façon motivée (règles métier, contraintes techniques, cohérence).
- **Enchaîner** avec `AskUserQuestion` pour décider de la suite — car la réponse ouvre
  souvent un choix (changer le comportement ? garder ? refactorer ?).
- Exemple vécu : *« le reset ne doit-il pas remettre wallet à `remainingBudget` ? »* →
  réponse (oui, plus fidèle aux règles) → question à l'utilisateur : adopter
  `remainingBudget` ou conserver `cans` ?

### 2. Bug / erreur signalée (« VSCode indique une erreur ici »)
- **Diagnostiquer la cause réelle** (ne pas se contenter de faire taire l'outil).
- Proposer le correctif, demander confirmation, appliquer.
- Exemple vécu : type de retour incohérent (`{ events, outcome }` attendu, `{ events }`
  renvoyé) → corriger le type déclaré.

### 3. Refactor / style (« utiliser un type/enum plutôt qu'une chaîne »)
- **Évaluer si le reproche est fondé** (parfois le code est déjà type-safe).
- S'il l'est ou améliore la cohérence du projet, proposer et demander (décision de style).
- Chercher les **conventions existantes** du dépôt avant de proposer une forme.

### 4. Réflexion déjà résolue / note obsolète
- **Expliquer pourquoi l'état actuel est correct** (ou pourquoi la note ne vaut plus).
- Pas de changement de code — seule la suppression du commentaire s'impose (Phase 3).

---

## Phase 3 — Appliquer & supprimer le commentaire

Une fois l'accord obtenu :
1. **Appliquer** le correctif décidé.
2. **Supprimer le commentaire TODO** — c'est le but : un TODO traité ne doit pas rester.
   - Si c'était une question de conception restée **sans changement de code**, le
     remplacer par une **brève explication** de la décision (pourquoi c'est ainsi),
     plutôt que de laisser un vide muet.
3. **Mettre à jour les commentaires voisins** devenus faux à cause du changement.

---

## Phase 4 — Vérifier

Quand un correctif touche le **comportement** (pas un simple commentaire) :

- **Découvrir la commande de vérification du projet** depuis le dépôt plutôt que de la
  présumer : scripts `package.json`, `Makefile`, `justfile`, `README`/`CONTRIBUTING`,
  configuration CI. Puis lancer la suite de tests du module concerné et, si pertinent,
  la compilation/typage.
- **Ajuster les tests et helpers qui encodaient l'ancien comportement** : renommer les
  titres de tests devenus faux, mettre à jour les valeurs attendues. Un changement de
  comportement volontaire qui casse un test signifie que le test doit suivre — pas que le
  changement est faux.

---

## Garde-fous

- Traiter les TODO **strictement dans le périmètre demandé** — ne pas en profiter pour
  toucher au reste.
- **Ne pas valider (commit) sans demande explicite** de l'utilisateur.
- Si le dépôt est sous contrôle de version, **proposer de répartir en commits distincts**
  quand plusieurs natures de changement coexistent (refactor / correctif / changement de
  comportement) — elles se relisent mieux séparément.
