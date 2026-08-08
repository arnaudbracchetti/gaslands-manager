# Atelier

L'Atelier est la phase "garage" qui s'ouvre juste après avoir terminé
l'enregistrement d'une partie (dernière étape du
[Programme Télé](/documentation/programme-tele#table-des-epaves)). C'est là
que vous dépensez ce que la partie vous a rapporté : réparer, réarmer,
échanger des [Chocs contre une Séquelle](/documentation/sequelles).

## La phase Atelier

Un seul Atelier est ouvert à la fois par campagne. Si une nouvelle partie
entre en Atelier alors qu'une autre y était encore, l'ancienne se ferme
automatiquement — vous en êtes averti à l'écran. Une fois fermé, l'Atelier
d'une partie ne peut plus être rouvert.

## Exporter la fiche d'équipe

Tant qu'une partie est en Atelier, le bouton **📄 Fiche d'équipe** apparaît à
côté du bouton Atelier dans le Programme Télé — accessible à tout
participant. Il génère un document imprimable (A4) de votre équipe telle
qu'elle est réellement à ce moment de la campagne, Chocs et Séquelles
compris (contrairement à la fiche exportée depuis l'écran Équipes, réservée
aux équipes non engagées et qui ne connaît jamais ces deux informations).

## La cagnotte

Votre cagnotte correspond au budget non dépensé de votre équipe, augmenté
des récompenses gagnées en jouant. Ce budget de départ n'est plus celui que
vous avez choisi pour votre équipe : c'est le [budget de la
campagne](/documentation/campagnes#creer-ou-rejoindre-une-campagne), fixé par
l'organisateur, qui s'applique - le même pour toutes les équipes engagées.
La cagnotte diminue à chaque achat, augmente à chaque revente - vous n'avez
rien à calculer, le solde affiché en haut de l'écran est toujours à jour.

## Points de sabotage

Juste sous la cagnotte, un second compteur affiche vos Points de sabotage —
1 point pour 3 [Points de Résistance](/documentation/campagnes#points-de-resistance)
accumulés (arrondi à l'inférieur). Le total exact de Points de Résistance
reste secret ; seul ce compteur dérivé vous est montré, et seulement à vous —
un autre participant qui consulte votre atelier ne le voit jamais.

L'usage réel des Jetons de Sabotage pendant une partie physique reste
déclaratif, comme les Votes du Public : l'application se contente de compter
le solde accumulé entre deux parties, pas son emploi en cours de jeu.

## Acheter et vendre de l'équipement

Depuis la liste des véhicules de l'équipe, cliquez sur un véhicule pour
retrouver le même écran d'équipement que lors de la
[construction d'un véhicule](/documentation/construction-vehicule) : armes,
améliorations, avantages, et en plus les [Séquelles](/documentation/sequelles),
payées en Chocs plutôt qu'en jerricans. Vous pouvez également
[renommer le véhicule](/documentation/construction-vehicule#donner-un-nom-à-un-véhicule)
depuis ce même écran, y compris un véhicule tout juste acheté pendant cette
session — en dehors d'un Atelier ouvert, en revanche, le nom reste figé tant
que votre équipe est engagée dans une campagne en cours.

## Annuler un achat ou revendre : la différence

Retirer un équipement ne se comporte pas pareil selon son origine :

- **Acheté pendant la session d'Atelier en cours** : c'est une **annulation**
  — remboursement intégral, comme si l'achat n'avait jamais eu lieu.
- **Déjà présent avant cette session** (construit avec l'équipe, ou acheté
  lors d'un Atelier précédent déjà fermé) : c'est une **revente** — la
  moitié du prix pour une arme ou une amélioration, **rien du tout** pour un
  avantage (perte totale). L'objet reste visible, barré, avec un badge
  "Vendu(e)".

Le bouton s'adapte automatiquement ("Annuler l'achat" ou "Revendre pour N
jerricans") : vous n'avez pas à vous souvenir vous-même de quel cas
s'applique.

## Acheter ou vendre un véhicule entier

Le bouton **+ Ajouter un véhicule** permet d'acheter un nouveau véhicule
directement en Atelier, avec son équipement intégré éventuel appliqué
automatiquement. Chaque véhicule de la liste peut ensuite être vendu ou
son achat annulé, avec la même distinction que ci-dessus — vendre un
véhicule entier revend au passage chaque pièce d'équipement encore active
dessus.

## Limites actuelles

- Un achat en Atelier n'est aujourd'hui bloqué que si la cagnotte est
  insuffisante : les emplacements disponibles, l'arc de tir requis ou
  l'autorisation du sponsor ne sont pas revérifiés à l'achat (contrairement
  à la construction d'équipe) — restez cohérent avec les règles vous-même.
- La limite de 8 véhicules par équipe n'est pas encore appliquée ici.
- Annuler un achat qui rendait possible un achat suivant dans la même
  session (par exemple retirer une remorque après avoir monté une arme dans
  l'emplacement qu'elle apportait) n'est pas détecté : le véhicule peut se
  retrouver en dépassement sans avertissement.
