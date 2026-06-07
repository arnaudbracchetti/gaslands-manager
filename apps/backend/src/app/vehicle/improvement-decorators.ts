/**
 * Décorateurs spécifiques — un par RÈGLE MÉTIER d'amélioration de véhicule.
 *
 * Chaque classe ci-dessous est une petite spécialisation de `ImprovementDecorator` :
 * elle n'override QUE ce qui la concerne — `stats` si elle modifie le profil du
 * véhicule, `validateSelf` si elle porte une règle de pose particulière (ou les deux).
 * Tout le reste (delegation, accumulation, capacité en emplacements, Template Method
 * de `validate`...) est déjà fourni par la classe abstraite — voir `vehicle-build.ts`.
 *
 * Le YAML ne porte qu'UNE référence (`comportement: "<clé>"`) vers la classe à
 * instancier (cf. `ImprovementDecoratorFactory`). C'est le CODE, ici, qui connaît et
 * implémente la règle — chaque classe se lit comme l'énoncé de la règle qu'elle
 * incarne, ce qui la rend testable isolément et lisible sans avoir à recouper avec le
 * texte du catalogue. Les variantes sponsor qui ne changent que prix/emplacement
 * partagent le même `comportement` ⇒ la Factory instancie la MÊME classe ⇒ même règle,
 * sans rien dupliquer ni paramétrer (cf. plan, §"Le YAML — une seule clé de référence").
 */

import { ImprovementDecorator, ok, fail, type RuleResult, type VehicleStats } from './vehicle-build';

// ── Chenilles : -1 vitesse_max / +1 manœuvrabilité, unique, incompatibilités ──

/**
 * Règle (cf. `amelioration.yml`) :
 *  - +1 Manœuvrabilité, -1 Vitesse maximale ;
 *  - un seul exemplaire par véhicule ;
 *  - interdites sur Char d'Assaut, Hélicoptère, Gyrocoptère.
 */
export class ChenillesDecorator extends ImprovementDecorator {
  private static readonly VEHICULES_INCOMPATIBLES: readonly string[] = [
    'char_assaut',
    'helicoptere',
    'gyrocoptere',
  ];

  override get stats(): VehicleStats {
    const s = this.inner.stats;
    return { ...s, vitesse_max: s.vitesse_max - 1, manoeuvrabilite: s.manoeuvrabilite + 1 };
  }

  protected override validateSelf(): RuleResult {
    if (ChenillesDecorator.VEHICULES_INCOMPATIBLES.includes(this.baseStats.nom_interne)) {
      return fail('Chenilles incompatibles avec ce véhicule');
    }
    // `inner` = les couches EN DESSOUS de moi (ne me compte pas) : si une autre Chenille
    // y figure déjà, alors MOI je serais un 2ᵉ exemplaire → refus.
    if (this.inner.countByType(ChenillesDecorator) >= 1) {
      return fail('Une seule paire de Chenilles par véhicule');
    }
    return ok();
  }
}

// ── Membre d'Équipage Supplémentaire : +1 équipage, plafonné ──────────────────

/**
 * Règle (cf. `amelioration.yml`) :
 *  - chaque exemplaire augmente l'Équipage de +1 ;
 *  - maximum = 2× la Valeur d'Équipage de DÉPART du véhicule.
 *
 * Couvre AUSSI la variante Scarlett (même `comportement` ⇒ même classe instanciée par
 * la Factory ⇒ même règle ; seul le prix catalogue diffère, ce qui ne regarde pas le build).
 */
export class MembreEquipageDecorator extends ImprovementDecorator {
  private static readonly MULTIPLICATEUR_MAX: number = 2;

  override get stats(): VehicleStats {
    return { ...this.inner.stats, equipage: this.inner.stats.equipage + 1 };
  }

  /**
   * Astuce : `this.stats.equipage` inclut DÉJÀ mon propre +1 (l'accesseur ci-dessus
   * part de `this.inner.stats` puis ajoute le mien). Comparer directement la valeur
   * cumulée au seuil évite de recompter manuellement les couches — état (`stats`) et
   * règle (`validateSelf`) s'appuient sur la MÊME mécanique d'accumulation, sans logique
   * dupliquée qui pourrait diverger avec le temps.
   */
  protected override validateSelf(): RuleResult {
    const seuil = this.baseStats.equipage * MembreEquipageDecorator.MULTIPLICATEUR_MAX;
    if (this.stats.equipage > seuil) {
      return fail(`Maximum d'équipage atteint (${seuil})`);
    }
    return ok();
  }
}

// ── Bélier : exige une orientation, unique PAR position parmi son propre type ──

/**
 * Règle (cf. `amelioration.yml`) :
 *  - une orientation doit être définie à l'achat (comme pour une arme) ;
 *  - un seul Bélier par orientation (mais plusieurs Béliers sur des orientations différentes
 *    sont autorisés — d'où une vérification PAR POSITION, pas un simple comptage global).
 *
 * Couvre AUSSI la variante Slime (même `comportement` ⇒ même classe ⇒ même règle).
 *
 * ⚠️ PAS de lien avec Bélier Explosif malgré la proximité de noms : sa propre fiche
 * confirme qu'ils sont explicitement compatibles et cumulatifs sur la même orientation —
 * chacun valide SA règle, en toute indépendance (cf. `BelierExplosifDecorator` ci-dessous,
 * et le plan d'architecture pour la correction d'une fausse hypothèse de conception initiale).
 */
export class BelierDecorator extends ImprovementDecorator {
  protected override validateSelf(): RuleResult {
    if (!this.instance.orientation) {
      return fail('Une orientation est requise pour le Bélier');
    }
    // `hasOrientationFor` descend la chaîne et matche par CONSTRUCTEUR : un Bélier (Slime)
    // posé plus bas est vu comme "le même type" malgré un `nom_interne` différent —
    // exactement le regroupement souhaité, sans rien ajouter au YAML.
    if (this.inner.hasOrientationFor(BelierDecorator, this.instance.orientation)) {
      return fail(`Un Bélier occupe déjà la position "${this.instance.orientation}"`);
    }
    return ok();
  }
}

// ── Bélier Explosif : interdit sur Léger, unique, orientation requise ─────────

/**
 * Règle (cf. `amelioration.yml`) :
 *  - interdit sur les véhicules de Poids Léger ;
 *  - un seul exemplaire par véhicule (contrairement au Bélier, pas "par orientation" :
 *    le plafond global rend une vérification par position superflue) ;
 *  - une orientation doit néanmoins être définie à l'achat (comme pour une arme).
 *
 * Totalement indépendant du Bélier — voir `BelierDecorator` pour le détail du
 * raisonnement (les deux sont confirmés compatibles et cumulatifs par leurs règles).
 */
export class BelierExplosifDecorator extends ImprovementDecorator {
  protected override validateSelf(): RuleResult {
    if (this.baseStats.poids === 'Léger') {
      return fail('Le Bélier Explosif est interdit sur les véhicules de Poids Léger');
    }
    if (this.inner.countByType(BelierExplosifDecorator) >= 1) {
      return fail('Un seul Bélier Explosif par véhicule');
    }
    if (!this.instance.orientation) {
      return fail('Une orientation est requise pour le Bélier Explosif');
    }
    return ok();
  }
}

// ── Blindage : +2 carrosserie, cumulable sans limite ──────────────────────────

/**
 * Règle (cf. `amelioration.yml`) : +2 Carrosserie, de façon permanente et cumulable —
 * "un même véhicule peut acheter plusieurs Blindages, chaque achat ajoute +2".
 *
 * Couvre AUSSI le Micro-Blindage de Verney : règle et effet RIGOUREUSEMENT identiques
 * (seuls le prix et l'emplacement catalogue diffèrent — hors du périmètre du build).
 *
 * Pas de `validateSelf` : "cumulable sans limite" = absence de règle de pose, donc le
 * comportement par défaut (`ok()`, hérité de la classe abstraite) exprime déjà
 * exactement ce qu'il faut. Ce n'est PAS un cas analogue au bug structurel mentionné
 * dans le plan (qui concernait des règles RESTRICTIVES absentes pour la 1ʳᵉ pose) :
 * ici, l'absence de règle est elle-même la règle.
 */
export class BlindageDecorator extends ImprovementDecorator {
  override get stats(): VehicleStats {
    return { ...this.inner.stats, carrosserie: this.inner.stats.carrosserie + 2 };
  }
}

// ── Équipement exclusif Mishkin : Réacteur Nucléaire / Téléporteur — unique ───

/**
 * Règle commune au Réacteur Nucléaire Expérimental ET au Téléporteur Expérimental
 * (cf. `amelioration.yml`) : chacun ne peut être acheté qu'une seule fois par véhicule.
 * Leurs effets de jeu (vitesse maximale, téléportation...) sont purement narratifs du
 * point de vue du build chiffré — seule la contrainte d'unicité influence la validation.
 *
 * Les deux améliorations partagent ce même `comportement`. Le message d'erreur
 * réutilise `this.amelioration.nom` pour rester précis malgré le partage de la classe
 * ("Un seul exemplaire de Téléporteur Expérimental..." plutôt qu'un message générique).
 */
export class EquipementMishkinDecorator extends ImprovementDecorator {
  protected override validateSelf(): RuleResult {
    if (this.inner.countByType(EquipementMishkinDecorator) >= 1) {
      return fail(`Un seul exemplaire de "${this.amelioration.nom}" par véhicule`);
    }
    return ok();
  }
}
