# Programme Télé

Le Programme Télé est la liste des parties d'une [campagne](/documentation/campagnes)
: l'organisateur y planifie les parties à venir, puis y enregistre leur
résultat une fois jouées. Il reste visible par tous les participants dans
tous les états de la campagne (lecture seule une fois celle-ci *Terminée*).

## Planifier une partie

Chaque partie planifiée s'appuie sur un **scénario** du catalogue (Événement
Télévisé ou Escarmouche), qui détermine son type. Une nouvelle partie est
ajoutée en fin de programme, avec le statut *Planifiée*.

## Modifier ou supprimer une partie planifiée

Possible tant que la partie n'a pas encore été jouée. Une fois son résultat
enregistré, une partie est figée : elle ne peut plus être ni modifiée ni
supprimée.

## Enregistrer un résultat : un déroulé à étapes variables

Cliquer sur **Enregistrer résultat** sur une partie planifiée ouvre un
parcours dont les écrans dépendent du type de partie (Événement Télévisé ou
Escarmouche) et du scénario choisi :

### 1. Présence

Cochez les équipes présentes à la partie. Toujours le premier écran, quel
que soit le type de partie. Au moins deux équipes doivent être cochées pour
continuer — impossible d'enregistrer une partie à un seul participant.

### 2. Classement (Événement Télévisé uniquement)

Classez les équipes présentes par glisser-déposer. Absent pour une
Escarmouche, qui n'attribue jamais de Point de Championnat de classement.

### 3. Portes franchies (Événement Télévisé, si le scénario en comporte)

Indiquez pour chaque équipe classée le nombre de portes franchies (+1 Point
de Championnat par porte). N'apparaît que pour les scénarios qui comportent
des portes (ex. la Course à la Mort) — absent sinon.

### 4. Jerricans (si le scénario en propose)

Saisissez le butin de jerricans ramassé par chaque équipe présente, pour les
scénarios qui en proposent (ex. un pillage de convoi). Indépendant du revenu
de base d'une Escarmouche (voir plus bas), qui s'y ajoute.

### 5. Désignation des épaves

Pour chaque véhicule des équipes présentes, indiquez s'il est resté intact,
s'il a été détruit par un adversaire précis, ou s'il est mis en épave seul.
Pour un Événement Télévisé, désigner un destructeur lui crédite des Points
de Championnat selon le poids du véhicule détruit, et c'est ici que se coche
le "Favori du public" éventuel de la partie précédente ; pour une
Escarmouche, la destruction reste tracée dans le [Journal de
partie](#le-journal-de-partie) mais ne rapporte aucun point.

### 6. Résolution

Dès l'arrivée sur ce dernier écran, tout se résout automatiquement, sans
rien à sélectionner vous-même :

- **Revenu de base** (Escarmouche uniquement) : chaque équipe présente
  reçoit un tirage de dé, dont le résultat détermine son gain de jerricans —
  cumulable avec le butin de scénario saisi à l'étape 4.
- **Table des Épaves** : chaque véhicule désigné à l'étape précédente reçoit
  un tirage aléatoire (un dé virtuel par véhicule, résultat affiché dès
  qu'il est tiré). Selon le résultat, un véhicule peut ressortir indemne,
  cabossé, perdre une arme ou une amélioration, voire être détruit — et
  gagne des [Chocs](/documentation/sequelles) en conséquence.

Le bouton **Terminer** s'active une fois tous les tirages reçus : il
enregistre définitivement le résultat et ouvre l'[Atelier](/documentation/atelier)
de cette partie.

Tant que vous n'avez pas atteint l'écran Résolution, rien n'est encore
enregistré : **Précédent** et **Annuler** restent libres à tout moment, sans
perte de données côté serveur. Une fois sur l'écran Résolution, **Annuler**
reste possible et défait tout ce qui a déjà été tiré (classement, exploits,
revenus, épaves) ; **Précédent** n'est en revanche plus disponible à ce
stade.

## Le Journal de partie

Pour toute partie déjà passée en Atelier ou Jouée, le bouton **Journal**
liste, groupés par participant, tous les événements qui lui sont arrivés :
classement, exploits, revenus, tirages de la Table des Épaves, achats et
reventes en Atelier. Accessible à tout participant validé de la campagne,
même s'il n'a pas participé à cette partie précise.
