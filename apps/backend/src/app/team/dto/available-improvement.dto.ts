export interface AvailableImprovementDto {
  nom: string;
  nomInterne: string;
  prix: number;
  emplacement: number;
  description: string;
  regles: string;
  disponible: boolean;
  raison?: string;
}
