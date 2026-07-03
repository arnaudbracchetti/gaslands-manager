# Revue externe du skill `ddd`

> Revue de conception du skill `.claude/skills/ddd/` (SKILL.md + `theory/concepts.md`,
> `theory/aggregate-design.md`, `theory/cqrs.md`), croisée avec les sources de référence du DDD
> (Evans, Vernon, Fowler, Microsoft/Azure, Vaadin).
>
> Chaque recommandation cite (a) un pointeur précis dans le skill et (b) une source (§5).
>
> **Statut : toutes les recommandations (A1, A2, B1, C1, C2, D1–D6) ont été appliquées au skill.**
> Ce document est conservé comme trace du raisonnement et des sources ayant motivé chaque
> changement — les constats « absent »/« contredit » ci-dessous décrivent l'état **avant**
> application, pas l'état courant des fichiers.

---

## 1. Résumé exécutif

Le skill est **tactiquement solide et pédagogiquement bien construit** : le workflow de
brainstorming socratique, les 7 anti-patterns et le CQRS léger sont d'un niveau nettement
au-dessus de la moyenne des ressources DDD en ligne. Sa principale limite est d'être **purement
tactique** : il manque deux des quatre règles canoniques d'agrégat de Vernon (référence par
identité, cohérence éventuelle inter-agrégats), le socle du **langage ubiquitaire** dans le
dialogue de conception, et quelques finitions du modèle riche (invariants à la construction,
factories, « états illégaux non-représentables »).

Aucune de ces lacunes n'est une erreur : ce sont des **compléments**. Le skill ne dit rien de
faux ; il est incomplet sur les frontières *entre* agrégats et sur le vocabulaire. Les
recommandations ci-dessous sont priorisées (§4) pour que tu appliques d'abord ce qui rapporte le
plus.

**Verdict : à conserver tel quel, à enrichir de façon ciblée.**

---

## 2. Points forts à préserver

Une revue équilibrée commence par ce qui marche — à **ne pas casser** en enrichissant :

- **Workflow de brainstorming socratique** (`SKILL.md` §Comportement attendu, Phases 1–6) : une
  question à la fois, `AskUserQuestion`, reformulation après chaque réponse. C'est exactement la
  posture « explorer, ne pas affirmer » que recommande le DDD pour co-construire un modèle avec un
  expert métier.
- **Les 7 anti-patterns** (`aggregate-design.md`) : chacun donne le mauvais exemple, le bon, ET le
  piège évité. Les nº 5 (garde dupliquée), nº 6 (validateur partiel) et nº 7 (service mort qui
  contourne l'agrégat) sont particulièrement fins et rarement documentés ailleurs.
- **La requête hybride** (`cqrs.md` §Requête hybride) : « le verdict d'affichage et la règle
  d'écriture appellent **la même** méthode de domaine ». C'est le point qui empêche la dérive
  frontend/backend classique — excellent.
- **Inversion de dépendance** (`concepts.md` §6, `SKILL.md` Phase 5 point 5) : l'interface
  repository est définie par le domaine, implémentée par l'infra. Correct et bien expliqué.
- **Alignement Fowler** (`aggregate-design.md` anti-pattern 1) : les règles vivent dans l'agrégat,
  jamais dans un service — c'est la définition même du modèle riche vs anémique.
- **« Une transaction = une mutation sur un seul agrégat »** (`concepts.md` §1) : la règle 1 de
  Vernon est déjà là.

---

## 3. Constats & recommandations

### Zone A — Règles d'agrégat canoniques

Vernon énonce **quatre** règles de conception d'agrégat (§5). Le skill en couvre deux (invariants
dans une frontière de cohérence ; une transaction = un agrégat). Les deux autres manquent.

#### A1 — « Référencer les autres agrégats par identité » est absent — **priorité haute**

- **Constat.** Le skill traite en profondeur la relation **parent → enfant** *à l'intérieur* d'un
  agrégat (`concepts.md` §1–2, `aggregate-design.md` Tests 1–3), mais **jamais** comment deux
  agrégats **distincts** se relient. Or c'est la règle 3 de Vernon : on référence un autre agrégat
  **par son `id`**, pas par un pointeur d'objet.
- **Pourquoi ça compte.** Tenir une référence directe vers un autre agrégat invite à le muter dans
  la même transaction (violation de la règle 1) et fait exploser la taille des chargements. « If you
  don't hold any reference, you can't modify another Aggregate » (Vernon).
- **Recommandation.** Ajouter une sous-section (dans `concepts.md` après §2, ou dans
  `aggregate-design.md`) : *« Relier deux agrégats : par identité, pas par référence »*. Règle :
  un champ `otherAggregateId: Id`, jamais un champ `otherAggregate: OtherRoot`. Ancrage projet :
  `CampaignParticipant` référence `Team` et `User` **par id** — c'est déjà le cas, autant le nommer
  comme application de la règle.
- **Source.** Vernon, *Effective Aggregate Design*, règle 3 (archi-lab.io, dddcommunity.org).

#### A2 — L'heuristique « ~200 entités » contredit « design small aggregates » — **priorité haute**

- **Constat.** `aggregate-design.md` §Trop grand écrit : *« si charger l'agrégat pour une mutation
  ramène plus de ~200 entités enfants, revoir la frontière »*. Ce plafond est **beaucoup trop
  permissif** au regard de Vernon (règle 2) : ~70 % des agrégats bien conçus ne contiennent **que
  la racine + des value objects**, et les 30 % restants **2 à 3 entités maximum**. Un agrégat de
  « 199 enfants » serait pour Vernon un anti-pattern presque certain.
- **Pourquoi ça compte.** Le message actuel oriente vers de **gros** agrégats (« tant que tu es
  sous 200, ça va »), alors que la règle est l'inverse : **petit par défaut**. Les gros agrégats
  viennent de « faux invariants et de la commodité de composition » (Vernon).
- **Recommandation.** Reformuler le §Trop grand : mener par *« Défaut = le plus petit agrégat
  possible. Un enfant n'entre dans l'agrégat que s'il doit rester **transactionnellement cohérent**
  avec la racine (un invariant les lie). Sinon → agrégat séparé, référencé par id (cf. A1). »*
  Garder une remarque de perf, mais comme garde-fou secondaire, pas comme règle principale.
  Corollaire à ajouter : *un enfant qu'on ne consulte jamais pour valider un invariant de la racine
  est probablement un read model ou un agrégat séparé, pas un enfant.*
- **Source.** Vernon, règle 2 « Design Small Aggregates » (archi-lab.io) ; InfoQ *Designing and
  Storing Aggregates*.

### Zone B — Coordination inter-agrégats

#### B1 — « Et si une opération touche deux agrégats ? » reste sans réponse — **priorité haute**

- **Constat.** `concepts.md` §1 pose *« une transaction = une mutation sur un seul agrégat »*, mais
  le skill **ne dit nulle part** ce qu'on fait quand un besoin métier doit toucher deux agrégats.
  La réponse canonique manque : **domain events + cohérence éventuelle** (règle 4 de Vernon).
- **Pourquoi ça compte.** Sans cette pièce, un lecteur confronté à « quand X est validé, Y doit
  être mis à jour » n'a que deux mauvaises sorties : fusionner X et Y en un méga-agrégat (viole A2),
  ou muter deux agrégats dans une transaction (viole la règle 1). Le domain event est la troisième
  voie, correcte.
- **Recommandation.** Ajouter un **7ᵉ bloc de construction** léger dans `concepts.md` : *Domain
  Event* — « un fait métier passé (`CommandeConfirmée`, `PartieClôturée`), émis par l'agrégat, qui
  déclenche une réaction sur un **autre** agrégat dans une transaction distincte ». Préciser que la
  version *légère* suffit (dispatch en-process, avant/après le commit) — **pas besoin** de bus ni
  de Kafka, cohérent avec l'esprit « CQRS léger » du skill. Ajouter la règle de décision : *« Une
  opération doit muter deux agrégats ? Ne les charge pas ensemble. Émets un événement depuis le
  premier ; un handler mute le second. Ou reconsidère la frontière. »*
- **Ancrage projet fort.** Le module `campaign/` fait **déjà** de l'event sourcing (agrégat
  `Campaign`, hiérarchie `GameEvent` Command/Invoker/Receiver). Le skill gagnerait à s'appuyer sur
  cet exemple réel — actuellement il n'en parle pas du tout, alors que c'est la démonstration la
  plus aboutie du dépôt.
- **Source.** Vernon, règle 4 « Use Eventual Consistency » (archi-lab.io) ; Microsoft Learn,
  *Domain events: design and implementation*.

### Zone C — Langage ubiquitaire & cadrage stratégique

#### C1 — La Phase 1 saute le vocabulaire du domaine — **priorité moyenne**

- **Constat.** `SKILL.md` Phase 1 démarre par « décris la feature en une phrase » puis va
  directement à « est-ce un nouvel agrégat / une règle / une requête ? ». Le **langage ubiquitaire**
  — le socle de tout le DDD selon Evans et Vernon — n'apparaît nulle part comme étape.
- **Pourquoi ça compte.** DDD, c'est d'abord *« modéliser un langage ubiquitaire dans un contexte
  délimité »*. Nommer l'agrégat, ses états et ses opérations dans les **termes du métier** avant de
  décider des frontières évite de figer un vocabulaire technique qui trahit le domaine. Pour un
  skill de *brainstorming*, c'est une omission structurante.
- **Recommandation.** Insérer en Phase 1 (avant la question « nouveau dans le domaine ? ») une
  micro-étape : *« Établissons le vocabulaire : comment le métier nomme-t-il cette chose, ses
  états, ses actions ? »* — et rappeler d'utiliser **ces mots-là** dans les noms de classes,
  méthodes et événements tout au long du design. Une ou deux phrases + un exemple suffisent.
- **Source.** Evans / Vernon via O'Reilly *DDD Distilled* ch. 2 ; DZone *Importance of Ubiquitous
  Language*.

#### C2 — Aucune mention du bounded context — **priorité basse (respecter YAGNI)**

- **Constat.** Le skill est 100 % tactique ; le **bounded context** (design stratégique) n'est
  jamais évoqué.
- **Pourquoi ça compte (mais modérément).** « Tactics without strategy lose their meaning » : les
  patterns tactiques n'ont de sens *que* dans un contexte délimité où chaque terme est non-ambigu.
  MAIS le projet Gaslands est **mono-contexte** : un context mapping complet, des sous-domaines, des
  anti-corruption layers seraient du sur-dimensionnement — ce que le skill lui-même proscrit (YAGNI,
  `SKILL.md` §Principes).
- **Recommandation.** **Ne pas** ajouter de section stratégique complète. Ajouter seulement une
  **note de cadrage** de 2–3 lignes (en tête de `concepts.md` ou en fin de `SKILL.md`) : *« Ces
  patterns tactiques vivent à l'intérieur d'un seul contexte délimité (bounded context). Noms et
  règles n'y sont non-ambigus que dans ses frontières. Ce projet est mono-contexte ; le context
  mapping est hors périmètre. »* Cela situe le skill sans l'alourdir.
- **Source.** Fowler *BoundedContext* ; Vaadin *DDD Part 1: Strategic Domain-Driven Design*.

### Zone D — Profondeur du modèle riche

#### D1 — Les factories ne sont qu'évoquées — **priorité moyenne**

- **Constat.** La factory n'apparaît que dans la règle transversale 4 de `SKILL.md` (« si une
  fabrique n'a pas de dépendance, en faire une fonction pure ») — sous l'angle « pas de framework »,
  jamais sous l'angle « quand et pourquoi ».
- **Recommandation.** Ajouter un court paragraphe (dans `concepts.md`) sur **quand** utiliser une
  factory : création d'un agrégat impliquant plusieurs objets/invariants posés dès la naissance,
  et **reconstitution** depuis la persistance. Point clé : la factory (ou le constructeur) est le
  gardien de l'invariant *à la création* (lien direct vers D2).
- **Source.** *Patterns, Principles, and Practices of DDD*, ch. 20 Factories.

#### D2 — Les invariants ne sont gardés qu'en mutation, jamais à la construction — **priorité moyenne**

- **Constat.** Tous les exemples du skill posent la garde sur une **mutation** (`addLine`,
  `addWeapon`, `rename`…). **Aucun** ne montre un constructeur qui refuse une construction invalide.
  Pourtant `concepts.md` §1 affirme que les invariants sont *« toujours vrais, avant ET après chaque
  mutation »* — ce qui inclut logiquement l'instant zéro.
- **Recommandation.** Ajouter le principe : *un modèle riche rejette aussi un état initial
  invalide — le constructeur/factory valide et lève une exception de domaine si l'agrégat naîtrait
  incohérent.* Et la nuance de reconstitution : *au chargement depuis la persistance, on fait
  confiance à l'état déjà validé (on ne re-valide pas les invariants déjà garantis à l'écriture) ;
  on ne valide que des données neuves.* Cette distinction évite le double écueil « constructeur
  permissif » / « re-validation coûteuse au mapping ».
- **Source.** Modèle riche / entités auto-validantes (Ensono *Anaemic vs Rich Domain Model* ;
  Microsoft Learn *Tactical DDD*).

#### D3 — « Rendre les états illégaux non-représentables » est absent — **priorité moyenne**

- **Constat.** La section VO (`concepts.md` §3) couvre immuabilité, égalité structurelle, API métier
  typée — mais pas la pratique moderne consistant à **rendre les états illégaux
  non-représentables** via le typage et des VOs auto-validants (plutôt que valider a posteriori).
- **Recommandation.** Ajouter à la section VO : *plutôt que d'accepter une donnée brute puis de la
  valider, préfère un type qui ne peut **pas** représenter l'invalide (VO auto-validant à la
  construction, unions de types pour les états, pas de champ nullable qui encode « parfois »).*
  Relier à l'anti-pattern 4 (getter à hydratation implicite) qui illustre déjà l'idée à l'envers.
- **Source.** Pratique du modèle riche typé (Ensono ; Medium *Anemic vs Rich Domain Model*).

#### D4 — Le pattern Specification n'est pas nommé — **priorité basse**

- **Constat.** Le verdict `canAddLine(...) → RuleResult` (`cqrs.md` §Requête hybride,
  `SKILL.md`/`DOMAIN_MODEL.md` via `canAddWeapon`) **est** une forme légère du pattern
  **Specification**, mais il n'est jamais nommé comme tel.
- **Recommandation.** Le nommer en une ligne et souligner sa réutilisation : *une même règle sert
  de (1) garde d'écriture, (2) verdict d'affichage, (3) filtre de requête — une seule
  implémentation, jamais trois divergentes.* Cela relie le pattern déjà pratiqué à la littérature.
- **Source.** Tactical DDD, Specification (ddd.academy *Implementing Tactical Patterns*).

#### D5 — Le bénéfice de testabilité n'est pas énoncé — **priorité basse**

- **Constat.** Le skill insiste sur « le domaine ne dépend d'aucun framework » (règle transversale
  4, Phase 5) mais ne dit jamais **pourquoi c'est un gain concret** : un domaine sans framework se
  teste **sans mock ni base de données**, en instanciant directement l'agrégat.
- **Recommandation.** Ajouter aux §Principes : *un domaine pur est trivialement testable en
  unitaire — `new Aggregate(...)`, appeler la méthode, asserter l'invariant ; aucun mock, aucune
  base. C'est le retour sur investissement de l'inversion de dépendance.*
- **Source.** Argument standard du modèle riche / hexagonal (Vaadin *Tactical DDD*).

#### D6 — Tension exception vs Result non tranchée — **optionnel**

- **Constat.** Le skill utilise des exceptions (`DomainException`) pour les violations de règle
  *et* un `RuleResult` pour les verdicts, sans expliciter quand choisir l'un ou l'autre.
- **Recommandation (facultative, 1 phrase).** *Lève une exception de domaine pour une violation
  d'invariant (état qui ne devrait jamais arriver depuis une UI correcte) ; retourne un `RuleResult`
  quand l'appelant a besoin du verdict sans provoquer d'erreur (affichage de disponibilité).*

---

## 4. Tableau récapitulatif priorisé

| # | Constat | Recommandation | Fichier skill visé | Priorité | Statut |
|---|---------|----------------|--------------------|----------|--------|
| A1 | Référence inter-agrégats par identité absente | Nouvelle sous-section « relier par id, pas par référence » | `concepts.md` §1 | 🔴 Haute | ✅ Appliqué |
| A2 | Heuristique « ~200 entités » trop permissive | Mener par « petit agrégat par défaut » (Vernon règle 2) | `aggregate-design.md` §Trop grand + checklist | 🔴 Haute | ✅ Appliqué |
| B1 | Opération multi-agrégats sans réponse | 7ᵉ bloc « Domain Event » + cohérence éventuelle (léger) | `concepts.md` §7 | 🔴 Haute | ✅ Appliqué |
| C1 | Langage ubiquitaire absent du workflow | Micro-étape « vocabulaire du domaine » en Phase 1 | `SKILL.md` Phase 1 | 🟠 Moyenne | ✅ Appliqué |
| C2 | Bounded context jamais mentionné | Note de cadrage 2–3 lignes (pas de section complète) | `SKILL.md` §Cadrage | 🟡 Basse | ✅ Appliqué |
| D1 | Factories seulement évoquées | Paragraphe « quand utiliser une factory » | `concepts.md` §1 | 🟠 Moyenne | ✅ Appliqué |
| D2 | Invariants non gardés à la construction | Principe « valider à la création + confiance à la reconstitution » | `concepts.md` §1 | 🟠 Moyenne | ✅ Appliqué |
| D3 | « États illégaux non-représentables » absent | Ajout à la section Value Object | `concepts.md` §3 | 🟠 Moyenne | ✅ Appliqué |
| D4 | Pattern Specification non nommé | Le nommer + réutilisation write/read/filter | `cqrs.md` | 🟡 Basse | ✅ Appliqué |
| D5 | Bénéfice testabilité non dit | Ajout aux règles transversales (item 8) | `SKILL.md` | 🟡 Basse | ✅ Appliqué |
| D6 | Exception vs Result non tranché | 1 phrase de règle de choix | `concepts.md` §4 | ⚪ Optionnel | ✅ Appliqué |

---

## 5. Sources

- Vaughn Vernon — *Effective Aggregate Design* (les 4 règles) :
  [dddcommunity.org](https://www.dddcommunity.org/library/vernon_2011/) ·
  [synthèse archi-lab.io](https://www.archi-lab.io/infopages/ddd/aggregate-design-rules-vernon.html) ·
  [InfoQ — Designing and Storing Aggregates](https://www.infoq.com/news/2014/12/aggregates-ddd/)
- Martin Fowler —
  [AnemicDomainModel](https://martinfowler.com/bliki/AnemicDomainModel.html) ·
  [BoundedContext](https://martinfowler.com/bliki/BoundedContext.html)
- Microsoft Learn —
  [Domain events: design and implementation](https://learn.microsoft.com/en-us/dotnet/architecture/microservices/microservice-ddd-cqrs-patterns/domain-events-design-implementation) ·
  [Use tactical DDD to design microservices](https://learn.microsoft.com/en-us/azure/architecture/microservices/model/tactical-domain-driven-design)
- Vaadin —
  [DDD Part 1: Strategic Domain-Driven Design](https://vaadin.com/blog/ddd-part-1-strategic-domain-driven-design) ·
  [DDD Part 2: Tactical Domain-Driven Design](https://vaadin.com/blog/ddd-part-2-tactical-domain-driven-design)
- O'Reilly — *Domain-Driven Design Distilled*, ch. 2 (Bounded Contexts & Ubiquitous Language) ;
  *Patterns, Principles, and Practices of DDD*, ch. 20 (Factories)
- Modèle riche vs anémique —
  [Ensono](https://www.ensono.com/insights-and-news/expert-opinions/anaemic-domain-model-vs-rich-domain-model/) ·
  [DZone — Importance of Ubiquitous Language](https://dzone.com/articles/importance-of-ubiquitous-language-in-domain-driven)
