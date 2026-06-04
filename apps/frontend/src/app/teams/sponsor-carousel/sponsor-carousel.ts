/**
 * SponsorCarousel — carousel de sélection du sponsor d'une équipe Gaslands.
 *
 * Ce composant "dumb" affiche un carousel interactif permettant de naviguer
 * parmi les sponsors du jeu et d'en sélectionner un. Il ne contacte jamais l'API :
 * le parent (TeamForm) lui fournit la liste de sponsors et le sponsor sélectionné.
 *
 * Architecture :
 *   - Input `sponsors`        : liste des sponsors chargée par TeamForm
 *   - Input `selectedSponsor` : nom du sponsor actuellement sélectionné
 *   - Input `locked`          : si true, la navigation est désactivée
 *                               (équipe ayant déjà des véhicules)
 *   - Output `sponsorChange`  : émis avec le nom du nouveau sponsor sélectionné
 *
 * Chaque carte affiche :
 *   - Nom du sponsor (majuscules, rouge)
 *   - Description courte (italique grise)
 *   - Badges des classes d'avantage
 *   - Avantages sponsorisés (markdown converti en HTML via marked)
 *
 * Le markdown est converti côté client via la librairie `marked` (déjà installée).
 * DomSanitizer.bypassSecurityTrustHtml() est utilisé car le contenu vient du catalogue
 * interne du jeu (non modifiable par l'utilisateur) — pas de risque XSS.
 */
import {
  Component,
  InputSignal,
  OnInit,
  OutputEmitterRef,
  Signal,
  WritableSignal,
  computed,
  effect,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { NgClass } from '@angular/common';
import { marked } from 'marked';
import { SponsorInfo } from '../team.model';

@Component({
  selector: 'app-sponsor-carousel',
  standalone: true,
  // NgClass : utilisé pour conditionner la classe .locked sur la carte sponsor
  imports: [NgClass],
  templateUrl: './sponsor-carousel.html',
  styleUrl: './sponsor-carousel.scss',
})
export class SponsorCarousel implements OnInit {
  private sanitizer: DomSanitizer = inject(DomSanitizer);

  // ── Inputs ──────────────────────────────────────────────────────────────────

  /** Liste complète des sponsors (fournie par TeamForm après chargement de l'API) */
  sponsors: InputSignal<SponsorInfo[]> = input<SponsorInfo[]>([]);

  /** Nom du sponsor actuellement sélectionné (synchronisé depuis le formulaire parent) */
  selectedSponsor: InputSignal<string> = input<string>('');

  /**
   * Si true, la navigation est désactivée et un badge de verrouillage est affiché.
   * Activé quand l'équipe possède au moins un véhicule (sponsor immutable à ce stade).
   */
  locked: InputSignal<boolean> = input<boolean>(false);

  // ── Output ──────────────────────────────────────────────────────────────────

  /**
   * Émis avec le nom du sponsor chaque fois que l'utilisateur change de page.
   * Le parent met à jour son signal formSponsor avec cette valeur.
   */
  sponsorChange: OutputEmitterRef<string> = output<string>();

  // ── État interne ─────────────────────────────────────────────────────────────

  /** Index du sponsor actuellement affiché dans le carousel (0-based) */
  currentIndex: WritableSignal<number> = signal(0);

  /**
   * Sponsor affiché, dérivé de currentIndex.
   * Signal<SponsorInfo | null> : computed() retourne un Signal en lecture seule.
   */
  currentSponsor: Signal<SponsorInfo | null> = computed(
    (): SponsorInfo | null => this.sponsors()[this.currentIndex()] ?? null,
  );

  /**
   * Avantages sponsorisés convertis depuis markdown vers HTML sanitisé.
   * Calculé automatiquement quand currentSponsor change.
   * SafeHtml : type Angular indiquant que ce contenu a été approuvé pour [innerHTML].
   */
  currentHtml: Signal<SafeHtml | null> = computed((): SafeHtml | null => {
    const sponsor = this.currentSponsor();
    if (!sponsor) return null;

    // marked.parse() convertit le markdown en HTML (synchrone par défaut en v18).
    // Le cast en string est nécessaire car le type retourné est `string | Promise<string>`.
    const html = marked.parse(sponsor.avantages_sponsorises) as string;

    // bypassSecurityTrustHtml : contenu issu du catalogue interne (non saisi par l'utilisateur)
    // → pas de risque XSS. Angular bloquerait certaines balises sans ce bypass.
    return this.sanitizer.bypassSecurityTrustHtml(html);
  });

  /** Libellé de position pour l'accessibilité et l'affichage : "3 / 13" */
  positionLabel: Signal<string> = computed(
    (): string => `${this.currentIndex() + 1} / ${this.sponsors().length}`,
  );

  constructor() {
    /**
     * effect() : synchronise l'index affiché quand le sponsor sélectionné change.
     *
     * Cas d'usage :
     *   1. Création → selectedSponsor = 'Rutherford' (valeur par défaut)
     *   2. Édition → selectedSponsor = sponsor de l'équipe existante
     *
     * On cherche l'index correspondant dans la liste et on positionne le carousel dessus.
     * Si le sponsor n'est pas trouvé (données incohérentes), on reste à l'index 0.
     */
    effect((): void => {
      const selected = this.selectedSponsor();
      const list = this.sponsors();
      if (!list.length) return;

      const idx = list.findIndex((s: SponsorInfo): boolean => s.nom === selected);
      this.currentIndex.set(idx !== -1 ? idx : 0);
    });
  }

  ngOnInit(): void {
    // L'initialisation est gérée par l'effect() dans le constructeur.
    // ngOnInit est ici pour respecter l'interface OnInit (explicite = lisible).
  }

  // ── Navigation ───────────────────────────────────────────────────────────────

  /** Passe au sponsor précédent (navigation circulaire : 0 → dernier si on est au début) */
  prev(): void {
    if (this.locked()) return;
    const len = this.sponsors().length;
    if (!len) return;
    this.currentIndex.update((i: number): number => (i - 1 + len) % len);
    this.emitChange();
  }

  /** Passe au sponsor suivant (navigation circulaire : dernier → 0 si on est à la fin) */
  next(): void {
    if (this.locked()) return;
    const len = this.sponsors().length;
    if (!len) return;
    this.currentIndex.update((i: number): number => (i + 1) % len);
    this.emitChange();
  }

  /** Navigue directement à un index donné (utilisé par les dots de navigation) */
  goTo(index: number): void {
    if (this.locked()) return;
    this.currentIndex.set(index);
    this.emitChange();
  }

  // ── Méthode privée ───────────────────────────────────────────────────────────

  /** Émet le nom du sponsor courant vers le composant parent */
  private emitChange(): void {
    const sponsor = this.sponsors()[this.currentIndex()];
    if (sponsor) {
      this.sponsorChange.emit(sponsor.nom);
    }
  }
}
