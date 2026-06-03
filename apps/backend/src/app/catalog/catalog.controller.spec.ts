/**
 * Tests unitaires pour CatalogController.
 *
 * Objectif : tester la couche HTTP (routing, statuts, format de réponse)
 * en isolation totale du service.
 *
 * Le CatalogService est mocké : on contrôle les données retournées
 * pour ne tester QUE le comportement du contrôleur.
 *
 * Cas testés :
 * - GET /catalog/sponsors → retourne la liste des sponsors
 * - GET /catalog/sponsors/:nom → retourne le sponsor trouvé
 * - GET /catalog/sponsors/:nom → lève NotFoundException si sponsor inexistant
 * - GET /catalog/vehicules → retourne la liste des véhicules
 * - GET /catalog/armes → retourne la liste des armes
 * - GET /catalog/ameliorations → retourne la liste des améliorations
 */

import { vi, describe, it, expect, beforeEach } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { CatalogController } from './catalog.controller';
import { CatalogService } from './catalog.service';
import { Sponsor, Vehicule, Arme, Amelioration } from './catalog.interfaces';

// ── Données fictives utilisées dans les mocks ─────────────────────────────────

const mockSponsor: Sponsor = {
  nom: 'Rutherford',
  description: 'Sponsor militaire',
  classes_avantage: ['Militaire'],
  avantages_sponsorises: '- Véhicules militaires exclusifs',
  vehicules: [],
  armes: [],
  ameliorations: [],
};

const mockVehicule: Vehicule = {
  nom: 'Voiture',
  poids: 'Moyen',
  carrosserie: 10,
  manoeuvrabilite: 3,
  vitesse_max: 5,
  equipage: 2,
  emplacements: 2,
  prix: 12,
  description: 'Véhicule standard',
  regles: '',
  sponsors_autorises: ['Rutherford'],
};

const mockArme: Arme = {
  nom: 'Mitrailleuse',
  type: 'base',
  prix: 2,
  emplacement: 1,
  description: 'Arme automatique',
  regles: '',
  sponsors_autorises: ['Rutherford'],
};

const mockAmelioration: Amelioration = {
  nom: 'Blindage',
  prix: 4,
  emplacement: 1,
  description: '+2 carrosserie',
  regles: '',
  sponsors_autorises: ['Rutherford'],
};

// ── Mock du CatalogService ───────────────────────────────────────────────────

const mockCatalogService = {
  getAllSponsors: vi.fn(),
  getSponsor: vi.fn(),
  getAllVehicules: vi.fn(),
  getAllArmes: vi.fn(),
  getAllAmeliorations: vi.fn(),
};

// ── Suite de tests ────────────────────────────────────────────────────────────

describe('CatalogController', () => {
  let controller: CatalogController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [CatalogController],
      providers: [
        {
          // On injecte le mock à la place du vrai CatalogService
          provide: CatalogService,
          useValue: mockCatalogService,
        },
      ],
    }).compile();

    controller = module.get<CatalogController>(CatalogController);

    // Réinitialiser tous les mocks entre chaque test
    vi.clearAllMocks();
  });

  // ── GET /catalog/sponsors ───────────────────────────────────────────────────

  describe('getAllSponsors()', () => {
    it('retourne la liste des sponsors depuis le service', () => {
      mockCatalogService.getAllSponsors.mockReturnValue([mockSponsor]);

      const result = controller.getAllSponsors();

      expect(mockCatalogService.getAllSponsors).toHaveBeenCalledOnce();
      expect(result).toEqual([mockSponsor]);
    });

    it('retourne un tableau vide si le catalogue est vide', () => {
      mockCatalogService.getAllSponsors.mockReturnValue([]);

      const result = controller.getAllSponsors();

      expect(result).toEqual([]);
    });
  });

  // ── GET /catalog/sponsors/:nom ──────────────────────────────────────────────

  describe('getSponsor()', () => {
    it('retourne le sponsor trouvé par son nom', () => {
      mockCatalogService.getSponsor.mockReturnValue(mockSponsor);

      const result = controller.getSponsor('Rutherford');

      expect(mockCatalogService.getSponsor).toHaveBeenCalledWith('Rutherford');
      expect(result).toEqual(mockSponsor);
    });

    it('lève NotFoundException si le sponsor n\'existe pas dans le catalogue', () => {
      // Le service retourne undefined → le contrôleur doit lever une 404
      mockCatalogService.getSponsor.mockReturnValue(undefined);

      expect(() => controller.getSponsor('SponsorInexistant')).toThrow(
        NotFoundException,
      );
    });

    it('transmet le nom décodé au service (les paramètres URL sont décodés par NestJS)', () => {
      // NestJS décode automatiquement les paramètres URL avant d'appeler le contrôleur.
      // Ce test vérifie que le contrôleur passe le nom tel quel au service.
      mockCatalogService.getSponsor.mockReturnValue(mockSponsor);

      controller.getSponsor('La Geôlière'); // Nom avec espace et accent

      expect(mockCatalogService.getSponsor).toHaveBeenCalledWith('La Geôlière');
    });
  });

  // ── GET /catalog/vehicules ──────────────────────────────────────────────────

  describe('getAllVehicules()', () => {
    it('retourne la liste des véhicules depuis le service', () => {
      mockCatalogService.getAllVehicules.mockReturnValue([mockVehicule]);

      const result = controller.getAllVehicules();

      expect(mockCatalogService.getAllVehicules).toHaveBeenCalledOnce();
      expect(result).toEqual([mockVehicule]);
    });
  });

  // ── GET /catalog/armes ──────────────────────────────────────────────────────

  describe('getAllArmes()', () => {
    it('retourne la liste des armes depuis le service', () => {
      mockCatalogService.getAllArmes.mockReturnValue([mockArme]);

      const result = controller.getAllArmes();

      expect(mockCatalogService.getAllArmes).toHaveBeenCalledOnce();
      expect(result).toEqual([mockArme]);
    });
  });

  // ── GET /catalog/ameliorations ──────────────────────────────────────────────

  describe('getAllAmeliorations()', () => {
    it('retourne la liste des améliorations depuis le service', () => {
      mockCatalogService.getAllAmeliorations.mockReturnValue([mockAmelioration]);

      const result = controller.getAllAmeliorations();

      expect(mockCatalogService.getAllAmeliorations).toHaveBeenCalledOnce();
      expect(result).toEqual([mockAmelioration]);
    });
  });
});
