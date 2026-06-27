export interface AvailableImprovementDto {
  nom: string;
  nomInterne: string;
  prix: number | string;
  emplacement: number;
  description: string;
  regles: string;
  disponible: boolean;
  raison?: string;
}
