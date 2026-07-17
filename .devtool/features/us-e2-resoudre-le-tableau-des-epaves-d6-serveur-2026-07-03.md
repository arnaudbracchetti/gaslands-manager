---
id: "us-e2-resoudre-le-tableau-des-epaves-d6-serveur-2026-07-03"
status: "in-progress"
priority: "high"
assignee: null
epic: null
dueDate: null
created: "2026-07-03T19:28:55.333Z"
modified: "2026-07-17T00:00:00.000Z"
completedAt: null
labels: ["mode-campagne", "degats-sequelles"]
order: "a3"
---
# Résoudre le Tableau des Épaves (D6 serveur)

En tant que joueur, je veux que l'appli lance le D6 du Tableau des Épaves et
applique le résultat, afin de connaître le sort de mes véhicules abîmés sans
tricher.

## Critères d'acceptation

- [x] Étant donné un véhicule Épave, quand la résolution se lance, alors l'appli
      génère un D6 et y ajoute les Chocs actuels du véhicule ± modificateur de
      poids (Léger +1, Lourd −1, p.168).
- [x] Étant donné le total, quand l'appli consulte le Tableau des Épaves, alors la
      ligne obtenue est enregistrée (dé, résultat, chocs gagnés) et retournée à
      l'organisateur au moment de l'appel.
- [x] Étant donné un résultat « Arrachée », quand il s'applique, alors une
      arme **ou une amélioration** est marquée perdue.
- [x] Étant donné un résultat « Siège irrécupérable », quand il s'applique, alors
      l'équipage du véhicule est réduit de 1 (borné à 1 minimum) via une séquelle.
- [ ] Étant donné un résultat « Véhicule détruit, pilote mort », quand il
      s'applique, alors le véhicule disparaît des vues actives.

## Vérification code (2026-07-03)

Repassée de `done` à `backlog` — le cœur du tirage D6 fonctionne, mais la table de
résultats réelle du jeu est fortement simplifiée et plusieurs effets manquent :

- Tirage D6 + Chocs ± modificateur de poids : `WreckResolverService`/`WreckOutcome`
  — correct et testé (`wreck-resolver.service.spec.ts:70-84`).
- Le résultat est bien journalisé (`WreckResolvedEvent`, colonnes `game_events`) et
  retourné en réponse HTTP synchrone, **mais il n'existe aucun endpoint pour
  rejouer/afficher un tirage passé** — `getResults()` ne renvoie que les
  `RankingAssignedEvent`.
- **La table de résultats est réduite à 3 issues génériques**
  (`wreck-result.enum.ts:3-6` : `CHOCS_GAGNE`, `ARME_PERDUE`, `EPAVE`) — pas de
  « Siège irrécupérable » ni « Véhicule détruit, pilote mort » distincts.
- « Arrachée » ne couvre que les **armes** (`WeaponLostEvent`) : les améliorations
  n'ont aucun mécanisme `isLost`/`markLost` (`grep isLost team/domain/improvement.ts`
  → rien).
- « Siège irrécupérable » (réduction d'équipage) : **aucun concept d'équipage
  mutable** n'existe sur `Vehicle` (seule une capacité statique catalogue). Aucune
  des 3 séquelles du registre (`moteur_endommage`, `direction_endommage`,
  `blindage_arrache`) ne réduit l'équipage.
- « Véhicule détruit » ne fait que poser un flag `isLost: true` — `GetWorkshopUseCase`
  continue de renvoyer le véhicule dans la liste, il ne « disparaît » d'aucune vue.

## Vérification code (2026-07-17)

Mise à jour majeure depuis 2026-07-03 — la table est désormais à **9 résultats distincts** (`WreckResult` enum : `DEBOSSELE`, `INDEMNE`, `ROUE_CABOSSEE`, `ARRACHEE`, `PIGNON_ENDOMMAGE`, `SIEGE_IRRECUPERABLE`, `CHASSIS_FRAGILISE`, `FAVORI_DU_PUBLIC`, `VEHICULE_DETRUIT`), pas 3 génériques. Les 3 critères cochés sont confirmés implémentés :
- Arrachée : `ImprovementLostEvent` existe désormais en plus de `WeaponLostEvent` (et couvre bien une amélioration).
- Siège irrécupérable : `SiegeIrrecuperableBehavior` réduit l'Équipage du véhicule via le mécanisme Strategy.
Dernier critère : « véhicule détruit disparaît des vues actives » reste non coché — vérifié par lecture directe de `get-workshop.usecase.ts` : `isLost` est exposé sur le véhicule mais la liste n'est **pas filtrée** (contrairement au filtrage des véhicules **vendus** qui, eux, disparaissent). Limitation documentée dans `docs/spec/CAMPAIGN.md#limitations-connues`.