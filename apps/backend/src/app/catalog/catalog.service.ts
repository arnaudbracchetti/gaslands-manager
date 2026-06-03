/**
 * CatalogService — Singleton du catalogue de jeu Gaslands.
 *
 * Ce service charge les données du catalogue (sponsors, véhicules, armes,
 * améliorations) depuis les fichiers YAML une seule fois au démarrage du
 * serveur, via le lifecycle hook OnModuleInit de NestJS.
 *
 * Architecture :
 * - Les données sont stockées dans une Map<string, Sponsor> indexée par nom de sponsor.
 * - Les relations sponsor → véhicules/armes/améliorations sont pré-calculées
 *   à l'initialisation : chaque Sponsor contient directement ses items autorisés.
 * - Accès O(1) par nom de sponsor, sans filtrage à la requête.
 *
 * NestJS rend les services singletons par défaut (scope Singleton) :
 * une seule instance de ce service existe pendant toute la durée de vie du serveur.
 */

import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { parse } from 'yaml';
import * as fs from 'fs';
import * as path from 'path';
import {
  Amelioration,
  Arme,
  RawSponsor,
  Sponsor,
  Vehicule,
} from './catalog.interfaces';

@Injectable()
export class CatalogService implements OnModuleInit {
  private readonly logger = new Logger(CatalogService.name);

  /**
   * Map indexée par nom de sponsor (accès O(1)).
   * Chaque entrée est un Sponsor enrichi avec ses relations pré-résolues.
   * readonly : on ne remplace jamais la Map, seulement son contenu lors de l'init.
   */
  private readonly sponsorMap = new Map<string, Sponsor>();

  /**
   * Listes brutes conservées pour les endpoints "tout lister".
   * Elles sont aussi utilisées pour calculer les relations dans onModuleInit.
   */
  private allVehicules: Vehicule[] = [];
  private allArmes: Arme[] = [];
  private allAmeliorations: Amelioration[] = [];

  /**
   * Lifecycle hook NestJS : appelé automatiquement après l'initialisation
   * du module, avant que le serveur HTTP ne commence à accepter des requêtes.
   *
   * C'est ici que tout le catalogue est chargé en mémoire.
   */
  onModuleInit(): void {
    this.logger.log('Chargement du catalogue depuis les fichiers YAML...');
    try {
      // Étape 1 : Charger les données brutes depuis les 4 fichiers YAML
      const rawSponsors = this.loadYaml<{ sponsors: RawSponsor[] }>(
        'sponsors.yml',
      ).sponsors;

      this.allVehicules = this.loadYaml<{ vehicules: Vehicule[] }>(
        'vehicules.yml',
      ).vehicules;

      this.allArmes = this.loadYaml<{ armes: Arme[] }>('armes.yml').armes;

      // ⚠️ La clé racine dans amelioration.yml est "ameliorations_vehicules"
      this.allAmeliorations = this.loadYaml<{
        ameliorations_vehicules: Amelioration[];
      }>('amelioration.yml').ameliorations_vehicules;

      // Étape 2 : Construire la Map avec les relations pré-résolues.
      // Pour chaque sponsor, on filtre les items dont sponsors_autorises[] contient son nom.
      // Ce filtrage ne se fait qu'UNE SEULE FOIS ici, pas à chaque requête.
      for (const raw of rawSponsors) {
        this.sponsorMap.set(raw.nom, {
          ...raw,
          vehicules: this.allVehicules.filter((v) =>
            v.sponsors_autorises.includes(raw.nom),
          ),
          armes: this.allArmes.filter((a) =>
            a.sponsors_autorises.includes(raw.nom),
          ),
          ameliorations: this.allAmeliorations.filter((a) =>
            a.sponsors_autorises.includes(raw.nom),
          ),
        });
      }

      this.logger.log(
        `Catalogue chargé : ${this.sponsorMap.size} sponsors, ` +
          `${this.allVehicules.length} véhicules, ` +
          `${this.allArmes.length} armes, ` +
          `${this.allAmeliorations.length} améliorations.`,
      );
    } catch (err) {
      // On re-throw intentionnellement pour faire crasher le démarrage du serveur.
      // Un catalogue non chargé rend l'application inutilisable — mieux vaut
      // un crash visible qu'un service qui répond silencieusement avec des données vides.
      this.logger.error('Échec du chargement du catalogue YAML', err);
      throw err;
    }
  }

  /**
   * Charge et parse un fichier YAML depuis database_init/data/.
   *
   * Délègue la lecture à readFileContent() pour permettre la substitution
   * en tests (pattern Template Method) sans mocker le module fs.
   */
  private loadYaml<T>(filename: string): T {
    const raw = this.readFileContent(filename);
    return parse(raw) as T;
  }

  /**
   * Lit le contenu brut d'un fichier du catalogue.
   *
   * Protected : surcharger cette méthode dans les sous-classes de test
   * permet de fournir des données fictives sans toucher au système de fichiers.
   *
   * process.cwd() retourne la racine du workspace quand Nx lance le backend,
   * comme le fait déjà ContentService pour les fichiers Markdown.
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

  // ── Méthodes publiques d'accès au catalogue ──────────────────────────────

  /**
   * Retourne tous les sponsors avec leurs relations pré-résolues.
   * Chaque Sponsor contient directement ses véhicules, armes et améliorations.
   */
  getAllSponsors(): Sponsor[] {
    return Array.from(this.sponsorMap.values());
  }

  /**
   * Retourne un sponsor par son nom exact, avec ses relations pré-résolues.
   * Retourne undefined si le sponsor n'existe pas dans le catalogue.
   */
  getSponsor(nom: string): Sponsor | undefined {
    return this.sponsorMap.get(nom);
  }

  /** Retourne tous les véhicules du catalogue (toutes configurations). */
  getAllVehicules(): Vehicule[] {
    return this.allVehicules;
  }

  /** Retourne toutes les armes du catalogue (tous types). */
  getAllArmes(): Arme[] {
    return this.allArmes;
  }

  /** Retourne toutes les améliorations du catalogue. */
  getAllAmeliorations(): Amelioration[] {
    return this.allAmeliorations;
  }
}
