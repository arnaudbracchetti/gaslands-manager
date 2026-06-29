# US-B1 — Saisir le classement d'une partie — Plan d'implémentation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Permettre à un organisateur de saisir le classement final des équipes d'une partie `PLANIFIE`, créer un `GameResult` par équipe présente avec les Points de Championnat calculés (snapshot), et passer la partie à `JOUE`.

**Architecture:** Nouvelle entité `GameResult` (backend) persistée en transaction atomique via un endpoint `POST .../results`. PC calculés au moment de la validation (snapshot dénormalisé, jamais recalculé). UI drag-and-drop via Angular CDK dans un nouveau composant dumb `GameResultForm`, orchestré par `SeasonProgram`.

**Tech Stack:** NestJS 11 + TypeORM (backend) · Angular 21 zoneless + Signals + Angular CDK DragDropModule (frontend) · Vitest (tests unitaires)

## Global Constraints

- Angular zoneless : tout changement d'état dans les templates passe par un Signal (`signal()`, `computed()`). Jamais de mutation directe.
- TypeScript strict : `explicit-function-return-type` imposé par ESLint — typer toutes les fonctions publiques.
- `import type` pour les interfaces/types dans les signatures décorées NestJS (`emitDecoratorMetadata`).
- CSS : pas de couleur en dur — utiliser `var(--clr-*)` ou les tokens `--tb-*` existants.
- Commandes Nx : toujours `npx nx test backend` / `npx nx test frontend`, pas `vitest` directement.
- Ne jamais commiter sans demande explicite de l'utilisateur.
- Branche cible : `mode-campagne`.

---

## Fichiers créés / modifiés

### Backend
| Action | Fichier | Rôle |
|--------|---------|------|
| Créer | `apps/backend/src/app/game/game-result.entity.ts` | Entité TypeORM `GameResult` |
| Créer | `apps/backend/src/app/game/dto/record-result.dto.ts` | DTO entrée `POST .../results` |
| Créer | `apps/backend/src/app/game/dto/game-result-response.dto.ts` | DTO sortie `GET .../results` |
| Créer | `apps/backend/src/app/game/game-result.service.ts` | Logique métier PC + transaction |
| Créer | `apps/backend/src/app/game/game-result.service.spec.ts` | Tests unitaires service |
| Modifier | `apps/backend/src/app/game/game.module.ts` | Enregistrer `GameResult` + `GameResultService` |
| Modifier | `apps/backend/src/app/game/game.controller.ts` | Ajouter les 2 nouvelles routes |
| Modifier | `apps/backend/src/app/game/game.controller.spec.ts` | Tests câblage nouvelles routes |
| Modifier | `apps/backend/src/app/app.module.ts` | Ajouter `GameResult` dans `entities` |

### Frontend
| Action | Fichier | Rôle |
|--------|---------|------|
| Modifier | `apps/frontend/src/app/seasons/game.model.ts` | Ajouter `GameResult`, `RecordResultDto` |
| Modifier | `apps/frontend/src/app/seasons/seasons.service.ts` | Ajouter `recordResult`, `getGameResults` |
| Créer | `apps/frontend/src/app/seasons/game-result-form/game-result-form.ts` | Composant dumb drag-and-drop |
| Créer | `apps/frontend/src/app/seasons/game-result-form/game-result-form.html` | Template |
| Créer | `apps/frontend/src/app/seasons/game-result-form/game-result-form.scss` | Styles |
| Créer | `apps/frontend/src/app/seasons/game-result-form/game-result-form.spec.ts` | Tests unitaires |
| Modifier | `apps/frontend/src/app/seasons/season-program/season-program.ts` | Signal `recordingGame`, chargement participants, appel `recordResult` |
| Modifier | `apps/frontend/src/app/seasons/season-program/season-program.html` | Affichage conditionnel `GameResultForm` |
| Modifier | `apps/frontend/src/app/seasons/season-program/season-program.spec.ts` | Tests nouveaux cas |
| Modifier | `apps/frontend/src/app/seasons/game-list/game-list.ts` | Input `canRecord`, output `recordGame` |
| Modifier | `apps/frontend/src/app/seasons/game-list/game-list.html` | Bouton "🎯 Saisir les rangs" |
| Modifier | `apps/frontend/src/app/seasons/game-list/game-list.spec.ts` | Tests nouveau bouton |

---

## Task 1 : Entité `GameResult` + migration DB

**Files:**
- Create: `apps/backend/src/app/game/game-result.entity.ts`
- Modify: `apps/backend/src/app/game/game.module.ts`
- Modify: `apps/backend/src/app/app.module.ts`

**Interfaces:**
- Produces: entité `GameResult` avec colonnes `id`, `gameId`, `participantId`, `rank`, `championshipPoints`, `createdAt`; contraintes uniques `(gameId, participantId)` et `(gameId, rank)`

- [ ] **Créer `game-result.entity.ts`**

```typescript
import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn, CreateDateColumn, Unique } from 'typeorm';
import { Game } from './game.entity';
import { SeasonParticipant } from '../season/season-participant.entity';

@Entity('game_results')
@Unique(['gameId', 'participantId'])
@Unique(['gameId', 'rank'])
export class GameResult {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column()
  gameId!: number;

  @ManyToOne(() => Game, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'gameId' })
  game!: Game;

  @Column()
  participantId!: number;

  @ManyToOne(() => SeasonParticipant, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'participantId' })
  participant!: SeasonParticipant;

  @Column()
  rank!: number;

  @Column({ default: 0 })
  championshipPoints!: number;

  @CreateDateColumn()
  createdAt!: Date;
}
```

- [ ] **Ajouter `GameResult` dans `game.module.ts`**

Ouvrir `apps/backend/src/app/game/game.module.ts`. Dans `TypeOrmModule.forFeature([Game])`, ajouter `GameResult` :

```typescript
TypeOrmModule.forFeature([Game, GameResult])
```

Ajouter l'import en haut :
```typescript
import { GameResult } from './game-result.entity';
```

- [ ] **Ajouter `GameResult` dans `app.module.ts`**

Ouvrir `apps/backend/src/app/app.module.ts`. Dans la liste `entities: [...]` de `TypeOrmModule.forRoot`, ajouter `GameResult` après `Game`.

Ajouter l'import :
```typescript
import { GameResult } from './game/game-result.entity';
```

- [ ] **Vérifier que le backend démarre sans erreur**

```bash
npx nx serve backend
```

En mode dev (`synchronize: true`), TypeORM crée automatiquement la table `game_results`. Vérifier dans les logs qu'aucune erreur TypeORM n'apparaît.

---

## Task 2 : DTOs backend

**Files:**
- Create: `apps/backend/src/app/game/dto/record-result.dto.ts`
- Create: `apps/backend/src/app/game/dto/game-result-response.dto.ts`

**Interfaces:**
- Produces:
  - `RecordResultItemDto { participantId: number; rank: number }`
  - `RecordResultDto { results: RecordResultItemDto[] }`
  - `GameResultResponseDto { id: number; gameId: number; participantId: number; rank: number; championshipPoints: number; createdAt: Date }`

- [ ] **Créer `record-result.dto.ts`**

```typescript
import { IsArray, IsInt, Min, ValidateNested, ArrayMinSize } from 'class-validator';
import { Type } from 'class-transformer';

export class RecordResultItemDto {
  @IsInt()
  @Min(1)
  participantId!: number;

  @IsInt()
  @Min(1)
  rank!: number;
}

export class RecordResultDto {
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => RecordResultItemDto)
  results!: RecordResultItemDto[];
}
```

- [ ] **Créer `game-result-response.dto.ts`**

```typescript
export class GameResultResponseDto {
  id!: number;
  gameId!: number;
  participantId!: number;
  rank!: number;
  championshipPoints!: number;
  createdAt!: Date;
}
```

---

## Task 3 : `GameResultService` — logique métier et tests

**Files:**
- Create: `apps/backend/src/app/game/game-result.service.ts`
- Create: `apps/backend/src/app/game/game-result.service.spec.ts`

**Interfaces:**
- Consumes:
  - `SeasonService.assertOrganizer(seasonId, userId): Promise<Season>`
  - `SeasonParticipantRepository` (TypeORM, filtre `seasonId` + `status: 'VALIDATED'`)
  - `GameRepository` (TypeORM)
  - `GameResultRepository` (TypeORM)
  - `RecordResultDto` (Task 2)
  - `GameResultResponseDto` (Task 2)
  - `GameStatus` enum : `'PLANIFIE' | 'JOUE'` (fichier existant `game.enums.ts`)
  - `GameType` enum : `'EVENEMENT_TELE' | 'ESCARMOUCHE'` (fichier existant `game.enums.ts`)
- Produces:
  - `GameResultService.recordResult(seasonId, gameId, userId, dto): Promise<GameResponseDto>`
  - `GameResultService.getResults(seasonId, gameId, userId): Promise<GameResultResponseDto[]>`

- [ ] **Écrire les tests en premier (`game-result.service.spec.ts`)**

```typescript
import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { GameResultService } from './game-result.service';
import { GameResult } from './game-result.entity';
import { Game } from './game.entity';
import { SeasonParticipant } from '../season/season-participant.entity';
import { SeasonService } from '../season/season.service';
import { ScenarioCatalogService } from './scenario-catalog.service';
import { GameStatus, GameType } from './game.enums';
import { ParticipantStatus } from '../season/season.enums';

const mockGame = (overrides: Partial<Game> = {}): Game =>
  ({ id: 1, seasonId: 10, type: GameType.EVENEMENT_TELE, status: GameStatus.PLANIFIE, ...overrides } as Game);

const mockParticipant = (id: number, overrides = {}): SeasonParticipant =>
  ({ id, seasonId: 10, status: ParticipantStatus.VALIDATED, ...overrides } as SeasonParticipant);

describe('GameResultService', () => {
  let service: GameResultService;
  let gameRepo: { findOne: ReturnType<typeof vi.fn> };
  let participantRepo: { find: ReturnType<typeof vi.fn> };
  let gameResultRepo: { find: ReturnType<typeof vi.fn> };
  let dataSource: { transaction: ReturnType<typeof vi.fn> };
  let seasonService: { assertOrganizer: ReturnType<typeof vi.fn>; assertVisibleParticipant: ReturnType<typeof vi.fn> };
  let scenarioCatalog: { getByNomInterne: ReturnType<typeof vi.fn> };

  beforeEach(async () => {
    gameRepo = { findOne: vi.fn() };
    participantRepo = { find: vi.fn() };
    gameResultRepo = { find: vi.fn() };
    dataSource = {
      transaction: vi.fn().mockImplementation(async (cb: (em: unknown) => Promise<unknown>) => {
        const em = { save: vi.fn().mockResolvedValue([]), getRepository: vi.fn().mockReturnValue({ save: vi.fn() }) };
        return cb(em);
      }),
    };
    seasonService = { assertOrganizer: vi.fn().mockResolvedValue({ id: 10 }), assertVisibleParticipant: vi.fn().mockResolvedValue({ id: 10 }) };
    scenarioCatalog = { getByNomInterne: vi.fn() };

    const module = await Test.createTestingModule({
      providers: [
        GameResultService,
        { provide: getRepositoryToken(Game), useValue: gameRepo },
        { provide: getRepositoryToken(SeasonParticipant), useValue: participantRepo },
        { provide: getRepositoryToken(GameResult), useValue: gameResultRepo },
        { provide: DataSource, useValue: dataSource },
        { provide: SeasonService, useValue: seasonService },
        { provide: ScenarioCatalogService, useValue: scenarioCatalog },
      ],
    }).compile();
    service = module.get(GameResultService);
  });

  describe('recordResult', () => {
    it('crée GameResult avec PC corrects pour EVENEMENT_TELE (4 présents → 2 classés)', async () => {
      gameRepo.findOne.mockResolvedValue(mockGame({ type: GameType.EVENEMENT_TELE }));
      participantRepo.find.mockResolvedValue([mockParticipant(1), mockParticipant(2), mockParticipant(3), mockParticipant(4)]);
      let savedResults: Partial<GameResult>[] = [];
      dataSource.transaction.mockImplementation(async (cb: (em: { save: (v: unknown) => Promise<unknown> }) => Promise<unknown>) => {
        const em = { save: vi.fn().mockImplementation((v: unknown) => { savedResults = v as Partial<GameResult>[]; return Promise.resolve(v); }) };
        return cb(em);
      });

      await service.recordResult(10, 1, 99, {
        results: [{ participantId: 1, rank: 1 }, { participantId: 2, rank: 2 }, { participantId: 3, rank: 3 }, { participantId: 4, rank: 4 }],
      });

      expect(savedResults.find(r => r.rank === 1)?.championshipPoints).toBe(10);
      expect(savedResults.find(r => r.rank === 2)?.championshipPoints).toBe(5);
      expect(savedResults.find(r => r.rank === 3)?.championshipPoints).toBe(0);
      expect(savedResults.find(r => r.rank === 4)?.championshipPoints).toBe(0);
    });

    it('PC = 0 pour tous si ESCARMOUCHE', async () => {
      gameRepo.findOne.mockResolvedValue(mockGame({ type: GameType.ESCARMOUCHE }));
      participantRepo.find.mockResolvedValue([mockParticipant(1), mockParticipant(2)]);
      let savedResults: Partial<GameResult>[] = [];
      dataSource.transaction.mockImplementation(async (cb: (em: { save: (v: unknown) => Promise<unknown> }) => Promise<unknown>) => {
        const em = { save: vi.fn().mockImplementation((v: unknown) => { savedResults = v as Partial<GameResult>[]; return Promise.resolve(v); }) };
        return cb(em);
      });

      await service.recordResult(10, 1, 99, {
        results: [{ participantId: 1, rank: 1 }, { participantId: 2, rank: 2 }],
      });

      expect(savedResults.every(r => r.championshipPoints === 0)).toBe(true);
    });

    it('⌈N/2⌉ — 5 présents → 3 classés : rangs 1/2/3 reçoivent PC, rangs 4/5 = 0', async () => {
      gameRepo.findOne.mockResolvedValue(mockGame({ type: GameType.EVENEMENT_TELE }));
      participantRepo.find.mockResolvedValue([1, 2, 3, 4, 5].map(i => mockParticipant(i)));
      let savedResults: Partial<GameResult>[] = [];
      dataSource.transaction.mockImplementation(async (cb: (em: { save: (v: unknown) => Promise<unknown> }) => Promise<unknown>) => {
        const em = { save: vi.fn().mockImplementation((v: unknown) => { savedResults = v as Partial<GameResult>[]; return Promise.resolve(v); }) };
        return cb(em);
      });

      await service.recordResult(10, 1, 99, {
        results: [1, 2, 3, 4, 5].map((pid, i) => ({ participantId: pid, rank: i + 1 })),
      });

      expect(savedResults.find(r => r.rank === 1)?.championshipPoints).toBe(10);
      expect(savedResults.find(r => r.rank === 2)?.championshipPoints).toBe(5);
      expect(savedResults.find(r => r.rank === 3)?.championshipPoints).toBe(2);
      expect(savedResults.find(r => r.rank === 4)?.championshipPoints).toBe(0);
      expect(savedResults.find(r => r.rank === 5)?.championshipPoints).toBe(0);
    });

    it('400 si partie déjà JOUE', async () => {
      gameRepo.findOne.mockResolvedValue(mockGame({ status: GameStatus.JOUE }));
      participantRepo.find.mockResolvedValue([mockParticipant(1)]);
      await expect(service.recordResult(10, 1, 99, { results: [{ participantId: 1, rank: 1 }] }))
        .rejects.toThrow(BadRequestException);
    });

    it('400 si un participantId est inconnu dans la saison', async () => {
      gameRepo.findOne.mockResolvedValue(mockGame());
      participantRepo.find.mockResolvedValue([mockParticipant(1)]);
      await expect(service.recordResult(10, 1, 99, { results: [{ participantId: 99, rank: 1 }] }))
        .rejects.toThrow(BadRequestException);
    });

    it('400 si rangs non consécutifs (trou)', async () => {
      gameRepo.findOne.mockResolvedValue(mockGame());
      participantRepo.find.mockResolvedValue([mockParticipant(1), mockParticipant(2)]);
      await expect(service.recordResult(10, 1, 99, { results: [{ participantId: 1, rank: 1 }, { participantId: 2, rank: 3 }] }))
        .rejects.toThrow(BadRequestException);
    });

    it('400 si rangs en doublon', async () => {
      gameRepo.findOne.mockResolvedValue(mockGame());
      participantRepo.find.mockResolvedValue([mockParticipant(1), mockParticipant(2)]);
      await expect(service.recordResult(10, 1, 99, { results: [{ participantId: 1, rank: 1 }, { participantId: 2, rank: 1 }] }))
        .rejects.toThrow(BadRequestException);
    });

    it('404 si non-organisateur', async () => {
      seasonService.assertOrganizer.mockRejectedValue(new NotFoundException());
      await expect(service.recordResult(10, 1, 99, { results: [{ participantId: 1, rank: 1 }] }))
        .rejects.toThrow(NotFoundException);
    });

    it('404 si partie introuvable', async () => {
      gameRepo.findOne.mockResolvedValue(null);
      participantRepo.find.mockResolvedValue([mockParticipant(1)]);
      await expect(service.recordResult(10, 999, 99, { results: [{ participantId: 1, rank: 1 }] }))
        .rejects.toThrow(NotFoundException);
    });
  });

  describe('getResults', () => {
    it('retourne les résultats de la partie', async () => {
      seasonService.assertVisibleParticipant.mockResolvedValue({ id: 10 });
      gameRepo.findOne.mockResolvedValue(mockGame());
      gameResultRepo.find.mockResolvedValue([
        { id: 1, gameId: 1, participantId: 1, rank: 1, championshipPoints: 10, createdAt: new Date() },
      ]);
      const results = await service.getResults(10, 1, 99);
      expect(results).toHaveLength(1);
      expect(results[0].championshipPoints).toBe(10);
    });
  });
});
```

- [ ] **Vérifier que les tests échouent**

```bash
NX_IGNORE_UNSUPPORTED_TS_SETUP=true npx nx test backend --testFile=apps/backend/src/app/game/game-result.service.spec.ts
```

Attendu : échec "Cannot find module './game-result.service'"

- [ ] **Implémenter `game-result.service.ts`**

```typescript
import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { GameResult } from './game-result.entity';
import { Game } from './game.entity';
import { SeasonParticipant } from '../season/season-participant.entity';
import { SeasonService } from '../season/season.service';
import { ScenarioCatalogService } from './scenario-catalog.service';
import type { RecordResultDto } from './dto/record-result.dto';
import type { GameResultResponseDto } from './dto/game-result-response.dto';
import type { GameResponseDto } from './dto/game-response.dto';
import { GameStatus, GameType } from './game.enums';
import { ParticipantStatus } from '../season/season.enums';

const POINTS_TABLE = [10, 5, 2, 1];

@Injectable()
export class GameResultService {
  constructor(
    @InjectRepository(Game) private readonly gameRepo: Repository<Game>,
    @InjectRepository(SeasonParticipant) private readonly participantRepo: Repository<SeasonParticipant>,
    @InjectRepository(GameResult) private readonly gameResultRepo: Repository<GameResult>,
    private readonly dataSource: DataSource,
    private readonly seasonService: SeasonService,
    private readonly scenarioCatalog: ScenarioCatalogService,
  ) {}

  async recordResult(
    seasonId: number,
    gameId: number,
    userId: number,
    dto: RecordResultDto,
  ): Promise<GameResponseDto> {
    await this.seasonService.assertOrganizer(seasonId, userId);

    const game = await this.gameRepo.findOne({ where: { id: gameId, seasonId } });
    if (!game) throw new NotFoundException('Partie introuvable');
    if (game.status === GameStatus.JOUE) throw new BadRequestException('Cette partie a déjà été jouée');

    const validatedParticipants = await this.participantRepo.find({
      where: { seasonId, status: ParticipantStatus.VALIDATED },
    });
    const validIds = new Set(validatedParticipants.map(p => p.id));

    for (const item of dto.results) {
      if (!validIds.has(item.participantId)) {
        throw new BadRequestException(`Participant ${item.participantId} inconnu ou non validé dans cette saison`);
      }
    }

    const ranks = dto.results.map(r => r.rank).sort((a, b) => a - b);
    const hasDuplicates = new Set(ranks).size !== ranks.length;
    const isConsecutive = ranks.every((r, i) => r === i + 1);
    if (hasDuplicates || !isConsecutive) {
      throw new BadRequestException('Les rangs doivent être uniques et consécutifs à partir de 1');
    }

    const n = dto.results.length;
    const classified = Math.ceil(n / 2);

    const results: Partial<GameResult>[] = dto.results.map(item => {
      let championshipPoints = 0;
      if (game.type === GameType.EVENEMENT_TELE && item.rank <= classified) {
        championshipPoints = POINTS_TABLE[item.rank - 1] ?? 0;
      }
      return { gameId, participantId: item.participantId, rank: item.rank, championshipPoints };
    });

    await this.dataSource.transaction(async em => {
      await em.save(GameResult, results);
      await em.save(Game, { id: gameId, status: GameStatus.JOUE, playedAt: new Date() });
    });

    const updatedGame = await this.gameRepo.findOne({ where: { id: gameId } });
    if (!updatedGame) throw new NotFoundException('Partie introuvable après mise à jour');

    const scenario = this.scenarioCatalog.getByNomInterne(updatedGame.scenarioId);
    return { ...updatedGame, scenarioName: scenario?.nom ?? updatedGame.scenarioId };
  }

  async getResults(
    seasonId: number,
    gameId: number,
    userId: number,
  ): Promise<GameResultResponseDto[]> {
    await this.seasonService.assertVisibleParticipant(seasonId, userId);

    const game = await this.gameRepo.findOne({ where: { id: gameId, seasonId } });
    if (!game) throw new NotFoundException('Partie introuvable');

    return this.gameResultRepo.find({ where: { gameId }, order: { rank: 'ASC' } });
  }
}
```

- [ ] **Vérifier que les tests passent**

```bash
NX_IGNORE_UNSUPPORTED_TS_SETUP=true npx nx test backend --testFile=apps/backend/src/app/game/game-result.service.spec.ts
```

Attendu : tous les tests PASS

---

## Task 4 : Câblage controller + tests controller

**Files:**
- Modify: `apps/backend/src/app/game/game.controller.ts`
- Modify: `apps/backend/src/app/game/game.controller.spec.ts`
- Modify: `apps/backend/src/app/game/game.module.ts`

**Interfaces:**
- Consumes: `GameResultService.recordResult`, `GameResultService.getResults` (Task 3)
- Produces:
  - `POST /api/seasons/:id/games/:gameId/results` → `GameResponseDto`
  - `GET /api/seasons/:id/games/:gameId/results` → `GameResultResponseDto[]`

- [ ] **Ajouter les routes dans `game.controller.ts`**

Ouvrir `apps/backend/src/app/game/game.controller.ts`. Injecter `GameResultService` dans le constructeur et ajouter les deux méthodes :

```typescript
// Dans les imports, ajouter :
import { GameResultService } from './game-result.service';
import type { RecordResultDto } from './dto/record-result.dto';

// Ajouter GameResultService dans le constructeur :
constructor(
  private readonly gameService: GameService,
  private readonly gameResultService: GameResultService,
) {}

// Ajouter les deux routes :
@Post(':gameId/results')
@UseGuards(JwtAuthGuard)
recordResult(
  @Param('id', ParseIntPipe) seasonId: number,
  @Param('gameId', ParseIntPipe) gameId: number,
  @Req() req: RequestWithUser,
  @Body() dto: RecordResultDto,
): Promise<GameResponseDto> {
  return this.gameResultService.recordResult(seasonId, gameId, req.user.id, dto);
}

@Get(':gameId/results')
@UseGuards(JwtAuthGuard)
getResults(
  @Param('id', ParseIntPipe) seasonId: number,
  @Param('gameId', ParseIntPipe) gameId: number,
  @Req() req: RequestWithUser,
): Promise<GameResultResponseDto[]> {
  return this.gameResultService.getResults(seasonId, gameId, req.user.id);
}
```

- [ ] **Enregistrer `GameResultService` dans `game.module.ts`**

Dans la liste `providers`, ajouter `GameResultService` :

```typescript
providers: [GameService, ScenarioCatalogService, GameResultService],
```

Import à ajouter :
```typescript
import { GameResultService } from './game-result.service';
```

Aussi ajouter `SeasonParticipant` dans `TypeOrmModule.forFeature` car `GameResultService` en a besoin :
```typescript
TypeOrmModule.forFeature([Game, GameResult, SeasonParticipant])
```

Import :
```typescript
import { SeasonParticipant } from '../season/season-participant.entity';
```

- [ ] **Ajouter les tests de câblage dans `game.controller.spec.ts`**

Ouvrir le fichier existant et ajouter un describe pour les nouvelles routes :

```typescript
describe('POST :id/games/:gameId/results', () => {
  it('appelle gameResultService.recordResult avec les bons paramètres', async () => {
    const mockGame = { id: 1, status: 'JOUE', scenarioName: 'Course de la Mort' };
    gameResultService.recordResult = vi.fn().mockResolvedValue(mockGame);

    const result = await controller.recordResult(10, 1, { user: { id: 99 } } as RequestWithUser, {
      results: [{ participantId: 1, rank: 1 }],
    });

    expect(gameResultService.recordResult).toHaveBeenCalledWith(10, 1, 99, { results: [{ participantId: 1, rank: 1 }] });
    expect(result).toEqual(mockGame);
  });
});

describe('GET :id/games/:gameId/results', () => {
  it('appelle gameResultService.getResults avec les bons paramètres', async () => {
    const mockResults = [{ id: 1, rank: 1, championshipPoints: 10 }];
    gameResultService.getResults = vi.fn().mockResolvedValue(mockResults);

    const result = await controller.getResults(10, 1, { user: { id: 99 } } as RequestWithUser);

    expect(gameResultService.getResults).toHaveBeenCalledWith(10, 1, 99);
    expect(result).toEqual(mockResults);
  });
});
```

Dans le `beforeEach`, ajouter `gameResultService` au module de test :

```typescript
const mockGameResultService = { recordResult: vi.fn(), getResults: vi.fn() };
// Dans providers :
{ provide: GameResultService, useValue: mockGameResultService }
// Dans le destructuring après compile :
gameResultService = module.get(GameResultService);
```

- [ ] **Lancer tous les tests backend**

```bash
NX_IGNORE_UNSUPPORTED_TS_SETUP=true npx nx test backend
```

Attendu : tous les tests PASS (service + controller)

---

## Task 5 : Modèles et service frontend

**Files:**
- Modify: `apps/frontend/src/app/seasons/game.model.ts`
- Modify: `apps/frontend/src/app/seasons/seasons.service.ts`

**Interfaces:**
- Produces:
  - Type `GameResult { id, gameId, participantId, rank, championshipPoints, createdAt }`
  - Type `RecordResultDto { results: { participantId: number; rank: number }[] }`
  - `SeasonsService.recordResult(seasonId, gameId, dto): Observable<Game>`
  - `SeasonsService.getGameResults(seasonId, gameId): Observable<GameResult[]>`

- [ ] **Ajouter les types dans `game.model.ts`**

Ouvrir `apps/frontend/src/app/seasons/game.model.ts` et ajouter à la fin :

```typescript
export interface GameResult {
  id: number;
  gameId: number;
  participantId: number;
  rank: number;
  championshipPoints: number;
  createdAt: string;
}

export interface RecordResultDto {
  results: { participantId: number; rank: number }[];
}
```

- [ ] **Ajouter les méthodes dans `seasons.service.ts`**

Ouvrir `apps/frontend/src/app/seasons/seasons.service.ts`. Ajouter l'import des nouveaux types et les deux méthodes :

```typescript
import type { GameResult, RecordResultDto } from './game.model';

// Dans la classe SeasonsService :

recordResult(seasonId: number, gameId: number, dto: RecordResultDto): Observable<Game> {
  return this.http.post<Game>(`/api/seasons/${seasonId}/games/${gameId}/results`, dto);
}

getGameResults(seasonId: number, gameId: number): Observable<GameResult[]> {
  return this.http.get<GameResult[]>(`/api/seasons/${seasonId}/games/${gameId}/results`);
}
```

---

## Task 6 : Composant `GameResultForm` (dumb) + tests

**Files:**
- Create: `apps/frontend/src/app/seasons/game-result-form/game-result-form.ts`
- Create: `apps/frontend/src/app/seasons/game-result-form/game-result-form.html`
- Create: `apps/frontend/src/app/seasons/game-result-form/game-result-form.scss`
- Create: `apps/frontend/src/app/seasons/game-result-form/game-result-form.spec.ts`

**Interfaces:**
- Consumes: `SeasonParticipant` (type existant dans `season.model.ts`), `RecordResultDto` (Task 5)
- Produces:
  - `input participants: SeasonParticipant[]`
  - `input saving: boolean`
  - `output saved: EventEmitter<RecordResultDto>`
  - `output formCancel: EventEmitter<void>`

- [ ] **Écrire les tests d'abord (`game-result-form.spec.ts`)**

```typescript
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { GameResultForm } from './game-result-form';
import { outputToObservable } from '@angular/core/rxjs-interop';

const mockParticipants = [
  { id: 1, teamName: 'Équipe Alpha', userName: 'Alice', status: 'VALIDATED', isOrganizer: false } as any,
  { id: 2, teamName: 'Équipe Beta', userName: 'Bob', status: 'VALIDATED', isOrganizer: false } as any,
  { id: 3, teamName: 'Équipe Gamma', userName: 'Carol', status: 'VALIDATED', isOrganizer: false } as any,
];

describe('GameResultForm', () => {
  let fixture: ComponentFixture<GameResultForm>;
  let component: GameResultForm;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [GameResultForm],
    }).compileComponents();
    fixture = TestBed.createComponent(GameResultForm);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('participants', mockParticipants);
    fixture.componentRef.setInput('saving', false);
    fixture.detectChanges();
  });

  it('affiche tous les participants avec checkbox décochée', () => {
    const checkboxes = fixture.nativeElement.querySelectorAll('input[type="checkbox"]');
    expect(checkboxes).toHaveLength(3);
    checkboxes.forEach((cb: HTMLInputElement) => expect(cb.checked).toBe(false));
  });

  it('cocher un participant le déplace dans la zone de classement', () => {
    const checkboxes = fixture.nativeElement.querySelectorAll('input[type="checkbox"]');
    checkboxes[0].click();
    fixture.detectChanges();
    expect(component.presentParticipants().length).toBe(1);
  });

  it('décocher un participant le retire de la zone de classement', () => {
    const checkboxes = fixture.nativeElement.querySelectorAll('input[type="checkbox"]');
    checkboxes[0].click();
    fixture.detectChanges();
    checkboxes[0].click();
    fixture.detectChanges();
    expect(component.presentParticipants().length).toBe(0);
  });

  it('bouton Valider désactivé si aucune équipe cochée', () => {
    const submitBtn: HTMLButtonElement = fixture.nativeElement.querySelector('button[type="submit"]');
    expect(submitBtn.disabled).toBe(true);
  });

  it('bouton Valider actif si au moins une équipe cochée', () => {
    const checkboxes = fixture.nativeElement.querySelectorAll('input[type="checkbox"]');
    checkboxes[0].click();
    fixture.detectChanges();
    const submitBtn: HTMLButtonElement = fixture.nativeElement.querySelector('button[type="submit"]');
    expect(submitBtn.disabled).toBe(false);
  });

  it('saved émet les rangs dans l\'ordre de la liste', () => {
    const emitted: any[] = [];
    outputToObservable(component.saved).subscribe(v => emitted.push(v));

    const checkboxes = fixture.nativeElement.querySelectorAll('input[type="checkbox"]');
    checkboxes[0].click();
    checkboxes[1].click();
    fixture.detectChanges();

    fixture.nativeElement.querySelector('button[type="submit"]').click();
    fixture.detectChanges();

    expect(emitted).toHaveLength(1);
    expect(emitted[0].results[0]).toMatchObject({ participantId: 1, rank: 1 });
    expect(emitted[0].results[1]).toMatchObject({ participantId: 2, rank: 2 });
  });

  it('formCancel émet void au clic Annuler', () => {
    const emitted: unknown[] = [];
    outputToObservable(component.formCancel).subscribe(() => emitted.push(true));
    fixture.nativeElement.querySelector('button[type="button"]').click();
    expect(emitted).toHaveLength(1);
  });

  it('badge classé/non-classé correct : 3 présents → 2 classés', () => {
    const checkboxes = fixture.nativeElement.querySelectorAll('input[type="checkbox"]');
    [0, 1, 2].forEach(i => { checkboxes[i].click(); });
    fixture.detectChanges();
    expect(component.classifiedCount()).toBe(2);
  });
});
```

- [ ] **Vérifier que les tests échouent**

```bash
NX_IGNORE_UNSUPPORTED_TS_SETUP=true npx nx test frontend --testFile=apps/frontend/src/app/seasons/game-result-form/game-result-form.spec.ts
```

Attendu : échec "Cannot find module"

- [ ] **Créer `game-result-form.ts`**

```typescript
import { Component, input, output, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DragDropModule, CdkDragDrop, moveItemInArray } from '@angular/cdk/drag-drop';
import type { SeasonParticipant } from '../season.model';
import type { RecordResultDto } from '../game.model';

@Component({
  selector: 'app-game-result-form',
  standalone: true,
  imports: [CommonModule, DragDropModule],
  templateUrl: './game-result-form.html',
  styleUrl: './game-result-form.scss',
})
export class GameResultForm {
  participants = input.required<SeasonParticipant[]>();
  saving = input<boolean>(false);

  saved = output<RecordResultDto>();
  formCancel = output<void>();

  // IDs des participants cochés comme présents, dans l'ordre de classement
  presentParticipants = signal<SeasonParticipant[]>([]);

  classifiedCount = computed<number>(() =>
    Math.ceil(this.presentParticipants().length / 2)
  );

  isPresent(participant: SeasonParticipant): boolean {
    return this.presentParticipants().some(p => p.id === participant.id);
  }

  togglePresent(participant: SeasonParticipant): void {
    const current = this.presentParticipants();
    if (this.isPresent(participant)) {
      this.presentParticipants.set(current.filter(p => p.id !== participant.id));
    } else {
      this.presentParticipants.set([...current, participant]);
    }
  }

  drop(event: CdkDragDrop<SeasonParticipant[]>): void {
    const list = [...this.presentParticipants()];
    moveItemInArray(list, event.previousIndex, event.currentIndex);
    this.presentParticipants.set(list);
  }

  isClassified(index: number): boolean {
    return index + 1 <= this.classifiedCount();
  }

  onSubmit(): void {
    const results = this.presentParticipants().map((p, i) => ({
      participantId: p.id,
      rank: i + 1,
    }));
    this.saved.emit({ results });
  }

  onCancel(): void {
    this.formCancel.emit();
  }
}
```

- [ ] **Créer `game-result-form.html`**

```html
<div class="game-result-form">
  <h3 class="game-result-form__title">🎯 Saisir le classement</h3>

  <div class="game-result-form__participants">
    <p class="game-result-form__hint">Cochez les équipes présentes à la partie :</p>
    @for (participant of participants(); track participant.id) {
      <label class="game-result-form__participant-row">
        <input
          type="checkbox"
          [checked]="isPresent(participant)"
          (change)="togglePresent(participant)"
          [disabled]="saving()"
        />
        <span>{{ participant.teamName }}</span>
        <span class="game-result-form__user">({{ participant.userName }})</span>
      </label>
    }
  </div>

  @if (presentParticipants().length > 0) {
    <div class="game-result-form__ranking">
      <p class="game-result-form__hint">
        Glissez pour réordonner — {{ classifiedCount() }} équipe(s) classée(s) sur {{ presentParticipants().length }}
      </p>
      <ol
        cdkDropList
        [cdkDropListData]="presentParticipants()"
        (cdkDropListDropped)="drop($event)"
        class="game-result-form__list"
      >
        @for (participant of presentParticipants(); track participant.id; let i = $index) {
          <li cdkDrag class="game-result-form__item">
            <span class="game-result-form__rank">{{ i + 1 }}</span>
            <span class="game-result-form__team">{{ participant.teamName }}</span>
            @if (isClassified(i)) {
              <span class="game-result-form__badge game-result-form__badge--classified">classé</span>
            } @else {
              <span class="game-result-form__badge game-result-form__badge--unclassified">non classé</span>
            }
          </li>
        }
      </ol>
    </div>
  }

  <div class="game-result-form__actions">
    <button
      type="submit"
      class="btn btn--primary"
      [disabled]="presentParticipants().length === 0 || saving()"
      (click)="onSubmit()"
    >
      {{ saving() ? 'Enregistrement…' : 'Valider le classement' }}
    </button>
    <button type="button" class="btn btn--secondary" [disabled]="saving()" (click)="onCancel()">
      Annuler
    </button>
  </div>
</div>
```

- [ ] **Créer `game-result-form.scss`**

```scss
.game-result-form {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;

  &__title {
    font-family: var(--font-display);
    color: var(--tb-os);
    text-transform: uppercase;
    letter-spacing: 0.05em;
    margin: 0;
  }

  &__hint {
    font-family: var(--font-mono);
    font-size: 0.8rem;
    color: var(--tb-metal-2);
    margin: 0 0 0.5rem;
  }

  &__participants {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  &__participant-row {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    cursor: pointer;
    font-family: var(--font-text);
    color: var(--tb-os);
  }

  &__user {
    font-size: 0.85rem;
    color: var(--tb-metal-2);
  }

  &__list {
    list-style: none;
    padding: 0;
    margin: 0;
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  &__item {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    padding: 0.6rem 1rem;
    background: var(--tb-bitume-2);
    border: 1px solid var(--tb-metal-2);
    border-radius: var(--r-sm);
    cursor: grab;

    &:active { cursor: grabbing; }
  }

  &__rank {
    font-family: var(--font-display);
    font-size: 1.1rem;
    color: var(--tb-os);
    min-width: 1.5rem;
    text-align: center;
  }

  &__team {
    flex: 1;
    font-family: var(--font-text);
    color: var(--tb-os);
  }

  &__badge {
    font-family: var(--font-mono);
    font-size: 0.7rem;
    padding: 0.2rem 0.5rem;
    border-radius: var(--r-sm);
    text-transform: uppercase;

    &--classified {
      background: var(--tb-danger);
      color: var(--tb-bitume);
    }

    &--unclassified {
      background: var(--tb-metal-2);
      color: var(--tb-bitume);
    }
  }

  &__actions {
    display: flex;
    gap: 0.75rem;
  }
}
```

- [ ] **Vérifier que les tests passent**

```bash
NX_IGNORE_UNSUPPORTED_TS_SETUP=true npx nx test frontend --testFile=apps/frontend/src/app/seasons/game-result-form/game-result-form.spec.ts
```

Attendu : tous les tests PASS

---

## Task 7 : Modifications `GameList` — bouton "Saisir les rangs"

**Files:**
- Modify: `apps/frontend/src/app/seasons/game-list/game-list.ts`
- Modify: `apps/frontend/src/app/seasons/game-list/game-list.html`
- Modify: `apps/frontend/src/app/seasons/game-list/game-list.spec.ts`

**Interfaces:**
- Consumes: `Game` (existant), `canManage: boolean` (existant)
- Produces: nouveau `output recordGame: OutputEmitterRef<Game>`; nouveau `input canRecord: boolean`

- [ ] **Ajouter `canRecord` et `recordGame` dans `game-list.ts`**

Ouvrir `apps/frontend/src/app/seasons/game-list/game-list.ts`. Ajouter :

```typescript
canRecord = input<boolean>(false);
recordGame = output<Game>();
```

Ajouter la méthode :

```typescript
onRecord(game: Game): void {
  this.recordGame.emit(game);
}
```

- [ ] **Ajouter le bouton dans `game-list.html`**

Dans la liste des actions par partie (là où se trouvent déjà les boutons modifier/supprimer), ajouter pour les parties `PLANIFIE` avec `canRecord` :

```html
@if (canRecord() && game.status === 'PLANIFIE') {
  <button class="btn btn--sm btn--primary" (click)="onRecord(game)">
    🎯 Saisir les rangs
  </button>
}
```

- [ ] **Ajouter les tests**

Dans `game-list.spec.ts`, ajouter :

```typescript
it('affiche le bouton "Saisir les rangs" pour une partie PLANIFIE quand canRecord=true', () => {
  fixture.componentRef.setInput('games', [{ id: 1, status: 'PLANIFIE', scenarioName: 'Test', type: 'EVENEMENT_TELE', order: 1 }]);
  fixture.componentRef.setInput('canManage', true);
  fixture.componentRef.setInput('canRecord', true);
  fixture.detectChanges();
  expect(fixture.nativeElement.querySelector('button')).toBeTruthy();
  expect(fixture.nativeElement.textContent).toContain('Saisir les rangs');
});

it('n\'affiche pas le bouton pour une partie JOUE', () => {
  fixture.componentRef.setInput('games', [{ id: 1, status: 'JOUE', scenarioName: 'Test', type: 'EVENEMENT_TELE', order: 1 }]);
  fixture.componentRef.setInput('canRecord', true);
  fixture.detectChanges();
  const buttons = fixture.nativeElement.querySelectorAll('button');
  const recordBtn = Array.from(buttons).find((b: unknown) => (b as HTMLElement).textContent?.includes('Saisir'));
  expect(recordBtn).toBeFalsy();
});

it('recordGame émet la partie au clic', () => {
  const game = { id: 1, status: 'PLANIFIE', scenarioName: 'Test', type: 'EVENEMENT_TELE', order: 1 };
  fixture.componentRef.setInput('games', [game]);
  fixture.componentRef.setInput('canManage', true);
  fixture.componentRef.setInput('canRecord', true);
  fixture.detectChanges();

  const emitted: unknown[] = [];
  outputToObservable(component.recordGame).subscribe(v => emitted.push(v));

  fixture.nativeElement.querySelector('button').click();
  expect(emitted).toHaveLength(1);
  expect((emitted[0] as any).id).toBe(1);
});
```

- [ ] **Lancer les tests frontend**

```bash
NX_IGNORE_UNSUPPORTED_TS_SETUP=true npx nx test frontend --testFile=apps/frontend/src/app/seasons/game-list/game-list.spec.ts
```

Attendu : tous les tests PASS

---

## Task 8 : Modifications `SeasonProgram` — orchestration saisie résultat

**Files:**
- Modify: `apps/frontend/src/app/seasons/season-program/season-program.ts`
- Modify: `apps/frontend/src/app/seasons/season-program/season-program.html`
- Modify: `apps/frontend/src/app/seasons/season-program/season-program.spec.ts`

**Interfaces:**
- Consumes:
  - `SeasonsService.getParticipants(seasonId): Observable<SeasonParticipant[]>` (endpoint existant : `GET /api/seasons/:id/participants`)
  - `SeasonsService.recordResult(seasonId, gameId, dto)` (Task 5)
  - `GameResultForm` inputs/outputs (Task 6)
  - `GameList` input `canRecord`, output `recordGame` (Task 7)

- [ ] **Ajouter les nouveaux signals et méthodes dans `season-program.ts`**

Ouvrir `apps/frontend/src/app/seasons/season-program/season-program.ts`. Ajouter :

```typescript
import { GameResultForm } from '../game-result-form/game-result-form';
import type { SeasonParticipant } from '../season.model';
import type { RecordResultDto } from '../game.model';

// Dans la classe, nouveaux signals :
recordingGame = signal<Game | null>(null);
participants = signal<SeasonParticipant[]>([]);
savingResult = signal<boolean>(false);
```

Dans `ngOnInit` (ou l'effet de chargement existant), charger les participants :

```typescript
this.seasonsService.getParticipants(this.seasonId()).subscribe({
  next: (participants) => this.participants.set(participants),
});
```

Ajouter les méthodes :

```typescript
onRecordGame(game: Game): void {
  this.recordingGame.set(game);
}

onResultSaved(dto: RecordResultDto): void {
  const game = this.recordingGame();
  if (!game) return;
  this.savingResult.set(true);
  this.seasonsService.recordResult(this.seasonId(), game.id, dto).subscribe({
    next: () => {
      this.recordingGame.set(null);
      this.savingResult.set(false);
      this.loadGames();
    },
    error: () => {
      this.savingResult.set(false);
    },
  });
}

onResultCancelled(): void {
  this.recordingGame.set(null);
}
```

Ajouter `GameResultForm` dans les `imports` du composant.

- [ ] **Modifier `season-program.html`**

Remplacer le bloc qui affiche `GameList` par un bloc conditionnel :

```html
@if (recordingGame()) {
  <app-game-result-form
    [participants]="participants()"
    [saving]="savingResult()"
    (saved)="onResultSaved($event)"
    (formCancel)="onResultCancelled()"
  />
} @else {
  <!-- bloc GameList existant, avec les nouveaux inputs -->
  <app-game-list
    [games]="games()"
    [canManage]="canManage()"
    [canRecord]="canManage()"
    (editGame)="onEditGame($event)"
    (deleteGame)="onDeleteGame($event)"
    (recordGame)="onRecordGame($event)"
  />
  <!-- ...reste du bloc existant (GameForm, ConfirmModal) -->
}
```

- [ ] **Ajouter les tests dans `season-program.spec.ts`**

```typescript
it('affiche GameResultForm quand recordingGame est défini', () => {
  component.recordingGame.set({ id: 1, status: 'PLANIFIE', scenarioName: 'Test', type: 'EVENEMENT_TELE', order: 1 } as any);
  fixture.detectChanges();
  expect(fixture.nativeElement.querySelector('app-game-result-form')).toBeTruthy();
  expect(fixture.nativeElement.querySelector('app-game-list')).toBeFalsy();
});

it('onRecordGame met à jour recordingGame', () => {
  const game = { id: 2, status: 'PLANIFIE' } as any;
  component.onRecordGame(game);
  expect(component.recordingGame()).toEqual(game);
});

it('onResultCancelled remet recordingGame à null', () => {
  component.recordingGame.set({ id: 1 } as any);
  component.onResultCancelled();
  expect(component.recordingGame()).toBeNull();
});
```

- [ ] **Lancer tous les tests frontend**

```bash
NX_IGNORE_UNSUPPORTED_TS_SETUP=true npx nx test frontend
```

Attendu : tous les tests PASS

---

## Task 9 : Vérification E2E manuelle

- [ ] **Démarrer l'environnement**

```bash
./dev.sh
```

- [ ] **Scénario 1 — EVENEMENT_TELE, règle ⌈N/2⌉**

1. Se connecter en tant qu'organisateur d'une saison avec 4 participants VALIDATED
2. Ajouter une partie de type EVENEMENT_TELE (scénario "Course de la Mort")
3. Cliquer "🎯 Saisir les rangs"
4. Cocher 4 équipes → vérifier badge "classé" sur les 2 premières, "non classé" sur les 2 dernières
5. Réordonner par drag-and-drop
6. Cliquer "Valider le classement"
7. Vérifier que la partie affiche le statut "Jouée" dans la liste
8. Vérifier qu'on ne peut plus cliquer "🎯 Saisir les rangs" sur cette partie

- [ ] **Scénario 2 — ESCARMOUCHE**

1. Ajouter une partie ESCARMOUCHE
2. Saisir les rangs de 2 équipes
3. Valider → partie passe à JOUE

- [ ] **Scénario 3 — Sécurité**

1. Se connecter en tant que participant non-organisateur
2. Vérifier que le bouton "🎯 Saisir les rangs" est absent

- [ ] **Lancer la suite de tests complète**

```bash
NX_IGNORE_UNSUPPORTED_TS_SETUP=true npx nx test backend && NX_IGNORE_UNSUPPORTED_TS_SETUP=true npx nx test frontend
```

Attendu : tous les tests PASS

---

## Spec couverte — récapitulatif

| Critère spec | Task |
|---|---|
| `GameResult` créé par équipe présente avec `rank` | Task 1, 3 |
| PC calculés 10/5/2/1, règle ⌈N/2⌉, EVENEMENT_TELE uniquement | Task 3 |
| ESCARMOUCHE → 0 PC | Task 3 |
| Non-organisateur → refusé (404) | Task 3, 4 |
| Partie passe à `JOUE` après validation | Task 3 |
| Transaction atomique | Task 3 |
| UI drag-and-drop | Task 6 |
| Badge classé/non-classé temps réel | Task 6 |
| Organisateur peut marquer absents | Task 6 |
