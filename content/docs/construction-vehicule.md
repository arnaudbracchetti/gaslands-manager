# Construire et équiper un véhicule

Une fois une [équipe](/documentation/equipes) créée, chaque véhicule se
construit en deux temps : choisir son châssis, puis l'équiper.

## Choisir un véhicule

Le bouton **+ Ajouter un véhicule** propose la liste des véhicules autorisés
par le sponsor de l'équipe (certains véhicules, comme l'Hélicoptère ou le
Char d'assaut, sont exclusifs à un sponsor). Le véhicule est acheté "nu" et
son coût est immédiatement décompté du budget de l'équipe.

## Donner un nom à un véhicule

En plus de son type (Buggy, Camion, Monster Truck...), chaque véhicule peut
recevoir un nom propre — par défaut, il porte simplement le nom de son type.
Le champ en tête de l'écran d'équipement est modifiable à tout moment : il
suffit de cliquer dedans, taper un nouveau nom, puis cliquer ailleurs pour
l'enregistrer. Partout où l'application affiche ce véhicule (fiche d'équipe,
atelier de campagne, résolution de partie), le nom personnalisé apparaît
suivi du type entre parenthèses — par exemple **"La Teigne (Buggy)"** — sauf
si le véhicule n'a jamais été renommé, auquel cas seul le type est affiché.

## Le budget de l'équipement

L'écran d'équipement affiche en permanence le budget de l'équipe (jerricans
utilisés / total, barre de progression, solde restant) — ce budget est
partagé entre **tous** les véhicules de l'équipe, pas seulement celui en
cours d'édition. Toute arme, amélioration ou avantage dont le prix dépasse
le solde restant est grisé et indisponible à l'achat.

Chaque véhicule a aussi son propre nombre d'**emplacements** : armes et
améliorations en consomment (une jauge dédiée l'indique), les avantages
n'en consomment jamais.

## Armes

Cliquer sur une arme du catalogue ouvre une popup avec sa description
complète (règles, coût, emplacement). L'ajouter au véhicule se fait avec le
bouton **+** de sa carte.

La plupart des armes demandent de choisir un **arc de tir** (avant, arrière
ou latéral) — les armes d'équipage tirent automatiquement à 360° sans
qu'il soit nécessaire de choisir. Les armes marquées compatibles peuvent
aussi être montées **sur Tourelle** (bouton dédié, arc à 360°) : ce montage
**triple le coût** de l'arme. Pour changer l'arme montée sur une Tourelle,
il faut d'abord retirer l'arme actuelle puis en acheter une nouvelle avec ce
même bouton — il n'existe pas d'action "réassigner" séparée.

## Améliorations

Les améliorations modifient les caractéristiques du véhicule (blindage,
maniabilité, emplacements supplémentaires...). Certaines demandent une
orientation (le Bélier, par exemple), la plupart non. Deux véhicules ne
peuvent porter qu'une seule remorque à la fois (Remorque Moyenne et Remorque
Lourde s'excluent mutuellement).

## Avantages

Les avantages forment une quatrième catégorie d'équipement, distincte des
armes et améliorations : ils **ne consomment jamais d'emplacement**, ne
demandent **jamais d'orientation**, et un même avantage ne peut être acheté
**qu'une seule fois** par véhicule. Votre sponsor donne accès à deux des
douze catégories de style (Agression, Audace, Dur à Cuire, Précision...) —
les avantages disponibles sont présentés en deux listes, une par catégorie.

La plupart des avantages sont purement descriptifs (ils justifient une
règle que vous appliquez vous-même en jouant). Trois d'entre eux ont un
effet chiffré directement pris en compte par l'application : **Expertise**
(+1 Maniabilité), **Cascadeur** et **Sur Deux Roues** (tous deux réservés
aux véhicules dont la Maniabilité effective atteint un certain seuil).

## Équipement intégré

Certains véhicules ont un équipement fourni d'office, gratuit et non
retirable — par exemple les Arceaux du Buggy, ou le Canon de 125mm monté sur
Tourelle du Char d'assaut. Il est signalé par un badge **🔒 Intégré** et
n'entre ni dans le calcul du budget, ni dans celui des emplacements.

## Modifier ou retirer un équipement

Chaque ligne d'équipement monté propose un bouton de retrait. En
construction d'équipe, retirer une arme ou une amélioration achetée par
erreur ne rembourse rien de spécial : elle est simplement supprimée (le
budget redevient disponible). Cette logique est différente une fois
l'équipe engagée en campagne — voir [Atelier](/documentation/atelier), qui
distingue annulation et revente.
