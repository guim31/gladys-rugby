# Rugby

Suivez vos équipes de rugby dans Gladys : le prochain match à l'heure locale, le score en direct, le dernier
résultat et le classement, pour vos tableaux de bord et vos scènes.

## Ce que vous obtenez

- Un appareil par équipe suivie (Stade Toulousain, France, Leinster…), avec son prochain match, le coup
  d'envoi, le lieu, le dernier résultat, le score en direct et le classement.
- Des déclencheurs de scène : **Match qui va commencer**, **Coup d'envoi**, **Match terminé** (avec le
  résultat : victoire, nul ou défaite).
- Une action de scène qui écrit des phrases prêtes à envoyer ou à faire dire.
- Un widget de tableau de bord **Équipe de rugby**.

## Compétitions

Top 14, Premiership, United Rugby Championship, Super Rugby Pacific, Champions Cup, Challenge Cup, Tournoi
des Six Nations, Rugby Championship, Nations Championship (tests d'automne), autres test-matchs et Coupe du
monde. La Pro D2 n'est pas proposée : ESPN ne la sert pas.

## Mise en route

1. Dans l'onglet **Configuration**, cochez les compétitions qui vous intéressent et choisissez la langue des
   textes (français par défaut), puis enregistrez.
2. Ouvrez l'onglet **Découverte** : toutes les équipes de ces compétitions y sont listées. Ajoutez celles que
   vous suivez ; chacune devient un appareil.
3. Appuyez sur **Vérifier** pour relire ESPN et voir ce que l'intégration sait de vos équipes.

Une équipe joue plusieurs compétitions (Stade Toulousain : Top 14 et Champions Cup) : son appareil réunit
les matchs de toutes les compétitions cochées. Son classement vient de la première compétition de la liste
qui la classe, son championnat avant sa coupe d'Europe.

## Appareils

| Fonctionnalité       | Valeur                                                                    |
| -------------------- | ------------------------------------------------------------------------- |
| Prochain match       | « Lyon – Stade Toulousain (Top 14) », l'équipe qui reçoit d'abord         |
| Coup d'envoi         | Jour et heure dans le fuseau de Gladys (le jour seul s'il n'est pas fixé) |
| Lieu                 | Stade et ville, et la chaîne TV quand ESPN la donne                       |
| Dernier résultat     | « Victoire 28-18 contre Clermont Auvergne (Top 14) »                      |
| Jours avant le match | 0 le jour du match, -1 quand aucun match n'est prévu                      |
| Match en cours       | 1 pendant un match                                                        |
| Match aujourd'hui    | 1 le jour du match                                                        |
| Score de l'équipe    | Pendant un match le score en direct, ensuite le score du dernier match    |
| Score adverse        | Idem, pour l'adversaire                                                   |
| Classement           | Place au classement du championnat, ou dans la poule d'une coupe          |

Les noms des fonctionnalités sont fixés à l'ajout d'une équipe : changez la langue avant d'ajouter vos
équipes.

## Scènes

### Déclencheurs

- **Match qui va commencer** : 15, 30, 60 ou 120 minutes avant le coup d'envoi prévu d'une équipe suivie
  (seulement quand l'heure est connue).
- **Coup d'envoi** : quand ESPN indique que le match a commencé, à une minute près.
- **Match terminé** : à la fin du match. Son filtre **Résultat** ne garde que les victoires, les nuls ou les
  défaites : choisissez **Victoire** pour fêter ça.

Laissez **Équipe** vide pour toutes les équipes suivies. La scène peut lire l'équipe, l'adversaire, la
compétition, domicile ou extérieur, l'heure du coup d'envoi, le lieu, les scores, le résultat et une
**phrase** toute prête.

### Action

**Lire l'actualité d'une équipe** renvoie un résumé, le prochain match, le dernier résultat sous forme de
phrases, si un match est en cours et le nombre de jours avant le prochain match. Envoyez-les dans un message
ou faites-les dire à voix haute.

## Tableau de bord

Le widget **Équipe de rugby** montre une équipe suivie : le score en direct pendant un match, le compte à
rebours jusqu'au prochain, le classement, les trois prochains matchs et le dernier résultat. Ses réglages
choisissent l'équipe et peuvent masquer les prochains matchs ou le dernier résultat.

## Données et limites

- Les données viennent de l'API JSON publique d'ESPN (`site.api.espn.com`) : pas de compte, pas de clé.
  **Cette API n'est ni officielle ni documentée** : elle peut changer ou s'arrêter sans prévenir.
  L'intégration la lit avec parcimonie : les équipes une fois par jour, les matchs de chaque compétition
  toutes les 6 heures (cinq requêtes : du mois dernier à trois mois devant), les classements toutes les
  6 heures et après un match, et le tableau des scores du jour **chaque minute seulement pendant un match
  d'une équipe suivie**, dès 5 minutes avant le coup d'envoi.
- Les matchs à plus de trois mois ne sont pas lus : en novembre, le prochain Tournoi n'apparaît pas encore.
- ESPN donne les noms d'équipes en anglais, sans accents (Stade Francais Paris) ; les sélections nationales
  sont traduites.
- La chaîne TV est rarement donnée pour le rugby européen.
- Aucun calendrier Gladys n'est rempli : une intégration est soit de type appareil, soit de type calendrier.
- Sans lien avec ESPN, les ligues ni les clubs.

## Dépannage

- **Aucune équipe dans l'onglet Découverte** : cochez au moins une compétition et enregistrez, puis appuyez
  sur **Vérifier**. Si ESPN ne répond pas, l'état de l'intégration le dit.
- **Une valeur reste vide** : l'intégration ne devine jamais ; un classement apparaît dès qu'ESPN publie
  celui de la saison.
- Journaux : l'intégration journalise son démarrage et ses erreurs ; `LOG_LEVEL=debug` pour chaque lecture.
