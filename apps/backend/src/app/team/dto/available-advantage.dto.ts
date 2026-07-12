export interface AvailableAdvantageDto {
  nom: string;
  nomInterne: string;
  categorie: string;
  prix: number;
  description: string;
  regles: string;
  disponible: boolean;
  raison?: string;
}
