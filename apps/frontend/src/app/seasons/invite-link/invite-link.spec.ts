/**
 * Tests unitaires pour InviteLink.
 *
 * Composant "dumb" : affichage du code + copie dans le presse-papiers
 * (navigator.clipboard mocké, cf. CLAUDE.md §8.2 "Outils clés").
 */
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { vi } from 'vitest';
import { InviteLink } from './invite-link';

describe('InviteLink', () => {
  let component: InviteLink;
  let fixture: ComponentFixture<InviteLink>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [InviteLink],
    }).compileComponents();

    fixture = TestBed.createComponent(InviteLink);
    component = fixture.componentInstance;
  });

  it('affiche le code d\'invitation', () => {
    fixture.componentRef.setInput('inviteCode', 'abcdef123456');
    fixture.detectChanges();

    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('.invite-link__code')?.textContent).toContain('abcdef123456');
  });

  it('copie le code dans le presse-papiers et affiche un retour visuel temporaire', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal('navigator', { clipboard: { writeText } });

    fixture.componentRef.setInput('inviteCode', 'abcdef123456');
    fixture.detectChanges();

    component.copyCode();
    await Promise.resolve();
    fixture.detectChanges();

    expect(writeText).toHaveBeenCalledWith('abcdef123456');
    expect(component.copied()).toBe(true);
  });
});
