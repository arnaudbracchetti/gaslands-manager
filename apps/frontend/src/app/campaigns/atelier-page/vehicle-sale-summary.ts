/**
 * VehicleSaleSummary — synthèse d'un véhicule d'atelier avant vente/annulation,
 * affichée par `SellVehicleModal`. Sur le modèle de `buildVehicleSummary`
 * (`teams/vehicle-summary.ts`), mais consomme directement `WorkshopVehicleDto`
 * (pas besoin de repasser par le modèle `Vehicle` de construction d'équipe) et
 * détaille chaque ligne d'équipement plutôt qu'un simple tag.
 *
 * `refund` (agrégat) et le `refund` de chaque ligne/`chassisRefund` sont TOUJOURS
 * les valeurs backend (`WorkshopVehicleDto.resaleRefund`/`.chassisResaleRefund`,
 * `WorkshopWeaponDto`/`WorkshopImprovementDto`/`WorkshopAdvantageDto.resaleRefund`)
 * — jamais recalculées ici, même convention que `Weapon.price`/`Improvement.price`/
 * `Advantage.price` (règle métier, pas de réimplémentation côté client). Seuls
 * `totalCost` et le détail par ligne (affichage informatif) sont calculés ici, à
 * partir des valeurs déjà résolues par le backend sur chaque équipement.
 */
import { Sponsor } from '../../catalog/catalog.model';
import { WorkshopVehicleDto } from '../workshop.model';

export interface VehicleSaleLineItem {
  label: string;
  category: 'Arme' | 'Amélioration' | 'Avantage';
  /** Prix initial (payé à l'achat). */
  price: number;
  /** Montant recrédité si cette ligne est revendue — backend (`Xxx.resaleRefund`). */
  refund: number;
}

export interface VehicleSaleSummary {
  vehicleName: string;
  chassisPrice: number;
  /** Backend : `Vehicle.chassisResaleRefund` — montant recrédité pour le seul châssis. */
  chassisRefund: number;
  /** Équipement actif — exclut estDefaut/isSold/isLost, même filtre que
   *  `buildVehicleSummary.equipements`/`MountedEquipment.visibleXxx`. */
  items: VehicleSaleLineItem[];
  /** chassisPrice + somme des `items` actifs. */
  totalCost: number;
  /** Backend : `Vehicle.resaleRefund` — montant crédité si revente réelle. */
  refund: number;
  /** Backend : pilote le texte/bouton de la modale ("Annuler l'achat" vs "Vendre"). */
  purchasedThisSession: boolean;
}

export function buildVehicleSaleSummary(vehicle: WorkshopVehicleDto, catalog: Sponsor): VehicleSaleSummary {
  const vehiculeCatalogue = catalog.vehicules.find((v) => v.nom_interne === vehicle.nomInterne);
  // Déjà formaté par le backend ("Nom (Type)" si personnalisé) — plus de résolution catalogue ici.
  const vehicleName = vehicle.nom;
  const chassisPrice = vehiculeCatalogue?.prix ?? vehicle.price;

  const items: VehicleSaleLineItem[] = [];

  for (const weapon of vehicle.weapons) {
    if (weapon.estDefaut || weapon.isSold || weapon.isLost) continue;
    const armeCatalogue = catalog.armes.find((a) => a.nom_interne === weapon.nomInterne);
    items.push({ label: armeCatalogue?.nom ?? weapon.nomInterne, category: 'Arme', price: weapon.price, refund: weapon.resaleRefund });
  }

  for (const improvement of vehicle.improvements) {
    if (improvement.estDefaut || improvement.isSold || improvement.isLost) continue;
    const amCatalogue = catalog.ameliorations.find((a) => a.nom_interne === improvement.nomInterne);
    items.push({
      label: amCatalogue?.nom ?? improvement.nomInterne,
      category: 'Amélioration',
      price: improvement.price,
      refund: improvement.resaleRefund,
    });
  }

  for (const advantage of vehicle.advantages) {
    if (advantage.isSold) continue;
    const avCatalogue = catalog.avantages.find((a) => a.nom_interne === advantage.nomInterne);
    items.push({
      label: avCatalogue?.nom ?? advantage.nomInterne,
      category: 'Avantage',
      price: advantage.price,
      refund: advantage.resaleRefund,
    });
  }

  const totalCost = chassisPrice + items.reduce((sum, item) => sum + item.price, 0);

  return {
    vehicleName,
    chassisPrice,
    chassisRefund: vehicle.chassisResaleRefund,
    items,
    totalCost,
    refund: vehicle.resaleRefund,
    purchasedThisSession: vehicle.purchasedThisSession,
  };
}
