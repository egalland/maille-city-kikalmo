# Maille City

Jeu de ville en laine à la troisième personne. Enfer est le monde actif sur ordinateur et mobile. Les joueurs entrent dans le même espace public. Le guide de la version et le bilan de chaque phase se trouvent dans [le carnet de jeu](public/carnet.html).

## Démarrage local

Node 22.13 ou ultérieur fournit SQLite pour la prévisualisation et les tests.

```sh
npm run dev
node --test test/*.mjs
node scripts/benchmark-district.mjs
npm run build
```

Le serveur de développement utilise une base SQLite en mémoire. Le déploiement utilise le Worker de `dist/server/index.js` et son binding D1. La carte d’Enfer est incluse et les notices d’attribution des données géographiques, des polices et du moteur se trouvent dans `licenses/`.

## Frontières entre systèmes

| Système | Modules principaux | Contrat |
| --- | --- | --- |
| Monde | paris-data, paris-world, terrain-height, enfer-bridges, workshop | Géométrie des rues, surfaces, hauteurs et collisions consultées par le jeu, la caméra et les décors |
| Ville | street-signals, traffic-flow, crowd-motion, city-climate | Horloge commune, routes échantillonnées, priorités et interactions des habitants proches |
| Action | game, parkour, wanted, police-perception, police-tactics, vehicle-damage, vitality | Intentions de déplacement, observations policières, impacts puis état et événements du monde |
| Affichage | game-render, city3d, puppets3d, mesh-renderer, diagnostics | État interpolé des acteurs, quartiers chargés autour de la caméra, mesures facultatives |
| Carrière | career-catalog, career-route, career-ui, worker/career | Contrats, étapes, prix, révisions de sauvegarde et transactions du portefeuille |
| Multijoueur | net, state-wire, roster-wire, worker/game-api, worker/vehicle-seats | Instantanés, opérations rejouables et sièges exclusifs. Les états spéculatifs se réconcilient avec les résultats du Worker |
| Son et interface | street-audio, car-radio, main, panels, social-controls | Entrées PC/tactiles, réglages, messages du serveur, ambiance et musique synthétisée |

Les changements de schéma sont additifs. Les versions de carrière antérieures acquièrent leurs tables complémentaires à l’ouverture. Le schéma de présence distingue l’identité temporaire d’un onglet de la clé de progression du navigateur. Les signalements sont réservés à l’exploitant dans la table D1 `mc_reports`, avec le motif et les messages acceptés récents. Le serveur limite leur fréquence et applique une rétention de 30 jours lors du traitement des signalements.
