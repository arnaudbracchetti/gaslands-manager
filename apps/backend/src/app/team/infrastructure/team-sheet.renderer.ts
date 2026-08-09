import { existsSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import type { EquipmentCategory, EquipmentRowDto, TeamSheetDto, VehicleSheetDto } from './team-sheet.interfaces';

/**
 * Layout validé itérativement avec l'utilisateur via une maquette HTML/CSS
 * (Playwright, outil de dev ponctuel - jamais livré), puis révisé après une
 * première implémentation (statistiques affichées avant la carrosserie, N° de
 * renvoi en colonne dédiée plutôt qu'en exposant inline) : 2 véhicules par ligne
 * en largeur A4, cases de carrosserie groupées par 5, carré à dé pour la vitesse
 * courante, tableau d'équipement à 5 colonnes (N°/Nom/Type/Facing/Effet), annexe
 * de règles partagée et dédupliquée. Ce fichier rejoue ce layout à partir de
 * données réelles - cf. docs/plans (design de la fiche) pour l'historique.
 */

/**
 * process.cwd() vaut la racine du workspace sous `nx serve` et `/app` en Docker
 * (assets/ y est copié par le Dockerfile) - même convention que CatalogService/
 * ContentService. Sous Vitest (`nx test`), process.cwd() vaut apps/backend/ au
 * lieu de la racine (cause déjà documentée dans catalog.data.spec.ts) : repli sur
 * __dirname, stable ici puisque ce fichier n'est jamais bundlé pendant les tests.
 * CatalogService contourne ce même problème via une sous-classe de test (Template
 * Method) - impossible ici, ce fichier n'étant qu'une collection de fonctions
 * pures sans classe à sous-classer.
 */
function resolveLogoPath(): string {
  const fromWorkspaceRoot = join(process.cwd(), 'assets', 'logo-watermark.webp');
  if (existsSync(fromWorkspaceRoot)) return fromWorkspaceRoot;
  return resolve(__dirname, '../../../../../../assets/logo-watermark.webp');
}

/**
 * Logo d'en-tête, encodé en data URI et lu une seule fois au chargement du
 * module. Un data URI (plutôt qu'un chemin d'image relatif) est nécessaire car
 * le document produit est écrit via `document.write` dans une fenêtre
 * `about:blank` côté frontend (cf. TEAMS.md - Fiche d'équipe exportable) :
 * aucune URL relative n'y résout quoi que ce soit, le document doit rester
 * intégralement autonome.
 */
const LOGO_DATA_URI = `data:image/webp;base64,${readFileSync(resolveLogoPath()).toString('base64')}`;

const SHEET_CSS = `
  @page { size: A4; margin: 10mm; }
  @media screen {
    body { max-width: 210mm; margin: 0 auto; padding: 10mm; }
  }
  * { box-sizing: border-box; }
  body { font-family: "Liberation Sans", Arial, sans-serif; color: #161616; margin: 0; font-size: 9pt; }

  /* Un véhicule (et son texte de règles/équipement) ne doit jamais être coupé par un
     saut de page à l'impression - break-inside: avoid est donc répété à chaque niveau
     imbriqué (ligne de 2 cartes, carte, en-tête, stats, carrosserie, tableau ET chacune
     de ses lignes) plutôt que posé une seule fois en haut : certains moteurs de rendu
     n'appliquent pas fiablement la règle à un conteneur flex/table à ses enfants. */
  .cards-row { display: flex; gap: 6mm; align-items: stretch; margin-bottom: 6mm; break-inside: avoid; }
  .card { flex: 1 1 0; border: 1.4pt solid #1a1a1a; border-radius: 3mm; padding: 3mm 3.5mm; break-inside: avoid; }

  .card-header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 1pt solid #1a1a1a; padding-bottom: 2mm; margin-bottom: 2.5mm; break-inside: avoid; }
  .veh-name { font-size: 14pt; font-weight: 700; line-height: 1.1; }
  .veh-sub { font-size: 8pt; color: #555; margin-top: 0.5mm; }
  .cost-block { text-align: right; white-space: nowrap; }
  .cost { font-size: 16pt; font-weight: 700; }
  .cost .unit { font-size: 8pt; font-weight: 400; }
  .chocs { font-size: 8pt; color: #7a1f1f; font-weight: 600; margin-top: 0.5mm; }

  .stats-line-b { display: flex; justify-content: space-between; align-items: center; gap: 2mm; padding: 1mm 0 3mm; border-bottom: 1pt solid #ccc; margin-bottom: 3mm; break-inside: avoid; }
  .stat { text-align: center; }
  .stat .lbl { font-size: 7pt; text-transform: uppercase; color: #666; letter-spacing: 0.2pt; display: block; margin-bottom: 0.8mm; }
  .stat .val { font-size: 22pt; font-weight: 700; display: block; line-height: 1; }

  .gear-box { width: 11mm; height: 11mm; border: 1.4pt solid #1a1a1a; border-radius: 1.2mm; position: relative; display: flex; align-items: center; justify-content: center; }
  .gear-box .die-hint { width: 8mm; height: 8mm; border: 0.8pt dashed #999; border-radius: 1.5mm; display: flex; align-items: center; justify-content: center; font-size: 6pt; color: #999; text-align: center; line-height: 1.1; }
  .gear-box .max-label { position: absolute; bottom: 0.6mm; right: 1mm; font-size: 5.5pt; color: #555; font-weight: 600; background: #fff; padding: 0 0.3mm; }

  .stat-hull-label { font-size: 7.5pt; text-transform: uppercase; letter-spacing: 0.3pt; color: #555; margin-bottom: 1mm; }
  .hull-boxes { display: flex; flex-wrap: wrap; align-items: center; gap: 2.5mm; padding-bottom: 3mm; border-bottom: 1pt solid #ccc; margin-bottom: 2.5mm; break-inside: avoid; }
  .hull-group { display: flex; gap: 0.8mm; }
  .box { width: 3.4mm; height: 3.4mm; border: 1.1pt solid #1a1a1a; display: inline-block; border-radius: 0.4mm; }
  .box.small { width: 2.6mm; height: 2.6mm; }

  .equip-table { width: 100%; border-collapse: collapse; font-size: 7.8pt; margin-bottom: 1mm; break-inside: avoid; }
  .equip-table th { background: #eaeaea; font-size: 6.8pt; text-transform: uppercase; letter-spacing: 0.2pt; text-align: left; padding: 1mm 1.4mm; border: 0.8pt solid #999; }
  .equip-table td { padding: 1mm 1.4mm; border: 0.8pt solid #bbb; vertical-align: middle; }
  .equip-table tr { break-inside: avoid; }
  .equip-table td.facing { white-space: nowrap; }
  .equip-table td.num, .equip-table th.num { text-align: center; white-space: nowrap; }
  .effect-cell { display: flex; align-items: center; gap: 1mm; flex-wrap: wrap; }
  .ammo-boxes { display: flex; gap: 0.6mm; }
  .type-tag { font-size: 7pt; white-space: nowrap; }

  .annex { margin-top: 7mm; border-top: 1.6pt solid #1a1a1a; padding-top: 2.5mm; break-before: page; }
  .annex h3 { font-size: 9.5pt; margin: 0 0 2mm; }
  .annex .annex-sub { font-size: 7.5pt; color: #666; margin: -1.5mm 0 3mm; }
  .annex-columns { columns: 2; column-gap: 8mm; font-size: 7.8pt; }
  .annex-columns ol { margin: 0; padding-left: 4mm; }
  .annex-columns li { margin-bottom: 1.6mm; break-inside: avoid; }
  .annex-columns li b { font-weight: 700; }

  .empty-state { font-size: 10pt; color: #666; padding: 10mm 0; text-align: center; }

  .page-header { display: flex; justify-content: space-between; align-items: center; border-bottom: 2pt solid #1a1a1a; padding-bottom: 2mm; margin-bottom: 5mm; }
  .page-header-left { display: flex; align-items: center; gap: 3mm; }
  .page-header .header-logo { height: 13mm; width: auto; }
  .page-header .team-name { font-size: 17pt; font-weight: 700; }
  .page-header .team-sponsor { font-size: 9pt; color: #555; margin-left: 2mm; }
  .page-header .team-player { font-size: 8pt; color: #555; margin-top: 0.5mm; }
  .page-header-right { display: flex; flex-direction: column; align-items: flex-end; gap: 1.5mm; }
  .page-header .team-total { font-size: 11pt; font-weight: 700; white-space: nowrap; }
  .page-header .team-total .unit { font-size: 8pt; font-weight: 400; }
  .sabotage-row { display: flex; align-items: center; gap: 1.5mm; }
  .sabotage-row .sabotage-lbl { font-size: 7pt; text-transform: uppercase; color: #666; letter-spacing: 0.2pt; }
  .sabotage-row .sabotage-boxes { display: flex; gap: 0.6mm; flex-wrap: wrap; justify-content: flex-end; max-width: 45mm; }
`;

const TYPE_LABELS: Record<EquipmentCategory, string> = {
  arme: 'Arme',
  amelioration: 'Amélio.',
  avantage: 'Avantage',
  sequelle: 'Séquelle',
};

/** Seuls `Team.name` et `Vehicle.nom` (renommage) peuvent contenir du texte saisi par l'utilisateur. */
function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Assigne un numéro de renvoi à chaque équipement distinct (`category`+`nomInterne`),
 * dans l'ordre de première rencontre - une seule entrée d'annexe même si plusieurs
 * véhicules partagent le même équipement. Ce comptage est un artefact de l'ORDRE DE
 * RENDU (réordonner les véhicules renumérote), donc vit ici plutôt que dans le DTO.
 */
class FootnoteRegistry {
  private readonly numberByKey: Map<string, number> = new Map<string, number>();
  private readonly entries: { number: number; nom: string; ruleHtml: string }[] = [];

  numberFor(row: EquipmentRowDto): number {
    const key = `${row.category}:${row.nomInterne}`;
    const existing = this.numberByKey.get(key);
    if (existing !== undefined) return existing;

    const number = this.entries.length + 1;
    this.numberByKey.set(key, number);
    this.entries.push({ number, nom: row.nom, ruleHtml: row.ruleHtml });
    return number;
  }

  allEntries(): readonly { number: number; nom: string; ruleHtml: string }[] {
    return this.entries;
  }
}

function renderHullBoxes(carrosserie: number): string {
  const groups: string[] = [];
  let remaining = carrosserie;
  while (remaining > 0) {
    const size = Math.min(5, remaining);
    groups.push(`<div class="hull-group">${'<span class="box"></span>'.repeat(size)}</div>`);
    remaining -= size;
  }
  return groups.join('');
}

function renderGearBox(gearMax: number): string {
  return `
    <div class="gear-box">
      <div class="die-hint">poser<br>un dé</div>
      <div class="max-label">Max ${gearMax}</div>
    </div>`;
}

/** shortLabel + éventuelles cases de munitions - le renvoi vit désormais dans sa propre colonne N°. */
function renderEffectCell(row: EquipmentRowDto): string {
  const labelHtml = row.shortLabel ? `<span>${row.shortLabel}</span>` : '';
  const ammoHtml = row.munitions !== null
    ? `<span class="ammo-boxes">${'<span class="box small"></span>'.repeat(row.munitions)}</span>`
    : '';
  const content = labelHtml + ammoHtml;
  return `<div class="effect-cell">${content || '-'}</div>`;
}

function renderEquipmentRow(row: EquipmentRowDto, footnotes: FootnoteRegistry): string {
  const number = footnotes.numberFor(row);
  return `
    <tr>
      <td class="num">${number}</td>
      <td>${row.nom}</td>
      <td class="type-tag">${TYPE_LABELS[row.category]}</td>
      <td class="facing">${row.facing}</td>
      <td>${renderEffectCell(row)}</td>
    </tr>`;
}

function renderEquipmentTable(vehicle: VehicleSheetDto, footnotes: FootnoteRegistry): string {
  if (vehicle.equipment.length === 0) return '';
  const rows = vehicle.equipment.map((row) => renderEquipmentRow(row, footnotes)).join('');
  return `
    <table class="equip-table">
      <colgroup>
        <col style="width:4%"><col style="width:32%"><col style="width:16%"><col style="width:14%"><col style="width:34%">
      </colgroup>
      <thead>
        <tr><th class="num">N°</th><th>Nom</th><th>Type</th><th class="facing">Facing</th><th>Effet</th></tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>`;
}

function renderVehicleCard(vehicle: VehicleSheetDto, sponsor: string, footnotes: FootnoteRegistry): string {
  const chocsHtml = vehicle.chocs > 0 ? `<div class="chocs">Chocs : ${vehicle.chocs}</div>` : '';
  return `
    <div class="card">
      <div class="card-header">
        <div>
          <div class="veh-name">${escapeHtml(vehicle.nom)}</div>
          <div class="veh-sub">${vehicle.poids} · ${sponsor}</div>
        </div>
        <div class="cost-block">
          <div class="cost">${vehicle.cost} <span class="unit">cans</span></div>
          ${chocsHtml}
        </div>
      </div>

      <div class="stats-line-b">
        <div class="stat"><span class="lbl">Manœuv.</span><span class="val">${vehicle.manoeuvrabilite}</span></div>
        <div class="stat"><span class="lbl">Vitesse</span>${renderGearBox(vehicle.gearMax)}</div>
        <div class="stat"><span class="lbl">Équipage</span><span class="val">${vehicle.equipage}</span></div>
        <div class="stat"><span class="lbl">Emplac.</span><span class="val">${vehicle.emplacementsUtilises}/${vehicle.emplacementsTotal}</span></div>
      </div>

      <div class="stat-hull-label">Carrosserie</div>
      <div class="hull-boxes">${renderHullBoxes(vehicle.carrosserie)}</div>

      ${renderEquipmentTable(vehicle, footnotes)}
    </div>`;
}

/**
 * Bandeau d'en-tête, une seule fois pour tout le document (pas par page/cards-row) :
 * nom d'équipe, sponsor, coût total tous véhicules confondus (`Vehicle.cost` déjà
 * résiduel pour un véhicule vendu - aucun véhicule vendu n'atteint de toute façon
 * ce DTO, filtré par `teamToSheetDto`).
 */
function renderSabotageRow(sabotagePoints: number | null): string {
  if (sabotagePoints === null) return '';
  return `
    <div class="sabotage-row">
      <span class="sabotage-lbl">Sabotage</span>
      <span class="sabotage-boxes">${'<span class="box small"></span>'.repeat(sabotagePoints)}</span>
    </div>`;
}

/**
 * Coût total de l'équipe hors contexte campagne ; en campagne, remplacé par les
 * Votes du Public gagnés en début de partie (`dto.votesPublic`, dérivé de l'écart
 * de PC avec le leader — cf. `CampaignParticipant.votesPublicFor`).
 */
function renderTeamTotal(dto: TeamSheetDto): string {
  if (dto.votesPublic !== null) {
    return `<div class="team-total">${dto.votesPublic} <span class="unit">VP</span></div>`;
  }
  const total = dto.vehicles.reduce((sum, v) => sum + v.cost, 0);
  return `<div class="team-total">${total} <span class="unit">cans</span></div>`;
}

function renderPageHeader(dto: TeamSheetDto): string {
  return `
    <div class="page-header">
      <div class="page-header-left">
        <img class="header-logo" src="${LOGO_DATA_URI}" alt="Gaslands Manager">
        <div>
          <div><span class="team-name">${escapeHtml(dto.teamName)}</span><span class="team-sponsor">${dto.sponsor}</span></div>
          <div class="team-player">Joueur : ${escapeHtml(dto.playerName)}</div>
        </div>
      </div>
      <div class="page-header-right">
        ${renderTeamTotal(dto)}
        ${renderSabotageRow(dto.sabotagePoints)}
      </div>
    </div>`;
}

function renderCardsRow(vehicles: readonly VehicleSheetDto[], sponsor: string, footnotes: FootnoteRegistry): string {
  const cards = vehicles.map((v) => renderVehicleCard(v, sponsor, footnotes)).join('');
  return `<div class="cards-row">${cards}</div>`;
}

function renderAnnex(footnotes: FootnoteRegistry): string {
  const entries = footnotes.allEntries();
  if (entries.length === 0) return '';
  const items = entries
    .map((e) => `<li><b>${e.nom}</b> - ${e.ruleHtml.replace(/^<p>|<\/p>$/g, '')}</li>`)
    .join('');
  return `
    <div class="annex">
      <h3>Annexe - Règles détaillées</h3>
      <div class="annex-sub">☐ = case à cocher (munitions restantes) - le N° du tableau renvoie à la règle détaillée ci-dessous.</div>
      <div class="annex-columns"><ol>${items}</ol></div>
    </div>`;
}

/** Traduit une fiche d'équipe (`TeamSheetDto`) en document HTML autonome, imprimable en A4. */
export function renderTeamSheetHtml(dto: TeamSheetDto): string {
  const footnotes = new FootnoteRegistry();

  const vehiclesHtml = dto.vehicles.length === 0
    ? '<div class="empty-state">Aucun véhicule à afficher.</div>'
    : ((): string => {
        const rows: string[] = [];
        for (let i = 0; i < dto.vehicles.length; i += 2) {
          rows.push(renderCardsRow(dto.vehicles.slice(i, i + 2), dto.sponsor, footnotes));
        }
        // L'annexe est construite APRÈS les cartes : `renderEquipmentRow` alimente
        // `footnotes` au fil du rendu, donc `allEntries()` ne serait pas encore
        // rempli si on l'appelait avant que `rows` soit entièrement calculé.
        return rows.join('') + renderAnnex(footnotes);
      })();

  const bodyHtml = renderPageHeader(dto) + vehiclesHtml;

  return `<!doctype html>
<html lang="fr">
<head>
<meta charset="utf-8">
<title>Fiche d'équipe - ${escapeHtml(dto.teamName)}</title>
<style>${SHEET_CSS}</style>
</head>
<body>
${bodyHtml}
</body>
</html>`;
}
