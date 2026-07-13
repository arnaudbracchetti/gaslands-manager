# Séquelles — Design

## Contexte

Le jeu Gaslands (p.170) prévoit des **Séquelles** : des inconvénients permanents qu'un
véhicule peut acquérir en échange de Chocs accumulés en partie, uniquement lors de la
phase Atelier (le véhicule n'a pas encore de Chocs à la création d'équipe). Un système
partiel existe déjà dans le code : 4 séquelles **mécaniques** (`moteur_endommage`,
`direction_endommage`, `blindage_arrache`, `siege_irrecuperable`), codées en dur dans
[sequella-decorators.ts](../../apps/backend/src/app/team/domain/sequella-decorators.ts),
imposées automatiquement par la Table des Épaves. Ce système partiel a deux lacunes :
aucun catalogue YAML (pas aligné avec le pattern Avantage/Amélioration), et **aucune
garde d'origine** — rien n'empêche aujourd'hui d'acheter volontairement ces séquelles
mécaniques via l'endpoint atelier existant (`POST .../events/sequella`).

Cette conception ajoute les **11 séquelles "volontaires"** du livre de règles
(Suicidaire, Impopulaire, Dingue, Lâche, Vieille Blessure de Guerre, Vibrations,
Convulsions, Maintenu par la Rouille, Dur à Cuire, Légende Vivante), unifie l'ensemble
(15 séquelles) dans un catalogue YAML unique, corrige la faille d'origine, et modélise
les 3 cas particuliers (Dur à Cuire, Maintenu par la Rouille, Légende Vivante).

**Périmètre** : backend uniquement. Aucune UI n'existe aujourd'hui pour les séquelles
côté atelier (aucun affichage des Chocs, aucun bouton d'achat) — ce sera un chantier
Temps 2 séparé, cohérent avec le reste de l'atelier (cf. `docs/spec/CAMPAIGN.md`,
section "Limitations connues").

**Principe directeur retenu après plusieurs itérations** : ne pas traiter les
séquelles différemment des armes/améliorations/avantages déjà en place. Elles suivent
**exactement** le même mécanisme d'achat/revente (`EquipmentChangedEvent`), avec
seulement deux différences : la monnaie (Chocs du véhicule, pas cagnotte du
participant) et une garde supplémentaire sur la revente (cf. Légende Vivante
ci-dessous).

---

## 1. Catalogue — `database_init/data/sequelle.yml`

Nouveau fichier, chargé par `CatalogService.onModuleInit()` selon le pattern déjà en
place pour `avantage.yml`/`amelioration.yml` (lecture YAML, conversion Markdown→HTML de
`description`, `Map` en mémoire). 15 entrées : les 4 mécaniques existantes (migrées
depuis le TS codé en dur) + les 11 nouvelles.

| Champ | Type | Description |
|---|---|---|
| `nom` | string | Libellé affiché |
| `nom_interne` | string | Identifiant stable |
| `description` | string (Markdown) | Texte de la règle |
| `chocs_cost` | number | Coût en Chocs (0 pour les séquelles imposées) |
| `origine` | `'ATELIER' \| 'TABLE_EPAVES'` | **Nouveau champ clé** — distingue achat volontaire vs résultat de tirage automatique |
| `comportement` | string, optionnel | Réservé au pattern Décorateur (stats effectives) — présent **uniquement** pour les 4 séquelles qui modifient une stat (`moteur_endommage`, `direction_endommage`, `blindage_arrache`, `siege_irrecuperable`). Absent pour les 11 autres, y compris les 3 cas particuliers : leur comportement spécial ne passe pas par le Décorateur de stats mais par du code dédié (use case / `WreckTable`) qui les reconnaît directement via leur `nom_interne` fixe |

```yaml
sequelles:
  - nom: Moteur endommagé
    nom_interne: moteur_endommage
    chocs_cost: 0
    origine: TABLE_EPAVES
    comportement: moteur_endommage
  - nom: Direction endommagée
    nom_interne: direction_endommage
    chocs_cost: 0
    origine: TABLE_EPAVES
    comportement: direction_endommage
  - nom: Blindage arraché
    nom_interne: blindage_arrache
    chocs_cost: 0
    origine: TABLE_EPAVES
    comportement: blindage_arrache
  - nom: Siège irrécupérable
    nom_interne: siege_irrecuperable
    chocs_cost: 0
    origine: TABLE_EPAVES
    comportement: siege_irrecuperable
  - nom: Suicidaire
    nom_interne: suicidaire
    chocs_cost: 1
    origine: ATELIER
  - nom: Impopulaire
    nom_interne: impopulaire
    chocs_cost: 1
    origine: ATELIER
  - nom: Dingue
    nom_interne: dingue
    chocs_cost: 2
    origine: ATELIER
  - nom: Lâche
    nom_interne: lache
    chocs_cost: 2
    origine: ATELIER
  - nom: Vieille Blessure de Guerre
    nom_interne: vieille_blessure_de_guerre
    chocs_cost: 3
    origine: ATELIER
  - nom: Vibrations
    nom_interne: vibrations
    chocs_cost: 3
    origine: ATELIER
  - nom: Convulsions
    nom_interne: convulsions
    chocs_cost: 4
    origine: ATELIER
  - nom: Maintenu par la Rouille
    nom_interne: maintenu_par_la_rouille
    chocs_cost: 5
    origine: ATELIER
  - nom: Dur à Cuire
    nom_interne: dur_a_cuire
    chocs_cost: 6
    origine: ATELIER
  - nom: Légende Vivante
    nom_interne: legende_vivante
    chocs_cost: 11
    origine: ATELIER
```

`ICatalogRepository` (`apps/backend/src/app/team/domain/catalog.repository.interface.ts`)
gagne `getSequelleType(nomInterne)` / `getAllSequelles()`, symétriques à
`getAdvantageType`/`getAllAvantages`. `CatalogAdapter`
(`apps/backend/src/app/team/infrastructure/catalog.adapter.ts`) les implémente.
`SequelleType` (VO, remplace/étend `SequellaType` dans
[sequella-type.ts](../../apps/backend/src/app/team/domain/value-objects/sequella-type.ts))
gagne le champ `origine`.

---

## 2. Domaine — `Sequella` comme entité enfant de `Vehicle`

`Vehicle._sequellas` cesse d'être une liste plate de VO `SequellaType` partagés pour
devenir une liste de **`Sequella`**, entité enfant à part entière — miroir exact
d'`Advantage` :

```ts
class Sequella {
  id: number;
  type: SequelleType;
  private _isSold: boolean = false;
  get isSold(): boolean { return this._isSold; }
  get price(): number { return this.type.chocsCost; } // jamais réduit, comme Advantage.price
  markSold(): void { this._isSold = true; }
  clearSold(): void { this._isSold = false; }
}
```

**Nouvelles méthodes sur `Vehicle`** (fichier
[vehicle.ts](../../apps/backend/src/app/team/domain/vehicle.ts), à côté de `canAddAdvantage`
lignes 247-261 qui sert de modèle direct) :

- **`canAddSequella(type: SequelleType): RuleResult`** — lecture pure :
  1. Rejette si `type.origine !== 'ATELIER'` (corrige la faille actuelle).
  2. Rejette si une séquelle `ATELIER` de même `nom_interne` est déjà active
     (`!isSold && type.equals(...)`), comme `canAddAdvantage`.
  3. Rejette si `this.chocs < type.chocsCost`.
- **`canRemoveSequella(type: SequelleType, isSameSession: boolean): RuleResult`** :
  - Si `isSameSession` → toujours autorisé (annulation standard, comme tout objet).
  - Sinon (revente cross-session) → autorisé **seulement si**
    `this.hasActiveSequella('legende_vivante')`. Sinon rejeté.
- **`hasActiveSequella(nomInterne: string): boolean`** — helper partagé, réutilisé par
  `canRemoveSequella` et par `WreckTable` (cf. §4).

**`Advantage`** (même fichier ou son propre value-object) gagne un champ
`grantedBySequellaNomInterne: string | null` (défaut `null`) — utilisé uniquement par
Dur à Cuire, cf. §3.

**Qui appelle `canAddSequella`/`canRemoveSequella`** : `Game.changeEquipment()`
(jamais le use case ni un endpoint directement) — cohérent avec le principe déjà en
place dans ce module ("aucune règle métier dans un use case si l'agrégat peut la
porter").

---

## 3. Event-sourcing — unification dans `EquipmentChangedEvent`

**Classes retirées** : `SequellaAddedEvent`
([sequella-added.event.ts](../../apps/backend/src/app/campaign/domain/events/sequella-added.event.ts))
et l'idée d'un `SequellaRemovedEvent` séparé (jamais créée) — tout passe désormais par
`EquipmentChangedEvent`, dont `entityType` gagne la valeur `'SEQUELLE'`.

**Différences de traitement selon `entityType === 'SEQUELLE'`** :
- Monnaie : `execute()`/`undo()` débitent/créditent `vehicle.chocs`
  (`vehicle.addChocs`) au lieu de `participant.wallet` (`creditWallet`).
- Sinon, dualité **identique** à `ADVANTAGE` : achat annulé si encore dans la session
  d'atelier en cours (`wasPurchasedThisSession` — suppression du `BUY` du journal,
  remboursement intégral) ; sinon revente (`SELL`, toujours **0** remboursement, comme
  `Advantage.price` jamais réduit).
- **Seule vraie différence avec `ADVANTAGE`** : la revente (`SELL` cross-session) est
  gardée par `Vehicle.canRemoveSequella` — rejetée par défaut, sauf présence de
  Légende Vivante.
- Identification par `nomInterne` seul (pas de `targetEntityId`) : l'unicité garantit
  au plus une instance `ATELIER` active par type, comme pour un avantage.

**Cas particulier Dur à Cuire** — un seul événement porte les deux effets :
```ts
// BUY(SEQUELLE, 'dur_a_cuire').execute()
vehicle.addChocs(-cost);
vehicle.addSequella(type);
if (freeAdvantageNomInterne) {
  vehicle.addAdvantage(advantageType); // coût 0 ; taggé grantedBySequellaNomInterne='dur_a_cuire'
}
```
`undo()` défait symétriquement les deux. **Annulation même session** : supprimer ce
seul événement du journal fait disparaître séquelle + avantage au prochain replay —
atomique par construction, aucun lien entre événements à maintenir.

**Revente cross-session de Dur à Cuire** (atteignable seulement via Légende Vivante,
cf. §4) : `SELL(SEQUELLE, 'dur_a_cuire').execute()` marque la séquelle vendue, **et**
retrouve l'avantage taggé sur l'état courant du véhicule
(`vehicle.advantages.find(a => a.grantedBySequellaNomInterne === 'dur_a_cuire' && !a.isSold)`)
pour le marquer vendu aussi — aucune recherche dans le journal, juste une propriété de
l'état déjà répliqué.

Nouveau champ sur `EquipmentChangedEvent` : `freeAdvantageNomInterne: string | null`
(colonne `GAME_EVENT` nullable), renseigné uniquement pour `BUY(SEQUELLE,
'dur_a_cuire')`.

**Migration `WreckTable`** : le point de construction qui produit aujourd'hui un
`SequellaAddedEvent` en dur pour `siege_irrecuperable`
([wreck-table.ts](../../apps/backend/src/app/campaign/domain/wreck/wreck-table.ts) lignes
74-76) doit désormais construire `EquipmentChangedEvent(BUY, SEQUELLE, nomInterne,
cost=0)`.

---

## 4. `WreckTable` — deux modificateurs permanents et composables

`WreckTable` distingue déjà en interne une opération "tirer une fois" (D6 + Chocs
courants → ligne du tableau → événements) d'une boucle de résolution globale. Les
deux séquelles à comportement spécial deviennent deux modificateurs indépendants de
cette opération élémentaire, qui se composent sans se connaître :

- **`legende_vivante`** (effet **permanent**, pas de consommation) : si
  `vehicle.hasActiveSequella('legende_vivante')`, l'opération élémentaire utilise la
  valeur `1` au lieu d'appeler `IRandomizer` — à chaque tirage, tant que la séquelle
  reste active.
- **`maintenu_par_la_rouille`** (permanent également) : si
  `vehicle.hasActiveSequella('maintenu_par_la_rouille')`, la résolution globale
  rappelle l'opération élémentaire une seconde fois après avoir appliqué la première
  (Chocs mis à jour entre les deux), et concatène les `descriptions`.

Un véhicule avec les deux séquelles obtient deux résultats "1" (chacun recalculé avec
son propre total de Chocs courant) — composition naturelle, aucun code spécifique
d'interaction entre les deux séquelles.

**Retrait de Légende Vivante n'est plus un cas spécial en soi** : puisque la revente
d'une séquelle est désormais le même mécanisme que pour tout objet (juste gardé par
`canRemoveSequella`), Légende Vivante n'ouvre qu'une **condition** déjà couverte par
la garde du §2/§3 — aucun événement ni champ de liaison supplémentaire.

---

## 5. API — un seul endpoint pour tout

`AddSequellaUseCase`
([add-sequella.usecase.ts](../../apps/backend/src/app/campaign/application/add-sequella.usecase.ts))
et l'endpoint dédié `/events/sequella` sont **retirés**. Tout passe par l'endpoint
générique existant :

```
POST /api/campaigns/:id/events/equipment
{ operation: 'BUY' | 'SELL', entityType: 'SEQUELLE', nomInterne, vehicleId,
  freeAdvantageNomInterne? }
```

`ChangeEquipmentUseCase` existant est étendu pour `entityType SEQUELLE` (orchestration
pure : charge/replay, vérifie le participant, délègue à `Game.changeEquipment()`,
catch `DomainException` → `BadRequestException`, persiste). Aucun nouveau use case.

---

## Fichiers concernés

- `database_init/data/sequelle.yml` — nouveau.
- `apps/backend/src/app/team/domain/value-objects/sequella-type.ts` — ajout `origine`.
- `apps/backend/src/app/team/domain/vehicle.ts` — `Sequella` entité, `canAddSequella`,
  `canRemoveSequella`, `hasActiveSequella` ; `Advantage.grantedBySequellaNomInterne`.
- `apps/backend/src/app/team/domain/sequella-decorators.ts` — les 4 décorateurs
  mécaniques restent, mais leur `SequellaType` vient désormais du catalogue (plus de
  `SEQUELLA_REGISTRY` figé en dur).
- `apps/backend/src/app/team/domain/catalog.repository.interface.ts` +
  `apps/backend/src/app/team/infrastructure/catalog.adapter.ts` — `getSequelleType`/
  `getAllSequelles`.
- `apps/backend/src/app/catalog/catalog.service.ts` — chargement `sequelle.yml`.
- `apps/backend/src/app/campaign/domain/events/equipment-changed.event.ts` — entityType
  `SEQUELLE`, champ `freeAdvantageNomInterne`, logique Dur à Cuire.
- `apps/backend/src/app/campaign/domain/games/game.ts` — `changeEquipment()` étendu
  (garde `canAddSequella`/`canRemoveSequella`).
- `apps/backend/src/app/campaign/domain/wreck/wreck-table.ts` — migration vers
  `EquipmentChangedEvent`, modificateurs Rouille/Légende Vivante.
- `apps/backend/src/app/campaign/domain/events/sequella-added.event.ts` — supprimé.
- `apps/backend/src/app/campaign/application/add-sequella.usecase.ts` — supprimé,
  absorbé par `ChangeEquipmentUseCase`.
- ORM : entité `game-event.entity.ts` (nouvelle colonne `freeAdvantageNomInterne`),
  `campaign.mapper.ts` (mapping).
- `apps/backend/src/app/campaign/application/get-workshop.usecase.ts` — mapping
  `sequellas` à ajuster pour la nouvelle forme `Sequella` (isSold).

## Documentation à mettre à jour

- `docs/spec/CAMPAIGN.md` — nouvelle sous-section "Séquelles", mise à jour
  "Annulation d'achat vs revente", retrait de la mention "séquelles spéciales
  absentes" dans "Limitations connues", table des endpoints.
- `docs/ARCHITECTURE.md` — §3.4 (`Sequella` entité), §3.8 (retrait des 2 événements
  obsolètes, `WreckTable` étendu).
- `docs/DOMAIN_MODEL.md` — diagramme agrégat (§1, `Sequella`), diagramme catalogue
  (§2, `Sequelle`), ERD (§3, colonne `freeAdvantageNomInterne`, `entityType` gagne
  `SEQUELLE`), tableau des événements (§4).

## Vérification / Plan de tests

Backend uniquement (aucune UI dans ce périmètre) :
- Tests unitaires `Vehicle` : `canAddSequella` (garde origine, unicité, Chocs),
  `canRemoveSequella` (garde session + Légende Vivante), `hasActiveSequella`.
- Tests unitaires `EquipmentChangedEvent` : BUY/SELL `SEQUELLE` (monnaie Chocs),
  bundling Dur à Cuire (execute/undo des deux effets), revente Dur à Cuire qui vend
  aussi l'avantage taggé.
- Tests unitaires `WreckTable` : forçage à 1 (Légende Vivante), double tirage chaîné
  (Rouille), composition des deux ensemble.
- Tests unitaires `ChangeEquipmentUseCase`/`Game.changeEquipment()` : rejet achat
  d'une séquelle `TABLE_EPAVES` en atelier, rejet revente cross-session sans Légende
  Vivante, acceptation avec.
- Tests unitaires `CatalogService` : chargement de `sequelle.yml`.
- `backend-e2e` : achat séquelle (Chocs décrémentés), doublon rejeté, Chocs
  insuffisants rejetés, achat `TABLE_EPAVES` en atelier rejeté, Dur à Cuire bout-en-
  bout (séquelle + avantage), annulation même session (les deux disparaissent),
  tirage Table des Épaves avec Rouille/Légende Vivante actifs.
- Commande : `npx nx test backend` (unitaires) puis `npx nx e2e backend-e2e` (après
  `npx nx serve backend` dans un terminal séparé, cf. `docs/E2E_TESTING.md`).
