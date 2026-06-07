/**
 * CatalogService — service Angular pour le catalogue de jeu Gaslands.
 *
 * Le catalogue (sponsors, véhicules, armes, améliorations) est une donnée publique :
 * aucun token JWT n'est requis pour y accéder. Ce service encapsule les appels HTTP
 * vers /api/catalog/*.
 *
 * Les données sont en lecture seule et chargées à la demande (pas de cache global).
 * Si les performances deviennent un enjeu, on pourra ajouter un shareReplay(1) ici.
 */
import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { SponsorInfo } from '../teams/team.model';
import { Sponsor } from './catalog.model';

@Injectable({ providedIn: 'root' })
export class CatalogService {
  // inject() : syntaxe Angular moderne, équivalent au paramètre de constructeur.
  // Type explicite requis sur le membre de classe (règle memberVariableDeclaration).
  private http: HttpClient = inject(HttpClient);

  /**
   * GET /api/catalog/sponsors
   *
   * Retourne tous les sponsors avec leurs classes d'avantage et avantages spéciaux.
   * Ces données alimentent le carousel de sélection de sponsor dans TeamForm.
   *
   * La réponse est un tableau de 13 SponsorInfo (1 par sponsor disponible dans le jeu).
   */
  getSponsors(): Observable<SponsorInfo[]> {
    return this.http.get<SponsorInfo[]>('/api/catalog/sponsors');
  }

  /**
   * GET /api/catalog/sponsors/:nom
   *
   * Retourne UN sponsor avec son catalogue COMPLET et pré-filtré : véhicules,
   * armes et améliorations qu'il autorise (cf. `Sponsor`, vue "enrichie" — à
   * distinguer de `SponsorInfo`, la vue allégée du carousel, cf. `catalog.model.ts`).
   *
   * Exactement ce dont `VehicleBuilder` a besoin pour ses deux étapes — choisir
   * un véhicule (étape 1), puis l'équiper d'armes et d'améliorations (étape 2) —
   * sans le moindre filtrage côté client : le backend l'a déjà fait au démarrage.
   *
   * `encodeURIComponent` : certains noms de sponsor contiennent espaces et accents
   * (ex: "La Geôlière") — il faut les encoder pour former une URL valide
   * (cf. SPECIFICATION.md §6, note sur l'encodage des noms de sponsor).
   */
  getSponsorByName(nom: string): Observable<Sponsor> {
    return this.http.get<Sponsor>(`/api/catalog/sponsors/${encodeURIComponent(nom)}`);
  }
}
