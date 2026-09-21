---
id: "regles-maison-carte-2026-09-20"
status: "backlog"
priority: "high"
assignee: null
dueDate: null
created: "2026-09-20T10:02:28.000Z"
modified: "2026-09-21T17:49:48.000Z"
completedAt: null
labels: ["regles-maison", "mode-campagne", "wayfinder:map"]
order: "aX"
---
# Carte — Règles maison : mécanisme par campagne et première règle

> Carte de route. Index des décisions et des cartes filles — le détail vit dans
> chaque carte fille, jamais recopié ici.

## Destination

Un mécanisme de « règles maison » par campagne — des variantes optionnelles du
règlement, activables une par une par l'organisateur — livré de bout en bout
(backend, IHM, documentation), avec sa première règle réellement implémentée :
**« Points de Résistance aux équipes sans point de championnat »**. Ajouter la
règle maison suivante doit alors coûter une entrée de catalogue et une classe
Strategy, sans refonte du mécanisme.

## Notes

- **Cette carte porte l'exécution**, pas seulement les décisions : les décisions
  produit ont déjà été prises (cf. ci-dessous), les cartes filles couvrent donc
  la réalisation.
- **Convention de colonne** : une carte fille en `todo` est prenable
  immédiatement ; une carte en `backlog` attend qu'une autre soit terminée (voir
  sa section « Dépendances »).
- **Avant de commencer une carte** : renseigner `assignee`, pour qu'une session
  concurrente ne reprenne pas la même.
- **Skills à consulter** : `ddd` (obligatoire avant toute règle métier backend,
  cf. CLAUDE.md), `gof-patterns` (Strategy), `kanban-markdown` pour la mise à
  jour de ces cartes.

## Cartes filles

| Carte | Dépend de |
|---|---|
| [RM-1 — Conception détaillée du mécanisme (DDD)](./done/rm-1-conception-ddd-regles-maison-2026-09-20.md) | — (résolu) |
| [RM-2 — Catalogue YAML des règles maison](./rm-2-catalogue-yaml-regles-maison-2026-09-20.md) | RM-1 ✅ — prenable |
| [RM-3 — Persistance du réglage sur la campagne](./rm-3-persistance-houserules-campagne-2026-09-20.md) | RM-1 ✅, RM-2 |
| [RM-4 — Déplacer la distribution des PR vers l'entrée en Atelier](./rm-4-deplacer-distribution-pr-entree-atelier-2026-09-20.md) | RM-1 ✅ — prenable |
| [RM-5 — Règle R1 : stratégie « aucun point de championnat »](./rm-5-strategie-pr-sans-point-championnat-2026-09-20.md) | RM-3, RM-4 |
| [RM-6 — IHM : régler les règles maison d'une campagne](./rm-6-ihm-reglage-regles-maison-2026-09-20.md) | RM-2, RM-3 |
| [RM-7 — IHM : affichage en lecture seule](./rm-7-ihm-affichage-lecture-seule-2026-09-20.md) | RM-3, RM-6 |
| [RM-8 — Documentation](./rm-8-documentation-regles-maison-2026-09-20.md) | RM-5, RM-6, RM-7 |

## Décisions acquises

### RM-1 — Conception détaillée du mécanisme (résolu 2026-09-21)

Document de conception :
[docs/plans/2026-09-21-regles-maison-mecanisme-design.md](../../docs/plans/2026-09-21-regles-maison-mecanisme-design.md).
Treize questions tranchées via les skills `ddd`/`grilling` — réglage porté par un
Value Object `HouseRules` (ensemble de clés activées, deux fabriques
lecture/écriture, colonne `jsonb` sur `campaigns`), catalogue en service singleton
dédié (calqué sur `ScenarioCatalogService`), traçabilité par une colonne marqueur
`resistanceStrategyKey` sur `GameEventOrm` (distingue automatique/manuel), calcul
porté par une nouvelle méthode `Game.distributeResistance` avec une Strategy à
réponse unitaire par participant, garde ET/Escarmouche par hook polymorphe, et
séparation stricte entre la transition de statut (`Campaign.enterAtelier`,
inchangée) et la distribution (`Game.distributeResistance`), orchestrées par
`EnterAtelierUseCase` avec le journal persisté avant le statut et une garde
d'idempotence. RM-2 et RM-4 débloquées.

### Session de cadrage, 2026-09-20

Issues d'une session de questionnement préalable à cette carte — elles ne sont
donc rattachées à aucune carte fille, mais elles sont tranchées : ne pas les
rouvrir sans élément nouveau.

- **Portée du réglage** : par campagne, en base — pas un fichier de configuration
  global, qui appliquerait les mêmes règles à tous les groupes hébergés. Précédent
  à copier : `Campaign.budget`.
- **Forme du stockage** : une structure extensible « nom de règle → booléen »,
  pour qu'une nouvelle règle n'impose pas de migration de schéma.
- **Qui règle, et quand** : l'organisateur, à la création de la campagne et après
  coup, **sans contrainte d'état** — contrairement au budget, dont la restriction
  `EN_CONSTRUCTION` tient à l'éligibilité des équipes, sans objet ici.
- **Gel dans le temps** : la décision est figée dans l'événement au moment où la
  partie est clôturée ; changer une règle plus tard ne réécrit jamais une partie
  déjà jouée. Vérifié dans le code : le replay ré-applique des faits déjà décidés,
  il n'en recalcule aucun.
- **Clé inconnue** : rejetée en HTTP 400, validée contre le catalogue — jamais
  ignorée silencieusement.
- **Règle R1 — critère** : les participants n'ayant gagné **aucun point de
  championnat** sur la partie reçoivent 3 Points de Résistance, au lieu des
  participants classés dans la seconde moitié. Total = classement + exploits +
  Favori du Public. Montant inchangé : +3. **Événement Télévisé uniquement.**
- **Moment du calcul** : déplacé de l'enregistrement du résultat vers l'entrée en
  Atelier, seul instant où le total de PC est complet — le bonus Favori du Public
  est émis après l'enregistrement du résultat. Conséquence assumée : la règle par
  défaut change aussi de moment d'exécution.
- **Route manuelle de contact Résistance** : strictement inchangée, la règle
  maison ne porte que sur la distribution automatique.
- **Source des textes** : un catalogue YAML, comme les sept autres catalogues du
  projet — ajouter une règle ne doit jamais demander de modifier le frontend.
- **Présentation** : une case à cocher par règle, avec une ligne courte en dessous
  qui **change selon l'état de la case** (cochée : le comportement alternatif ;
  décochée : le rappel du comportement par défaut).
- **Visibilité** : lecture seule pour tous les participants sur la page de
  campagne, et sur l'écran d'inscription par code — comme le budget.
- **Journal** : la ligne de contact Résistance mentionne la règle appliquée.
- **Structure** : une interface Strategy par point de calcul, pas d'abstraction
  générique fourre-tout — les calculs concernés n'ont rien en commun.
- **Tests** : unitaires backend sur les deux variantes ; pas d'e2e Playwright.

## Not yet specified

- Faut-il faire apparaître les règles maison actives sur la **fiche d'équipe
  exportable** (HTML imprimable) ? Pas tranché, et pas assez net pour une carte
  tant que l'affichage en lecture seule n'existe pas.
- **Ampleur de la non-régression** sur les tests existants de la distribution
  automatique : le déplacement du calcul touche des specs dont on ne connaîtra
  le nombre ni la nature (adaptation ou réécriture) qu'une fois RM-1 figée.

## Out of scope

- **R2 — revenu de base d'Escarmouche en 1D4+2** au lieu de 1D6 : règle maison
  indépendante, explicitement remise à un effort ultérieur lors du cadrage. Le
  mécanisme livré ici doit pouvoir l'accueillir sans refonte.
- **R3 — revenu de base versé à tous les participants**, même absents de
  l'Escarmouche, les présents touchant en plus la récompense du scénario : idem.
  Ne demande aucun changement d'écran, seulement de tirer le dé pour tout le monde.
- **Écran de détail d'une règle maison** (champ de règles détaillées au
  catalogue) : écarté au cadrage, le champ serait de la donnée morte tant qu'aucun
  écran ne l'affiche.
- **Test e2e Playwright** du parcours complet : écarté au cadrage, la règle est un
  calcul pur entièrement couvrable en test unitaire.
