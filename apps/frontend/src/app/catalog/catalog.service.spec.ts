/**
 * Tests unitaires pour CatalogService.
 *
 * Mirroir de `teams.service.spec.ts` (cf. son en-tête) : `HttpTestingController`
 * intercepte les requêtes sortantes et vérifie qu'elles sont bien construites
 * (méthode, URL) — aucun appel réseau réel. Le service n'a aucune logique propre
 * (juste deux façades sur `HttpClient`) : le seul comportement à couvrir est la
 * construction de l'URL — en particulier l'encodage des noms de sponsor accentués
 * (cf. `getSponsorByName`, et SPECIFICATION.md §6, note sur l'encodage).
 */

import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { CatalogService } from './catalog.service';
import { Sponsor } from './catalog.model';
import { SponsorInfo } from '../teams/team.model';

// Sponsor "allégé" (vue carousel) — réponse fictive de GET /api/catalog/sponsors
const mockSponsorInfo: SponsorInfo = {
  nom: 'Rutherford',
  description: 'Sponsor militaire',
  classes_avantage: ['Militaire'],
  avantages_sponsorises: '',
};

// Sponsor "enrichi" (vue complète, relations résolues) — réponse fictive de
// GET /api/catalog/sponsors/:nom (cf. `Sponsor`, distingué de `SponsorInfo` ci-dessus).
const mockSponsor: Sponsor = {
  nom: 'Rutherford',
  description: 'Sponsor militaire',
  classes_avantage: ['Militaire'],
  avantages_sponsorises: '',
  vehicules: [],
  armes: [],
  ameliorations: [],
};

describe('CatalogService', () => {
  let service: CatalogService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [CatalogService, provideHttpClient(), provideHttpClientTesting()],
    });

    service = TestBed.inject(CatalogService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  // ── getSponsors() ───────────────────────────────────────────────────────────

  describe('getSponsors()', () => {
    it('effectue GET /api/catalog/sponsors et retourne la liste allégée', () => {
      let result: SponsorInfo[] | undefined;

      service.getSponsors().subscribe((sponsors) => { result = sponsors; });

      const req = httpMock.expectOne('/api/catalog/sponsors');
      expect(req.request.method).toBe('GET');
      req.flush([mockSponsorInfo]);

      expect(result).toEqual([mockSponsorInfo]);
    });
  });

  // ── getSponsorByName() ──────────────────────────────────────────────────────

  describe('getSponsorByName()', () => {
    it('effectue GET /api/catalog/sponsors/:nom et retourne le catalogue complet du sponsor', () => {
      let result: Sponsor | undefined;

      service.getSponsorByName('Rutherford').subscribe((sponsor) => { result = sponsor; });

      const req = httpMock.expectOne('/api/catalog/sponsors/Rutherford');
      expect(req.request.method).toBe('GET');
      req.flush(mockSponsor);

      expect(result).toEqual(mockSponsor);
    });

    it('encode les noms de sponsor avec espaces et accents (ex: "La Geôlière")', () => {
      service.getSponsorByName('La Geôlière').subscribe();

      // encodeURIComponent('La Geôlière') → 'La%20Ge%C3%B4li%C3%A8re'
      // (cf. SPECIFICATION.md §6 : convention attendue par le backend)
      const req = httpMock.expectOne('/api/catalog/sponsors/La%20Ge%C3%B4li%C3%A8re');
      expect(req.request.method).toBe('GET');
      req.flush(mockSponsor);
    });
  });
});
