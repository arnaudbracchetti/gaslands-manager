import type { Arme } from '../../../catalog/catalog.interfaces';

export class WeaponType {
  private constructor(private readonly raw: Arme) {}

  static from(raw: Arme): WeaponType {
    return new WeaponType(raw);
  }

  get nomInterne(): string {
    return this.raw.nom_interne;
  }

  get nom(): string {
    return this.raw.nom;
  }

  get price(): number {
    return this.raw.prix;
  }

  get slots(): number {
    return this.raw.emplacement;
  }

  get description(): string {
    return this.raw.description;
  }

  get regles(): string {
    return this.raw.regles;
  }

  get type(): 'base' | 'avancée' | 'équipage' | 'largable' {
    return this.raw.type;
  }

  get isEquipage(): boolean {
    return this.raw.type === 'équipage';
  }

  get requiresOrientation(): boolean {
    return !this.isEquipage;
  }

  equals(other: WeaponType): boolean {
    return this.raw.nom_interne === other.raw.nom_interne;
  }
}
