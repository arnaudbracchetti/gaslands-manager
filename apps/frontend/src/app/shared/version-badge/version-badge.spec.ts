/**
 * Tests unitaires pour VersionBadge.
 *
 * Cas testés :
 * - version reçue → affichée dans .badge
 * - { version: null } (IMAGE_TAG absent côté serveur) → rien affiché
 * - requête en erreur → rien affiché, aucune exception
 */
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { VersionBadge } from './version-badge';

describe('VersionBadge', () => {
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [VersionBadge],
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });

    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  it('affiche la version reçue de /api/version', async () => {
    const fixture = TestBed.createComponent(VersionBadge);
    await fixture.whenStable();

    httpMock.expectOne('/api/version').flush({ version: 'v9.9.9' });
    await fixture.whenStable();

    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('.badge')?.textContent?.trim()).toBe('v9.9.9');
  });

  it("n'affiche rien si le serveur renvoie { version: null }", async () => {
    const fixture = TestBed.createComponent(VersionBadge);
    await fixture.whenStable();

    httpMock.expectOne('/api/version').flush({ version: null });
    await fixture.whenStable();

    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('.badge')).toBeNull();
  });

  it("n'affiche rien et ne lève pas d'erreur si /api/version échoue", async () => {
    const fixture = TestBed.createComponent(VersionBadge);
    await fixture.whenStable();

    httpMock.expectOne('/api/version').flush(null, { status: 404, statusText: 'Not Found' });
    await fixture.whenStable();

    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('.badge')).toBeNull();
    expect(fixture.componentInstance.version()).toBeNull();
  });
});
