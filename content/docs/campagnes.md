# Campagnes

Une campagne est une "ligue" : plusieurs équipes, chacune appartenant à un
joueur différent, qui jouent ensemble plusieurs parties dans la durée. C'est
le mode qui donne accès au [Programme Télé](/documentation/programme-tele),
à l'[Atelier](/documentation/atelier) et aux [Séquelles](/documentation/sequelles)
— aucune de ces mécaniques n'existe en dehors d'une campagne.

## Créer ou rejoindre une campagne

Créer une campagne vous en fait automatiquement l'**organisateur**. À la
création, vous fixez aussi le **budget en jerricans** de la campagne (50 par
défaut) : cette valeur remplace le budget de chaque équipe engagée pour toute
la durée de la campagne, y compris la cagnotte de l'[Atelier](/documentation/atelier).
Vous pouvez ensuite partager le **code d'invitation** de la campagne : toute
personne qui le possède peut soumettre une demande d'inscription en
choisissant l'une de ses [équipes](/documentation/equipes) - seules celles dont
le coût total tient dans le budget de la campagne sont proposées, les autres
apparaissent grisées ("hors budget"). Un utilisateur ne peut engager qu'une
seule équipe par campagne à la fois (mais peut en changer tant que la
campagne n'a pas démarré, voir plus bas - la nouvelle équipe doit elle aussi
tenir dans le budget). Tant que la campagne est encore en construction,
l'organisateur peut modifier son nom et son budget depuis le bouton
"✏️ Modifier" de l'écran de la campagne - une baisse du budget est refusée si
elle rendrait une équipe déjà engagée hors budget.

## Rôles : organisateur et participant

L'organisateur valide ou refuse chaque demande d'inscription, gère le
Programme Télé, enregistre les résultats de partie et peut promouvoir un
autre participant co-organisateur. Un participant "en attente" ou "refusé"
ne voit pas les autres demandes en cours — seuls les organisateurs ont
cette visibilité.

Refuser un participant déjà validé est réversible (il peut être revalidé
plus tard) ; le retirer définitivement de la campagne ne l'est pas.

## Cycle de vie d'une campagne

Une campagne traverse trois états, dans cet ordre, sans retour en arrière :

1. **En construction** — inscriptions libres, chaque participant peut
   changer l'équipe qu'il engage, le Programme Télé peut être préparé.
2. **En cours** — les parties se jouent, les résultats s'enregistrent,
   l'équipe engagée par chacun est verrouillée.
3. **Terminée** — tout redevient lecture seule (Programme Télé compris) ;
   l'Atelier encore ouvert, s'il y en avait un, se ferme automatiquement.

## Changer d'équipe engagée

Tant que la campagne est *En construction*, chaque participant peut changer
l'équipe qu'il engage parmi ses propres équipes, depuis le sélecteur "Votre
équipe" de l'écran de la campagne. Cela devient impossible dès que la
campagne passe *En cours*.

## Classement

Le classement affiche chaque participant validé avec ses **Points de
Championnat** cumulés (10/5/2/1 selon le rang à chaque partie, plus des
points d'exploit — portes franchies, véhicules ennemis détruits). Il se met
à jour après chaque partie enregistrée via le
[Programme Télé](/documentation/programme-tele).

## Points de Résistance

Une mécanique discrète : tout participant qui termine hors du haut du
classement d'une partie reçoit automatiquement des Points de Résistance.
Le total exact reste volontairement **secret** — personne, pas même vous, ne
peut le consulter directement. Il alimente toutefois un compteur dérivé
visible dans votre [Atelier](/documentation/atelier#points-de-sabotage), les
Points de sabotage.
