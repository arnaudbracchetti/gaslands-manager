/**
 * Tests unitaires pour GameList (composant dumb).
 *
 * Vérifie : émission des actions edit/delete, et la règle canModify
 * (gérable ET partie PLANIFIE) qui conditionne l'affichage des boutons.
 */
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { outputToObservable } from '@angular/core/rxjs-interop';
import type { CdkDrag, CdkDragDrop, CdkDropList } from '@angular/cdk/drag-drop';
import { GameList } from './game-list';
import { Game } from '../game.model';

function makeGame(overrides: Partial<Game> = {}): Game {
  return {
    id: 1,
    campaignId: 1,
    scenarioId: 'course_de_la_mort',
    scenarioName: 'La Course de la Mort',
    type: 'EVENEMENT_TELE',
    status: 'PLANIFIE',
    order: 1,
    playedAt: null,
    createdAt: '2025-01-01T00:00:00.000Z',
    updatedAt: '2025-01-01T00:00:00.000Z',
    franchissementPortes: true,
    gainJerricans: false,
    ...overrides,
  };
}

describe('GameList', () => {
  let component: GameList;
  let fixture: ComponentFixture<GameList>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [GameList] }).compileComponents();
    fixture = TestBed.createComponent(GameList);
    component = fixture.componentInstance;
  });

  it('autorise la modification d\'une partie PLANIFIE quand gérable', () => {
    fixture.componentRef.setInput('games', [makeGame()]);
    fixture.componentRef.setInput('canManage', true);
    fixture.detectChanges();

    expect(component.canModify(makeGame({ status: 'PLANIFIE' }))).toBe(true);
  });

  it('interdit la modification d\'une partie JOUE même si gérable', () => {
    fixture.componentRef.setInput('games', [makeGame()]);
    fixture.componentRef.setInput('canManage', true);
    fixture.detectChanges();

    expect(component.canModify(makeGame({ status: 'JOUE' }))).toBe(false);
  });

  it('interdit la modification d\'une partie en ATELIER même si gérable', () => {
    fixture.componentRef.setInput('games', [makeGame()]);
    fixture.componentRef.setInput('canManage', true);
    fixture.detectChanges();

    expect(component.canModify(makeGame({ status: 'ATELIER' }))).toBe(false);
  });

  it('interdit la modification quand non gérable', () => {
    fixture.componentRef.setInput('games', [makeGame()]);
    fixture.componentRef.setInput('canManage', false);
    fixture.detectChanges();

    expect(component.canModify(makeGame())).toBe(false);
  });

  it('émet editGame avec la partie', () => {
    fixture.componentRef.setInput('games', [makeGame()]);
    fixture.componentRef.setInput('canManage', true);
    fixture.detectChanges();

    const emitted: Game[] = [];
    outputToObservable(component.editGame).subscribe((g) => emitted.push(g));

    const game = makeGame({ id: 5 });
    component.editGame.emit(game);

    expect(emitted).toEqual([game]);
  });

  it('émet deleteGame avec la partie', () => {
    fixture.componentRef.setInput('games', [makeGame()]);
    fixture.componentRef.setInput('canManage', true);
    fixture.detectChanges();

    const emitted: Game[] = [];
    outputToObservable(component.deleteGame).subscribe((g) => emitted.push(g));

    const game = makeGame({ id: 5 });
    component.deleteGame.emit(game);

    expect(emitted).toEqual([game]);
  });

  it('fournit des libellés lisibles de type et statut', () => {
    expect(component.typeLabel(makeGame({ type: 'EVENEMENT_TELE' }))).toBe('Événement Télévisé');
    expect(component.typeLabel(makeGame({ type: 'ESCARMOUCHE' }))).toBe('Escarmouche');
    expect(component.statusLabel(makeGame({ status: 'PLANIFIE' }))).toBe('Planifiée');
    expect(component.statusLabel(makeGame({ status: 'ATELIER' }))).toBe('Atelier');
    expect(component.statusLabel(makeGame({ status: 'JOUE' }))).toBe('Jouée');
  });

  it('affiche la date de la séquence de fin de partie quand playedAt est renseigné', () => {
    fixture.componentRef.setInput('games', [
      makeGame({ status: 'JOUE', playedAt: '2026-03-05T00:00:00.000Z' }),
    ]);
    fixture.detectChanges();

    const dateEl = fixture.nativeElement.querySelector('.game-list__played-date');
    expect(dateEl?.textContent?.trim()).toBe('05/03/2026');
  });

  it('n\'affiche aucune date pour une partie PLANIFIE (playedAt null)', () => {
    fixture.componentRef.setInput('games', [makeGame({ status: 'PLANIFIE', playedAt: null })]);
    fixture.detectChanges();

    const dateEl = fixture.nativeElement.querySelector('.game-list__played-date');
    expect(dateEl).toBeFalsy();
  });

  it('affiche le bouton "Fin de partie" pour une partie PLANIFIE quand canRecord=true', () => {
    fixture.componentRef.setInput('games', [makeGame()]);
    fixture.componentRef.setInput('canManage', true);
    fixture.componentRef.setInput('canRecord', true);
    fixture.detectChanges();

    const buttons = fixture.nativeElement.querySelectorAll('button');
    const recordBtn = Array.from(buttons).find((b: unknown) =>
      (b as HTMLElement).textContent?.includes('Fin de partie')
    );
    expect(recordBtn).toBeTruthy();
  });

  it('n\'affiche pas le bouton pour une partie JOUE', () => {
    fixture.componentRef.setInput('games', [makeGame({ status: 'JOUE' })]);
    fixture.componentRef.setInput('canRecord', true);
    fixture.detectChanges();

    const buttons = fixture.nativeElement.querySelectorAll('button');
    const recordBtn = Array.from(buttons).find((b: unknown) =>
      (b as HTMLElement).textContent?.includes('Fin de partie')
    );
    expect(recordBtn).toBeFalsy();
  });

  it('n\'affiche pas le bouton pour une partie en ATELIER', () => {
    fixture.componentRef.setInput('games', [makeGame({ status: 'ATELIER' })]);
    fixture.componentRef.setInput('canRecord', true);
    fixture.detectChanges();

    const buttons = fixture.nativeElement.querySelectorAll('button');
    const recordBtn = Array.from(buttons).find((b: unknown) =>
      (b as HTMLElement).textContent?.includes('Fin de partie')
    );
    expect(recordBtn).toBeFalsy();
  });

  it('affiche le bouton "Journal" pour une partie en ATELIER ou JOUE', () => {
    fixture.componentRef.setInput('games', [makeGame({ status: 'ATELIER' })]);
    fixture.detectChanges();

    let journalBtn = fixture.nativeElement.querySelector('.game-list__journal');
    expect(journalBtn).toBeTruthy();

    fixture.componentRef.setInput('games', [makeGame({ status: 'JOUE' })]);
    fixture.detectChanges();

    journalBtn = fixture.nativeElement.querySelector('.game-list__journal');
    expect(journalBtn).toBeTruthy();
  });

  it('n\'affiche pas le bouton "Journal" pour une partie PLANIFIE', () => {
    fixture.componentRef.setInput('games', [makeGame({ status: 'PLANIFIE' })]);
    fixture.detectChanges();

    const journalBtn = fixture.nativeElement.querySelector('.game-list__journal');
    expect(journalBtn).toBeFalsy();
  });

  it('le bouton "Journal" est visible même sans canManage ni canRecord', () => {
    fixture.componentRef.setInput('games', [makeGame({ status: 'JOUE' })]);
    fixture.componentRef.setInput('canManage', false);
    fixture.componentRef.setInput('canRecord', false);
    fixture.detectChanges();

    const journalBtn = fixture.nativeElement.querySelector('.game-list__journal');
    expect(journalBtn).toBeTruthy();
  });

  it('émet openJournal avec la partie au clic', () => {
    const game = makeGame({ id: 9, status: 'JOUE' });
    fixture.componentRef.setInput('games', [game]);
    fixture.detectChanges();

    const emitted: Game[] = [];
    outputToObservable(component.openJournal).subscribe((g) => emitted.push(g));

    fixture.nativeElement.querySelector('.game-list__journal').click();

    expect(emitted).toEqual([game]);
  });

  it('recordGame émet la partie au clic', () => {
    const game = makeGame();
    fixture.componentRef.setInput('games', [game]);
    fixture.componentRef.setInput('canManage', true);
    fixture.componentRef.setInput('canRecord', true);
    fixture.detectChanges();

    const emitted: Game[] = [];
    outputToObservable(component.recordGame).subscribe((g) => emitted.push(g));

    const recordBtn = fixture.nativeElement.querySelector('.game-list__record');
    if (recordBtn) {
      recordBtn.click();
    }

    expect(emitted).toHaveLength(1);
    expect(emitted[0].id).toBe(game.id);
  });

  describe('réordonnancement (US-A4)', () => {
    const planifieA = makeGame({ id: 10, order: 1, status: 'PLANIFIE' });
    const joue = makeGame({ id: 20, order: 2, status: 'JOUE' });
    const planifieB = makeGame({ id: 30, order: 3, status: 'PLANIFIE' });

    function setupThreeGames(canManage = true): void {
      fixture.componentRef.setInput('games', [planifieA, joue, planifieB]);
      fixture.componentRef.setInput('canManage', canManage);
      fixture.detectChanges();
    }

    it('initialise orderedGames() depuis games()', () => {
      setupThreeGames();
      expect(component.orderedGames().map((g) => g.id)).toEqual([10, 20, 30]);
    });

    it('affiche la poignée et les flèches uniquement pour les parties PLANIFIE', () => {
      setupThreeGames();
      const handles = fixture.nativeElement.querySelectorAll('.game-list__handle');
      expect(handles.length).toBe(2);
    });

    it('n\'affiche aucune poignée/flèche quand non gérable', () => {
      setupThreeGames(false);
      expect(fixture.nativeElement.querySelectorAll('.game-list__handle').length).toBe(0);
    });

    it('moveDown permute deux parties PLANIFIE en sautant la partie JOUE intercalée', () => {
      setupThreeGames();
      const emitted: number[][] = [];
      outputToObservable(component.reorderRequested).subscribe((ids) => emitted.push(ids));

      component.moveDown(10);

      // La partie JOUE (id 20) garde sa position 1 (index) dans orderedGames() ;
      // seules les 2 parties PLANIFIE ont permuté entre elles.
      expect(component.orderedGames().map((g) => g.id)).toEqual([30, 20, 10]);
      expect(emitted).toEqual([[30, 10]]);
    });

    it('moveUp est un no-op s\'il n\'y a pas de partie PLANIFIE précédente', () => {
      setupThreeGames();
      component.moveUp(10);
      expect(component.orderedGames().map((g) => g.id)).toEqual([10, 20, 30]);
    });

    it('moveDown est un no-op s\'il n\'y a pas de partie PLANIFIE suivante', () => {
      setupThreeGames();
      component.moveDown(30);
      expect(component.orderedGames().map((g) => g.id)).toEqual([10, 20, 30]);
    });

    it('hasPreviousPlanifie/hasNextPlanifie ignorent les parties non-PLANIFIE', () => {
      setupThreeGames();
      expect(component.hasPreviousPlanifie(10)).toBe(false);
      expect(component.hasNextPlanifie(10)).toBe(true);
      expect(component.hasPreviousPlanifie(30)).toBe(true);
      expect(component.hasNextPlanifie(30)).toBe(false);
    });

    it('sortPredicate refuse un index occupé par une partie non-PLANIFIE', () => {
      setupThreeGames();
      const drop = { data: component.orderedGames() } as unknown as CdkDropList<Game[]>;
      const drag = {} as unknown as CdkDrag<Game>;
      expect(component.sortPredicate(1, drag, drop)).toBe(false);
      expect(component.sortPredicate(0, drag, drop)).toBe(true);
      expect(component.sortPredicate(2, drag, drop)).toBe(true);
    });

    it('drop réordonne et émet uniquement les ids des parties PLANIFIE', () => {
      setupThreeGames();
      const emitted: number[][] = [];
      outputToObservable(component.reorderRequested).subscribe((ids) => emitted.push(ids));

      component.drop(
        { previousIndex: 0, currentIndex: 2 } as unknown as CdkDragDrop<Game[]>,
      );

      expect(emitted).toHaveLength(1);
      expect(emitted[0]).not.toContain(20);
    });

    it('orderedGames() se réinitialise si games() change (ex. rechargement serveur)', () => {
      setupThreeGames();
      component.moveDown(10);
      expect(component.orderedGames().map((g) => g.id)).toEqual([30, 20, 10]);

      fixture.componentRef.setInput('games', [planifieA, joue, planifieB]);
      fixture.detectChanges();

      expect(component.orderedGames().map((g) => g.id)).toEqual([10, 20, 30]);
    });
  });
});
