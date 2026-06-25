import { Weapon } from './weapon';
import { WeaponType } from './value-objects/weapon-type';
import type { Arme } from '../../catalog/catalog.interfaces';

const armeBase: Arme = {
  nom: 'Mitrailleuse',
  nom_interne: 'mitrailleuse',
  type: 'base',
  prix: 4,
  emplacement: 1,
  description: '',
  regles: '',
  sponsors_autorises: ['Rutherford'],
};

const armeEquipage: Arme = {
  nom: 'Grenades',
  nom_interne: 'grenades',
  type: 'équipage',
  prix: 2,
  emplacement: 0,
  description: '',
  regles: '',
  sponsors_autorises: ['Rutherford'],
};

describe('Weapon', () => {
  it('expose son id', () => {
    const w = new Weapon(1, WeaponType.from(armeBase), 'avant');
    expect(w.id).toBe(1);
  });

  it('expose son type', () => {
    const w = new Weapon(1, WeaponType.from(armeBase), 'avant');
    expect(w.type.nomInterne).toBe('mitrailleuse');
  });

  it('expose son orientation', () => {
    const w = new Weapon(1, WeaponType.from(armeBase), 'avant');
    expect(w.orientation).toBe('avant');
  });

  it('accepte une orientation null pour les armes équipage', () => {
    const w = new Weapon(2, WeaponType.from(armeEquipage), null);
    expect(w.orientation).toBeNull();
  });

  it('délègue price à son WeaponType', () => {
    const w = new Weapon(1, WeaponType.from(armeBase), 'avant');
    expect(w.price).toBe(4);
  });

  it('délègue slots à son WeaponType', () => {
    const w = new Weapon(1, WeaponType.from(armeBase), 'avant');
    expect(w.slots).toBe(1);
  });
});
