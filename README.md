# Matières vivantes — Catherine Fourcade

Portfolio d'une décennie de maintenance industrielle, raconté en cinq matières.
Chaque tuile de la page d'accueil est une scène animée et interactive ; un clic
l'ouvre en plein écran sur le chapitre correspondant.

## Structure

```
index.html          page unique : en-tête, cinq tuiles, chapitres
css/style.css       thème clair/sombre, tuiles, zoom, scènes par matière
js/ui.js            zoom tuile → chapitre (FLIP), halo de matière, bascule de thème
js/eau.js           simulation liquide (heightfield 2D, ondes, réfraction)
js/copeaux.js       usinage (plaquette carbure, rainure, copeaux, étincelles)
js/fibre.js         papyrus + écriture hiéroglyphique au passage du curseur
js/lait.js          shader WebGL (goutte, impact, jet de rebond, vagues)
js/acier.js         coulée de métal en fusion déviée par le curseur
firebase.json       configuration Firebase Hosting
```

Chaque fichier de matière est un module autonome : il cherche son panneau,
s'arrête sans bruit s'il ne le trouve pas ou si le contexte graphique manque,
et respecte `prefers-reduced-motion`.

## Développement

Le site est statique — aucune étape de compilation. Pour un aperçu local :

```bash
firebase serve
```

Ouvrir ensuite http://localhost:5000. Un simple `python -m http.server` fait
aussi l'affaire ; les modules sont chargés en scripts classiques, pas en modules
ES, donc l'ouverture directe du fichier fonctionne également.

## Déploiement

```bash
firebase deploy
```

## Notes techniques

- **Le clone des tuiles.** À l'ouverture d'un chapitre, la tuile est clonée pour
  garder sa place dans la rangée pendant qu'elle passe en plein écran. À la
  fermeture, c'est la tuile *d'origine* qui reprend sa place et le clone qui
  disparaît — jamais l'inverse : `cloneNode()` ne copie que le DOM, jamais le
  contenu d'un `<canvas>`, et promouvoir le clone éteindrait la simulation.
- **Résolution de la simulation d'eau.** La grille est plafonnée, car les tuiles
  passent en plein écran et le heightfield est parcouru deux fois par image.
- **Repli sans canvas.** Les décors CSS restent en place sous les canvas et
  prennent le relais si le contexte graphique n'est pas disponible.
