/**
 * Tests unitaires pour SellVehicleModal (composant dumb, compose ModalShell).
 */
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { outputToObservable } from '@angular/core/rxjs-interop';
import { SellVehicleModal } from './sell-vehicle-modal';
import type { VehicleSaleSummary } from '../vehicle-sale-summary';

const soldSummary: VehicleSaleSummary = {
  vehicleName: 'La Teigne',
  chassisPrice: 10,
  chassisRefund: 5,
  items: [],
  totalCost: 10,
  refund: 5,
  purchasedThisSession: false,
};

const sessionPurchaseSummary: VehicleSaleSummary = {
  ...soldSummary,
  purchasedThisSession: true,
};

describe('SellVehicleModal', () => {
  let component: SellVehicleModal;
  let fixture: ComponentFixture<SellVehicleModal>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [SellVehicleModal] }).compileComponents();
    fixture = TestBed.createComponent(SellVehicleModal);
    component = fixture.componentInstance;
  });

  it('affiche "Vendre ce véhicule ?" pour un véhicule pré-existant', () => {
    fixture.componentRef.setInput('summary', soldSummary);
    fixture.detectChanges();

    expect(component.title()).toBe('Vendre ce véhicule ?');
    expect(component.confirmLabel()).toBe('Vendre');
    expect(component.amount()).toBe(5);
  });

  it('affiche "Annuler l\'achat de ce véhicule ?" pour un achat de cette session', () => {
    fixture.componentRef.setInput('summary', sessionPurchaseSummary);
    fixture.detectChanges();

    expect(component.title()).toBe("Annuler l'achat de ce véhicule ?");
    expect(component.confirmLabel()).toBe("Annuler l'achat");
    expect(component.amount()).toBe(10);
  });

  it('émet confirmed au clic sur le bouton de confirmation', () => {
    fixture.componentRef.setInput('summary', soldSummary);
    fixture.detectChanges();

    const emitted: unknown[] = [];
    outputToObservable(component.confirmed).subscribe(() => emitted.push(true));

    (fixture.nativeElement as HTMLElement).querySelector<HTMLButtonElement>('.ms-modal__confirm')?.click();

    expect(emitted).toHaveLength(1);
  });

  it('émet cancelled au clic sur le bouton Fermer', () => {
    fixture.componentRef.setInput('summary', soldSummary);
    fixture.detectChanges();

    const emitted: unknown[] = [];
    outputToObservable(component.cancelled).subscribe(() => emitted.push(true));

    (fixture.nativeElement as HTMLElement).querySelector<HTMLButtonElement>('.ms-modal__cancel')?.click();

    expect(emitted).toHaveLength(1);
  });
});
