# Documentation utilisateur — conception

> Conçu via le skill `brainstorming` le 2026-07-16. Implémenté dans la même
> session. Ce document reflète ce qui a été réellement construit (quelques
> détails techniques ont évolué par rapport à la première ébauche validée en
> brainstorming — notés ci-dessous).

## Contexte

Le projet n'avait aucune documentation expliquant aux joueurs comment
utiliser l'application (équipes, construction de véhicule, campagnes,
programme télé, atelier, séquelles...). La seule page existante, `/rules`,
expliquait les règles *du jeu de plateau* Gaslands (sourcées du livre) — un
besoin différent. L'utilisateur cible connaît déjà les règles de Gaslands
mais pas les mécaniques propres au mode campagne de l'application (chocs,
séquelles, revente, points de résistance...).

Objectif : une documentation multi-fichiers dans `content/docs/`, au
découpage compatible avec celui de l'application (pour permettre un lien
d'aide contextuelle par écran), accessible aussi bien globalement (depuis la
home et la navbar) que contextuellement (depuis chaque écran), avec
navigation fluide entre chapitres et ancres internes. Elle **remplace**
entièrement `/rules` — ce n'est plus une doc de règles de jeu, mais une doc
d'usage de l'application.

---

## 1. Découpage en chapitres

Un fichier = une zone fonctionnelle de l'application (pas une notion de
règle du jeu). Dans `content/docs/` :

| Fichier | Contenu |
|---|---|
| `index.md` | Intro : à qui s'adresse cette doc, comment elle est organisée. Pas la liste des chapitres — générée par le composant `Documentation`, cf. §3. |
| `equipes.md` | Créer une équipe, sponsor et son verrouillage, budget, modifier/supprimer |
| `construction-vehicule.md` | Choisir un véhicule, budget d'équipement, armes (orientation, Tourelle ×3), améliorations, avantages, équipement intégré |
| `campagnes.md` | Créer/rejoindre, rôles organisateur/participant, cycle de vie, changer d'équipe engagée, classement, Points de Résistance |
| `programme-tele.md` | Planifier une partie, enregistrer un résultat (wizard 3 étapes : classement → désignation des épaves → Table des Épaves), Journal de partie, limite connue (Escarmouche) |
| `atelier.md` | La cagnotte, achat/revente, annulation vs revente, achat/vente de véhicule, limites connues |
| `sequelles.md` | Les Chocs, échange contre une Séquelle, cas particuliers (Dur à Cuire, Maintenu par la Rouille, Légende Vivante), revente fermée par défaut |

Chaque chapitre décrit le comportement observable de l'application, jamais
les choix d'implémentation ni l'historique des changements. Les limitations
connues (cf. [CAMPAIGN.md](../spec/CAMPAIGN.md#limitations-connues-vérifiées-dans-le-code-le-2026-07-03))
sont mentionnées en langage joueur quand elles affectent un usage courant
(ex. Atelier, Escarmouche) — pas en jargon technique.

---

## 2. Architecture backend

Prolonge `ContentModule` existant (`apps/backend/src/app/content/`) — pas de
nouveau module NestJS.

- **`DocsService`** (`content/docs.service.ts`), pattern singleton en
  mémoire (`OnModuleInit`, même famille que `CatalogService`/
  `ScenarioCatalogService`, cf. ARCHITECTURE.md §3.3) :
  - Au démarrage, lit et parse `content/docs/manifest.yml` (librairie
    `yaml`, `parse()`, déjà en dépendance — utilisée par `CatalogService`)
    → cache en mémoire la liste ordonnée `{ slug, title }[]`.
  - `listChapters(): DocChapter[]` — retourne le cache.
  - `getChapter(slug): Promise<{ html, title }>` — **relit le fichier à
    chaque appel** (pas de cache du contenu) : on peut corriger une phrase
    de documentation sans redémarrer le backend, comme le mécanisme
    `content/` existant.
  - `readFileContent(filename)` (protected, Template Method — même pattern
    que `CatalogService`) est le **seul point d'accès au système de
    fichiers** de toute la classe : `onModuleInit` (manifest) ET
    `getChapter` (un chapitre) passent tous les deux par lui, pour rester
    substituables en test avec un seul point d'override.
- **`content/docs/manifest.yml`** — ordre canonique, source unique de
  vérité pour l'ordre et les titres :
  ```yaml
  - slug: equipes
    title: Équipes
  - slug: construction-vehicule
    title: Construire et équiper un véhicule
  - slug: campagnes
    title: Campagnes
  - slug: programme-tele
    title: Programme Télé
  - slug: atelier
    title: Atelier
  - slug: sequelles
    title: Chocs et Séquelles
  ```
- **Ancres internes** — `marked` (v18, déjà en dépendance) ne génère plus
  d'`id` sur les titres depuis sa v5 (option `headerIds` retirée du cœur,
  vérifié empiriquement). `DocsService.withHeadingIds()` **post-traite le
  HTML rendu** avec une regex (`<(h[1-6])>(.*?)<\/\1>`) plutôt que de passer
  par un renderer `marked` personnalisé — plus simple, et strictement local
  à cette classe (n'affecte pas `ContentService`/`CatalogService`, qui
  utilisent la même fonction `marked` globale sans ce post-traitement).
  *Écart avec l'ébauche brainstorming* : celle-ci envisageait une instance
  `Marked` dédiée avec un renderer personnalisé ; le post-traitement du HTML
  atteint le même résultat (isolation complète des deux autres services)
  avec moins de surface d'API à maîtriser.
  - Slugification : `normalize('NFD')` puis `\p{Diacritic}` (propriété
    Unicode, flag `/u`) pour retirer les accents — préféré à une plage
    `̀-ͯ` tapée à la main, plus lisible et strictement équivalent.
- **`ContentController`** — deux nouvelles routes, déclarées **avant**
  `@Get(':slug')` existant (même piège d'ordre de routes que
  `campaign.controller.ts`, sinon `:slug` capture `"docs"` en premier) :
  - `GET /api/content/docs` → `listChapters()`
  - `GET /api/content/docs/:slug` → `getChapter(slug)`
- `content/regles.md` **supprimé** (remplacé). `content/vehicules.md`/
  `armes.md` **conservés intouchés** — fichiers orphelins réservés au
  backlog catalogue dynamique (`/vehicles`/`/weapons`), hors périmètre ici.

**Tests** : `docs.service.spec.ts`, même stratégie Template Method que
`catalog.service.spec.ts` (sous-classe `TestDocsService` qui surcharge
`readFileContent`, aucun mock de `fs`).

---

## 3. Architecture frontend

Nouveau dossier `apps/frontend/src/app/documentation/` :

- **`Documentation`** (`documentation.ts`, route `/documentation`,
  publique — pas d'`authGuard`, comme `/rules` avant elle) : charge l'intro
  (`GET /api/content/docs/index`) et, **indépendamment et de façon non
  bloquante** (même pattern que `CampaignDetail.standings`, cf.
  COMPONENTS.md), le sommaire (`GET /api/content/docs`) pour générer la
  liste des chapitres programmatiquement (`@for`) — jamais codée en dur
  dans `index.md`.
- **`DocumentationChapter`** (`documentation-chapter/documentation-chapter.ts`,
  route `/documentation/:slug`) : appelle `GET /api/content/docs/:slug`.
  **Point d'implémentation important** : s'abonne à `route.paramMap`
  (Observable), pas `route.snapshot.params` (lu une fois). Angular réutilise
  la même instance de composant quand on navigue d'un chapitre à un autre
  via `DocLinksDirective` (même route paramétrée) — un snapshot lu une seule
  fois dans `ngOnInit` ne verrait jamais le changement de `:slug`, et la
  page resterait bloquée sur le premier chapitre visité.
- **`DocLinksDirective`** (`documentation/doc-links.directive.ts`,
  sélecteur `[appDocLinks]`) — appliquée sur le conteneur `[innerHTML]` des
  deux composants ci-dessus : le contenu injecté n'étant jamais compilé par
  Angular, un `<a>` qu'il contient n'est jamais reconnu par `routerLink`. Un
  seul gestionnaire `(click)` sur le conteneur (délégation d'événement,
  `closest('a')` pour tolérer un clic sur un `<strong>`/`<code>` imbriqué)
  intercepte les liens dont le `pathname` commence par `/documentation` **et
  diffère du `pathname` courant** (et vérifie le même `origin`, défensif),
  `preventDefault()` + `router.navigateByUrl(pathname + hash)`. Les ancres
  `#section` dont le `pathname` est identique à la page courante restent
  **volontairement hors interception** (cf. §3bis, corrigé après un bug
  constaté à la vérification) : le navigateur défile nativement sans
  recharger.
- **Style partagé** — `.markdown-content` (typographie du HTML injecté,
  reprise de l'ancien `rules.scss`, augmentée du style des liens `<a>`
  absent jusque-là) vit en **CSS global** (`apps/frontend/src/styles.scss`),
  pas dans un mixin Sass par composant comme envisagé initialement — cf.
  §3bis point 3, un mixin `@include`-é dans le `.scss` d'un composant reste
  scopé par l'encapsulation de vue Angular, qui n'atteint jamais le contenu
  de `[innerHTML]`. Un seul bloc de règles partagé par `Documentation` et
  `DocumentationChapter`, comme `.navbar` l'est déjà pour la même raison.
- **Fil d'ariane** (`Breadcrumb`, `shared/breadcrumb/`, ajouté après-coup sur
  demande utilisateur) : `Documentation` affiche un fil statique à un seul
  maillon ("Documentation", non cliquable — déjà la racine de la section) ;
  `DocumentationChapter` affiche "Documentation › [titre du chapitre]"
  (`computed()` sur le titre chargé, `'…'` tant qu'il ne l'est pas encore,
  même convention que `AtelierVehiclePage.breadcrumbs`). Remplace l'ancien
  lien "← Retour au sommaire" de `DocumentationChapter`, devenu redondant
  (même destination que le premier maillon du fil).
- **Aide contextuelle** : chaque route pertinente de `app.routes.ts` reçoit
  `data: { docSlug: '...' }` :

  | Route(s) | `docSlug` |
  |---|---|
  | `/teams`, `/teams/:id/edit` | `equipes` |
  | `/teams/:teamId/vehicles/new`, `/teams/:teamId/vehicles/:vehicleId` | `construction-vehicule` |
  | `/campaigns`, `/campaigns/join/:code`, `/campaigns/:id` | `campagnes` |
  | `/campaigns/:id/atelier`, `/campaigns/:id/atelier/vehicles/:vehicleId` | `atelier` |

  (`/vehicles`, `/weapons`, `/admin/users`, `/login`, `/register`, `/home` :
  pas de lien contextuel.)

  Dans `app.ts` (shell global, rendu sur tout écran via `app.html`) : un
  `WritableSignal<string | null>` mis à jour à chaque `NavigationEnd` du
  `Router`, en descendant jusqu'à la route active la plus profonde
  (`route.firstChild` en boucle — routes actuellement toutes plates, un
  seul niveau à parcourir) et en lisant `snapshot.data['docSlug']`.
  `app.html` affiche conditionnellement (`@if (docSlug(); as slug)`) un
  lien `❓ Aide sur cet écran` vers `/documentation/<slug>`, dans la navbar,
  à côté de l'entrée `Documentation` (sommaire général).

---

## 3bis. Trois bugs réels trouvés à la vérification (et corrigés)

La vérification manuelle (navigateur réel, pas seulement les tests
unitaires) a révélé trois problèmes que la conception initiale n'avait pas
anticipés — ni les tests backend, ni le build/lint frontend ne pouvaient les
détecter, seuls un clic réel sur un lien d'ancre et une relecture visuelle
les ont révélés :

1. **`[innerHTML]` sanitise silencieusement les attributs `id`.** Angular
   sanitise par défaut tout contenu lié via `[innerHTML]` et retire les
   attributs qu'il ne juge pas nécessaires — dont `id` sur un titre — sans
   lever d'erreur ni avertissement bloquant (juste un warning console
   generique). Résultat : **aucune** ancre ne fonctionnait, alors que
   `GET /api/content/docs/:slug` renvoyait bien le HTML avec les `id`
   corrects (vérifié à la main via `curl`). Corrigé en reprenant le pattern
   déjà établi dans `sponsor-carousel.ts` pour un besoin identique (contenu
   HTML interne, jamais saisi par l'utilisateur) : `html` devient un
   `WritableSignal<SafeHtml | null>` et chaque valeur passe par
   `DomSanitizer.bypassSecurityTrustHtml()` avant d'être affectée.
2. **Le Router n'active pas le défilement vers une ancre par défaut.**
   `provideRouter(appRoutes)` seul met à jour l'URL avec le `#fragment` mais
   ne fait jamais défiler la page jusqu'à l'élément correspondant. Corrigé
   en ajoutant `withInMemoryScrolling({ anchorScrolling: 'enabled' })` dans
   `app.config.ts` (`scrollPositionRestoration` volontairement laissé au
   défaut, pour ne changer le comportement d'aucune autre route de
   l'appli).

   Corollaire découvert en résolvant le point 2 : une ancre **same-page**
   (ex. cliquer `#section` depuis la page qui contient déjà cette section)
   a un `pathname` résolu identique à `window.location.pathname`, donc elle
   matchait aussi le test `startsWith('/documentation')` de
   `DocLinksDirective` et se retrouvait interceptée — avec un risque réel de
   passer par `Router.navigateByUrl()` vers une URL de même chemin, dont le
   traitement par la sémantique "same URL navigation" d'Angular n'est pas
   garanti identique au défilement natif. `DocLinksDirective` exclut
   maintenant explicitement ce cas (`anchor.pathname === window.location.pathname`
   → pas d'interception, comportement natif du navigateur conservé).
3. **L'encapsulation de vue Angular ne scope jamais le contenu de
   `[innerHTML]`.** Trouvé après un retour utilisateur sur la couleur des
   liens ("trop flashy, pas en accord avec la charte") : la couleur
   incriminée était en réalité le **bleu par défaut du navigateur**, pas
   celle prévue par `_markdown-content.scss` — cette dernière ne s'appliquait
   jamais. En creusant : l'encapsulation "emulated" (mode par défaut
   d'Angular) attache un attribut `_ngcontent-xyz` aux éléments que le
   template du composant rend lui-même, et récrit le CSS du composant pour
   exiger cet attribut ; les descendants de `[innerHTML]` — jamais compilés
   par Angular — ne le reçoivent jamais. Seules les propriétés CSS
   *héritables* déclarées sur `.markdown-content` elle-même (`color`,
   `font-family`, `line-height`) semblaient "fonctionner", par simple
   héritage vers les enfants, pas parce que les règles imbriquées (`h1`,
   `h2`, `a`, `table`...) matchaient — elles ne matchaient jamais. Corrigé en
   déplaçant `.markdown-content` en CSS **global**
   (`apps/frontend/src/styles.scss`, plus de mixin `_markdown-content.scss`
   ni de `@include` dans les `.scss` des deux composants) — même raison de
   fond que `.navbar` y est déjà globale (`app.scss` est vide). Couleur des
   liens revue au passage : `--text-accent` (rouille, ton terre cuite
   discret, token sémantique existant mais jusqu'ici inutilisé) au lieu de
   `--tb-danger` (or vif, réservé aux signaux/CTA) — plus lisible et
   cohérent avec la charte pour du texte de lien au fil d'un paragraphe.

---

## 4. Intégration UI

- **Navbar** (`app.html`) : le lien `Règles` → `/rules` devient
  `<app-icon concept="journal" size="sm" /> Documentation` → `/documentation`
  (icône réutilisée telle quelle — déjà le pictogramme d'un livre ouvert ;
  la planche de 20 icônes est pleine, pas de concept "aide" dédié
  disponible). Le lien contextuel `❓ Aide sur cet écran` (emoji, faute de
  case libre sur la planche — cohérent avec la migration icônes encore
  partielle ailleurs dans l'appli) s'ajoute juste après, visible seulement
  si l'écran courant déclare un `docSlug`.
- **Home** (`home.html`) : la carte "Règles" (grille de 4) et le bouton
  hero secondaire pointent désormais vers `/documentation`, libellés
  renommés "Documentation".

---

## 5. Suppression de `/rules`

Vérifié par grep qu'aucun test e2e ni aucune autre partie du code ne
référence `/rules` ou le composant `Rules` en dehors des 4 points listés
ci-dessous — suppression sans risque.

- Supprimé : `content/regles.md`, tout `apps/frontend/src/app/rules/`
  (`rules.ts`, `.html`, `.scss`), l'entrée `path: 'rules'` dans
  `app.routes.ts`.
- Remplacés (pas juste supprimés) : `app.html` (navbar), `home.html`
  (hero + carte feature) — cf. §4.

---

## 6. Documentation projet mise à jour

- `CLAUDE.md` — `content/docs/*.md` ajouté à la liste "Documentation de
  référence" (même mécanisme qui garantit déjà que `docs/spec/*.md` reste
  à jour).
- `docs/spec/NAVIGATION.md` — routes `/documentation`/`/documentation/:slug`
  remplaçant `/rules`, nouvelle section "Documentation utilisateur"
  (mécanisme, endpoints), backlog "Documentation utilisateur (futur)"
  retiré (implémenté).
- `docs/COMPONENTS.md` — `Rules` remplacé par `Documentation`,
  `DocumentationChapter`, `DocLinksDirective`.

---

## 7. Vérification effectuée

- **Backend** : `npx nx test backend` → 611/611 (dont les 5 nouveaux tests
  `docs.service.spec.ts` : chargement du manifest et de son ordre, HTML +
  titre d'un chapitre, ids sur les titres, 404 sur un slug inconnu, lecture
  de `index` hors sommaire). `curl` direct sur `/api/content/docs` et
  `/api/content/docs/equipes` contre le backend réellement démarré (pas
  seulement les tests) pour confirmer l'ordre du sommaire et la présence des
  `id` dans le HTML.
- **Frontend** : `npx nx run frontend:build` (production) OK. `npx nx test
  frontend` → 460/460 tests passés (les 2 "fichiers en échec"/30 erreurs
  signalés par vitest sont un flake préexistant sans rapport avec cette
  session — confirmé identique en nombre sur le commit de base via
  `git stash`, dans des specs jamais touchées ici). `npx nx lint frontend` →
  93 erreurs préexistantes, **aucune** dans les fichiers de cette session
  (confirmé par grep ciblé) — dette technique non liée, non traitée ici.
- **Navigateur réel** (Playwright, `./dev.sh` relancé pour charger le code
  neuf) : sommaire et chapitres affichés et stylés correctement (captures
  d'écran) ; `/rules` redirige vers `/home` ; navigation entre chapitres et
  clic sur un lien croisé confirmés SPA (pas de rechargement, vérifié via un
  marqueur `window.*` qui ne survit qu'en l'absence de reload) ; clic sur une
  ancre inter-chapitres (`/documentation/atelier` → lien vers
  `/documentation/programme-tele#table-des-epaves`) confirmé fonctionnel
  **après correction des bugs 1 et 2 du §3bis** ; lien "❓ Aide sur cet écran"
  vérifié avec un compte de test réel : présent et pointant vers le bon
  chapitre sur `/teams` (`equipes`) et `/campaigns` (`campagnes`), absent sur
  `/home` ; aucune erreur console/page pendant tout le parcours. Styles
  imbriqués (`h1`-`h3`, `a`, `table`...) vérifiés via `getComputedStyle` réel
  (pas seulement visuel) avant et après le correctif du bug 3 — confirmé
  qu'aucune règle imbriquée n'appliquait avant (`text-transform: none` sur
  un `h2` censé être uppercase), toutes correctes après.
- **Non vérifié manuellement** : le lien contextuel sur les routes
  `construction-vehicule` et `atelier` spécifiquement (nécessite une équipe
  et un véhicule existants) — la table `data.docSlug` de `app.routes.ts` est
  cependant le même mécanisme déjà validé sur `equipes`/`campagnes`, sans
  raison de se comporter différemment.
