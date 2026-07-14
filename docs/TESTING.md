# Gaslands Manager — Tests

> Détail des patterns de tests **unitaires** backend/frontend. Contexte général et
> commandes : [ARCHITECTURE.md §8](ARCHITECTURE.md#8-tests). Pour tout ce qui est
> **e2e** (infrastructure, commandes, bonnes pratiques, pièges, troubleshooting,
> cadre de décision e2e-vs-unitaire) : skill `e2e-testing`
> (`.claude/skills/e2e-testing/SKILL.md`), seule source à jour sur le sujet.
> Mettre à jour après tout changement de pattern de test unitaire.

---

## 1. Backend — Patterns de test

**Service avec TypeORM** : mock du `Repository` via `getRepositoryToken` dans `Test.createTestingModule`.

**Service sans DI** (ex : `CatalogService`) : instanciation directe + Pattern Template Method (voir [ARCHITECTURE.md §3.3](ARCHITECTURE.md#33-catalogue-de-jeu--singleton-en-mémoire)). Appeler `service.onModuleInit()` manuellement dans `beforeEach`.

Ce qu'on teste : cas nominaux, `NotFoundException`, isolation par `userId`, câblage controller → service, relations pré-résolues.
Ce qu'on ne teste pas en unitaire : auth JWT (testé via le guard), SQL réel (→ e2e).

---

## 2. Frontend — Patterns de test

**Smart component** : mock du service dans `providers`, sous-composants rendent normalement.

**Dumb component** :

```typescript
// Initialiser un input() Signal
fixture.componentRef.setInput('team', mockTeam);
fixture.detectChanges();  // déclenche effect() si présent

// Observer un output() Signal
import { outputToObservable } from '@angular/core/rxjs-interop';
outputToObservable(component.editClicked).subscribe(t => emitted.push(t));
```

**Outils clés** : `HttpTestingController`, `of(data)` / `throwError(() => ...)`, `vi.stubGlobal('confirm', vi.fn().mockReturnValue(true))`.

| Que tester ? | Fichier spec |
|---|---|
| Orchestration, appels API, visibilité formulaire | `teams.spec.ts` |
| Affichage carte, émission boutons | `team-card.spec.ts` |
| Pré-remplissage, validation, émission DTO | `team-form.spec.ts` |
| Requêtes HTTP (verbe, URL, corps) | `teams.service.spec.ts` |

---

## 3. E2E frontend

Infrastructure (base de test dédiée, backend isolé, ordre `globalSetup`/`webServer`),
commandes, carte de couverture, bonnes pratiques, pièges et troubleshooting : skill
`e2e-testing` (`.claude/skills/e2e-testing/SKILL.md`) — seule source à jour, ne pas la
dupliquer ici.
