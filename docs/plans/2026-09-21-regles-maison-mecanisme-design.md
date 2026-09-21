# Règles maison — Mécanisme par campagne : conception

## Contexte

Le mode campagne doit accueillir des **règles maison** — des variantes optionnelles
du règlement, activables une par une par l'organisateur d'une campagne — avec une
première règle réellement implémentée : **« Points de Résistance aux équipes sans
point de championnat »** (R1). Ajouter la règle maison suivante doit coûter une
entrée de catalogue et une classe Strategy, sans refonte du mécanisme.

Ce document fige la conception avant toute ligne de code (carte kanban RM-1,
`.devtool/features/rm-1-conception-ddd-regles-maison-2026-09-20.md`), pour que les
cartes filles (RM-2 à RM-8, cf. `.devtool/features/regles-maison-carte-2026-09-20.md`)
l'exécutent sans avoir à re-décider quoi que ce soit. Conception menée via les skills
`ddd` et `grilling`, après exploration complète du code existant : la distribution
automatique des Points de Résistance (`Game.recordResult`,
`ResistanceContactedEvent`), l'event-sourcing campagne (`Campaign`/`Game`/
`GameEvent`, cf. [ARCHITECTURE.md §3.8](../ARCHITECTURE.md#38-mode-campagne--event-sourcing-campaign)),
le précédent `Campaign.budget` de bout en bout, les catalogues YAML en mémoire
(`CatalogService`, `ScenarioCatalogService`), et les migrations TypeORM du projet.

Décisions déjà actées au cadrage produit (carte parente, non rouvertes ici) : portée
par campagne en base, structure extensible, réglable par l'organisateur sans
contrainte d'état, décision gelée dans l'événement au moment où la partie est
clôturée, clé inconnue rejetée en HTTP 400, R1 réservée à l'Événement Télévisé,
montant inchangé (+3), calcul déplacé de l'enregistrement du résultat vers l'entrée
en Atelier (seul instant où le total de PC est complet — le bonus Favori du Public
est émis après l'enregistrement du résultat).

---

## 1. Réglage sur l'agrégat `Campaign`

**Value Object `HouseRules`**, immuable, exposant `isEnabled(nomInterne): boolean`.
Contient **uniquement les clés activées** (pas une map complète nom→booléen) : une
règle absente équivaut au comportement par défaut, donc une règle ajoutée après coup
au catalogue est automatiquement « décochée » partout, sans reprise de données.

**Colonne** `houseRules` sur `campaigns` : `jsonb NOT NULL DEFAULT '[]'` (tableau de
clés). Première colonne JSON du projet — aucun précédent à copier (toutes les
entités existantes utilisent des colonnes scalaires typées, cf. `GameEventOrm`), mais
cohérente avec le choix « ensemble de clés » plutôt qu'un sac hétérogène.

### Deux chemins de construction, pas un flag

C'est ce double chemin qui porte mécaniquement « lecture tolérante, écriture
stricte » :

```ts
class HouseRules {
  private constructor(private readonly enabled: ReadonlySet<string>) {}

  /** Hydratation depuis la base (mapper) — aucune validation : une clé orpheline
   *  reste présente mais inerte, personne ne la relit. */
  static fromPersisted(keys: string[]): HouseRules {
    return new HouseRules(new Set(keys));
  }

  /** Depuis une saisie utilisateur — validKeys est le catalogue COURANT (liste des
   *  nom_interne), fourni par l'appelant. Rejette toute clé absente. */
  static fromUserInput(keys: string[], validKeys: readonly string[]): HouseRules {
    const valid = new Set(validKeys);
    for (const k of keys) {
      if (!valid.has(k)) throw new DomainException(`Règle maison inconnue : "${k}".`);
    }
    return new HouseRules(new Set(keys));
  }

  isEnabled(nomInterne: string): boolean { return this.enabled.has(nomInterne); }
  toArray(): string[] { return [...this.enabled]; }
}
```

**D'où vient `validKeys` ?** Le use case (création ou mise à jour de campagne), qui a
accès par injection à `HouseRuleCatalogService` (§2), en extrait
`catalog.getAll().map(r => r.nom_interne)` et le passe à
`Campaign.setHouseRules(keys, validKeys)` — une méthode fine qui délègue directement
à `HouseRules.fromUserInput`. **Le domaine ne connaît jamais le catalogue** : il
reçoit un instantané de ses clés valides en paramètre, exactement comme
`IPasswordHasher` est passé en paramètre à `User.changePassword(...)` plutôt
qu'injecté dans l'agrégat (cf. [ARCHITECTURE.md §3.5](../ARCHITECTURE.md)).
`DomainException` → HTTP 400 par le use case, comme `UpdateCampaignUseCase` le fait
pour `changeBudget`. Le mapper ORM→domaine (chargement) appelle `HouseRules.fromPersisted`
— jamais `fromUserInput` — donc aucune dépendance au catalogue à la lecture.

**Clé orpheline** (activée en base, retirée depuis du catalogue) : conséquence
directe du double chemin ci-dessus — `fromPersisted` ne filtre ni ne fait échouer, la
clé reste présente mais inerte ; le premier `fromUserInput` qui suit (n'importe
quelle modification ultérieure du réglage) la fait disparaître, faute d'être dans
`validKeys`. Aucune campagne ne devient inouvrable à cause d'un retrait de ligne YAML.

**Exposition** : réglable dès la création et après, exposé dans toutes les réponses
de campagne (le DTO de réponse est dérivé par spread de l'entité ORM, cf. précédent
`budget` — la nouvelle colonne apparaît automatiquement) **et** sur la route de
consultation par code d'invitation (`CampaignSummaryDto`, DTO explicite et minimal —
y ajouter le champ à la main, comme `budget` l'a été).

---

## 2. Catalogue YAML des règles maison

**Service dédié** dans `campaign/`, calqué **fichier pour fichier** sur
`ScenarioCatalogService` (`campaign/scenario-catalog.service.ts`) : `OnModuleInit`,
`Map` indexée par `nom_interne`, Template Method `protected readFileContent()`,
conversion Markdown→HTML une fois au chargement, fail-fast. Pas d'extension du
`CatalogService` du module équipe : une règle maison n'a aucun lien avec sponsors ou
équipement, et ce service est déjà consommé par le module équipe via une interface de
domaine qu'il n'y a aucune raison d'élargir.

**Fichier** `database_init/data/regles-maison.yml`, même schéma à champs courts que
`scenarios.yml` : nom affiché, nom interne, description courte « décochée » (rappel
du comportement par défaut), description courte « cochée » (comportement
alternatif). Pas de champ de règles détaillées — écarté au cadrage (donnée morte
tant qu'aucun écran ne l'affiche).

**Route publique**, hébergée dans `campaign.controller.ts` (comme
`GET /api/catalog/scenarios`), sans JWT.

Première entrée : `resistance_sans_points_championnat`.

---

## 3. Traçabilité au journal

**Colonne nullable dédiée** sur `GameEventOrm`, ex. `resistanceStrategyKey` — pas
`houseRuleNomInterne`, la valeur réservée `"defaut"` de RM-4 (§7) n'étant pas un
`nom_interne` du catalogue ; un nom qui laisserait croire à une FK serait trompeur.
Même patron que `gatesCrossed`/`sabotagePointsSpent`. Elle porte **la clé de la
stratégie appliquée**, pas un simple booléen « règle maison active » : c'est ce qui
distingue un contact Résistance **automatique** d'un contact **manuel** sur la même
partie (le second ne renseigne jamais cette colonne). Un seul champ sert donc deux
besoins : le texte affiché au journal (RM-5) et la garde d'idempotence (RM-4, §6).

**Le montant +3 reste une constante de classe, non persisté** — décision de cadrage
explicite (montant inchangé), le figer serait de la donnée morte (YAGNI). Contraste
assumé avec les 4 événements de PC (`championshipPoints` figé à l'écriture, D-S8).

**Migration** : une seule, ajoutant cette colonne + la colonne `houseRules` sur
`campaigns` — suit le patron exact de
`apps/backend/src/migrations/1786182754067-AddCampaignBudget.ts`, ajoutée à
`apps/backend/src/migrations/index.ts` (`ALL_MIGRATIONS`).

---

## 4. Relevé, calcul unitaire et Strategy — l'algorithme reste dans `Game`

`Game` garde la boucle et la construction des événements — c'est déjà sa granularité
aujourd'hui (`recordResult` fait tout : classement, exploits, PR, en une seule
méthode). La Strategy ne répond plus qu'à une question **unitaire, par participant**
— exactement ce que `recordResult` calcule aujourd'hui en ligne (`r.rank >
classified`) — jamais un filtrage en bloc de toute la liste.

### Interface Strategy

```ts
interface ResistanceEntry {
  participantId: number;
  rank: number;
  championshipPointsThisGame: number;
}

interface ResistanceDistributionStrategy {
  /** Clé stampée sur l'événement créé (§3) — "defaut" pour la règle par défaut,
   *  nom_interne du catalogue pour une règle maison (§7). */
  readonly key: string;
  /** Calcul unitaire : ce participant reçoit-il les PR ? */
  isEligible(entry: ResistanceEntry, context: { classified: number }): boolean;
}
```

### `Game.distributeResistance(strategy)`

Nouvelle méthode publique, hook polymorphe (§5). Déroulement :

1. **Garde d'idempotence** (§6) : si le journal porte déjà un événement avec
   `resistanceStrategyKey` non nul, retourne `[]` sans rien recalculer.
2. Lit ses propres `RankingAssignedEvent` (un par participant classé dans **cette**
   partie) — `n =` leur nombre, `classified = Math.ceil(n / 2)`. **C'est ici que le
   nombre total de participants de la partie entre en jeu**, pas dans la Strategy :
   `Game` le connaît par son propre journal, la Strategy n'a jamais à le deviner.
3. Pour chaque `RankingAssignedEvent`, calcule `championshipPointsThisGame` en
   sommant l'accesseur polymorphe (ci-dessous) sur tout son journal filtré par ce
   `participantId`, construit l'`entry`, appelle `strategy.isEligible(entry, {
   classified })`.
4. Pour chaque participant éligible : `new ResistanceContactedEvent(0, this.id,
   participantId, 0, strategy.key)`, journalisé via `this.addEvent(...)` (donc
   revalidé par `canAccept`, comme tout événement).
5. Retourne les événements créés (jamais persistés ici — cf. §6).

### Accesseur polymorphe des points de championnat

Sur la classe de base `GameEvent`, ex. `championshipPointsAwarded: number`, valant
`0` par défaut, surchargé par les 4 événements qui appellent déjà `addPoints()`
(`RankingAssignedEvent`, `GatesCrossedEvent`, `VehicleDestroyedEvent`,
`FavoriDuPublicBonusEvent`) — `Game` somme sans jamais tester de type ; un futur
événement porteur de points est pris en compte sans toucher ce calcul.

### Deux implémentations (RM-5)

- Règle par défaut : `entry.rank > context.classified`, `key = "defaut"` — extraite
  telle quelle du code actuel.
- R1 : `entry.championshipPointsThisGame === 0`,
  `key = "resistance_sans_points_championnat"`.

### Résolution

Portée par **`Campaign`** (il détient `HouseRules`), via un **registre pur du
domaine** — même idiome que `IMPROVEMENT_BEHAVIORS`/`resolveImprovementBehavior`
(module équipe, cf. [VEHICLE_SYSTEM.md §4](../VEHICLE_SYSTEM.md#4-pattern-strategy---equipmentbehavior)) :
`Campaign.resolveResistanceStrategy(): ResistanceDistributionStrategy`, repli sur la
stratégie par défaut si aucune clé activée de la campagne n'a d'entrée dans le
registre. Le use case appelle cette méthode puis passe le résultat à
`game.distributeResistance(...)` (§6) — aucune résolution de règle métier hors du
domaine.

---

## 5. Garde de type de partie (Événement Télévisé uniquement)

`Game.distributeResistance(strategy)` (§4) **est elle-même le hook polymorphe** :
rend **liste vide** par défaut sur la classe de base `Game`, surchargée par
`EvenementTeleGame` avec le corps décrit au §4 (garde d'idempotence, relevé, boucle,
événements). `EscarmoucheGame` n'a rien à surcharger — hérite du no-op.

Pas de test de type — cohérent avec la hiérarchie déjà en place (`canAccept` est
dupliqué à l'identique entre les deux sous-classes précisément pour ce genre de
divergence), et sémantiquement correct : appeler cette méthode sur une Escarmouche
n'est pas une erreur d'appelant à rejeter (contrairement à `recordResult`, qui lève
une `DomainException` si on l'invoque hors Événement Télévisé — sémantique
différente, car `recordResult` a un point d'entrée alternatif dédié pour
l'Escarmouche), c'est un cas sans effet : le use case appelle cette méthode
inconditionnellement pour toute partie qui entre en Atelier.

---

## 6. Deux méthodes, deux concepts — orchestrées par le use case

**Une méthode, un concept.** `Campaign.enterAtelier(gameId)` **reste exactement ce
qu'elle est aujourd'hui** : transitions de statut uniquement (y compris la clôture
automatique d'un autre atelier ouvert), signature de retour `{ autoClosedGameId }`
inchangée. La distribution des PR n'y est **pas** ajoutée — elle vit entièrement dans
`Game.distributeResistance(strategy)` (§4/§5), un concept séparé.

C'est **`EnterAtelierUseCase`** qui orchestre les deux appels, dans l'ordre de
persistance requis :

```ts
async execute(cmd: EnterAtelierCommand): Promise<EnterAtelierResult> {
  const campaign = await this.replayService.loadAndReplay(cmd.campaignId);
  assertOrganizer(campaign, cmd.userId);

  // Concept 1 — distribution des PR (no-op hors Événement Télévisé, cf. §5).
  const game = campaign.findGame(cmd.gameId);
  const strategy = campaign.resolveResistanceStrategy();
  const distributionEvents = game.distributeResistance(strategy);
  if (distributionEvents.length > 0) {
    await this.campaignRepo.appendEvents(cmd.gameId, distributionEvents);
  }

  // Concept 2 — transition de statut (inchangé).
  const result = campaign.enterAtelier(cmd.gameId);
  await this.campaignRepo.saveCampaign(campaign);

  return result;
}
```

**Ordre de persistance** : le journal (`appendEvents`) est écrit **avant** le statut
(`saveCampaign`) — jamais l'inverse. Aucune transaction n'existe dans tout le projet
(vérifié : zéro usage de `DataSource`/`QueryRunner`/`.transaction()` en dehors des
migrations et du healthcheck) ; avec cet ordre, un échec sur la seconde écriture
laisse au pire une partie encore `PLANIFIE` avec ses événements de distribution déjà
journalisés — jamais l'inverse (statut basculé sans que les PR aient été crédités).

**Garde d'idempotence** (§4, étape 1 de `distributeResistance`) : si le journal porte
déjà un événement marqué (`resistanceStrategyKey` non nul, quelle que soit sa
valeur), la méthode rend `[]` sans rien recalculer — l'appel à `enterAtelier` se fait
alors normalement, sans jamais d'appel à `appendEvents`. Rattrape exactement le
scénario de panne ci-dessus : un rejeu de la route après un premier échec sur
`saveCampaign` ne recrée rien, et la transition de statut peut enfin aboutir. Refuser
l'opération à la place condamnerait la partie à rester `PLANIFIE` indéfiniment —
l'organisateur ne pourrait plus jamais rouvrir son atelier.

---

## 7. Séquencement RM-4 / RM-5

RM-4 est scopée « comportement constant » (aucune Strategy encore introduite,
extraction explicitement réservée à RM-5). Mais la garde d'idempotence (§6) a besoin
d'un marqueur dès que le calcul est déplacé — avant même qu'une seconde règle
existe. Pour éviter deux migrations sur la même colonne :

- **RM-4** pose : la colonne marqueur `resistanceStrategyKey` (§3) ; la méthode
  `Game.distributeResistance` et son hook (§4/§5), avec **une seule implémentation
  Strategy branchée en dur** — la règle par défaut, `key = "defaut"` (valeur
  réservée, non cataloguée) ; la garde d'idempotence ; la séparation des deux
  méthodes et l'orchestration du use case (§6) ; le retrait de l'émission actuelle
  dans `recordResult`. L'interface `ResistanceDistributionStrategy` peut déjà exister
  à ce stade (une seule implémentation qui la respecte), ou la méthode peut rester
  inline avec le critère unique — au choix de l'exécution, sans effet observable
  différent. Comportement observable strictement inchangé, tests existants adaptés.
- **RM-5** introduit : la seconde implémentation Strategy (R1), le registre de
  résolution `Campaign.resolveResistanceStrategy` (§4, remplace le branchement en dur
  de RM-4), et le texte du journal mentionnant la règle appliquée (`describe()`).

---

## 8. Impact sur l'annulation du wizard — aucun changement nécessaire

`Game.resultEventIdsForReset()` ne filtre déjà par aucun type d'événement ; la garde
de statut `PLANIFIE` suffit à circonscrire ce qu'un reset peut supprimer. Une fois la
distribution déplacée vers l'entrée en Atelier, un wizard abandonné avant "Terminer"
n'aura simplement jamais rien créé côté Points de Résistance — effet secondaire déjà
noté et accepté sur la carte RM-4 elle-même.

---

## Dettes signalées (hors périmètre de ce mécanisme)

- Le montant `3` existe aujourd'hui en **trois copies indépendantes non couplées** :
  `ResistanceContactedEvent.PR_BONUS`,
  `SabotagePointsSpentEvent.RESISTANCE_PER_SABOTAGE_POINT`, et le `/ 3` en dur du
  getter `CampaignParticipant.sabotagePoints`. Non traité par ce mécanisme — signalé
  pour mémoire.
- `EnterAtelierUseCase` n'a aujourd'hui **aucun test unitaire dédié**. RM-4 devra a
  minima en ajouter pour la garde d'idempotence et le nouvel ordre de persistance.

---

## Fichiers concernés (repères pour RM-2 à RM-5)

- `apps/backend/src/app/campaign/domain/campaign.ts` — VO `HouseRules` (deux factory
  methods), `setHouseRules`, `resolveResistanceStrategy` (registre).
- `apps/backend/src/app/campaign/domain/games/game.ts` — méthode
  `distributeResistance` (no-op par défaut), inchangé par ailleurs (`enterAtelier` ne
  bouge pas).
- `apps/backend/src/app/campaign/domain/games/evenement-tele-game.ts` — override de
  `distributeResistance` (relevé, garde d'idempotence, boucle, événements — §4).
- `apps/backend/src/app/campaign/domain/events/game-event.ts` — accesseur
  polymorphe `championshipPointsAwarded`.
- `apps/backend/src/app/campaign/domain/events/resistance-contacted.event.ts` —
  nouveau champ `strategyKey`/marqueur au constructeur.
- `apps/backend/src/app/campaign/domain/resistance-distribution-strategy.ts`
  (nouveau, nom indicatif) — interface + implémentation(s) Strategy.
- `apps/backend/src/app/campaign/house-rule-catalog.service.ts` (nouveau, nom
  indicatif) — catalogue §2.
- `database_init/data/regles-maison.yml` (nouveau).
- `apps/backend/src/app/campaign/infrastructure/entities/campaign.entity.ts`,
  `game-event.entity.ts` — colonnes.
- `apps/backend/src/app/campaign/infrastructure/campaign.mapper.ts`,
  `campaign.repository.ts` (`eventToOrm`/`toEvent`) — (dé)sérialisation du nouveau
  champ.
- `apps/backend/src/migrations/` — nouvelle migration + `index.ts`.
- `apps/backend/src/app/campaign/application/enter-atelier.usecase.ts` — ordre de
  persistance §6.
- `apps/backend/src/app/campaign/application/record-result.usecase.ts` — retrait de
  l'émission actuelle (déplacée).
- `apps/backend/src/app/campaign/dto/create-campaign.dto.ts`,
  `update-campaign.dto.ts`, `campaign-summary.dto.ts` — champ `houseRules`.
- `apps/frontend/src/app/campaigns/campaign.model.ts` et écrans associés (RM-6/RM-7,
  hors périmètre de ce document).

## Documentation à mettre à jour (par les cartes d'exécution, pas par ce document)

Conformément à CLAUDE.md — chaque carte d'exécution met à jour la doc au fil de
l'implémentation réelle, pas ce document de conception :
- [docs/spec/CAMPAIGN.md](../spec/CAMPAIGN.md) — nouvelle section « Règles maison »
  (RM-3 pour le réglage, RM-5 pour R1), mise à jour de la section « Limitations
  connues » si pertinent.
- [docs/ARCHITECTURE.md](../ARCHITECTURE.md) §3.8 — mention du registre de Strategy
  de distribution (RM-5), sur le modèle de la mention déjà faite pour les séquelles.
- [docs/DOMAIN_MODEL.md](../DOMAIN_MODEL.md) §3/§4 — colonnes `houseRules`/
  `resistanceStrategyKey` dans l'ERD (RM-3/RM-4).
- `content/docs/campagnes.md` — section « Points de Résistance » (RM-5, une fois R1
  observable par un joueur).

## Vérification / Plan de tests (repère pour les cartes d'exécution)

- **RM-3** : tests unitaires sur `HouseRules.fromPersisted`/`fromUserInput` (clé
  valide, clé inconnue → `DomainException`, clé orpheline tolérée en lecture),
  `Campaign.setHouseRules`.
- **RM-4** : tests sur `Game.distributeResistance` — cas nominal (identique au
  comportement actuel de `recordResult`), garde d'idempotence (second appel sur un
  journal déjà marqué → `[]`), garde de type (Escarmouche → `[]`), non-régression du
  comportement observable (mêmes cas que `game.spec.ts` existants, déplacés). Tests
  du nouvel ordre de persistance dans `enter-atelier.usecase.spec.ts` (nouveau
  fichier).
- **RM-5** : tests unitaires des deux implémentations Strategy (cas limites :
  participant classé dernier mais ayant franchi des portes — non éligible sous R1 ;
  participant dont les seuls points viennent du bonus Favori du Public), du registre
  de résolution, et du texte `describe()`.
- Aucun test e2e Playwright (décision de cadrage : calcul pur, entièrement couvrable
  en test unitaire).
