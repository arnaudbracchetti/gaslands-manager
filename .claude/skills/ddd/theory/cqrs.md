# CQRS léger — commandes vs requêtes

## Le principe

**CQRS** (Command Query Responsibility Segregation) sépare les opérations en deux catégories
aux chemins d'exécution différents.

Version **légère** (celle décrite ici) : pas d'event sourcing, pas de bus de messages — juste une
distinction claire entre les deux chemins dans le même processus.

```
Commande  →  charger l'agrégat  →  muter  →  persister  →  DTO de retour
Requête   →  lecture directe    →  DTO    →  (pas d'agrégat)
```

---

## Identifier une commande vs une requête

| Opération | Type | Pourquoi |
|-----------|------|---------|
| lister les commandes | Requête | Lecture seule, pas de mutation |
| créer une commande | Commande | Crée un agrégat |
| lire une commande | Requête | Lecture seule |
| modifier une commande | Commande | Mute l'agrégat |
| supprimer une commande | Commande | Supprime l'agrégat |
| lister les articles ajoutables à une commande | Requête hybride | Lit des règles mais ne mute pas |
| ajouter une ligne à une commande | Commande | Mute l'agrégat |

**Règle simple :** si l'opération modifie l'état persisté → commande. Sinon → requête.

---

## Le chemin d'une commande

```typescript
async execute(orderId: Id, itemRef: string, qty: number): Promise<LineDto> {
  // 1. Résoudre les inputs via la source de référence (Value Object)
  const itemType = this.catalog.getItemType(itemRef);      // erreur "introuvable" si inconnu

  // 2. Charger l'agrégat COMPLET (avec tous ses enfants)
  const order = await this.orderRepo.findById(orderId);    // erreur "introuvable" / accès refusé

  // 3. Déléguer la règle métier à l'agrégat
  try {
    order.addLine(itemType, qty);                          // exception de domaine si règle violée
  } catch (e) {
    if (e instanceof DomainException) throw toTransportError(e.message);
    throw e;
  }

  // 4. Persister l'agrégat entier
  await this.orderRepo.save(order);

  // 5. Retourner un DTO (jamais l'agrégat directement)
  return toLineDto(order.lines.at(-1));
}
```

**Invariant du chemin commande :** l'agrégat est toujours chargé **avant** la mutation, jamais après.
La cohérence est garantie dans la même transaction.

---

## Le chemin d'une requête légère

```typescript
// Requête directe — AUCUN agrégat domaine chargé.
async execute(customerId: Id): Promise<OrderSummaryDto[]> {
  return this.orderRepo.findSummariesForCustomer(customerId);
}

// Implémentation infrastructure : projeter directement les champs voulus
// (SQL, ou l'API de ton store), avec les agrégats calculés (COUNT, SUM, EXISTS…),
// sans reconstruire d'agrégat domaine.
```

**Pourquoi ne pas charger l'agrégat pour une liste ?**
- Performance : charger l'agrégat complet pour n'afficher qu'un nom et un compteur serait un surcoût énorme.
- Séparation : une liste est une **vue**, pas une donnée sur laquelle on prend des décisions métier.

---

## Read Model — un DTO de vue

Le read model est un DTO "plat" produit directement par la requête. Il ne passe pas par l'agrégat et
ne porte aucune règle.

```typescript
type OrderSummaryDto = {
  id: Id;
  reference: string;
  status: string;
  lineCount: number;   // agrégat calculé (COUNT)
  total: number;       // agrégat calculé (SUM)
  createdAt: Date;
};
```

**Différence avec l'agrégat `Order` :**
- `Order` (agrégat) → chargé pour les mutations, contient les règles métier.
- `OrderSummaryDto` → chargé pour l'affichage, calculé par la requête, sans logique métier.

---

## Requête hybride — calculer un verdict sans muter

Certaines requêtes ont besoin de l'agrégat pour calculer un verdict (disponibilité, éligibilité),
mais ne le mutent pas.

```typescript
async execute(orderId: Id): Promise<AvailableItemDto[]> {
  // Charger l'agrégat pour accéder à son état courant (plafond, lignes déjà présentes)
  const order = await this.orderRepo.findById(orderId);

  return this.catalog.items().map(item => {
    const type = ItemType.from(item);
    const verdict = order.canAddLine(type);   // l'agrégat décide, sans muter
    return { ref: type.ref, available: verdict.ok, reason: verdict.ok ? undefined : verdict.reason };
  });
}
```

**C'est une requête** (pas de mutation, pas de `save`), mais elle charge l'agrégat parce qu'elle a
besoin de son état pour calculer les verdicts. Point clé : le verdict d'affichage et la règle
d'écriture appellent **la même** méthode de domaine (`canAddLine`), jamais deux implémentations
divergentes.

**C'est une application légère du pattern *Specification*** : une règle métier encapsulée dans
un objet/méthode qui répond « oui/non (+ raison) », réutilisable dans plusieurs contextes. Ici,
une seule implémentation (`canAddLine`) sert à la fois de :
1. garde à l'écriture (`addLine` lève si le verdict est négatif) ;
2. verdict de lecture (cette section) ;
3. filtre de requête (ne lister que les éléments disponibles).

Jamais trois implémentations divergentes de la même règle.

---

## Résumé — règles de décision

| Situation | Action |
|-----------|--------|
| Lire une liste pour affichage | Requête directe → DTO. Pas d'agrégat. |
| Muter quoi que ce soit | Charger l'agrégat complet → muter → save |
| Calculer un verdict de disponibilité | Charger l'agrégat → appeler `canAdd...` → pas de save |
| Retourner l'état d'un agrégat (détail) | Charger l'agrégat → mapper en DTO |
| Compter ou agréger | Agrégat calculé directement dans la requête |
