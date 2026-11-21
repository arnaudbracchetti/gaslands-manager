---
status: accepted
---

# Retour arrière par l'image précédente, sans restauration

Revenir à la version précédente (N-1) relance son image sur la base telle qu'elle est, sans
restaurer le dump fait avant le déploiement : les résultats de partie, achats d'atelier et autres
saisies faites depuis le déploiement restent. Reprend l'ADR 0021 d'Histoires de Chimères, adapté à
TypeORM et au journal d'événements des campagnes.

En contrepartie :

- Une migration ne fait qu'ajouter (colonne nullable ou avec défaut, table, index). Un changement
  destructif (suppression, renommage, `NOT NULL` sans défaut) se répartit sur deux versions. TypeORM
  le permet : une image N-1 démarre sans erreur sur une base qui contient des migrations qu'elle ne
  connaît pas (vérifié, ticket #17).
- Une migration qui ne peut pas suivre la règle porte `// incompatible : <raison>` dans son
  fichier. Son retour arrière passe alors directement par la restauration du dump.
- Seul le cran N-1 est garanti. Remonter plus loin passe par la restauration.

## Particularité Gaslands : le journal d'événements

L'état des campagnes est rejoué depuis `game_events`, et le mapper refuse un type d'événement
inconnu. Si N a déjà écrit une valeur que N-1 ne lit pas (nouveau type d'événement, nouvelle valeur
de `resistanceStrategyKey`, nouvelle clé de `houseRules`...), N-1 ne peut plus charger la campagne
concernée. Ce qui compte, c'est ce que la base contient, pas ce que N pourrait écrire.

Chaque release déclare donc, dans un fichier embarqué dans son image, les valeurs nouvelles qu'elle
peut écrire, rédigées comme des actions utilisateur. Au retour arrière, le script cite cette liste
avec la date du déploiement et demande si quelqu'un a fait l'une de ces actions depuis. Oui ou « je
ne sais pas » : restauration du dump. Non, ou liste vide : N-1 relancé sur la base telle quelle.

## Considered Options

- **Toujours restaurer le dump au retour arrière** : aucune contrainte sur les migrations, mais
  tout ce qui a été saisi depuis le déploiement est perdu. Ce sont des résultats de parties jouées
  sur table, pénibles à ressaisir.
- **N-1 tolérant (ignore les événements inconnus au replay)** : écarté, l'état des campagnes
  divergerait sans rien signaler.
- **Nouveaux types d'événements en deux versions (lecteur puis écrivain)** : écarté, une release de
  plus pour chaque fonctionnalité de campagne.

## Consequences

- Un échec pendant le déploiement (N pas `healthy` ou mauvaise version) restaure toujours le dump
  et relance N-1 : la fenêtre ne dure que quelques minutes et couvre une migration à moitié
  appliquée sans réflexion. Si cette restauration échoue : alerte critique, intervention manuelle.
- Si N-1 ne démarre pas lors d'un retour sans restauration, le script relance N plutôt que de
  restaurer : la perte de données doit rester un choix explicite.
- Oublier la déclaration des valeurs nouvelles, ou le marqueur `// incompatible`, rend le retour
  sans restauration dangereux. Un contrôle automatique est à prévoir.
