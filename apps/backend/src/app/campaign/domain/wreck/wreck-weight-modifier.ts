/**
 * Modificateur de poids appliqué au tirage de la Table des Épaves (Gaslands, p.168) :
 * Léger +1, Lourd −1, Moyen 0. Extrait en fonction pure partagée entre `WreckTable`
 * (calcul du résultat) et `WreckResolvedEvent.describe()` (affichage du détail du
 * tirage) — une seule source de vérité pour ce barème, plutôt que deux copies qui
 * pourraient diverger.
 */
export function wreckWeightModifier(poids: 'Léger' | 'Moyen' | 'Lourd'): number {
  if (poids === 'Léger') return 1;
  if (poids === 'Lourd') return -1;
  return 0;
}
