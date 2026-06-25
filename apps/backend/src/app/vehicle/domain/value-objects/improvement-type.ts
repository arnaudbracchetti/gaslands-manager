import type { Amelioration } from '../../../catalog/catalog.interfaces';

export class ImprovementType {
  private constructor(private readonly raw: Amelioration) {}

  static from(raw: Amelioration): ImprovementType {
    return new ImprovementType(raw);
  }

  get nomInterne(): string {
    return this.raw.nom_interne;
  }

  get nom(): string {
    return this.raw.nom;
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

  get comportement(): string | undefined {
    return this.raw.comportement;
  }

  get hasVariablePrice(): boolean {
    return this.raw.prix === 'x3';
  }

  get isTourelle(): boolean {
    return this.raw.nom_interne === 'tourelle';
  }

  // Toujours un number : 0 pour la Tourelle (prix variable, dépend de l'arme assignée)
  get price(): number {
    return this.hasVariablePrice ? 0 : (this.raw.prix as number);
  }

  equals(other: ImprovementType): boolean {
    return this.raw.nom_interne === other.raw.nom_interne;
  }
}
