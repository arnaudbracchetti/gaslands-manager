# e2e-testing — Écrire un nouveau test

> Chargé par `SKILL.md` pour la branche `new` (générer un test pertinent). Ne contient
> rien sur le lancement/debug de tests existants — cf. `RUNNING.md` pour ça.

## Avant d'écrire quoi que ce soit

1. **Lire `docs/E2E_TESTING.md`** — carte de couverture (quels specs existent, ce
   qu'ils couvrent déjà) et helpers `support/` disponibles. C'est un **document
   vivant**, tenu à jour à chaque ajout de spec/helper (cf. "Mise à jour obligatoire"
   ci-dessous) — toujours le relire à ce moment précis plutôt que de se fier à un
   souvenir d'une session précédente.
2. **Déterminer ce qui a été fait dans la session en cours** : `git status`/`git diff`
   (staged + unstaged) et le contexte de la conversation (quelle fonctionnalité vient
   d'être implémentée/discutée). Si l'utilisateur a précisé une zone fonctionnelle
   explicite, la préférer à la déduction automatique.
3. **Appliquer le cadre de décision e2e-vs-unitaire** ci-dessous : si le changement ne
   le justifie pas, le dire explicitement plutôt que de générer un test inutile.
4. **Décider extension vs nouveau fichier** à partir de la carte de couverture lue en
   (1) : si un spec existant couvre déjà la zone fonctionnelle, étendre son
   `describe` plutôt que d'en créer un nouveau.

## Cadre de décision - e2e ou test unitaire ?

Ce projet n'exige JAMAIS l'e2e par défaut (`docs/ARCHITECTURE.md` §8 : "Tout nouveau
module NestJS → tests unitaires... Tout nouveau service Angular → tests unitaires") -
seulement une poignée de specs e2e existent contre des centaines de tests unitaires.
L'e2e est réservé aux cas où l'unitaire ne peut structurellement rien voir. Questions à
se poser avant d'en ajouter un :

1. **Le risque réel est-il dans l'intégration** (routing Angular, guards, proxy Nx/Angular,
   résolution DI NestJS, vraie base de données) plutôt que dans une règle métier ? Exemple
   vécu dans une session réelle : une nouvelle route avait déjà des tests unitaires 100%
   verts (use case + controller mockés) ; seul le test e2e (vraie requête HTTP + vraie
   base Postgres) a confirmé le câblage réel de bout en bout - et a même révélé une erreur
   de comptage dans la documentation qu'aucun mock n'aurait pu détecter.
2. **Le scénario traverse-t-il plusieurs écrans/navigations** où une rupture de câblage
   casserait silencieusement le parcours, sans qu'aucun test unitaire (qui teste un
   composant ou un use case isolément) ne le voie ?
3. **Le comportement dépend-il du DOM réellement rendu** (visibilité conditionnelle,
   désactivation de bouton) plutôt que de la valeur de retour d'une fonction ? Si c'est
   déjà densément couvert par les tests unitaires de composant Angular existants, l'e2e
   n'ajoute de valeur que sur la CHAÎNE complète, pas sur le composant isolé.
4. **Le cas est-il couvrable par un test unitaire avec mock, à un coût largement
   inférieur** (millisecondes contre 5-30s, sans navigateur ni vraie base, sans la
   flakiness documentée dans `RUNNING.md`) ? Préférer l'unitaire par défaut.
5. **Le résultat dépend-il d'un aléa serveur non seedé** (D6 de la Table des Épaves) ?
   Concevoir le scénario pour rester déterministe, accepter de n'asserter qu'un résultat
   "quelconque", ou ne pas écrire ce cas précis en e2e du tout (cf. Bonnes pratiques
   ci-dessous).
6. **Un spec existant peut-il être étendu** (cf. `docs/E2E_TESTING.md`) plutôt que
   dupliqué depuis une inscription/création de campagne complète ?

## Bonnes pratiques établies dans le code

- **Réutiliser les helpers `support/`** plutôt que dupliquer l'interaction DOM (liste à
  jour dans `docs/E2E_TESTING.md`).
- **Armer `page.waitForResponse(...)` AVANT l'action qui déclenche la requête**, jamais
  après (cf. `waitForEquipmentEvent`) - sinon course possible entre la réponse et
  l'attente.
- **Ne jamais asserter la valeur exacte d'un tirage serveur aléatoire** (D6 de la Table
  des Épaves) : pas de randomizer fixé côté e2e (contrairement aux tests unitaires
  backend, qui utilisent `FixedRandomizer`). Voir `campaign-wreck-designation.spec.ts`
  (accepte "un résultat quelconque est apparu") et `campaign-atelier-sequella.spec.ts`
  (contourne le problème en restant volontairement à chocs=0, aucun tirage nécessaire).
- **`data-testid` seulement quand un sélecteur texte/rôle est ambigu** - convention ad
  hoc documentée localement par helper, pas de règle centrale à respecter.
- **Un spec = un parcours utilisateur cohérent**, pas un test par règle métier isolée -
  ça, c'est le rôle du test unitaire.

## Après avoir écrit le test

1. **Exécuter ce test précis** (`.claude/skills/e2e-testing/quick-e2e.sh -g "<nom>"`,
   cf. `RUNNING.md`) pour vérifier qu'il passe réellement — ne jamais affirmer qu'un
   test généré "devrait passer" sans l'avoir exécuté.
2. **Mise à jour obligatoire de `docs/E2E_TESTING.md`** — ce fichier est un document
   vivant, pas une doc figée : le skill doit le maintenir à jour lui-même, pas attendre
   qu'un humain le fasse.
   - Nouveau fichier de spec : ajouter une ligne à la carte de couverture (nom du
     fichier + ce qu'il couvre).
   - Spec existant étendu : mettre à jour la description de la ligne existante si le
     périmètre couvert a changé.
   - Nouveau helper ajouté à `support/*.ts` : ajouter une ligne à la table des helpers
     partagés.
   - Nouveau `data-testid` ajouté à un template pour fiabiliser un sélecteur : noter
     lequel et dans quel fichier, à côté des exemples déjà listés.
3. Rapporter : fichier(s) créé(s)/modifié(s) (spec **et** `docs/E2E_TESTING.md`), ce
   que le test couvre, résultat du run.
