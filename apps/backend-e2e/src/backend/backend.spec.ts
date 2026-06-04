/**
 * Tests e2e pour le backend Gaslands Manager (NestJS).
 *
 * Ces tests vérifient les endpoints HTTP réels via axios.
 * Ils nécessitent que le backend soit lancé sur http://localhost:3000.
 *
 * Seules les routes publiques (sans JWT) sont testées ici.
 * Les routes protégées (/api/teams) nécessiteraient un token valide.
 */
import axios from 'axios';

// ── Catalogue (routes publiques) ─────────────────────────────────────────────

describe('GET /api/catalog/sponsors', () => {
  it('retourne la liste de tous les sponsors', async () => {
    const res = await axios.get('/api/catalog/sponsors');

    expect(res.status).toBe(200);
    // Le catalogue contient 13 sponsors définis dans sponsors.yml
    expect(Array.isArray(res.data)).toBe(true);
    expect(res.data.length).toBeGreaterThan(0);
  });

  it('chaque sponsor possède les champs attendus', async () => {
    const res = await axios.get('/api/catalog/sponsors');
    const firstSponsor = res.data[0];

    expect(firstSponsor).toHaveProperty('nom');
    expect(firstSponsor).toHaveProperty('description');
    expect(firstSponsor).toHaveProperty('classes_avantage');
    expect(firstSponsor).toHaveProperty('avantages_sponsorises');
    // Relations pré-calculées par le CatalogService
    expect(firstSponsor).toHaveProperty('vehicules');
    expect(firstSponsor).toHaveProperty('armes');
    expect(firstSponsor).toHaveProperty('ameliorations');
  });
});

describe('GET /api/catalog/vehicules', () => {
  it('retourne la liste des véhicules disponibles', async () => {
    const res = await axios.get('/api/catalog/vehicules');

    expect(res.status).toBe(200);
    expect(Array.isArray(res.data)).toBe(true);
    expect(res.data.length).toBeGreaterThan(0);
  });
});

describe('GET /api/catalog/sponsors/:nom', () => {
  it('retourne un sponsor par son nom', async () => {
    const res = await axios.get('/api/catalog/sponsors/Rutherford');

    expect(res.status).toBe(200);
    expect(res.data.nom).toBe('Rutherford');
  });

  it('retourne 404 pour un sponsor inexistant', async () => {
    try {
      await axios.get('/api/catalog/sponsors/SponsorInexistant');
      // Si on arrive ici, le test doit échouer
      fail('Devrait lancer une erreur 404');
    } catch (err: unknown) {
      const axiosErr = err as { response?: { status: number } };
      expect(axiosErr.response?.status).toBe(404);
    }
  });
});

// ── Auth (routes publiques) ───────────────────────────────────────────────────

describe('POST /api/auth/register', () => {
  it('la route register existe et répond (non 404)', async () => {
    // On vérifie juste que la route existe (pas de 404).
    // Le code exact (4xx) dépend de la validation et de l'état de la BDD.
    try {
      await axios.post('/api/auth/register', {});
    } catch (err: unknown) {
      const axiosErr = err as { response?: { status: number } };
      // La route doit répondre — n'importe quel code sauf 404 (route inexistante)
      expect(axiosErr.response?.status).not.toBe(404);
    }
  });
});

describe('Routes protégées', () => {
  it('GET /api/teams retourne 401 sans token JWT', async () => {
    try {
      await axios.get('/api/teams');
      fail('Devrait lancer une erreur 401');
    } catch (err: unknown) {
      const axiosErr = err as { response?: { status: number } };
      expect(axiosErr.response?.status).toBe(401);
    }
  });
});
