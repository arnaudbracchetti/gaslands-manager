import { describe, it, expect } from 'vitest';
import { renderTeamSheetHtml } from './team-sheet.renderer';
import type { EquipmentRowDto, TeamSheetDto, VehicleSheetDto } from './team-sheet.interfaces';

function makeRow(overrides: Partial<EquipmentRowDto> = {}): EquipmentRowDto {
  return {
    category: 'arme',
    nomInterne: 'mitrailleuse_lourde',
    nom: 'Mitrailleuse Lourde',
    facing: 'Avant',
    shortLabel: 'Standard+',
    munitions: null,
    ruleHtml: '<p>Portée : Double.</p>',
    ...overrides,
  };
}

function makeVehicle(overrides: Partial<VehicleSheetDto> = {}): VehicleSheetDto {
  return {
    id: 1,
    nom: 'La Teigne (Camion)',
    typeNom: 'Camion',
    poids: 'Moyen',
    cost: 42,
    chocs: 0,
    carrosserie: 12,
    manoeuvrabilite: 3,
    gearMax: 5,
    equipage: 2,
    emplacementsUtilises: 5,
    emplacementsTotal: 7,
    equipment: [],
    ...overrides,
  };
}

function makeSheet(overrides: Partial<TeamSheetDto> = {}): TeamSheetDto {
  return {
    teamName: 'Les Enragés',
    sponsor: 'Rutherford',
    playerName: 'Jean Dupont',
    sabotagePoints: null,
    votesPublic: null,
    vehicles: [makeVehicle()],
    ...overrides,
  };
}

/** Vérifie que la règle CSS `selector { ... }` porte bien la déclaration donnée (ex. `break-inside:\\s*avoid`). */
function ruleHasDeclaration(html: string, selector: string, declaration: string): boolean {
  const escaped = selector.replace(/[.]/g, '\\.');
  const rule = new RegExp(`${escaped}\\s*\\{[^}]*${declaration}`);
  return rule.test(html);
}

describe('renderTeamSheetHtml', () => {
  it('produit un document HTML autonome avec le CSS @page A4', () => {
    const html = renderTeamSheetHtml(makeSheet());
    expect(html).toContain('<!doctype html>');
    expect(html).toContain('@page { size: A4;');
  });

  it('inclut le logo dans l\'en-tête, encodé en data URI (document autonome, sans URL relative)', () => {
    const html = renderTeamSheetHtml(makeSheet());
    expect(html).toContain('<img class="header-logo" src="data:image/webp;base64,');
    expect(html).not.toContain('class="watermark"');
  });

  it('protège chaque niveau imbriqué d\'une carte véhicule contre une coupure de page', () => {
    const html = renderTeamSheetHtml(makeSheet());
    for (const selector of [
      '.cards-row', '.card', '.card-header', '.stats-line-b', '.hull-boxes',
      '.equip-table', '.equip-table tr',
    ]) {
      expect(ruleHasDeclaration(html, selector, 'break-inside:\\s*avoid'), `${selector} devrait avoir break-inside: avoid`).toBe(true);
    }
  });

  it('force un saut de page avant l\'annexe', () => {
    const html = renderTeamSheetHtml(makeSheet({
      vehicles: [makeVehicle({ equipment: [makeRow()] })],
    }));
    expect(ruleHasDeclaration(html, '.annex', 'break-before:\\s*page')).toBe(true);
  });

  it('n\'ajoute aucun saut de page forcé quand il n\'y a pas d\'annexe (aucun équipement)', () => {
    const html = renderTeamSheetHtml(makeSheet({ vehicles: [makeVehicle({ equipment: [] })] }));
    expect(html).not.toContain('class="annex"');
  });

  it('affiche un message si l\'équipe n\'a aucun véhicule', () => {
    const html = renderTeamSheetHtml(makeSheet({ vehicles: [] }));
    expect(html).toContain('Aucun véhicule à afficher.');
    expect(html).not.toContain('<div class="cards-row">');
  });

  it('affiche un bandeau d\'en-tête une seule fois avec nom, sponsor et coût total tous véhicules confondus', () => {
    const html = renderTeamSheetHtml(makeSheet({
      teamName: 'Les Enragés',
      sponsor: 'Rutherford',
      vehicles: [makeVehicle({ id: 1, cost: 42 }), makeVehicle({ id: 2, nom: 'Buggy', cost: 18 })],
    }));

    expect(html).toContain('<span class="team-name">Les Enragés</span>');
    expect(html).toContain('<span class="team-sponsor">Rutherford</span>');
    expect(html).toContain('<div class="team-total">60 <span class="unit">cans</span></div>');
    expect((html.match(/class="page-header"/g) ?? [])).toHaveLength(1);
  });

  it('le bandeau d\'en-tête affiche un total de 0 pour une équipe sans véhicule', () => {
    const html = renderTeamSheetHtml(makeSheet({ vehicles: [] }));
    expect(html).toContain('<div class="team-total">0 <span class="unit">cans</span></div>');
  });

  it('affiche le nom du joueur dans le bandeau d\'en-tête', () => {
    const html = renderTeamSheetHtml(makeSheet({ playerName: 'Jean Dupont' }));
    expect(html).toContain('<div class="team-player">Joueur : Jean Dupont</div>');
  });

  it('échappe les caractères spéciaux du nom du joueur (XSS)', () => {
    const html = renderTeamSheetHtml(makeSheet({ playerName: '<script>alert(1)</script>' }));
    expect(html).not.toContain('<script>alert(1)</script>');
    expect(html).toContain('&lt;script&gt;');
  });

  it('n\'affiche aucune ligne de sabotage quand sabotagePoints est null (hors contexte campagne)', () => {
    const html = renderTeamSheetHtml(makeSheet({ sabotagePoints: null }));
    expect(html).not.toContain('class="sabotage-row"');
  });

  it('affiche une case à cocher par point de sabotage disponible', () => {
    const html = renderTeamSheetHtml(makeSheet({ sabotagePoints: 3 }));
    expect(html).toContain('class="sabotage-row"');
    const boxes = html.match(/<span class="sabotage-boxes">((?:<span class="box small"><\/span>)*)<\/span>/);
    expect(boxes?.[1]?.match(/<span class="box small">/g)).toHaveLength(3);
  });

  it('affiche la ligne de sabotage sans case quand sabotagePoints vaut 0', () => {
    const html = renderTeamSheetHtml(makeSheet({ sabotagePoints: 0 }));
    expect(html).toContain('class="sabotage-row"');
    const boxes = html.match(/<span class="sabotage-boxes">((?:<span class="box small"><\/span>)*)<\/span>/);
    expect(boxes?.[1]).toBe('');
  });

  it('affiche le coût total en cans quand votesPublic est null (hors contexte campagne)', () => {
    const html = renderTeamSheetHtml(makeSheet({
      votesPublic: null,
      vehicles: [makeVehicle({ cost: 42 })],
    }));
    expect(html).toContain('<div class="team-total">42 <span class="unit">cans</span></div>');
    expect(html).not.toContain('class="unit">VP</span>');
  });

  it('affiche les Votes du Public à la place du coût total en contexte campagne', () => {
    const html = renderTeamSheetHtml(makeSheet({
      votesPublic: 3,
      vehicles: [makeVehicle({ cost: 42 })],
    }));
    expect(html).toContain('<div class="team-total">3 <span class="unit">VP</span></div>');
    expect(html).not.toContain('<div class="team-total">42 <span class="unit">cans</span></div>');
  });

  it('affiche 0 VP sans erreur quand le participant est le leader', () => {
    const html = renderTeamSheetHtml(makeSheet({ votesPublic: 0 }));
    expect(html).toContain('<div class="team-total">0 <span class="unit">VP</span></div>');
  });

  it('regroupe les cases de carrosserie par paquets de 5', () => {
    const html = renderTeamSheetHtml(makeSheet({ vehicles: [makeVehicle({ carrosserie: 12 })] }));
    const groupCount = (html.match(/hull-group/g) ?? []).length / 2; // ouverture + fermeture implicite
    // 12 = 5 + 5 + 2 → 3 groupes
    const openTags = html.match(/<div class="hull-group">/g) ?? [];
    expect(openTags).toHaveLength(3);
    expect(groupCount).toBeGreaterThan(0);
  });

  it('imprime le Max Gear dans le carré à dé', () => {
    const html = renderTeamSheetHtml(makeSheet({ vehicles: [makeVehicle({ gearMax: 6 })] }));
    expect(html).toContain('Max 6');
  });

  it('affiche la ligne Chocs seulement si chocs > 0', () => {
    const withChocs = renderTeamSheetHtml(makeSheet({ vehicles: [makeVehicle({ chocs: 3 })] }));
    expect(withChocs).toContain('Chocs : 3');

    const withoutChocs = renderTeamSheetHtml(makeSheet({ vehicles: [makeVehicle({ chocs: 0 })] }));
    expect(withoutChocs).not.toContain('class="chocs"');
  });

  it('cellule Effet : libellé court, sans renvoi (le N° vit dans sa propre colonne)', () => {
    const html = renderTeamSheetHtml(makeSheet({
      vehicles: [makeVehicle({ equipment: [makeRow({ shortLabel: 'Impact + recul', munitions: null })] })],
    }));
    expect(html).toContain('<span>Impact + recul</span>');
    expect(html).not.toContain('<span class="ammo-boxes">');
  });

  it('cellule Effet : cases de munitions quand munitions est renseigné', () => {
    const html = renderTeamSheetHtml(makeSheet({
      vehicles: [makeVehicle({ equipment: [makeRow({ shortLabel: 'Blitz', munitions: 3 })] })],
    }));
    const boxes = html.match(/<span class="box small">/g) ?? [];
    expect(boxes).toHaveLength(3);
  });

  it('cellule Effet : tiret seul quand ni shortLabel ni munitions ne sont renseignés', () => {
    const html = renderTeamSheetHtml(makeSheet({
      vehicles: [makeVehicle({ equipment: [makeRow({ shortLabel: null, munitions: null })] })],
    }));
    expect(html).toContain('<div class="effect-cell">-</div>');
  });

  it('numérote chaque ligne du tableau dans une colonne N° dédiée', () => {
    const html = renderTeamSheetHtml(makeSheet({
      vehicles: [makeVehicle({
        equipment: [
          makeRow({ nomInterne: 'arme_a', nom: 'Arme A' }),
          makeRow({ nomInterne: 'arme_b', nom: 'Arme B' }),
        ],
      })],
    }));
    expect(html).toContain('<th class="num">N°</th>');
    expect(html).toContain('<td class="num">1</td>');
    expect(html).toContain('<td class="num">2</td>');
  });

  it('déduplique les renvois : un même équipement partagé par 2 véhicules n\'a qu\'une entrée d\'annexe', () => {
    const sharedRow = makeRow({ nomInterne: 'mitrailleuse_lourde', category: 'arme' });
    const html = renderTeamSheetHtml(makeSheet({
      vehicles: [
        makeVehicle({ id: 1, equipment: [sharedRow] }),
        makeVehicle({ id: 2, nom: 'Buggy', equipment: [sharedRow] }),
      ],
    }));
    // Les deux lignes du tableau portent le même N° 1 (même équipement), une seule entrée d'annexe
    const numCells = html.match(/<td class="num">1<\/td>/g) ?? [];
    expect(numCells).toHaveLength(2);
    const annexEntries = html.match(/<li><b>/g) ?? [];
    expect(annexEntries).toHaveLength(1);
  });

  it('assigne des renvois distincts à des équipements différents', () => {
    const html = renderTeamSheetHtml(makeSheet({
      vehicles: [makeVehicle({
        equipment: [
          makeRow({ nomInterne: 'arme_a', nom: 'Arme A' }),
          makeRow({ nomInterne: 'arme_b', nom: 'Arme B' }),
        ],
      })],
    }));
    expect(html).toContain('<li><b>Arme A</b>');
    expect(html).toContain('<li><b>Arme B</b>');
    expect(html).toContain('<td class="num">1</td>');
    expect(html).toContain('<td class="num">2</td>');
  });

  it('échappe les caractères spéciaux dans le nom d\'équipe et le nom du véhicule (XSS)', () => {
    const html = renderTeamSheetHtml(makeSheet({
      teamName: '<script>alert(1)</script>',
      vehicles: [makeVehicle({ nom: 'Ma "Bête" & <Toi>' })],
    }));
    expect(html).not.toContain('<script>alert(1)</script>');
    expect(html).toContain('&lt;script&gt;');
    expect(html).toContain('&quot;Bête&quot;');
    expect(html).toContain('&amp;');
    expect(html).toContain('&lt;Toi&gt;');
  });

  it('ne touche jamais au HTML déjà rendu des règles (ruleHtml n\'est pas échappé)', () => {
    const html = renderTeamSheetHtml(makeSheet({
      vehicles: [makeVehicle({ equipment: [makeRow({ ruleHtml: '<p>Portée : <strong>Double</strong>.</p>' })] })],
    }));
    expect(html).toContain('<strong>Double</strong>');
  });

  it('deux véhicules tiennent dans une seule cards-row (page A4)', () => {
    const html = renderTeamSheetHtml(makeSheet({
      vehicles: [makeVehicle({ id: 1 }), makeVehicle({ id: 2, nom: 'Buggy' })],
    }));
    const rows = html.match(/<div class="cards-row">/g) ?? [];
    expect(rows).toHaveLength(1);
  });

  it('un 3e véhicule démarre une nouvelle cards-row', () => {
    const html = renderTeamSheetHtml(makeSheet({
      vehicles: [
        makeVehicle({ id: 1 }),
        makeVehicle({ id: 2, nom: 'Buggy' }),
        makeVehicle({ id: 3, nom: 'Moto' }),
      ],
    }));
    const rows = html.match(/<div class="cards-row">/g) ?? [];
    expect(rows).toHaveLength(2);
  });
});
