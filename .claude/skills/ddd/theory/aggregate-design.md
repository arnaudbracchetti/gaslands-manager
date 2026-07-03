# Identifier et délimiter un agrégat

Exemples neutres : une **commande** (`Order`) et ses **lignes** (`OrderLine`), un **compte**
(`Account`) et ses **transactions** (`Transaction`).

## Les 3 tests à appliquer

### Test 1 — Cycle de vie indépendant

> "Cet objet peut-il être créé, modifié et supprimé indépendamment ?"

| Objet | Peut exister seul ? | Verdict |
|-------|---------------------|---------|
| `Order` | Oui — créée directement | Agrégat racine ✅ |
| `OrderLine` | Non — une ligne sans commande n'a aucun sens | Entité enfant ✅ |
| `Account` | Oui — créé directement | Agrégat racine ✅ |
| `Transaction` | Non — une transaction sans compte n'a aucun sens | Entité enfant ✅ |

### Test 2 — Invariantes avec ses propres données

> "Peut-il enforcer ses invariantes en n'utilisant que ses propres données ?"

C'est le test le plus révélateur. Exemple d'une mauvaise frontière :

```
// ❌ OrderLine traitée comme "agrégat racine"
// L'invariante "total des lignes ≤ plafond de la commande" dépend de :
//   - order.plafond               → donnée EXTÉRIEURE à OrderLine
//   - le total de TOUTES les lignes → données EXTÉRIEURES à OrderLine
// → OrderLine ÉCHOUE le test d'agrégat racine

// ✅ Order agrégat racine
// L'invariante dépend de :
//   - this.plafond                → donnée DE l'agrégat Order
//   - this._lines.reduce(...)     → données DE l'agrégat Order
// → Order PASSE le test
get remaining(): number {
  return this.plafond - this._lines.reduce((sum, l) => sum + l.total, 0);
}
```

### Test 3 — Suppression en cascade

> "Quand le parent est supprimé, l'enfant doit-il l'être aussi ?"

- `Order` supprimée → ses `OrderLine` sont supprimées → entités enfants
- `Account` supprimé → ses `Transaction` sont supprimées → entités enfants

---

## La frontière d'agrégat — questions de granularité

### Trop petit (frontière trop étroite)

**Symptôme :** les règles métier nécessitent des données d'un autre agrégat pour être validées.

**Exemple :** `OrderLine` comme agrégat racine.
- `changeQuantity` doit vérifier le plafond → lit `order.plafond` → dépendance inter-agrégats
- Solution : fusionner `OrderLine` dans `Order` (la ligne devient une entité enfant)

### Trop grand (frontière trop large)

**Par défaut, viser le plus petit agrégat possible.** La majorité des agrégats bien conçus ne
contiennent que la racine et des Value Objects ; une minorité contient 2 ou 3 entités enfants au
maximum. Un enfant n'entre dans l'agrégat que s'il doit rester **transactionnellement cohérent**
avec la racine — c'est-à-dire qu'un invariant de la racine a besoin de ses données pour être
vérifié (voir Test 2 ci-dessus). Sinon, c'est un agrégat séparé, référencé par identité (voir
[concepts.md](concepts.md), §1 « Relier deux agrégats »).

**Symptôme d'une frontière trop large :** l'agrégat charge des dizaines ou des centaines
d'entités pour une simple mutation, ou contient un enfant qu'aucune règle de la racine ne
consulte jamais.

**Exemple :** si `Account` incluait tout l'historique de transactions sur plusieurs années.
- Une simple mutation chargerait l'arbre entier → surcoût mémoire/stockage inutile
- Un enfant qu'aucun invariant de `Account` ne consulte (ex. une transaction vieille de 3 ans)
  n'a pas besoin d'être DANS l'agrégat — c'est un read model, pas une entité enfant
- Solution : ne garder dans l'agrégat que ce qui est nécessaire aux invariantes (ex. un solde
  courant + les transactions de la période active) ; le reste devient un read model.

**Garde-fou de performance (secondaire, pas la règle principale) :** si malgré tout charger
l'agrégat pour une mutation ramène plus de ~200 entités enfants, c'est un signal fort qu'il faut
revoir la frontière — mais ne pas attendre ce seuil pour se poser la question : un agrégat de
20 entités qu'aucun invariant ne relie entre elles est déjà un candidat à la scission.

---

## Anti-patterns courants

### Anti-pattern 1 — La règle métier dans le service

```typescript
// ❌ Règle métier dans le service
class OrderService {
  async addLine(orderId, dto) {
    const order = await this.repo.findOne(orderId);
    const remaining = await this.computeRemaining(order); // ← règle ici
    if (dto.total > remaining) throw new Error('Plafond dépassé');
    // ...
  }
}

// ✅ Règle métier dans l'agrégat
class Order {
  addLine(itemType, qty) {
    if (itemType.unitPrice * qty > this.remaining) // ← règle ici, dans le domaine
      throw new DomainException('Plafond dépassé');
    this._lines.push(new OrderLine(itemType, qty));
  }
}
```

### Anti-pattern 2 — Le repository qui calcule des règles métier

```typescript
// ❌ Règle métier dans le repository
class OrderRepository {
  async computeRemaining(order): Promise<number> {
    // calcul (souvent en SQL) qui lit le plafond et somme les lignes → logique métier dans l'infra
  }
}

// ✅ Règle dans l'agrégat, repository ne fait que charger
class OrderRepository {
  async findById(orderId): Promise<Order> {
    // charge Order + toutes ses OrderLine
    // Order.remaining se calcule lui-même depuis ses données
  }
}
```

### Anti-pattern 3 — Accès direct à une entité enfant depuis l'extérieur

```typescript
// ❌ Accès direct à une ligne depuis la frontière
const line = await lineRepo.findOne(lineId);       // OrderLine est une entité enfant
await lineRepo.save({ ...line, quantity: qty });   // bypass l'agrégat

// ✅ Toujours passer par l'agrégat racine
const order = await orderRepo.findByLineId(lineId);
order.changeLineQuantity(lineId, qty);             // via l'agrégat
await orderRepo.save(order);
```

### Anti-pattern 4 — Getter avec hydratation implicite

```typescript
// ❌ Getter qui dépend d'une donnée transiente non garantie
class OrderLine {
  catalogItem?: CatalogItem;                 // peuplé "parfois" par un service

  get total(): number {
    return (this.catalogItem?.price ?? 0) * this.quantity; // retourne 0 si oublié !
  }
}

// ✅ Value Object qui encapsule la donnée de référence dès la création
class OrderLine {
  constructor(readonly itemType: ItemType, readonly quantity: number) {}
  get total(): number { return this.itemType.unitPrice * this.quantity; }
}
// Le VO est passé en argument ; l'entité ne dépend pas d'une hydratation extérieure.
```

### Anti-pattern 5 — La garde dupliquée chez chaque appelant

```typescript
// ❌ Deux use cases répètent le même contrôle d'état (avec des casts pour l'atteindre)
class ConfirmUseCase {
  execute(order) {
    if ((order as any).status !== 'OPEN') throw new Error('Commande figée');
    // ...
  }
}
class AddLineUseCase {
  execute(order) {
    if ((order as any).status !== 'OPEN') throw new Error('Commande figée'); // dupliqué
    // ...
  }
}

// ✅ La garde vit sur l'objet qui possède l'état
class Order {
  addLine(itemType, qty) {
    if (this._status !== OrderStatus.OPEN)
      throw new DomainException('Commande figée : plus de modification possible');
    // ...
  }
}
// Les appelants n'ont plus rien à vérifier — l'agrégat protège son propre invariant.
```

### Anti-pattern 6 — Le validateur partiel qui remplace un validateur complet

Piège classique en **déplaçant** une règle vers un nouvel emplacement : le nouveau contrôle ne voit
qu'une *partie* des données que voyait l'ancien.

```typescript
// Contexte : une ressource (la capacité) est consommée par DEUX familles d'enfants.
// ❌ On remonte le contrôle dans un composant qui ne connaît qu'UNE famille
class SpaceChecker {           // ne compte que le "matériel", pas les "rations"
  fits(gear, capacity) { return sum(gear) <= capacity; }
}
// → un sac qui dépasse la capacité À CAUSE des rations passe : régression silencieuse.

// ✅ Le contrôle vit là où TOUTES les données consommatrices sont disponibles
class Backpack {
  private get usedSpace() { return sum(this._gear) + sum(this._rations); } // les deux familles
  canAddGear(item) { return item.size <= this.capacity - this.usedSpace; }
}
```

**Règle :** en déplaçant une règle, lister les données qu'utilisait l'ancien contrôle et vérifier que
le nouvel emplacement les possède *toutes*.

### Anti-pattern 7 — Le service mort qui contourne l'agrégat

```typescript
// ❌ Un service legacy qui écrit la persistance sans passer par l'agrégat
class OrderService {
  async update(id, dto) {
    const order = await this.repo.findOne(id);
    Object.assign(order, dto);   // affecte les champs directement → saute les invariants
    await this.repo.save(order); // ex : un champ "verrouillé après confirmation" est écrasé
  }
}
// Même s'il n'est plus appelé, il reste un danger latent : la première réutilisation
// réintroduit un contournement d'invariant. → le supprimer.

// ✅ Toute mutation passe par une méthode de l'agrégat qui protège ses invariants
order.rename(dto.name);   // lève si l'état interdit le renommage
await orderRepo.save(order);
```

---

## Checklist avant de valider la frontière

- [ ] L'agrégat peut-il enforcer **toutes** ses invariantes sans lire de données extérieures ?
- [ ] Toutes les mutations passent-elles par l'agrégat racine (jamais directement sur les enfants) ?
- [ ] L'agrégat est-il aussi petit que possible (chaque enfant est-il nécessaire à un invariant de la racine), le seuil de ~200 entités n'étant qu'un garde-fou de dernier recours ?
- [ ] Les références vers d'autres agrégats se font-elles par identité (id), jamais par objet direct ?
- [ ] Les entités enfants sont-elles supprimées en cascade avec leur racine ?
- [ ] Aucun service ne contient de règle métier (seulement de l'orchestration) ?
- [ ] Les gardes d'état vivent-elles sur l'objet qui possède l'état (pas dupliquées chez l'appelant) ?
- [ ] En déplaçant une règle, le nouvel emplacement possède-t-il **toutes** les données de l'ancien ?
- [ ] Les getters de l'agrégat n'ont-ils pas de dépendances implicites non garanties ?
- [ ] Reste-t-il un service capable d'écrire la persistance en contournant l'agrégat ? (à supprimer)
