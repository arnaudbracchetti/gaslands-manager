/**
 * HouseRuleCatalogService - Catalogue des règles maison de campagne.
 *
 * Charge les règles maison depuis database_init/data/regles-maison.yml une seule
 * fois au démarrage du serveur (lifecycle hook OnModuleInit) - même pattern que
 * ScenarioCatalogService (cf. ARCHITECTURE.md §3.3) : données statiques, accès O(1)
 * via une Map en mémoire. Service dédié plutôt qu'extension du CatalogService du
 * module équipe : une règle maison n'a aucun lien avec sponsors ou équipement
 * (cf. docs/plans/2026-09-21-regles-maison-mecanisme-design.md §2).
 *
 * Pattern Template Method : readFileContent() est `protected` pour permettre aux
 * tests de fournir un YAML fictif sans mocker `fs` (cf. CatalogService).
 */

import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { parse } from 'yaml';
import { marked } from 'marked';
import * as fs from 'fs';
import * as path from 'path';
import { HouseRuleDefinition } from './house-rule.interfaces';

@Injectable()
export class HouseRuleCatalogService implements OnModuleInit {
  private readonly logger: Logger = new Logger(HouseRuleCatalogService.name);

  /** Map indexée par nom_interne (accès O(1)). */
  private readonly houseRuleMap: Map<string, HouseRuleDefinition> = new Map<
    string,
    HouseRuleDefinition
  >();

  /**
   * Lifecycle hook NestJS : appelé après l'initialisation du module.
   * Charge et indexe les règles maison. Fail-fast : une erreur YAML fait crasher
   * le démarrage (un catalogue vide silencieux serait pire).
   */
  onModuleInit(): void {
    this.logger.log('Chargement des règles maison depuis regles-maison.yml...');
    try {
      const houseRules = this.loadYaml<{ regles_maison: HouseRuleDefinition[] }>(
        'regles-maison.yml',
      ).regles_maison;

      for (const r of houseRules) {
        // Conversion Markdown → HTML une seule fois ici (comme CatalogService).
        r.description_decochee = this.toHtml(r.description_decochee);
        r.description_cochee = this.toHtml(r.description_cochee);
        this.houseRuleMap.set(r.nom_interne, r);
      }

      this.logger.log(
        `Catalogue de règles maison chargé : ${this.houseRuleMap.size} règle(s).`,
      );
    } catch (err: unknown) {
      this.logger.error('Échec du chargement des règles maison YAML', err);
      throw err;
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
    const filePath = path.join(process.cwd(), 'database_init', 'data', filename);
    return fs.readFileSync(filePath, 'utf-8');
  }

  // ── Méthodes publiques d'accès ──────────────────────────────────────────────

  /** Retourne toutes les règles maison du catalogue. */
  getAll(): HouseRuleDefinition[] {
    return Array.from(this.houseRuleMap.values());
  }

  /** Retourne une règle maison par son nom_interne, ou undefined si inconnue. */
  getByNomInterne(nomInterne: string): HouseRuleDefinition | undefined {
    return this.houseRuleMap.get(nomInterne);
  }

  /** Clés (nom_interne) valides du catalogue courant - instantané passé à
   *  `HouseRules.fromUserInput` par tout appelant qui règle les règles maison
   *  d'une campagne (création, modification). */
  validKeys(): string[] {
    return this.getAll().map((r) => r.nom_interne);
  }
}
