/**
 * Tests unitaires pour VehicleService (frontend, co-localisé avec VehicleBuilder).
 *
 * Mirroir de `teams.service.spec.ts`/`catalog.service.spec.ts` (cf. leur en-tête) :
 * `HttpTestingController` intercepte chaque requête sortante et vérifie sa
 * construction (méthode, URL, corps). Le service n'a aucune logique propre —
 * cinq façades sur `HttpClient` pour le flux de construction, plus `getAllForTeam`
 * (consommée par `Teams`, hors flux — cf. en-tête de `vehicle.service.ts`).
 */

import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { VehicleService } from './vehicle.service';
import {
  Vehicle,
  AvailableImprovementDto,
  AvailableWeaponDto,
} from './vehicle-builder.model';

// Véhicule fictif "nu" — réponse fictive de POST /api/teams/:teamId/vehicles
const mockVehicle: Vehicle = {
  id: 7,
  nomInterne: 'camion',
  teamId: 3,
  improvements: [],
  weapons: [],
  createdAt: '2025-01-01T00:00:00.000Z',
};

const mockAvailableImprovement: AvailableImprovementDto = {
  nom: 'Chenilles',
  nomInterne: 'chenilles',
  prix: 4,
  emplacement: 1,
  disponible: true,
};

const mockAvailableWeapon: AvailableWeaponDto = {
  nom: 'Mitrailleuse',
  nomInterne: 'mitrailleuse',
  prix: 4,
  emplacement: 1,
  type: 'base',
  disponible: false,
  raison: 'Une orientation est requise pour monter "Mitrailleuse" sur un arc de tir',
};

describe('VehicleService', () => {
  let service: VehicleService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [VehicleService, provideHttpClient(), provideHttpClientTesting()],
    });

    service = TestBed.inject(VehicleService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  // ── create() ────────────────────────────────────────────────────────────────

  describe('create()', () => {
    it('effectue POST /api/teams/:teamId/vehicles avec le DTO et retourne le véhicule créé', () => {
      let result: Vehicle | undefined;
      const dto = { nomInterne: 'camion' };

      service.create(3, dto).subscribe((vehicle) => { result = vehicle; });

      const req = httpMock.expectOne('/api/teams/3/vehicles');
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toEqual(dto);
      req.flush(mockVehicle);

      expect(result).toEqual(mockVehicle);
    });
  });

  // ── getAvailableImprovements() ──────────────────────────────────────────────

  describe('getAvailableImprovements()', () => {
    it('effectue GET /api/vehicles/:id/available-improvements et retourne le catalogue filtré', () => {
      let result: AvailableImprovementDto[] | undefined;

      service.getAvailableImprovements(7).subscribe((dtos) => { result = dtos; });

      const req = httpMock.expectOne('/api/vehicles/7/available-improvements');
      expect(req.request.method).toBe('GET');
      req.flush([mockAvailableImprovement]);

      expect(result).toEqual([mockAvailableImprovement]);
    });
  });

  // ── addImprovement() ────────────────────────────────────────────────────────

  describe('addImprovement()', () => {
    it('effectue POST /api/vehicles/:id/improvements avec le DTO et retourne le véhicule rechargé', () => {
      let result: Vehicle | undefined;
      const dto = { nomInterne: 'chenilles' };
      const reloaded = { ...mockVehicle, improvements: [{ id: 1, nomInterne: 'chenilles', orientation: null, vehicleId: 7, createdAt: '2025-01-01T00:00:00.000Z' }] };

      service.addImprovement(7, dto).subscribe((vehicle) => { result = vehicle; });

      const req = httpMock.expectOne('/api/vehicles/7/improvements');
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toEqual(dto);
      req.flush(reloaded);

      expect(result).toEqual(reloaded);
    });

    it('transmet `orientation` dans le corps quand elle est fournie (améliorations orientables)', () => {
      const dto = { nomInterne: 'belier', orientation: 'avant' as const };

      service.addImprovement(7, dto).subscribe();

      const req = httpMock.expectOne('/api/vehicles/7/improvements');
      expect(req.request.body).toEqual(dto);
      req.flush(mockVehicle);
    });
  });

  // ── getAvailableWeapons() ───────────────────────────────────────────────────

  describe('getAvailableWeapons()', () => {
    it('effectue GET /api/vehicles/:id/available-weapons et retourne le catalogue filtré', () => {
      let result: AvailableWeaponDto[] | undefined;

      service.getAvailableWeapons(7).subscribe((dtos) => { result = dtos; });

      const req = httpMock.expectOne('/api/vehicles/7/available-weapons');
      expect(req.request.method).toBe('GET');
      req.flush([mockAvailableWeapon]);

      expect(result).toEqual([mockAvailableWeapon]);
    });
  });

  // ── addWeapon() ─────────────────────────────────────────────────────────────

  describe('addWeapon()', () => {
    it('effectue POST /api/vehicles/:id/weapons avec le DTO et retourne le véhicule rechargé', () => {
      let result: Vehicle | undefined;
      const dto = { nomInterne: 'mitrailleuse', orientation: 'avant' as const };
      const reloaded = { ...mockVehicle, weapons: [{ id: 1, nomInterne: 'mitrailleuse', orientation: 'avant' as const, vehicleId: 7, createdAt: '2025-01-01T00:00:00.000Z', prix: 2 }] };

      service.addWeapon(7, dto).subscribe((vehicle) => { result = vehicle; });

      const req = httpMock.expectOne('/api/vehicles/7/weapons');
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toEqual(dto);
      req.flush(reloaded);

      expect(result).toEqual(reloaded);
    });

    it('transmet le DTO sans `orientation` pour une arme d\'équipage (champ optionnel)', () => {
      const dto = { nomInterne: 'grenades' };

      service.addWeapon(7, dto).subscribe();

      const req = httpMock.expectOne('/api/vehicles/7/weapons');
      expect(req.request.body).toEqual(dto);
      req.flush(mockVehicle);
    });
  });

  // ── getAllForTeam() ─────────────────────────────────────────────────────────
  // Hors flux de construction (cf. doc de la méthode) — consommée par `Teams`
  // pour bâtir le résumé affiché sur chaque carte (`buildVehicleSummary`).

  describe('getAllForTeam()', () => {
    it('effectue GET /api/teams/:teamId/vehicles et retourne les véhicules de l\'équipe', () => {
      let result: Vehicle[] | undefined;
      const equipped: Vehicle = {
        ...mockVehicle,
        improvements: [{ id: 1, nomInterne: 'blindage', orientation: null, vehicleId: 7, createdAt: '2025-01-01T00:00:00.000Z', estDefaut: false, prix: 4, emplacement: 1 }],
        weapons: [{ id: 1, nomInterne: 'mitrailleuse', orientation: 'avant', vehicleId: 7, createdAt: '2025-01-01T00:00:00.000Z', prix: 2 }],
      };

      service.getAllForTeam(3).subscribe((vehicles) => { result = vehicles; });

      const req = httpMock.expectOne('/api/teams/3/vehicles');
      expect(req.request.method).toBe('GET');
      req.flush([equipped]);

      expect(result).toEqual([equipped]);
    });
  });

  // ── remove() ────────────────────────────────────────────────────────────────
  // Trois méthodes de retrait/suppression — convention REST `204 No Content`,
  // d'où `req.flush(null)` (rien dans le corps de la réponse, cf. en-tête du service).

  describe('remove()', () => {
    it('effectue DELETE /api/vehicles/:id', () => {
      let completed = false;

      service.remove(7).subscribe(() => { completed = true; });

      const req = httpMock.expectOne('/api/vehicles/7');
      expect(req.request.method).toBe('DELETE');
      req.flush(null);

      expect(completed).toBe(true);
    });
  });

  // ── removeWeapon() ──────────────────────────────────────────────────────────

  describe('removeWeapon()', () => {
    it('effectue DELETE /api/weapons/:id — route "à plat", reflet exact du backend', () => {
      let completed = false;

      service.removeWeapon(9).subscribe(() => { completed = true; });

      const req = httpMock.expectOne('/api/weapons/9');
      expect(req.request.method).toBe('DELETE');
      req.flush(null);

      expect(completed).toBe(true);
    });
  });

  // ── removeImprovement() ─────────────────────────────────────────────────────

  describe('removeImprovement()', () => {
    it('effectue DELETE /api/vehicles/:id/improvements/:improvementId — route nichée, mirroir d\'addImprovement', () => {
      let completed = false;

      service.removeImprovement(7, 3).subscribe(() => { completed = true; });

      const req = httpMock.expectOne('/api/vehicles/7/improvements/3');
      expect(req.request.method).toBe('DELETE');
      req.flush(null);

      expect(completed).toBe(true);
    });
  });
});
