/**
 * ScenarioCatalogService — Catalogue des scénarios de campagne Gaslands.
 *
 * Charge les scénarios depuis database_init/data/scenarios.yml une seule fois au
 * démarrage du serveur (lifecycle hook OnModuleInit). Même pattern que CatalogService
 * (cf. ARCHITECTURE.md §3.3) : données statiques, accès O(1) via une Map en mémoire.
 *
 * Pattern Template Method : readFileContent() est `protected` pour permettre aux
 * tests de fournir un YAML fictif sans mocker `fs` (cf. CatalogService).
 */

import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { parse } from 'yaml';
import { marked } from 'marked';
import * as fs from 'fs';
import * as path from 'path';
import { Scenario } from './scenario.interfaces';
import { GameType } from './game.enums';

@Injectable()
export class ScenarioCatalogService implements OnModuleInit {
  private readonly logger: Logger = new Logger(ScenarioCatalogService.name);

  /** Map indexée par nom_interne (accès O(1)). */
  private readonly scenarioMap: Map<string, Scenario> = new Map<
    string,
    Scenario
  >();

  /**
   * Lifecycle hook NestJS : appelé après l'initialisation du module.
   * Charge et indexe les scénarios. Fail-fast : une erreur YAML fait crasher
   * le démarrage (un catalogue vide silencieux serait pire).
   */
  onModuleInit(): void {
    this.logger.log('Chargement des scénarios depuis scenarios.yml...');
    try {
      const scenarios = this.loadYaml<{ scenarios: Scenario[] }>(
        'scenarios.yml',
      ).scenarios;

      for (const s of scenarios) {
        this.assertPoidsTirageValide(s);
        // Conversion Markdown → HTML une seule fois ici (comme CatalogService).
        s.description = this.toHtml(s.description);
        this.scenarioMap.set(s.nom_interne, s);
      }
      this.assertChaqueTypeTirable(scenarios);

      this.logger.log(
        `Catalogue de scénarios chargé : ${this.scenarioMap.size} scénarios.`,
      );
    } catch (err: unknown) {
      this.logger.error('Échec du chargement des scénarios YAML', err);
      throw err;
    }
  }

  /**
   * `poids_tirage` est obligatoire, entier et >= 0. Le YAML est casté sans validation
   * (cf. loadYaml) : on vérifie ici ce champ car le tirage en dépend arithmétiquement
   * (un poids absent donnerait NaN, un poids négatif fausserait les intervalles).
   */
  private assertPoidsTirageValide(s: Scenario): void {
    if (!Number.isInteger(s.poids_tirage) || s.poids_tirage < 0) {
      throw new Error(
        `scenarios.yml : poids_tirage invalide pour "${s.nom_interne}" ` +
          `(attendu un entier >= 0, reçu ${String(s.poids_tirage)}).`,
      );
    }
  }

  /** Chaque type doit avoir au moins un scénario tirable, sinon son bouton aléatoire échouerait. */
  private assertChaqueTypeTirable(scenarios: Scenario[]): void {
    for (const type of Object.values(GameType)) {
      const total = scenarios
        .filter((s) => s.type === type)
        .reduce((somme, s) => somme + s.poids_tirage, 0);
      if (total === 0) {
        throw new Error(
          `scenarios.yml : aucun scénario ${type} de poids_tirage non nul.`,
        );
      }
    }
  }

  /** Charge et parse un fichier YAML depuis database_init/data/. */
  private loadYaml<T>(filename: string): T {
    const raw = this.readFileContent(filename);
    return parse(raw) as T;
  }

  /** Convertit un champ Markdown en HTML (marked.parse est synchrone en v18). */
  private toHtml(markdown: string): string {
    return marked.parse(markdown) as string;
  }

  /**
   * Lit le contenu brut d'un fichier du catalogue.
   * Protected : surchargeable en test pour fournir un YAML fictif (Template Method).
   */
  protected readFileContent(filename: string): string {
    const filePath = path.join(
      process.cwd(),
      'database_init',
      'data',
      filename,
    );
    return fs.readFileSync(filePath, 'utf-8');
  }

  // ── Méthodes publiques d'accès ──────────────────────────────────────────────

  /** Retourne tous les scénarios du catalogue. */
  getAll(): Scenario[] {
    return Array.from(this.scenarioMap.values());
  }

  /** Retourne un scénario par son nom_interne, ou undefined si inconnu. */
  getByNomInterne(nomInterne: string): Scenario | undefined {
    return this.scenarioMap.get(nomInterne);
  }
}
