/**
 * Tests unitaires pour TeamBudget.
 *
 * TeamBudget est un composant "dumb" : on vérifie uniquement qu'il affiche
 * correctement les valeurs reçues en input (mirroir de `team-card.spec.ts`).
 * Aucun output à observer.
 */
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { TeamBudget } from './team-budget';

describe('TeamBudget', () => {
  let fixture: ComponentFixture<TeamBudget>;

  function setInputs(values: {
    budgetEquipe: number;
    coutEquipeTotal: number;
    budgetRestant: number;
    budgetDepasse: boolean;
    budgetPourcentage: number;
  }): void {
    fixture.componentRef.setInput('budgetEquipe', values.budgetEquipe);
    fixture.componentRef.setInput('coutEquipeTotal', values.coutEquipeTotal);
    fixture.componentRef.setInput('budgetRestant', values.budgetRestant);
    fixture.componentRef.setInput('budgetDepasse', values.budgetDepasse);
    fixture.componentRef.setInput('budgetPourcentage', values.budgetPourcentage);
    fixture.detectChanges();
  }

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TeamBudget],
    }).compileComponents();

    fixture = TestBed.createComponent(TeamBudget);
  });

  it('affiche le titre, le ratio utilisé/budget et le solde restant', () => {
    setInputs({ budgetEquipe: 50, coutEquipeTotal: 16, budgetRestant: 34, budgetDepasse: false, budgetPourcentage: 32 });

    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('.tb-title')?.textContent).toContain('Budget de l\'équipe');
    expect(el.textContent).toContain('16 / 50');
    expect(el.textContent).toContain('Restant');
    expect(el.textContent).toContain('34');
  });

  it('reflète le pourcentage consommé sur la largeur de la barre de progression', () => {
    setInputs({ budgetEquipe: 50, coutEquipeTotal: 16, budgetRestant: 34, budgetDepasse: false, budgetPourcentage: 32 });

    const el = fixture.nativeElement as HTMLElement;
    const fill = el.querySelector('.tb-bar-fill') as HTMLElement;
    expect(fill.style.width).toBe('32%');
    expect(fill.classList).not.toContain('tb-bar-fill--over');
  });

  it('affiche "Dépassement" et les classes --over quand budgetDepasse est vrai', () => {
    setInputs({ budgetEquipe: 10, coutEquipeTotal: 32, budgetRestant: -22, budgetDepasse: true, budgetPourcentage: 100 });

    const el = fixture.nativeElement as HTMLElement;
    const totalRow = el.querySelector('.tb-row--total') as HTMLElement;
    const fill = el.querySelector('.tb-bar-fill') as HTMLElement;

    expect(totalRow.textContent).toContain('Dépassement');
    expect(totalRow.textContent).toContain('22');
    expect(totalRow.classList).toContain('tb-row--over');
    expect(fill.classList).toContain('tb-bar-fill--over');
  });
});
