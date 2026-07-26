/**
 * Tests unitaires pour ParticipantList.
 *
 * Composant "dumb" : affichage unifié (tous statuts dans une seule liste).
 * Inputs : participants[], isOrganizer, currentUserId
 * Outputs : validate({ pid, accept }), remove(pid), promote(pid)
 */
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { outputToObservable } from '@angular/core/rxjs-interop';
import { provideRouter } from '@angular/router';
import { ParticipantList } from './participant-list';
import { CampaignParticipant } from '../campaign-participant.model';

const mockParticipants: CampaignParticipant[] = [
  { id: 1, userId: 42, teamId: 7, status: 'VALIDATED', isOrganizer: true, userName: 'Jean Dupont', teamName: 'Furies' },
  { id: 2, userId: 43, teamId: 8, status: 'PENDING', isOrganizer: false, userName: 'Alice Martin', teamName: 'Scrap Kings' },
];

/** Retrouve un bouton du menu ⋯ (déjà ouvert) par son libellé exact. */
function findMenuButtonByLabel(item: Element, label: string): HTMLButtonElement | null {
  const buttons = item.querySelectorAll('.participant-list__menu button');
  for (const btn of Array.from(buttons)) {
    if (btn.textContent?.trim() === label) return btn as HTMLButtonElement;
  }
  return null;
}

/** Mirroir de `findMenuButtonByLabel`, pour les entrées de menu en lien (`<a>`). */
function findMenuLinkByLabel(item: Element, label: string): HTMLAnchorElement | null {
  const links = item.querySelectorAll('.participant-list__menu a');
  for (const link of Array.from(links)) {
    if (link.textContent?.trim() === label) return link as HTMLAnchorElement;
  }
  return null;
}

describe('ParticipantList', () => {
  let component: ParticipantList;
  let fixture: ComponentFixture<ParticipantList>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ParticipantList],
      providers: [provideRouter([])],
    }).compileComponents();

    fixture = TestBed.createComponent(ParticipantList);
    component = fixture.componentInstance;
  });

  // ── Affichage de base ────────────────────────────────────────────────────

  it('affiche le nom de l\'utilisateur et de l\'équipe pour chaque participant', () => {
    fixture.componentRef.setInput('participants', mockParticipants);
    fixture.detectChanges();

    const el = fixture.nativeElement as HTMLElement;
    const items = el.querySelectorAll('.participant-list__item');
    expect(items.length).toBe(2);
    expect(items[0].textContent).toContain('Jean Dupont');
    expect(items[0].textContent).toContain('Furies');
  });

  it('affiche l\'icône "Organisateur" pour un participant organisateur', () => {
    fixture.componentRef.setInput('participants', mockParticipants);
    fixture.detectChanges();

    const el = fixture.nativeElement as HTMLElement;
    const items = el.querySelectorAll('.participant-list__item');
    expect(items[0].querySelector('.participant-list__organizer-badge')).not.toBeNull();
    expect(items[1].querySelector('.participant-list__organizer-badge')).toBeNull();
  });

  it('affiche un message si la liste est vide', () => {
    fixture.componentRef.setInput('participants', []);
    fixture.detectChanges();

    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('.participant-list__empty')).not.toBeNull();
  });

  // ── Actions organisateur (Valider/Refuser PENDING) ───────────────────────

  it('masque les boutons Valider/Refuser si l\'utilisateur n\'est pas organisateur', () => {
    fixture.componentRef.setInput('participants', mockParticipants);
    fixture.componentRef.setInput('isOrganizer', false);
    fixture.detectChanges();

    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('.participant-list__icon-btn--accept')).toBeNull();
    expect(el.querySelector('.participant-list__icon-btn--reject')).toBeNull();
  });

  it('affiche Valider/Refuser (icônes inline) pour un PENDING quand isOrganizer', () => {
    fixture.componentRef.setInput('participants', mockParticipants);
    fixture.componentRef.setInput('isOrganizer', true);
    fixture.componentRef.setInput('currentUserId', 99);
    fixture.detectChanges();

    const emitted: { pid: number; accept: boolean }[] = [];
    outputToObservable(component.validate).subscribe((e) => emitted.push(e));

    const el = fixture.nativeElement as HTMLElement;
    const items = el.querySelectorAll('.participant-list__item');

    const validateBtn = items[1].querySelector('.participant-list__icon-btn--accept') as HTMLButtonElement;
    expect(validateBtn).not.toBeNull();
    validateBtn.click();
    expect(emitted).toContainEqual({ pid: 2, accept: true });
  });

  it('émet validate({ accept: false }) au clic sur Refuser (icône inline) pour un PENDING', () => {
    fixture.componentRef.setInput('participants', mockParticipants);
    fixture.componentRef.setInput('isOrganizer', true);
    fixture.componentRef.setInput('currentUserId', 99);
    fixture.detectChanges();

    const emitted: { pid: number; accept: boolean }[] = [];
    outputToObservable(component.validate).subscribe((e) => emitted.push(e));

    const el = fixture.nativeElement as HTMLElement;
    const items = el.querySelectorAll('.participant-list__item');
    const rejectBtn = items[1].querySelector('.participant-list__icon-btn--reject') as HTMLButtonElement;
    expect(rejectBtn).not.toBeNull();
    rejectBtn.click();
    expect(emitted).toContainEqual({ pid: 2, accept: false });
  });

  // ── Action Retirer (regroupée dans le menu ⋯, cf. carte compacte) ────────

  it('affiche le menu ⋯ pour un non-organisateur (Historique), sans les actions organisateur', () => {
    fixture.componentRef.setInput('participants', mockParticipants);
    fixture.componentRef.setInput('isOrganizer', false);
    fixture.detectChanges();

    const el = fixture.nativeElement as HTMLElement;
    const items = el.querySelectorAll('.participant-list__item');
    // Le menu ⋯ reste affiché (Historique est toujours disponible pour tout
    // participant), mais Promouvoir/Refuser/Retirer sont réservés à l'organisateur.
    const trigger = items[1].querySelector('.participant-list__menu-trigger') as HTMLButtonElement;
    expect(trigger).not.toBeNull();
    trigger.click();
    fixture.detectChanges();

    expect(findMenuButtonByLabel(items[1], 'Retirer')).toBeNull();
    expect(findMenuButtonByLabel(items[1], 'Promouvoir')).toBeNull();
    expect(findMenuButtonByLabel(items[1], 'Voir l\'historique')).not.toBeNull();
  });

  it('affiche Retirer dans le menu ⋯ et émet remove(pid) quand organisateur', () => {
    fixture.componentRef.setInput('participants', mockParticipants);
    fixture.componentRef.setInput('isOrganizer', true);
    fixture.componentRef.setInput('currentUserId', 99);
    fixture.detectChanges();

    const emitted: number[] = [];
    outputToObservable(component.remove).subscribe((pid) => emitted.push(pid));

    const el = fixture.nativeElement as HTMLElement;
    const items = el.querySelectorAll('.participant-list__item');
    const trigger = items[1].querySelector('.participant-list__menu-trigger') as HTMLButtonElement;
    expect(trigger).not.toBeNull();
    trigger.click();
    fixture.detectChanges();

    const removeBtn = findMenuButtonByLabel(items[1], 'Retirer');
    expect(removeBtn).not.toBeNull();
    removeBtn!.click();
    expect(emitted).toEqual([2]);
  });

  it('n\'affiche pas Retirer dans le menu ⋯ pour l\'unique organisateur VALIDATED (CA4)', () => {
    fixture.componentRef.setInput('participants', mockParticipants);
    fixture.componentRef.setInput('isOrganizer', true);
    fixture.componentRef.setInput('currentUserId', 99);
    fixture.detectChanges();

    const el = fixture.nativeElement as HTMLElement;
    const items = el.querySelectorAll('.participant-list__item');
    // items[0] = Jean, seul organisateur VALIDATED → le menu ⋯ reste affiché
    // (Historique toujours disponible), mais aucune action de maintenance
    // (Refuser/Promouvoir/Retirer tous bloqués).
    const trigger = items[0].querySelector('.participant-list__menu-trigger') as HTMLButtonElement;
    expect(trigger).not.toBeNull();
    trigger.click();
    fixture.detectChanges();

    expect(findMenuButtonByLabel(items[0], 'Retirer')).toBeNull();
    expect(findMenuButtonByLabel(items[0], 'Promouvoir')).toBeNull();
  });

  it('affiche le menu ⋯ (Retirer) pour un organisateur s\'il en reste un autre (CA5)', () => {
    const twoOrganizers: CampaignParticipant[] = [
      { ...mockParticipants[0] },
      { ...mockParticipants[1], isOrganizer: true, status: 'VALIDATED' },
    ];
    fixture.componentRef.setInput('participants', twoOrganizers);
    fixture.componentRef.setInput('isOrganizer', true);
    fixture.componentRef.setInput('currentUserId', 99);
    fixture.detectChanges();

    const el = fixture.nativeElement as HTMLElement;
    const items = el.querySelectorAll('.participant-list__item');
    expect(items[0].querySelector('.participant-list__menu-trigger')).not.toBeNull();
    expect(items[1].querySelector('.participant-list__menu-trigger')).not.toBeNull();
  });

  // ── Action Promouvoir (dans le menu ⋯) ───────────────────────────────────

  it('n\'affiche pas Promouvoir dans le menu ⋯ pour un participant PENDING', () => {
    fixture.componentRef.setInput('participants', mockParticipants);
    fixture.componentRef.setInput('isOrganizer', true);
    fixture.componentRef.setInput('currentUserId', 99);
    fixture.detectChanges();

    const el = fixture.nativeElement as HTMLElement;
    const items = el.querySelectorAll('.participant-list__item');
    // items[1] (Alice) est PENDING : le menu ⋯ existe (pour Retirer) mais
    // ne doit jamais contenir Promouvoir (réservé aux VALIDATED non-orga).
    const trigger = items[1].querySelector('.participant-list__menu-trigger') as HTMLButtonElement;
    trigger.click();
    fixture.detectChanges();

    expect(findMenuButtonByLabel(items[1], 'Promouvoir')).toBeNull();
  });

  // ── Classement (Points de Championnat) ───────────────────────────────────

  it('conserve l\'ordre d\'origine tant qu\'aucun PC n\'est fourni (tri stable, tout à 0)', () => {
    fixture.componentRef.setInput('participants', mockParticipants);
    fixture.detectChanges();

    const el = fixture.nativeElement as HTMLElement;
    const items = el.querySelectorAll('.participant-list__item');
    expect(items[0].textContent).toContain('Jean Dupont');
    expect(items[1].textContent).toContain('Alice Martin');
  });

  it('trie les participants par PC décroissants quand des scores diffèrent', () => {
    const twoValidated: CampaignParticipant[] = [
      { ...mockParticipants[0] },
      { ...mockParticipants[1], status: 'VALIDATED' },
    ];
    fixture.componentRef.setInput('participants', twoValidated);
    fixture.componentRef.setInput(
      'championshipPoints',
      new Map([
        [1, 5],
        [2, 10],
      ]),
    );
    fixture.detectChanges();

    const el = fixture.nativeElement as HTMLElement;
    const items = el.querySelectorAll('.participant-list__item');
    // Alice (10 PC) doit désormais passer devant Jean (5 PC)
    expect(items[0].textContent).toContain('Alice Martin');
    expect(items[1].textContent).toContain('Jean Dupont');
  });

  it('n\'affiche les PC (ligne atténuée) que pour les participants VALIDATED', () => {
    fixture.componentRef.setInput('participants', mockParticipants);
    fixture.componentRef.setInput('championshipPoints', new Map([[1, 5], [2, 5]]));
    fixture.detectChanges();

    const el = fixture.nativeElement as HTMLElement;
    const items = el.querySelectorAll('.participant-list__item');
    // items[0] = Jean (VALIDATED) → ligne "équipe · N PC"
    expect(items[0].querySelector('.participant-list__meta')?.textContent).toContain('5 PC');
    // items[1] = Alice (PENDING) → ligne "équipe · En attente", jamais de PC
    expect(items[1].querySelector('.participant-list__meta')?.textContent).not.toContain('PC');
  });

  // ── Lien "Gérer mon équipe" (construction / atelier / grisé) ─────────────

  it('pointe vers TeamEditPage quand la saison est EN_CONSTRUCTION', () => {
    fixture.componentRef.setInput('participants', mockParticipants);
    fixture.componentRef.setInput('currentUserId', 42); // Jean (items[0]), teamId 7
    fixture.componentRef.setInput('campaignId', 5);
    fixture.componentRef.setInput('campaignState', 'EN_CONSTRUCTION');
    fixture.detectChanges();

    const el = fixture.nativeElement as HTMLElement;
    const items = el.querySelectorAll('.participant-list__item');
    const link = items[0].querySelector('a.participant-list__icon-btn') as HTMLAnchorElement;
    expect(link).not.toBeNull();
    expect(link.getAttribute('href')).toBe('/teams/7/edit?from=campaign&campaignId=5');
    expect(items[0].querySelector('button.participant-list__icon-btn[disabled]')).toBeNull();
  });

  it('pointe vers l\'Atelier quand la saison est démarrée et qu\'une partie y est ouverte', () => {
    fixture.componentRef.setInput('participants', mockParticipants);
    fixture.componentRef.setInput('currentUserId', 42);
    fixture.componentRef.setInput('campaignId', 5);
    fixture.componentRef.setInput('campaignState', 'EN_COURS');
    fixture.componentRef.setInput('hasAtelierGame', true);
    fixture.detectChanges();

    const el = fixture.nativeElement as HTMLElement;
    const items = el.querySelectorAll('.participant-list__item');
    const link = items[0].querySelector('a.participant-list__icon-btn') as HTMLAnchorElement;
    expect(link).not.toBeNull();
    expect(link.getAttribute('href')).toBe('/campaigns/5/atelier');
  });

  it('affiche un bouton grisé (non cliquable) quand la saison est démarrée sans atelier ouvert', () => {
    fixture.componentRef.setInput('participants', mockParticipants);
    fixture.componentRef.setInput('currentUserId', 42);
    fixture.componentRef.setInput('campaignId', 5);
    fixture.componentRef.setInput('campaignState', 'EN_COURS');
    fixture.componentRef.setInput('hasAtelierGame', false);
    fixture.detectChanges();

    const el = fixture.nativeElement as HTMLElement;
    const items = el.querySelectorAll('.participant-list__item');
    expect(items[0].querySelector('a.participant-list__icon-btn')).toBeNull();
    const disabledBtn = items[0].querySelector('button.participant-list__icon-btn[disabled]');
    expect(disabledBtn).not.toBeNull();
  });

  // ── Historique complet d'un participant ──────────────────────────────────

  it('émet viewJournal(pid) au clic sur le bouton historique de sa propre ligne', () => {
    fixture.componentRef.setInput('participants', mockParticipants);
    fixture.componentRef.setInput('currentUserId', 42); // Jean, items[0]
    fixture.detectChanges();

    const emitted: number[] = [];
    outputToObservable(component.viewJournal).subscribe((pid) => emitted.push(pid));

    const el = fixture.nativeElement as HTMLElement;
    const items = el.querySelectorAll('.participant-list__item');
    const journalBtn = items[0].querySelector(
      'button.participant-list__icon-btn[title="Voir mon historique"]',
    ) as HTMLButtonElement;
    expect(journalBtn).not.toBeNull();
    journalBtn.click();
    expect(emitted).toEqual([1]);
  });

  it('émet viewJournal(pid) et ferme le menu au clic sur "Voir l\'historique" (autre participant)', () => {
    fixture.componentRef.setInput('participants', mockParticipants);
    fixture.componentRef.setInput('currentUserId', 99);
    fixture.detectChanges();

    const emitted: number[] = [];
    outputToObservable(component.viewJournal).subscribe((pid) => emitted.push(pid));

    const el = fixture.nativeElement as HTMLElement;
    const items = el.querySelectorAll('.participant-list__item');
    const trigger = items[1].querySelector('.participant-list__menu-trigger') as HTMLButtonElement;
    trigger.click();
    fixture.detectChanges();

    const historyBtn = findMenuButtonByLabel(items[1], 'Voir l\'historique');
    expect(historyBtn).not.toBeNull();
    historyBtn!.click();
    fixture.detectChanges();

    expect(emitted).toEqual([2]);
    expect(items[1].querySelector('.participant-list__menu')).toBeNull();
  });

  it('le menu ⋯ d\'un autre participant affiche les actions organisateur en plus de l\'historique quand isOrganizer', () => {
    fixture.componentRef.setInput('participants', mockParticipants);
    fixture.componentRef.setInput('isOrganizer', true);
    fixture.componentRef.setInput('currentUserId', 99);
    fixture.detectChanges();

    const el = fixture.nativeElement as HTMLElement;
    const items = el.querySelectorAll('.participant-list__item');
    const trigger = items[1].querySelector('.participant-list__menu-trigger') as HTMLButtonElement;
    trigger.click();
    fixture.detectChanges();

    expect(findMenuButtonByLabel(items[1], 'Retirer')).not.toBeNull();
    expect(findMenuButtonByLabel(items[1], 'Voir l\'historique')).not.toBeNull();
  });

  // ── Consultation en lecture seule de l'atelier d'un tiers ────────────────

  it('affiche "Voir l\'atelier" dans le menu ⋯ d\'un autre participant quand la campagne est démarrée', () => {
    fixture.componentRef.setInput('participants', mockParticipants);
    fixture.componentRef.setInput('currentUserId', 99);
    fixture.componentRef.setInput('campaignId', 5);
    fixture.componentRef.setInput('campaignState', 'EN_COURS');
    fixture.detectChanges();

    const el = fixture.nativeElement as HTMLElement;
    const items = el.querySelectorAll('.participant-list__item');
    const trigger = items[1].querySelector('.participant-list__menu-trigger') as HTMLButtonElement;
    trigger.click();
    fixture.detectChanges();

    // items[1] = Alice (id 2, teamId 8).
    const atelierLink = findMenuLinkByLabel(items[1], 'Voir l\'atelier');
    expect(atelierLink).not.toBeNull();
    expect(atelierLink!.getAttribute('href')).toBe('/campaigns/5/participants/2/atelier');
  });

  it('n\'affiche pas "Voir l\'atelier" tant que la campagne est EN_CONSTRUCTION', () => {
    fixture.componentRef.setInput('participants', mockParticipants);
    fixture.componentRef.setInput('currentUserId', 99);
    fixture.componentRef.setInput('campaignId', 5);
    fixture.componentRef.setInput('campaignState', 'EN_CONSTRUCTION');
    fixture.detectChanges();

    const el = fixture.nativeElement as HTMLElement;
    const items = el.querySelectorAll('.participant-list__item');
    const trigger = items[1].querySelector('.participant-list__menu-trigger') as HTMLButtonElement;
    trigger.click();
    fixture.detectChanges();

    expect(findMenuLinkByLabel(items[1], 'Voir l\'atelier')).toBeNull();
  });

  it('n\'affiche pas "Voir l\'atelier" pour un participant sans équipe engagée', () => {
    const withoutTeam: CampaignParticipant[] = [
      { ...mockParticipants[0] },
      { ...mockParticipants[1], teamId: null },
    ];
    fixture.componentRef.setInput('participants', withoutTeam);
    fixture.componentRef.setInput('currentUserId', 99);
    fixture.componentRef.setInput('campaignId', 5);
    fixture.componentRef.setInput('campaignState', 'EN_COURS');
    fixture.detectChanges();

    const el = fixture.nativeElement as HTMLElement;
    const items = el.querySelectorAll('.participant-list__item');
    const trigger = items[1].querySelector('.participant-list__menu-trigger') as HTMLButtonElement;
    trigger.click();
    fixture.detectChanges();

    expect(findMenuLinkByLabel(items[1], 'Voir l\'atelier')).toBeNull();
  });
});
