/**
 * Tests unitaires pour ImpersonationBanner (composant dumb).
 */
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { outputToObservable } from '@angular/core/rxjs-interop';
import { ImpersonationBanner } from './impersonation-banner';

describe('ImpersonationBanner', () => {
  let component: ImpersonationBanner;
  let fixture: ComponentFixture<ImpersonationBanner>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [ImpersonationBanner] }).compileComponents();
    fixture = TestBed.createComponent(ImpersonationBanner);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('impersonatedUserName', 'JeanLeFou');
    fixture.detectChanges();
  });

  it('affiche le nom de l\'utilisateur usurpé', () => {
    const el = fixture.nativeElement as HTMLElement;
    expect(el.textContent).toContain('JeanLeFou');
  });

  it('émet returnClicked au clic sur "Revenir à mon compte"', () => {
    const emitted: unknown[] = [];
    outputToObservable(component.returnClicked).subscribe(() => emitted.push(true));

    (fixture.nativeElement as HTMLElement).querySelector<HTMLButtonElement>('.imp-banner__return')?.click();

    expect(emitted).toHaveLength(1);
  });
});
