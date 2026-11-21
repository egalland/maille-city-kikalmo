# Carte de Paris et de l’ouest parisien

Les emprises de bâtiments, les axes des rues et chemins, les surfaces en eau et les zones de végétation proviennent de l’**Institut national de l’information géographique et forestière (IGN), BD TOPO®**, extraction du 19 novembre 2026. Réutilisation sous **Licence Ouverte / Open Licence 2.0**.

- [Fiche officielle de la BD TOPO®](https://cartes.gouv.fr/rechercher-une-donnee/dataset/IGNF_BD-TOPO)
- [Service WFS de la Géoplateforme](https://data.geopf.fr/wfs/ows?service=WFS&version=2.0.0&request=GetCapabilities)
- [Texte de la Licence Ouverte 2.0](https://www.etalab.gouv.fr/licence-ouverte-open-licence/)

## Emprise et transformation

Le secteur suit l'axe du Louvre, des Tuileries, de la Concorde et des Champs-Élysées à l'Étoile, puis l'avenue de la Grande Armée, la porte Maillot, Neuilly-sur-Seine, la Seine et le quartier de La Défense. La bande extraite s'étend à 650 mètres de part et d'autre de cet axe. Le contour exact figure dans `metadata.boundary` du module de données.

Les éléments géographiques sont projetés dans un repère local métrique approximatif, orienté vers l'est en x et vers le sud en y. Le générateur simplifie les contours d'environ un mètre et arrondit les coordonnées au mètre. Il conserve les cours intérieures et les îles. Les natures, les hauteurs de bâtiments et les largeurs de chaussée sont issues des attributs IGN lorsqu'ils sont renseignés. Les hauteurs manquantes sont estimées à partir du nombre d'étages ou d'un gabarit par défaut. Chaque bâtiment indique si sa hauteur est observée dans la source. Une largeur indicative est attribuée aux tronçons dont la largeur est inconnue. Les tronçons routiers souterrains sont écartés de la représentation de surface. Les tabliers des ponts sont identifiés par le niveau de franchissement IGN.

Le relief du corridor et des trois arrêts embarqués est interpolé sur une grille de 32 mètres à partir des altitudes des sommets des tronçons routiers IGN en surface. Le modèle lisse les écarts entre rues proches. Les hauteurs entre routes sont approximatives. Les plans d’eau sont horizontaux à l’altitude médiane des sommets IGN de leur rive lorsque cette donnée est disponible. Les secteurs à la demande utilisent les altitudes routières de leur propre extraction et conservent la grille avec les données du quartier. L'habillage des façades, les personnages, les accessoires et les véhicules sont des créations stylisées pour le jeu. L’axe ainsi que les trois arrêts Tour Eiffel, Notre-Dame et Sacré-Cœur sont embarqués. Dans le plan du Grand Paris, les autres secteurs de 1,32 km de côté sont extraits à la demande auprès de la Géoplateforme et mis en cache dans le navigateur.

## Reproduction

Lancer `/usr/bin/python3 scripts/geo-extract.py` avec Python 3 et les bindings GDAL/OGR. Le générateur interroge séparément les couches `BDTOPO_V3:batiment`, `BDTOPO_V3:troncon_de_route`, `BDTOPO_V3:surface_hydrographique` et `BDTOPO_V3:zone_de_vegetation`. Le module obtenu est `public/paris-core.js`. Les arguments `eiffel`, `notre-dame` et `sacre-coeur` génèrent trois quartiers supplémentaires embarqués (archives gzip). Après ces quatre extractions, `python scripts/geo-relief.py` génère la grille embarquée `public/paris-heights.js` à partir du cache WFS, avec NumPy et SciPy. La BD TOPO est une source mise à jour dans le temps.

## Secteurs supplémentaires

Pour un quartier choisi ailleurs dans Paris et la petite couronne, le jeu charge les quatre mêmes couches du WFS de l'IGN sur un carré de 1,32 km de côté. Il utilise le même repère métrique que le corridor embarqué. La date d’extraction du secteur correspond à son chargement réussi. Une copie locale permet de revisiter un secteur et de conserver la dernière carte disponible lorsque le réseau est indisponible. Les contours sont quantifiés au mètre et les tronçons souterrains sont exclus de la vue de surface.

## Enfer · Pays noyonnais

La carte couvre environ 143 km², dont l’intégralité des communes de Noyon et de Pontoise-lès-Noyon (contours administratifs codes INSEE 60471 et 60507). L’archive `public/map-enfer.gz` embarque les mêmes couches IGN, les noms de voirie et les altitudes des berges disponibles et les profils altimétriques des franchissements IGN. Les bois, peupleraies et haies alimentent le placement des arbres. Les contours sont simplifiés à 22 cm puis quantifiés au décimètre dans le repère local. Le relief est interpolé à partir des altitudes routières sur une grille de 24 m. Les étages, matières, pignons et détails de façade sont interprétés pour Maille City.

Les maisons de brique et leurs toits s’inspirent des [Maisons de la reconstruction à Noyon](https://vpah-hauts-de-france.fr/ressources/les-maisons-de-la-reconstruction/) et de [l’Inventaire des maisons et fermes du canton de Noyon](https://inventaire.hautsdefrance.fr/dossier/IA00049486).

Relancer `/usr/bin/python3 scripts/geo-enfer.py` avec GDAL, NumPy et SciPy pour extraire la version courante de ce périmètre.

### Zone commerciale du Mont Renaud

Les emprises de la galerie et des bâtiments ainsi que les voies d’accès reprennent la BD TOPO®. Les parkings, les pistes de retrait et les plantations sont adaptés aux déplacements dans le jeu. Les sources de repérage sont le [dossier d’aménagement du Mont Renaud](https://www.hauts-de-france.developpement-durable.gouv.fr/IMG/pdf/cerfa_complet_2023_7682_compressed.pdf), la [fiche de l’hypermarché et de la station-service](https://www.auchan.fr/magasins/hypermarche/auchan-hypermarche-noyon/s-129) et la [fiche du Drive](https://www.auchan.fr/magasins/drive/auchan-drive-noyon/s-524).

## Clôtures et murs d’Enfer

La couche séparée [enfer-enclosures.js](../public/enfer-enclosures.js) provient des tracés de **© les contributeurs OpenStreetMap**, distribués sous [Open Database Licence 1.0](https://www.openstreetmap.org/copyright). L’extrait est daté dans l’en-tête du fichier et conserve l’identifiant OSM de chaque chemin. Il est également téléchargeable dans les crédits de la carte en jeu. Les murs, clôtures et murs de soutènement suivent leur axe cartographié. Les matériaux et hauteurs manquants sont interprétés dans le style textile du jeu. Une parcelle sans clôture renseignée reste ouverte.

Le script `/usr/bin/python3 scripts/geo-enclosures.py` interroge Overpass (Python 3, GDAL avec GEOS). Les coordonnées sont projetées puis arrondies au décimètre. Les portails, accès de service et chemins OSM, chaussées et empreintes IGN découpent le linéaire pour conserver des passages jouables. Le rendu et la collision utilisent le même ensemble d’intervalles. Aucun service de cartographie n’est interrogé pendant la partie pour ces clôtures.

Une couche distincte complète les jardins résidentiels de Noyon et de Pont-l’Évêque à partir du [Cadastre Etalab](https://cadastre.data.gouv.fr/datasets/cadastre-etalab), produit à partir du PCI de la DGFiP sous Licence Ouverte 2.0. Le script `scripts/geo-cadastre.py` utilise les limites des parcelles bâties pour proposer de courts linéaires de haies ou de murs de jardin. Le type de clôture relève du décor du jeu. Le découpage tient compte des chaussées, des chemins, des bâtiments, des accès depuis la rue, des clôtures OSM, du chemin de fer et des principaux lieux de jeu.
