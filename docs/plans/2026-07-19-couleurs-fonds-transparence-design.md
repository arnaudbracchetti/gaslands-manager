# Consolidation des couleurs, fonds et transparence — Terres Brûlées

## Contexte

L'app utilise une palette unique ("Terres Brûlées", thème sombre uni, pas de
switch clair/sombre) déjà bien centralisée dans `apps/frontend/src/styles.scss`
(29 couleurs solides, toutes en `:root`). Le problème signalé — fonds/boutons
trop transparents, en particulier dans l'atelier — venait d'ailleurs : **~41
valeurs `rgba()` distinctes (76 occurrences) et ~38 déclarations `opacity: <1`**
étaient dupliquées à la main dans une trentaine de fichiers `.scss` de
composants au lieu de passer par des tokens, ce qui rendait le niveau de
transparence incohérent d'un écran à l'autre et impossible à ajuster
globalement.

En creusant les calculs de contraste (formule WCAG de luminance relative,
alpha-blending sur les 4 surfaces bitume réellement utilisées), un second
problème est apparu, plus grave que prévu : `--tb-rouille-lt` (texte de
~45 boutons "supprimer"/messages d'erreur) et `--tb-coolant` (badges
"info") échouaient déjà sous 4.5:1 même sans aucun fond translucide — ce
n'était pas un problème de fond, la couleur de texte elle-même était trop
sombre.

**Décisions validées avec l'utilisateur** :
1. Pas de dark/light mode switching — un seul thème, inchangé.
2. Fonds solides partout pour cartes/boutons/panneaux (plus de rgba semi-transparent), sauf overlay de modale (reste translucide par nature).
3. Le pattern "badge translucide" (effet verre teinté, ~25 occurrences) est conservé visuellement mais réduit à un jeu **fini** de tokens réutilisables (accent/danger/success/info), chacun validé par calcul de contraste.
4. Toute l'application en une fois, pas de découpage par zone.
5. Cible WCAG AA formelle (≥4.5:1 texte normal, ≥3:1 UI) — avec une exception documentée pour les bordures teintées "danger" (la teinte rouille plafonne structurellement à 2.40:1 même à pleine opacité ; acceptable car le badge reste identifiable par son texte AA-conforme et sa forme, la bordure n'étant qu'un renfort décoratif).
6. Effets d'ambiance décoratifs (vignette, glow, sun-flare, noise, shadow-stamp) hors périmètre, sauf remplacement des `rgba(0,0,0,...)` ad hoc qui dupliquaient des tokens d'ombre déjà existants.
7. Correction des 2 couleurs de texte sous-contrastées incluse — **sans créer de nouveaux tokens dupliqués** : correction de la valeur des tokens existants plutôt qu'ajout de variantes "-hi" à côté (retour utilisateur : éviter de démultiplier des couleurs quasi-identiques).

## Tokens ajoutés/corrigés dans `styles.scss`

### Deux tokens existants corrigés (pas de nouveau token créé)

```scss
--tb-rouille-lt: #D67252;   // était #C2522E — luminosité relevée au seuil AA
--tb-coolant:    #7DA8B5;   // était #4E7C8A — idem
```

Ces deux tokens étaient déjà, sémantiquement, les variantes "claires/texte"
de leur couleur — la correction se propage automatiquement à tous leurs
usages existants (texte, bordures, remplissages, décoratif) sans toucher un
seul fichier composant.

### Triplets RGB (composition rgba())

```scss
--tb-danger-rgb:  230, 180, 28;
--tb-rouille-rgb: 162, 58, 28;
--tb-toxic-rgb:   138, 155, 46;
--tb-coolant-rgb: 125, 168, 181;
```

### Jeu fini de tints sémantiques

```scss
--tint-accent-bg / -bg-hover / -border / -text     (or — actif, focus, mise en avant)
--tint-danger-bg / -border / -border-strong / -text (rouille — suppression, rejet, erreurs)
--tint-success-bg / -border / -text                 (toxic — validé/actif)
--tint-info-bg / -border / -text                     (coolant — état neutre/informatif)
```

Contrastes calculés (pire cas `--tb-bitume-4`) : accent 6.47:1, danger
4.54:1, success 4.61:1, info 4.87:1 — tous ≥4.5:1. `--tint-accent-bg-hover`
est le seul palier "hover renforcé" du jeu (seul canal où la marge de
contraste le permet) ; pour danger/success, tout hover passe par
`border-color` solide ou `filter: brightness()`, jamais par une hausse
d'alpha (au-delà de ~0.10-0.11 le contraste redescend, le fond convergeant
vers la couleur du texte).

### Focus ring mutualisé

```scss
--focus-ring-glow: 0 0 0 2px rgba(var(--tb-danger-rgb), 0.15);
```

## Implémentation

Tous les `rgba()` ad hoc de composants (`.scss` sous `apps/frontend/src/app/`)
ont été remplacés par ces tokens, par domaine fonctionnel (campaigns/*,
teams/*, admin/*). Deux exceptions documentées et acceptées :
- `mounted-equipment.scss` (`text-shadow` du filigrane "VENDU") — forme
  différente de `--shadow-stamp`, effet décoratif hors périmètre.
- `--clr-overlay` (overlay de modale) — transparence intentionnelle, hors
  périmètre par décision utilisateur (#2 ci-dessus).

Vérifié par grep (`grep -rn "rgba(" apps/frontend/src/app --include=*.scss | grep -v "var(--"`)
et par `npx nx run frontend:build` (aucune erreur SCSS).

## Vérification

Aucun outil de contraste automatisé dans le repo. Le calcul WCAG a été fait
manuellement (formule de luminance relative officielle, alpha-blending sur
les 4 surfaces bitume réellement utilisées par les badges) — cf. tableau
ci-dessus. Une QA visuelle manuelle (`npx nx serve frontend`) reste à faire
par un humain, en particulier sur l'atelier (priorité initiale du
signalement) — aucun outil de capture d'écran/navigateur headless n'était
disponible dans l'environnement d'implémentation.

## Volet 2 — Contraste du texte (suite, même jour)

Après ce premier chantier (badges/fonds), l'utilisateur a signalé que le
**texte** restait globalement peu contrasté — sujet distinct, jamais audité
jusque-là (les calculs ci-dessus ne portaient que sur les couleurs de
badges). Recoupement exhaustif de tous les `var(--x)` utilisés dans
`apps/frontend/src/app/**/*.scss` contre les tokens réellement définis dans
`styles.scss`, plus calcul de contraste sur les tokens de texte sémantiques
(`--text-dim`, `--text-faint`, `--text-body`). Trois causes distinctes :

1. **Bug** : `--text-main`, référencé dans 3 sélecteurs
   (`change-team-modal.scss` ×2, `game-journal-modal.scss`), n'était **défini
   nulle part** dans `styles.scss` — seul token fantôme du projet (vérifié par
   recoupement exhaustif). Le cas le plus visible : le bouton de confirmation
   de `ChangeTeamModal` (fond `--tb-danger`, doré) avait une couleur de texte
   qui ne se résolvait jamais. Corrigé en pointant chaque usage vers le token
   sémantiquement correct pour son contexte : `var(--tb-os)` (texte sur fond
   sombre), `var(--action-primary-ink)` (ink sombre sur fond `--tb-danger`,
   même paire que `.btn-primary`), `var(--text-strong)` (contenu de journal).

2. **`--metal-sheen` utilisé comme fond de texte** dans 6 fichiers
   (`change-team-modal`, `game-journal-modal`, `equipment-detail-modal`,
   `sequella-detail-modal`, `sequella-advantage-picker`, `equipment-manager`
   `.em-sequella-card`). Le point le plus clair de ce dégradé (`--tb-metal-4`)
   est ~5× plus lumineux que les fonds bitume habituels, rendant tout texte
   `--text-dim`/`--text-faint` illisible dessus. `team-card.scss` avait déjà
   résolu exactement ce problème par le passé (remplacement par
   `var(--surface-raised)`, commentaire explicatif en place) — même
   traitement répliqué aux 5 autres fichiers restants. `confirm-modal.scss`
   et `sell-vehicle-modal.scss` utilisent aussi `--metal-sheen` mais leur
   texte était déjà en `--text-strong` (solide) — non concernés, laissés tels
   quels.

3. **`--text-faint`** (0.32 alpha, ~2.45:1 sur `--tb-bitume-4`) servait en
   réalité du contenu réel (description d'équipement, boutons d'action,
   messages d'état, placeholders) dans 13 de ses 15 usages — reclassés vers
   `--text-dim` plutôt que de remonter l'alpha de `--text-faint` lui-même
   (qui aurait fini quasi identique à `--text-dim`, rendant les deux tokens
   redondants). Seuls 2 usages restent en `--text-faint` : le séparateur
   décoratif `team-card.scss` (`__vehicle-arrow`) et un bouton `:disabled`
   dans `quick-team-create.scss` (état désactivé, exempté par les WCAG).

`--text-dim` lui-même est passé de 0.55 à 0.60 (`styles.scss`) — une fois (2)
traité, sa surface la plus claire restante est `--tb-metal-1` (~4.4:1 avant,
~4.95:1 après), changement mineur.

Vérifié par grep (absence de `--text-main`, `--metal-sheen` limité aux 2
fichiers déjà `--text-strong`, `--text-faint` limité aux 2 exceptions
documentées) et par `npx nx run frontend:build` (aucune erreur SCSS). Même
limitation que le volet 1 : pas de QA visuelle automatisée possible dans cet
environnement — à faire manuellement, en particulier sur `ChangeTeamModal`
(bug `--text-main` corrigé) et les modales de détail équipement/séquelle
(fond désormais solide).

## Volet 3 — Atelier, badges, boutons, navbar (même jour, round 3)

Après le volet 2, l'utilisateur a signalé successivement des textes/badges
peu lisibles sur l'écran d'atelier puis sur la navbar — alors que ces
éléments **passaient déjà** le calcul AA (4.5:1). Deux causes distinctes,
encore une fois pas un simple réglage global :

1. **Deux bugs confirmés** : `--tb-rouille` (couleur de *base*, jamais
   destinée au texte) utilisé directement en `color:` à 2 endroits —
   `vehicle-summary-card.scss` (`.tep-btn-delete-vehicle`, le bouton
   "Vendre"/"Annuler l'achat" de l'atelier, **2.25:1**) et
   `team-edit-page.scss` (`.tep-field__required`, 2.85:1 même sur la surface
   la plus sombre du thème). Corrigés vers `var(--tint-danger-text)`, le
   token réellement prévu pour du texte.

2. **Le seuil AA strict (4.5:1) s'est avéré insuffisant en pratique** sur le
   texte petit/mono/majuscule/tracké de cette app (labels, badges, boutons
   secondaires) — trois signalements de suite portaient sur des éléments
   déjà conformes au calcul (`.me-remove` "Retirer" ≈4.85:1, navbar avec
   `--text-dim` à 0.60 ≈5.66:1 sur `--tb-black`). Décision : viser ~7:1
   (quasi-AAA) plutôt que 4.5:1 pour tout texte interactif/secondaire.
   `--text-dim` relevé 0.60 → 0.80 ; `--tb-rouille-lt` #D67252 → #E6A088 ;
   `--tb-coolant` #7DA8B5 → #8FBCC9 ; `--tb-toxic` #8A9B2E → #A8BC4A
   (triplets `--tb-*-rgb` dérivés mis à jour en cohérence). Effet de bord
   assumé : `--text-dim` devient visuellement proche de `--text-body`
   (0.82), la distinction "texte secondaire" s'atténue — priorité donnée à
   la lisibilité plutôt qu'à cette nuance.

3. **Les badges passent en fond solide.** Calculé : `--tint-accent-bg`
   (rgba doré 0.12) composé sur `--tb-bitume-4` ne donne que **~1.3:1** de
   contraste avec la carte hôte — bien sous le 3:1 recommandé (SC 1.4.11)
   pour la délimitation d'un composant UI, même si le texte au-dessus, lui,
   était conforme. Nouveau système `--badge-{accent,danger,success,info}-bg`
   + `--badge-text` (encre sombre partagée, `var(--action-primary-ink)`,
   même paire que `.btn-primary`) — **aucune nouvelle couleur créée**,
   réutilise les tokens `--tb-danger`/`--tb-rouille-lt`/`--tb-toxic`/
   `--tb-coolant` déjà (re)validés au point 2. Résultat : 7.6-9.2:1 texte/
   fond, 7.6-8.8:1 délimitation fond/carte. Appliqué à tous les badges/
   pastilles d'état ou de coût (équipement, séquelles, sponsor, véhicule,
   participant, campagne, admin — 12 fichiers). Les boîtes d'erreur et
   boutons "ghost" (Retirer/Annuler/Rejeter) restent volontairement
   translucides (`--tint-*`) — ils héritent seulement du texte éclairci du
   point 2, aucune conversion en fond solide (un bouton fantôme n'a pas de
   remplissage par définition).

Vérifié par grep (aucun `color: var(--tb-rouille)` restant hors
`border-color`, tous les tokens `--badge-*` référencés correspondent à des
tokens définis) et par `npx nx run frontend:build` (aucune erreur SCSS).
QA visuelle manuelle encore à faire — écrans prioritaires : atelier (badges
jerricans/emplacement, boutons Vendre/Annuler/Retirer), navbar, campagnes
(badges état/rôle), admin.
