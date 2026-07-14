export interface AvailableSequellaDto {
  nom: string;
  nomInterne: string;
  /** Coût en Chocs (monnaie du véhicule, distincte de la cagnotte). */
  chocsCost: number;
  description: string;
  disponible: boolean;
  raison?: string;
}
