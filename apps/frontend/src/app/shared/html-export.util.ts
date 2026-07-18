/**
 * Ouvre un document HTML complet (ex. fiche d'équipe exportable) dans une fenêtre
 * déjà ouverte, ou déclenche un téléchargement de secours si `win` est `null`
 * (popup bloqué par le navigateur).
 *
 * `win` DOIT provenir d'un `window.open('', '_blank')` appelé de façon SYNCHRONE
 * dans le gestionnaire de clic, AVANT l'appel HTTP qui récupère `html` — ouvrir la
 * fenêtre seulement après la réponse asynchrone risque d'être traité comme un
 * popup non désiré par certains navigateurs (Safari notamment) et bloqué.
 */
export function openHtmlDocumentInNewTab(win: Window | null, html: string): void {
  if (!win) {
    downloadHtmlFile(html, 'fiche-equipe.html');
    return;
  }
  win.document.open();
  win.document.write(html);
  win.document.close();
}

/** Repli si la fenêtre n'a pas pu s'ouvrir — le joueur récupère quand même la fiche. */
function downloadHtmlFile(html: string, filename: string): void {
  const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
