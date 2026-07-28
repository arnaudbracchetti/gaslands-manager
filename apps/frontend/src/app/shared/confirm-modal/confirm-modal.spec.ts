/**
 * Tests unitaires pour ConfirmModal (composant dumb, composant ModalShell).
 */
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { outputToObservable } from '@angular/core/rxjs-interop';
import { ConfirmModal } from './confirm-modal';

describe('ConfirmModal', () => {
  let component: ConfirmModal;
  let fixture: ComponentFixture<ConfirmModal>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [ConfirmModal] }).compileComponents();
    fixture = TestBed.createComponent(ConfirmModal);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('message', 'Confirmer la suppression ?');
    fixture.detectChanges();
  });

  it('affiche le message', () => {
    const el = fixture.nativeElement as HTMLElement;
    expect(el.textContent).toContain('Confirmer la suppression ?');
  });

  it('affiche les libellés par défaut', () => {
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('.ms-modal__cancel')?.textContent?.trim()).toBe('Annuler');
    expect(el.querySelector('.ms-modal__confirm')?.textContent?.trim()).toBe('Confirmer');
  });

  it('émet confirmed au clic sur le bouton de confirmation', () => {
    const emitted: unknown[] = [];
    outputToObservable(component.confirmed).subscribe(() => emitted.push(true));

    (fixture.nativeElement as HTMLElement).querySelector<HTMLButtonElement>('.ms-modal__confirm')?.click();

    expect(emitted).toHaveLength(1);
  });

  it('émet cancelled au clic sur le bouton d\'annulation', () => {
    const emitted: unknown[] = [];
    outputToObservable(component.cancelled).subscribe(() => emitted.push(true));

    (fixture.nativeElement as HTMLElement).querySelector<HTMLButtonElement>('.ms-modal__cancel')?.click();

    expect(emitted).toHaveLength(1);
  });
});
