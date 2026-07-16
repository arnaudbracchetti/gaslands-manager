/**
 * Icon — icône peinte recadrée depuis la planche sprite unique `/icons/icon-sheet.png`.
 *
 * Composant "dumb" générique : reçoit un `concept` (cf. `icon-sheet.map.ts` pour
 * la liste et le mapping vers la planche) et affiche uniquement le DESSIN de la
 * case correspondante — la légende texte imprimée sous chaque icône dans la
 * planche est exclue via `ICON_CROP_RECTS` (rectangle en pixels source, pas la
 * cellule de grille entière). Jamais de coordonnées "magiques" dans un
 * template : le mapping concept → rectangle est centralisé dans `icon-sheet.map.ts`.
 *
 * Usage :
 *   <app-icon concept="supprimer" />
 *   <app-icon concept="argent" size="lg" alt="Coût" />
 *
 * Taille toujours exprimée via le nom standard `IconSize` (cf. `icon-sizes.ts`)
 * — jamais en pixels directement dans un template, pour que changer la taille
 * de toute une catégorie d'icônes (tous les badges, tous les titres...) se
 * fasse en un seul endroit (`ICON_SIZE_PX`).
 *
 * Les rectangles de découpe n'ont pas tous exactement les mêmes proportions
 * (dessins peints à la main, largeur de colonne fixe mais hauteur de dessin
 * variable selon la ligne) — et les marges entre dessin et légende sont trop
 * fines pour absorber un centrage par simple décalage de `background-position`
 * (ça laisserait réapparaître un fragment de la légende voisine). La structure
 * est donc à deux niveaux : `.app-icon__glyph` (élément interne) est dimensionné
 * exactement à `rect.width/height × scale` — **une seule échelle**, jamais deux
 * facteurs indépendants, donc jamais de déformation — et ses propres bornes
 * bloquent nativement tout débordement du fond au-delà du rectangle voulu.
 * Le conteneur externe (`sizePx × sizePx`) centre ce glyphe par flexbox.
 */
import { Component, InputSignal, Signal, computed, input } from '@angular/core';
import { ICON_CROP_RECTS, ICON_SHEET_IMAGE_HEIGHT, ICON_SHEET_IMAGE_WIDTH, IconConcept } from './icon-sheet.map';
import { ICON_SIZE_PX, IconSize } from './icon-sizes';

interface IconGlyphStyle {
  width: number;
  height: number;
  backgroundSize: string;
  backgroundPosition: string;
}

@Component({
  selector: 'app-icon',
  standalone: true,
  templateUrl: './icon.html',
  styleUrl: './icon.scss',
})
export class Icon {
  /** Concept à afficher — détermine le rectangle de la planche découpée. */
  concept: InputSignal<IconConcept> = input.required<IconConcept>();

  /** Taille nommée (cf. `ICON_SIZE_PX`) — défaut : 'sm'. */
  size: InputSignal<IconSize> = input<IconSize>('sm');

  /** Texte alternatif — vide par défaut (icône généralement accompagnée d'un libellé visible). */
  alt: InputSignal<string> = input<string>('');

  /** Largeur = hauteur du conteneur, en pixels — résolue depuis `size()`. */
  sizePx: Signal<number> = computed((): number => ICON_SIZE_PX[this.size()]);

  /** Dimensions et fond du glyphe interne — mis à l'échelle uniformément
   *  (jamais X/Y indépendants) puis centré par le conteneur (flexbox, cf.
   *  `icon.scss`), jamais par décalage de `background-position`. */
  glyph: Signal<IconGlyphStyle> = computed((): IconGlyphStyle => {
    const rect = ICON_CROP_RECTS[this.concept()];
    const scale = this.sizePx() / Math.max(rect.width, rect.height);

    return {
      width: rect.width * scale,
      height: rect.height * scale,
      backgroundSize: `${ICON_SHEET_IMAGE_WIDTH * scale}px ${ICON_SHEET_IMAGE_HEIGHT * scale}px`,
      backgroundPosition: `${-rect.x * scale}px ${-rect.y * scale}px`,
    };
  });
}
