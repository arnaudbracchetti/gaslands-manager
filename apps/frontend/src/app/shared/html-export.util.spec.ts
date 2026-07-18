import { describe, it, expect, vi } from 'vitest';
import { openHtmlDocumentInNewTab } from './html-export.util';

function makeMockWindow(): Window {
  return {
    document: {
      open: vi.fn(),
      write: vi.fn(),
      close: vi.fn(),
    },
  } as unknown as Window;
}

describe('openHtmlDocumentInNewTab', () => {
  it('écrit le HTML dans la fenêtre fournie (open → write → close)', () => {
    const win = makeMockWindow();

    openHtmlDocumentInNewTab(win, '<!doctype html><html></html>');

    expect(win.document.open).toHaveBeenCalled();
    expect(win.document.write).toHaveBeenCalledWith('<!doctype html><html></html>');
    expect(win.document.close).toHaveBeenCalled();
  });

  it('déclenche un téléchargement de secours si la fenêtre est null (popup bloqué)', () => {
    const createObjectURL = vi.fn().mockReturnValue('blob:fake-url');
    const revokeObjectURL = vi.fn();
    vi.stubGlobal('URL', { ...URL, createObjectURL, revokeObjectURL });

    const clickSpy = vi.fn();
    const anchor = { href: '', download: '', click: clickSpy } as unknown as HTMLAnchorElement;
    const createElementSpy = vi.spyOn(document, 'createElement').mockReturnValue(anchor);

    openHtmlDocumentInNewTab(null, '<!doctype html><html></html>');

    expect(createObjectURL).toHaveBeenCalled();
    expect(anchor.download).toBe('fiche-equipe.html');
    expect(clickSpy).toHaveBeenCalled();
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:fake-url');

    createElementSpy.mockRestore();
    vi.unstubAllGlobals();
  });
});
