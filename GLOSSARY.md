# Gaslands Manager

Gestion d'équipes et de campagnes pour le jeu de plateau Gaslands : construction des véhicules, puis suivi de leur évolution partie après partie en mode campagne.

## Language

### Équipement et coûts

**Jerrican** :
Unité de prix de tout ce qui s'achète pour une équipe (véhicules, armes, améliorations, avantages).
_Avoid_: canette, crédit

**Emplacement** :
Unité de capacité d'un véhicule, consommée par les armes et améliorations montées.
_Avoid_: slot

**Équipement gratuit** :
Arme, amélioration ou avantage qui coûte 0 jerrican **et** 0 emplacement au catalogue (aujourd'hui : Pistolet, Remorque de Transport). Un équipement obtenu sans payer mais dont le prix catalogue n'est pas nul (avantage de Dur à Cuire) n'est pas gratuit.
_Avoid_: équipement à 0, objet offert

### Table des Épaves

**Table des Épaves** :
Tirage de fin de partie qui détermine ce qu'il advient d'un véhicule mis en épave.
_Avoid_: table de dégâts, wreck table

**Équipement arrachable** :
Arme ou amélioration montée sur un véhicule qui peut être perdue sur le résultat « Arrachée » : ni perdue, ni vendue, ni intégrée au véhicule, ni **équipement gratuit**.
_Avoid_: pool d'équipement, équipement éligible

**Avantage perdable** :
Avantage d'un véhicule qui peut être perdu sur le résultat « Pignon Endommagé » : ni perdu, ni vendu, ni **équipement gratuit**.
_Avoid_: pool d'avantages, avantage éligible
