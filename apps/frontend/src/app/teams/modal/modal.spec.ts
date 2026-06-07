/**
 * Tests unitaires pour Modal.
 *
 * Mirroir de `team-card.spec.ts` (cf. son en-tête) : composant "dumb", on vérifie
 * uniquement l'affichage conditionnel (selon `visible`/`title`), la projection
 * du contenu (`<ng-content />`) et l'émission de `closeRequested` sur les TROIS
 * interactions prévues — overlay, croix, touche Échap (cf. en-tête de `modal.ts`).
 *
 * Composant hôte minimal : `<ng-content />` ne peut pas être vérifié en isolation,
 * il faut un composant englobant qui projette du contenu réel dans <app-modal>.
 */
import { Component } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { outputToObservable } from '@angular/core/rxjs-interop';
import { Modal } from './modal';

// Composant hôte : seul moyen de tester la projection de contenu (<ng-content />)
// d'un composant — on l'enveloppe dans un gabarit qui projette un marqueur connu.
@Component({
  standalone: true,
  imports: [Modal],
  template: `
    <app-modal [visible]="visible" [title]="title">
      <p class="projected-marker">Contenu projeté</p>
    </app-modal>
  `,
})
class HostComponent {
  visible = true;
  title = 'Titre de test';
}

describe('Modal', () => {
  let hostFixture: ComponentFixture<HostComponent>;
  let host: HostComponent;
  let modal: Modal;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [HostComponent],
    }).compileComponents();

    hostFixture = TestBed.createComponent(HostComponent);
    host = hostFixture.componentInstance;
    modal = hostFixture.debugElement.children[0].componentInstance as Modal;
    hostFixture.detectChanges();
  });

  // ── Affichage conditionnel ──────────────────────────────────────────────────

  it('affiche l\'overlay quand `visible` est true', () => {
    const el = hostFixture.nativeElement as HTMLElement;
    expect(el.querySelector('.modal-overlay')).not.toBeNull();
  });

  it('n\'affiche rien quand `visible` est false', () => {
    host.visible = false;
    hostFixture.detectChanges();

    const el = hostFixture.nativeElement as HTMLElement;
    expect(el.querySelector('.modal-overlay')).toBeNull();
  });

  it('affiche le titre fourni', () => {
    const el = hostFixture.nativeElement as HTMLElement;
    expect(el.querySelector('.modal-title')?.textContent).toContain('Titre de test');
  });

  it('n\'affiche pas de titre si `title` est vide (valeur par défaut)', () => {
    host.title = '';
    hostFixture.detectChanges();

    const el = hostFixture.nativeElement as HTMLElement;
    expect(el.querySelector('.modal-title')).toBeNull();
  });

  // ── Projection de contenu ───────────────────────────────────────────────────

  it('projette le contenu fourni par le parent via <ng-content />', () => {
    const el = hostFixture.nativeElement as HTMLElement;
    expect(el.querySelector('.projected-marker')?.textContent).toContain('Contenu projeté');
  });

  // ── Émission de closeRequested ──────────────────────────────────────────────

  it('émet closeRequested au clic sur l\'overlay', () => {
    const emitted: void[] = [];
    outputToObservable(modal.closeRequested).subscribe(() => emitted.push(undefined));

    const overlay = hostFixture.nativeElement.querySelector('.modal-overlay') as HTMLElement;
    overlay.click();

    expect(emitted).toHaveLength(1);
  });

  it('émet closeRequested au clic sur la croix de fermeture', () => {
    const emitted: void[] = [];
    outputToObservable(modal.closeRequested).subscribe(() => emitted.push(undefined));

    const closeBtn = hostFixture.nativeElement.querySelector('.modal-close') as HTMLButtonElement;
    closeBtn.click();

    expect(emitted).toHaveLength(1);
  });

  it('n\'émet PAS closeRequested au clic sur le contenu (stopPropagation)', () => {
    const emitted: void[] = [];
    outputToObservable(modal.closeRequested).subscribe(() => emitted.push(undefined));

    const content = hostFixture.nativeElement.querySelector('.modal-content') as HTMLElement;
    content.click();

    expect(emitted).toHaveLength(0);
  });

  it('émet closeRequested sur la touche Échap quand la modale est visible', () => {
    const emitted: void[] = [];
    outputToObservable(modal.closeRequested).subscribe(() => emitted.push(undefined));

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));

    expect(emitted).toHaveLength(1);
  });

  it('n\'émet PAS closeRequested sur Échap quand la modale est masquée', () => {
    host.visible = false;
    hostFixture.detectChanges();

    const emitted: void[] = [];
    outputToObservable(modal.closeRequested).subscribe(() => emitted.push(undefined));

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));

    expect(emitted).toHaveLength(0);
  });
});
