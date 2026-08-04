import { test, expect } from '@playwright/test';
import { registerTestUser, uniqueEmail } from './support/auth';
import { createTeam, createTeamWithVehicles } from './support/teams';
import { createCampaign, inviteAndValidateParticipant } from './support/campaigns';

/**
 * Gestion multi-participants d'une saison — invitation par code, validation,
 * refus, promotion, retrait, changement d'équipe. Aucun test existant
 * n'impliquait plus d'un utilisateur avant ce fichier (`inviteAndValidateParticipant`,
 * `support/campaigns.ts`, pilote un second contexte navigateur).
 */
test.describe('Campagnes — Gestion des participants', () => {
  test('invitation par code, copie, rejoint puis validé', async ({ page, context, browser, browserName }) => {
    await registerTestUser(page, {
      firstName: 'Furiosa',
      lastName: 'Organisatrice',
      email: uniqueEmail('e2e-participants-join'),
      password: 'test1234',
    });

    const organizerTeam = 'Escouade Organisatrice';
    await createTeam(page, organizerTeam);
    const campaignId = await createCampaign(page, { name: 'Saison E2E Invitation', teamName: organizerTeam });

    await expect(page.locator('.invite-link__code')).not.toHaveText('');

    // navigator.clipboard.writeText ne résout (et ne bascule `copied`) que si
    // la permission est accordée — cf. invite-link.ts, copyCode(). L'origine doit être
    // celle réellement servie (FRONTEND_PORT, cf. playwright.config.ts) — jamais
    // supposer 4200 en dur : ce spec tourne aussi sur le port dédié 4201 (ports
    // auto-gérés, cf. skill e2e-testing/RUNNING.md), où un mismatch d'origine fait
    // échouer silencieusement `writeText()` (NotAllowedError, jamais catché).
    // Firefox et WebKit n'ont pas cette permission dans leur modèle :
    // `grantPermissions` lève "Unknown permission: clipboard-write" sur les
    // deux (limitation du driver Playwright pour ces moteurs, pas un bug
    // applicatif - seul Chromium l'accepte) - le comportement de copie n'est
    // donc vérifié que sur Chromium.
    if (browserName === 'chromium') {
      await context.grantPermissions(['clipboard-write'], { origin: new URL(page.url()).origin });
      await page.locator('.invite-link__copy').click();
      // Depuis la migration des émojis vers des icônes SVG (invite-link.html),
      // le texte du bouton n'a plus de préfixe "✅" - seule l'icône le porte.
      await expect(page.locator('.invite-link__copy')).toHaveText('Copié !');
    }

    const joineeTeam = 'Escouade Invitée';
    const { joineeContext, joineePage } = await inviteAndValidateParticipant(page, browser, {
      joineeUser: {
        firstName: 'Max',
        lastName: 'Rockatansky',
        email: uniqueEmail('e2e-participants-joinee'),
        password: 'test1234',
      },
      joineeTeamName: joineeTeam,
    });

    // Côté organisateur : la ligne du participant n'est plus "En attente" - la
    // ligne 2 atténuée (participant-list.ts, metaText()) passe à "équipe · N PC".
    const joineeRow = page.locator('.participant-list__item').filter({ hasText: 'Max' });
    await expect(joineeRow.locator('.participant-list__meta')).not.toContainText('En attente');
    await expect(joineeRow.locator('.participant-list__meta')).toContainText('PC');

    // Côté invité : sa propre ligne, après rechargement, montre le même statut.
    await joineePage.goto(`/campaigns/${campaignId}`);
    const ownRow = joineePage.locator('.participant-list__item').filter({ hasText: 'Max' });
    await expect(ownRow.locator('.participant-list__meta')).toContainText('PC');

    await joineeContext.close();
  });

  test('refus puis re-validation, promotion co-organisateur', async ({ page, browser }) => {
    await registerTestUser(page, {
      firstName: 'Furiosa',
      lastName: 'Organisatrice',
      email: uniqueEmail('e2e-participants-reject'),
      password: 'test1234',
    });

    const organizerTeam = 'Escouade Promotrice';
    await createTeam(page, organizerTeam);
    const campaignId = await createCampaign(page, { name: 'Saison E2E Refus Promotion', teamName: organizerTeam });

    const { joineePage: validatedPage } = await inviteAndValidateParticipant(page, browser, {
      joineeUser: {
        firstName: 'Toast',
        lastName: 'Cadette',
        email: uniqueEmail('e2e-participants-validated'),
        password: 'test1234',
      },
      joineeTeamName: 'Escouade à Promouvoir',
    });

    const { joineeContext: rejectedContext } = await inviteAndValidateParticipant(page, browser, {
      joineeUser: {
        firstName: 'Nux',
        lastName: 'Rejete',
        email: uniqueEmail('e2e-participants-rejected'),
        password: 'test1234',
      },
      joineeTeamName: 'Escouade Refusée',
      accept: false,
    });

    // ── Refus : statut "Refusé" (ligne 2 atténuée), et "Valider" réapparaît (canRevalidate) ─
    const rejectedRow = page.locator('.participant-list__item').filter({ hasText: 'Nux' });
    await expect(rejectedRow.locator('.participant-list__meta')).toContainText('Refusé');
    await expect(rejectedRow.getByRole('button', { name: 'Valider' })).toBeVisible();

    // ── Promotion co-organisateur ────────────────────────────────────────────
    // Depuis la refonte en cartes compactes, "Promouvoir" n'est plus un bouton
    // inline mais une entrée du menu "⋯" (participant-list.html).
    const promotedRow = page.locator('.participant-list__item').filter({ hasText: 'Toast' });
    await promotedRow.getByRole('button', { name: 'Plus d\'actions' }).click();
    // Rendu via Angular CDK Overlay (participant-list.html) - le contenu du
    // menu vit dans le conteneur global attaché à <body>, plus dans le
    // sous-arbre DOM de `promotedRow` : recherche non scopée à la ligne.
    await page.getByRole('menuitem', { name: 'Promouvoir' }).click();
    // Le message affiche `participant.userName`, résolu depuis `User.callName`
    // (le pseudo, cf. spec/AUTH.md - jamais prénom+nom) - `registerTestUser`
    // remplit le pseudo avec le prénom par défaut, donc "Toast" seul ici.
    const promoteDialog = page.getByRole('dialog', { name: 'Promouvoir "Toast" co-organisateur ?' });
    await expect(promoteDialog).toBeVisible();
    const promoteResponse = page.waitForResponse(
      (r) => r.request().method() === 'PUT' && /\/api\/campaigns\/\d+\/participants\/\d+\/promote$/.test(r.url()),
    );
    await promoteDialog.getByRole('button', { name: 'Promouvoir', exact: true }).click();
    await promoteResponse;

    // Le badge organisateur est désormais une icône (pas de texte dédié) -
    // cf. `.participant-list__organizer-badge`, participant-list.html.
    await expect(promotedRow.locator('.participant-list__organizer-badge')).toBeVisible();

    // Côté fraîchement promu : après rechargement, il voit sa propre ligne
    // "Organisateur" (icône + texte, plus de préfixe "🏆" depuis la migration
    // des émojis vers des icônes SVG) et accède aux fonctionnalités
    // d'organisateur (lien d'invitation, réservé à `isOrganizer()`).
    await validatedPage.goto(`/campaigns/${campaignId}`);
    await expect(validatedPage.locator('.campaign-detail-role-badge')).toHaveText('Organisateur');
    await expect(validatedPage.locator('.invite-link__code')).toBeVisible();

    await rejectedContext.close();
  });

  test('retrait d\'un participant, changement d\'équipe sur sa propre ligne', async ({ page, browser }) => {
    await registerTestUser(page, {
      firstName: 'Furiosa',
      lastName: 'Organisatrice',
      email: uniqueEmail('e2e-participants-remove'),
      password: 'test1234',
    });

    const organizerTeam = 'Escouade Principale';
    await createTeamWithVehicles(page, { name: organizerTeam, vehicleNames: ['Camion à glaces'] });
    const campaignId = await createCampaign(page, { name: 'Saison E2E Retrait ChangeTeam', teamName: organizerTeam });

    const { joineeContext } = await inviteAndValidateParticipant(page, browser, {
      joineeUser: {
        firstName: 'Slit',
        lastName: 'Retire',
        email: uniqueEmail('e2e-participants-toremove'),
        password: 'test1234',
      },
      joineeTeamName: 'Escouade Éphémère',
    });

    // ── Retrait définitif ────────────────────────────────────────────────────
    // "Retirer" est désormais une entrée du menu "⋯" (cf. Promotion ci-dessus).
    const removedRow = page.locator('.participant-list__item').filter({ hasText: 'Slit' });
    await removedRow.getByRole('button', { name: 'Plus d\'actions' }).click();
    // Menu rendu via CDK Overlay dans <body>, hors du sous-arbre de la ligne
    // (cf. commentaire équivalent pour "Promouvoir" ci-dessus).
    await page.getByRole('menuitem', { name: 'Retirer' }).click();
    // Même règle que la modale de promotion ci-dessus : userName = callName
    // (pseudo, "Slit" seul - cf. spec/AUTH.md), pas prénom+nom.
    const removeDialog = page.getByRole('dialog', { name: 'Retirer "Slit" de la saison ?' });
    await expect(removeDialog).toBeVisible();
    const removeResponse = page.waitForResponse(
      (r) => r.request().method() === 'DELETE' && /\/api\/campaigns\/\d+\/participants\/\d+$/.test(r.url()),
    );
    await removeDialog.getByRole('button', { name: 'Retirer', exact: true }).click();
    await removeResponse;
    await expect(page.locator('.participant-list__item').filter({ hasText: 'Slit' })).toHaveCount(0);

    await joineeContext.close();

    // ── Changement d'équipe sur sa propre ligne (organisateur) ──────────────
    const secondTeamName = 'Escouade de Secours';
    await createTeam(page, secondTeamName);
    await page.goto(`/campaigns/${campaignId}`);

    // Depuis la refonte en cartes compactes, "Changer d'équipe" est un bouton
    // icône sans classe dédiée - ciblé par son nom accessible (title/aria-label).
    const ownRow = page.locator('.participant-list__item').filter({ hasText: organizerTeam }).first();
    const changeTeamButton = ownRow.getByRole('button', { name: 'Changer d\'équipe' });
    await expect(changeTeamButton).toBeVisible();
    await changeTeamButton.click();

    const changeTeamModal = page.getByRole('dialog', { name: 'Choisir votre équipe' });
    await expect(changeTeamModal).toBeVisible();

    // Cas négatif : "Annuler" ne change rien.
    await changeTeamModal.locator('.ctm-modal__select').selectOption({ label: secondTeamName });
    await changeTeamModal.locator('.ms-modal__cancel').click();
    await expect(changeTeamModal).toHaveCount(0);
    await expect(page.locator('.participant-list__item').filter({ hasText: organizerTeam })).toHaveCount(1);

    // Cas positif : "Valider" applique le changement.
    await changeTeamButton.click();
    await page.getByRole('dialog', { name: 'Choisir votre équipe' })
      .locator('.ctm-modal__select').selectOption({ label: secondTeamName });
    const changeTeamResponse = page.waitForResponse(
      (r) => r.request().method() === 'PUT' && /\/api\/campaigns\/\d+\/participants\/me$/.test(r.url()),
    );
    await page.getByRole('dialog', { name: 'Choisir votre équipe' })
      .locator('.ms-modal__confirm').click();
    await changeTeamResponse;

    await expect(page.locator('.participant-list__item').filter({ hasText: secondTeamName })).toHaveCount(1);
    await expect(page.locator('.participant-list__item').filter({ hasText: organizerTeam })).toHaveCount(0);
  });
});
