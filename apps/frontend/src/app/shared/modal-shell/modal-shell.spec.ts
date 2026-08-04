/**
 * Tests unitaires pour ModalShell (composant dumb).
 *
 * Couvre les deux modes ('action' : deux boutons, fermeture par bouton
 * uniquement ; 'consultation' : un seul bouton, fermeture par bouton ou par
 * clic hors de la boîte) et le rendu du contenu projeté — première
 * utilisation de <ng-content> du projet, via un composant hôte de test.
 */
import { Component, WritableSignal, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { CdkTrapFocus } from '@angular/cdk/a11y';
import { ModalShell } from './modal-shell';

// Zoneless : les valeurs mutées entre deux detectChanges() doivent être des
// Signals, pas de simples champs — sinon Angular ne les re-vérifie pas de
// façon cohérente (NG0100 ExpressionChangedAfterItHasBeenCheckedError).
@Component({
  standalone: true,
  imports: [ModalShell],
  template: `
    <app-modal-shell
      ariaLabel="Test"
      [mode]="mode()"
      [confirmDisabled]="confirmDisabled()"
      (confirmed)="confirmedCount.set(confirmedCount() + 1)"
      (cancelled)="cancelledCount.set(cancelledCount() + 1)">
      <p class="probe">Contenu projeté</p>
    </app-modal-shell>
  `,
})
class HostComponent {
  mode: WritableSignal<'action' | 'consultation'> = signal('action');
  confirmDisabled: WritableSignal<boolean> = signal(false);
  confirmedCount: WritableSignal<number> = signal(0);
  cancelledCount: WritableSignal<number> = signal(0);
}

describe('ModalShell', () => {
  let fixture: ComponentFixture<HostComponent>;
  let host: HostComponent;

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [HostComponent] }).compileComponents();
    fixture = TestBed.createComponent(HostComponent);
    host = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('rend le contenu projeté', () => {
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('.probe')?.textContent).toContain('Contenu projeté');
  });

  it('pose cdkTrapFocus (avec capture automatique) sur la boîte de dialogue', () => {
    // Le déplacement de focus réel dépend de la géométrie de l'élément
    // (FocusTrap.isVisible() → hasGeometry(), toujours 0 en jsdom - aucun
    // moteur de layout) : impossible à observer de façon fiable ici, et ce
    // serait tester le comportement de CDK lui-même plutôt que notre
    // câblage. On vérifie donc que la directive est bien posée sur
    // `.ms-modal` (pas `.ms-overlay`) avec la capture automatique activée.
    const trapDebugEl = fixture.debugElement.query(By.directive(CdkTrapFocus));
    expect(trapDebugEl).not.toBeNull();
    expect((trapDebugEl!.nativeElement as HTMLElement).classList.contains('ms-modal')).toBe(true);
    expect(trapDebugEl!.injector.get(CdkTrapFocus).autoCapture).toBe(true);
  });

  describe('mode "action" (défaut)', () => {
    it('affiche les deux boutons', () => {
      const el = fixture.nativeElement as HTMLElement;
      expect(el.querySelector('.ms-modal__cancel')).toBeTruthy();
      expect(el.querySelector('.ms-modal__confirm')).toBeTruthy();
    });

    it('émet cancelled au clic sur le bouton Annuler', () => {
      (fixture.nativeElement.querySelector('.ms-modal__cancel') as HTMLButtonElement).click();
      expect(host.cancelledCount()).toBe(1);
    });

    it('émet confirmed au clic sur le bouton d\'action', () => {
      (fixture.nativeElement.querySelector('.ms-modal__confirm') as HTMLButtonElement).click();
      expect(host.confirmedCount()).toBe(1);
    });

    it('n\'émet rien au clic sur l\'overlay', () => {
      (fixture.nativeElement.querySelector('.ms-overlay') as HTMLDivElement).click();
      expect(host.cancelledCount()).toBe(0);
      expect(host.confirmedCount()).toBe(0);
    });

    it('désactive le bouton de confirmation et empêche son clic quand confirmDisabled est vrai', () => {
      host.confirmDisabled.set(true);
      fixture.detectChanges();

      const confirmButton = fixture.nativeElement.querySelector('.ms-modal__confirm') as HTMLButtonElement;
      expect(confirmButton.disabled).toBe(true);

      confirmButton.click();
      expect(host.confirmedCount()).toBe(0);
    });
  });

  describe('mode "consultation"', () => {
    beforeEach(() => {
      host.mode.set('consultation');
      fixture.detectChanges();
    });

    it('n\'affiche qu\'un seul bouton (pas de bouton de confirmation)', () => {
      const el = fixture.nativeElement as HTMLElement;
      expect(el.querySelector('.ms-modal__cancel')).toBeTruthy();
      expect(el.querySelector('.ms-modal__confirm')).toBeFalsy();
    });

    it('émet cancelled au clic sur le bouton Fermer', () => {
      (fixture.nativeElement.querySelector('.ms-modal__cancel') as HTMLButtonElement).click();
      expect(host.cancelledCount()).toBe(1);
    });

    it('émet cancelled au clic sur l\'overlay (hors de la boîte)', () => {
      (fixture.nativeElement.querySelector('.ms-overlay') as HTMLDivElement).click();
      expect(host.cancelledCount()).toBe(1);
    });

    it('n\'émet rien au clic à l\'intérieur de la boîte (target != overlay)', () => {
      (fixture.nativeElement.querySelector('.ms-modal') as HTMLDivElement).click();
      expect(host.cancelledCount()).toBe(0);
    });
  });
});
