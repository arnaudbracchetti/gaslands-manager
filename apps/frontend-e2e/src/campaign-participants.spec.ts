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
  test('invitation par code, copie, rejoint puis validé', async ({ page, context, browser }) => {
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
    // la permission est accordée — cf. invite-link.ts, copyCode().
    await context.grantPermissions(['clipboard-write'], { origin: 'http://localhost:4200' });
    await page.locator('.invite-link__copy').click();
    await expect(page.locator('.invite-link__copy')).toHaveText('✅ Copié !');

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

    // Côté organisateur : la ligne du participant devient "▲ Participant" (plus "En attente").
    const joineeRow = page.locator('.participant-list__item').filter({ hasText: 'Max' });
    await expect(joineeRow.locator('.participant-list__badge--pending')).toHaveCount(0);
    await expect(joineeRow.locator('.participant-list__badge')).toHaveText('▲ Participant');

    // Côté invité : sa propre ligne, après rechargement, montre le même statut.
    await joineePage.goto(`/campaigns/${campaignId}`);
    const ownRow = joineePage.locator('.participant-list__item').filter({ hasText: 'Max' });
    await expect(ownRow.locator('.participant-list__badge')).toHaveText('▲ Participant');

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

    // ── Refus : badge "Refusé", et "Valider" réapparaît (canRevalidate) ─────
    const rejectedRow = page.locator('.participant-list__item').filter({ hasText: 'Nux' });
    await expect(rejectedRow.locator('.participant-list__badge--rejected')).toHaveText('Refusé');
    await expect(rejectedRow.getByRole('button', { name: 'Valider' })).toBeVisible();

    // ── Promotion co-organisateur ────────────────────────────────────────────
    const promotedRow = page.locator('.participant-list__item').filter({ hasText: 'Toast' });
    await promotedRow.getByRole('button', { name: 'Promouvoir' }).click();
    const promoteDialog = page.getByRole('dialog', { name: 'Promouvoir "Toast Cadette" co-organisateur ?' });
    await expect(promoteDialog).toBeVisible();
    const promoteResponse = page.waitForResponse(
      (r) => r.request().method() === 'PUT' && /\/api\/campaigns\/\d+\/participants\/\d+\/promote$/.test(r.url()),
    );
    await promoteDialog.getByRole('button', { name: 'Promouvoir', exact: true }).click();
    await promoteResponse;

    await expect(promotedRow.locator('.participant-list__badge--organizer')).toHaveText('★ Organisateur');

    // Côté fraîchement promu : après rechargement, il voit sa propre ligne
    // "★ Organisateur" et accède aux fonctionnalités d'organisateur (lien
    // d'invitation, réservé à `isOrganizer()`).
    await validatedPage.goto(`/campaigns/${campaignId}`);
    await expect(validatedPage.locator('.campaign-detail-role-badge')).toHaveText('🏆 Organisateur');
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
    const removedRow = page.locator('.participant-list__item').filter({ hasText: 'Slit' });
    await removedRow.getByRole('button', { name: 'Retirer' }).click();
    const removeDialog = page.getByRole('dialog', { name: 'Retirer "Slit Retire" de la saison ?' });
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

    const ownRow = page.locator('.participant-list__item').filter({ hasText: organizerTeam }).first();
    await expect(ownRow.locator('.participant-list__change-team')).toBeVisible();
    await ownRow.locator('.participant-list__change-team').click();

    const changeTeamModal = page.getByRole('dialog', { name: 'Choisir votre équipe' });
    await expect(changeTeamModal).toBeVisible();

    // Cas négatif : "Annuler" ne change rien.
    await changeTeamModal.locator('.ctm-modal__select').selectOption({ label: secondTeamName });
    await changeTeamModal.locator('.ctm-modal__cancel').click();
    await expect(changeTeamModal).toHaveCount(0);
    await expect(page.locator('.participant-list__item').filter({ hasText: organizerTeam })).toHaveCount(1);

    // Cas positif : "Valider" applique le changement.
    await ownRow.locator('.participant-list__change-team').click();
    await page.getByRole('dialog', { name: 'Choisir votre équipe' })
      .locator('.ctm-modal__select').selectOption({ label: secondTeamName });
    const changeTeamResponse = page.waitForResponse(
      (r) => r.request().method() === 'PUT' && /\/api\/campaigns\/\d+\/participants\/me$/.test(r.url()),
    );
    await page.getByRole('dialog', { name: 'Choisir votre équipe' })
      .locator('.ctm-modal__confirm').click();
    await changeTeamResponse;

    await expect(page.locator('.participant-list__item').filter({ hasText: secondTeamName })).toHaveCount(1);
    await expect(page.locator('.participant-list__item').filter({ hasText: organizerTeam })).toHaveCount(0);
  });
});
