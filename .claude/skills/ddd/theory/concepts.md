# Concepts DDD — référence

Les exemples ci-dessous utilisent un domaine neutre volontairement banal — une **commande**
(`Order`) composée de **lignes** (`OrderLine`), un **compte** (`Account`), une **réservation**
(`Reservation`) — pour illustrer sans supposer de stack ni de projet particulier.

## Les 7 blocs de construction

### 1. Agrégat racine (Aggregate Root)

L'unité de cohérence transactionnelle. Toutes les mutations passent par lui.

**Règles :**
- Seul l'agrégat racine est accessible depuis l'extérieur (pas d'accès direct aux enfants)
- Les invariantes de l'agrégat sont **toujours vraies**, avant et après chaque mutation
- Le repository ne persiste que des agrégats racines (jamais une entité enfant isolément)
- Une transaction = une mutation sur un seul agrégat

**Exemples :**
- `Order` est un agrégat racine (contient `OrderLine[]`)
- `Account` est un agrégat racine (contient ses `Transaction[]`)
- Une entité traitée comme racine alors qu'elle a besoin des données d'une autre pour valider
  ses règles n'est PAS une racine — c'est le "bug de frontière" le plus courant (voir
  [aggregate-design.md](aggregate-design.md), Test 2).

**Relier deux agrégats distincts : par identité, jamais par référence.**

Deux agrégats racines qui doivent se désigner l'un l'autre (ex. `Order` et `Customer`) ne se
tiennent jamais par un pointeur d'objet — seulement par l'`id` de l'autre.

```typescript
// ❌ Référence directe — invite à muter Customer depuis Order, dans la même transaction
class Order {
  constructor(readonly customer: Customer) {}
}

// ✅ Référence par identité — Order ne peut pas muter Customer, seulement le désigner
class Order {
  constructor(readonly customerId: Id) {}
}
```

**Pourquoi :** si l'agrégat ne détient aucune référence d'objet, il ne peut pas muter l'autre
agrégat — la règle « une transaction = un agrégat » (voir Règles ci-dessus) est protégée par
construction, pas seulement par discipline. Charger `Customer` pour l'afficher reste possible
(via son propre repository) ; ce qui est proscrit, c'est de le tenir en mémoire *à l'intérieur*
de l'agrégat `Order` et de le muter dans le même appel.

**Créer un agrégat : constructeur ou factory ?**

Un constructeur simple suffit quand la création n'assemble que quelques champs déjà valides.
Une **factory** (méthode statique ou fonction dédiée) devient utile quand :
- la création assemble plusieurs objets et doit poser un invariant **dès la naissance**
  (ex : une commande créée avec sa première ligne, jamais vide) ;
- l'agrégat doit être **reconstitué** depuis la persistance — un chemin distinct du chemin de
  création "neuve" (voir Value Object, `static from(raw)`, pour le même principe appliqué aux VO).

Dans les deux cas, la factory reste un domaine pur : une fonction/méthode statique sans
dépendance à un framework (voir SKILL.md, règle transversale 4).

**Garder l'invariant dès la construction, pas seulement en mutation.**

L'invariante « toujours vraie avant et après chaque mutation » (voir Règles ci-dessus) s'applique
aussi à l'instant zéro : un constructeur/factory qui accepterait un état initial incohérent
romprait la garantie dès la création.

```typescript
class Order {
  private constructor(readonly customerId: Id, private _lines: OrderLine[]) {
    if (_lines.length === 0) throw new DomainException('Une commande naît avec au moins une ligne');
  }

  // Création "neuve" — valide l'invariant depuis rien
  static create(customerId: Id, firstLine: OrderLine): Order {
    return new Order(customerId, [firstLine]);
  }

  // Reconstitution depuis la persistance — l'état est déjà validé à l'écriture
  static reconstitute(customerId: Id, lines: OrderLine[]): Order {
    return new Order(customerId, lines);
  }
}
```

**Nuance reconstitution :** au chargement depuis le repository, on fait confiance à l'état déjà
validé lors de l'écriture précédente — inutile de re-vérifier les invariants à chaque lecture.
Ne valider que des données réellement neuves (ex. une valeur apportée par l'appelant), jamais
des données relues telles quelles depuis le store.

---

### 2. Entité enfant (Entity)

Un objet avec une identité (`id`) mais dont le cycle de vie est gouverné par son agrégat racine.

**Caractéristiques :**
- A un `id` qui le distingue des autres entités du même type
- Ne peut pas être créé ou supprimé sans passer par l'agrégat racine
- Ses mutations passent par des méthodes de l'agrégat (jamais directement)

**Exemples :**
- `OrderLine` est une entité enfant de `Order`
- `Transaction` est une entité enfant de `Account`

**Test :** "Puis-je supprimer cette entité sans supprimer son parent ?" — Si non → entité enfant.

---

### 3. Value Object (VO)

Un objet défini par sa **valeur**, pas par son identité. Immuable.

**Caractéristiques :**
- Pas d'`id` — deux VO avec les mêmes données sont identiques
- Immuable : on ne modifie pas un VO, on en crée un nouveau
- Encapsule une règle de validation (ex : un montant a une devise et ne peut être négatif)
- Expose une API métier typée plutôt que des données brutes

**Exemple — un VO qui enveloppe une donnée de référence brute :**
```typescript
// Value Object qui enveloppe une entrée de catalogue (donnée brute et immuable)
// et expose une API métier typée.
class ItemType {
  private constructor(private readonly raw: CatalogItem) {}
  static from(raw: CatalogItem): ItemType { return new ItemType(raw); }

  get ref(): string { return this.raw.ref; }
  get unitPrice(): number { return this.raw.price; }     // le cast/normalisation vit ICI
  get isBackorderable(): boolean { return this.raw.stock === 'on_demand'; }
}
```

**VO vs Entité :**
| | Value Object | Entité |
|---|---|---|
| Identité | Non (défini par valeur) | Oui (défini par `id`) |
| Mutabilité | Immuable | Mutable (via l'agrégat) |
| Égalité | Structurelle | Par `id` |
| Exemple | `Money`, `ItemType` | `Order`, `OrderLine` |

**Quand créer un VO :** dès qu'une donnée a des règles de validation ou encapsule un calcul
(ex : `Money` avec `add`, `isNegative` ; `Budget` avec `remaining`, `isExceeded`).

**Rendre les états illégaux non-représentables.** Plutôt que d'accepter une donnée brute puis de
la valider a posteriori, préférer un type qui ne peut **pas** représenter l'invalide :
- un Value Object auto-validant dans son constructeur — aucune instance invalide ne peut circuler ;
- une union de types pour un statut, plutôt qu'un champ nullable qui encode implicitement
  plusieurs significations à la fois (le symptôme inverse est l'anti-pattern 4 de
  [aggregate-design.md](aggregate-design.md) — un getter qui dépend d'une donnée "parfois"
  présente, qui aurait dû être un type distinct).

---

### 4. Use Case (Application Service)

Orchestre une commande métier. Ne contient **aucune règle métier**.

**Flux systématique :**
```
1. Charger l'agrégat (et vérifier les autorisations d'accès)
2. Résoudre les Value Objects depuis les sources de référence
3. Déléguer à l'agrégat → exception de domaine éventuelle
4. Persister via le repository
```

**Ce qu'un use case NE fait PAS :**
- Calculer une règle métier (total, plafond, disponibilité)
- Décider si une opération est autorisée par les règles du domaine

**Ce qu'un use case fait :**
- Charger les données nécessaires (agrégat + données de référence)
- Appeler la bonne méthode de domaine
- Traduire l'exception de domaine → erreur de transport (**seul** endroit de ce mapping)
- Persister et retourner le DTO

```typescript
// ✅ Use case bien formé
class AddLineUseCase {
  async execute(orderId: Id, itemRef: string, qty: number): Promise<void> {
    const itemType = this.catalog.getItemType(itemRef);   // VO depuis la source de référence
    const order = await this.orderRepo.findById(orderId);  // charger l'agrégat
    try {
      order.addLine(itemType, qty);                        // déléguer la règle au domaine
    } catch (e) {
      // Traduire UNIQUEMENT l'erreur de domaine ; propager tout le reste.
      if (e instanceof DomainException) throw toTransportError(e.message); // ex. 400 côté HTTP
      throw e;
    }
    await this.orderRepo.save(order);                      // persister
  }
}
```

**Exception vs verdict — comment choisir :** lever une `DomainException` pour une violation
d'invariant (un état qui ne devrait jamais survenir depuis une interface correcte). Retourner un
verdict (`RuleResult`, voir *Specification* dans [cqrs.md](cqrs.md)) quand l'appelant a besoin de
la réponse sans provoquer d'erreur — ex. calculer une disponibilité pour l'affichage.

---

### 5. Domain Service

Logique métier qui implique plusieurs agrégats, mais qui n'"appartient" naturellement à aucun.

**Rare** — à n'utiliser que si la logique ne peut pas vivre dans un agrégat.

**Exemple :** un transfert entre deux `Account` (retirer de l'un, créditer l'autre) ne "possède" pas
naturellement un seul agrégat. Quand une seule racine possède toutes les données (ex : le plafond
d'une `Order` et le total de ses lignes), la règle vit dans l'agrégat, pas dans un domain service.

---

### 6. Repository (interface)

Contrat de persistence défini **par le domaine**, implémenté par l'infrastructure.

**Règles :**
- L'interface vit dans la couche domaine (aucune dépendance à la technologie de stockage)
- L'implémentation vit dans l'infrastructure
- Le domaine ne sait pas comment/où les données sont stockées
- Un repository charge et sauvegarde des **agrégats complets** (pas des entités enfants isolément)
- Les requêtes légères (listes, comptages) peuvent retourner des DTOs directement — pas d'agrégat

**Pattern de l'interface :**
```typescript
export interface IOrderRepository {
  // Requêtes légères (lecture seule, pas d'agrégat)
  findSummariesForCustomer(customerId: Id): Promise<OrderSummaryDto[]>;

  // Chargement d'agrégat (pour toute mutation)
  findById(orderId: Id): Promise<Order>;
  findByLineId(lineId: Id): Promise<Order>;   // localise la racine via un enfant

  // Persistance
  save(order: Order): Promise<void>;
  remove(orderId: Id): Promise<void>;
}
```

**Pourquoi une entrée `findByLineId` ?**
Si une opération est adressée par l'id d'un enfant (ex : une route sur une ligne de commande),
le repository doit naviguer jusqu'à la racine `Order` — l'appelant ne connaît pas forcément l'id
de la racine. Charger "par l'enfant" doit résoudre l'id de la racine puis recharger l'agrégat
complet (charger directement via l'enfant tend à ne rapporter qu'un agrégat partiel).

---

### 7. Domain Event

Un fait métier passé (`CommandeConfirmée`, `PartieClôturée`) qu'un agrégat émet après une mutation
réussie, pour déclencher une réaction sur un **autre** agrégat — dans une transaction distincte.

**Pourquoi :** une opération métier a parfois besoin d'affecter deux agrégats. Les charger et les
muter dans la même transaction violerait « une transaction = un agrégat » (voir §1). Le domain
event permet de coordonner par **cohérence éventuelle** plutôt que par cohérence immédiate.

**Version légère (celle de ce skill) :** pas besoin de bus de messages ni d'infrastructure event
sourcing complète pour en tirer bénéfice — un dispatch en-process suffit, juste avant ou juste
après le commit de la transaction qui a produit l'événement.

```typescript
// L'agrégat émet l'événement, sans connaître qui va le traiter
class Order {
  confirm(): DomainEvent[] {
    if (this._status !== OrderStatus.OPEN) throw new DomainException('Déjà confirmée');
    this._status = OrderStatus.CONFIRMED;
    return [new OrderConfirmedEvent(this.id, this.customerId)];
  }
}

// Un handler, dans une transaction séparée, réagit sur l'AUTRE agrégat
class OnOrderConfirmed {
  async handle(event: OrderConfirmedEvent): Promise<void> {
    const customer = await this.customerRepo.findById(event.customerId);
    customer.recordPurchase(event.orderId);
    await this.customerRepo.save(customer);
  }
}
```

**Règle de décision :** une opération doit affecter deux agrégats ? Ne pas les charger ensemble —
émettre un événement depuis le premier ; un handler mute le second dans un second temps. Si ce
découpage semble artificiel et que les deux agrégats sont *toujours* mutés ensemble, c'est peut-
être le signe qu'ils devraient n'en former qu'un seul (revoir la frontière, voir
[aggregate-design.md](aggregate-design.md)).

---

## Résumé visuel — qui fait quoi

```
Frontière (controller/handler) → transport uniquement (extraire params, renvoyer DTO)
     ↓
Use Case          → orchestration (charger, déléguer, persister, traduire les erreurs)
     ↓
Aggregate Root    → invariantes, règles métier (lève une exception de domaine)
  └─ Entity       → données avec identité, mutée via l'agrégat
  └─ Value Object → données immuables, typées, validées
     ↓
Repository (IF)   → contrat de persistence (défini par le domaine)
     ↓
Repository (IMPL) → technologie de stockage (infrastructure)
     ↓
Adapter externe   → source de référence (catalogue, service tiers) → interface du domaine
```

**Note — coordination entre agrégats :** ce schéma décrit le flux **à l'intérieur** d'une
transaction sur un seul agrégat. Quand une opération doit affecter un second agrégat, celui-ci
ne rentre pas dans le même flux — voir §7 Domain Event.
