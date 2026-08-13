# Mes créations

Déposez ici vos pages autonomes — une par création, en un seul fichier HTML si
possible, pour qu'elles s'ouvrent d'un double-clic comme en ligne.

    creations/
    ├── ma-premiere-creation.html
    └── une-autre.html

Puis ajoutez une carte dans la sous-section « Mes créations » du chapitre
Catherine, dans `index.html` :

```html
<article class="creation" data-url="creations/ma-premiere-creation.html">
  <h4>Le titre</h4>
  <p>deux mots sur la technique</p>
</article>
```

La grille se remplit toute seule : les cartes s'alignent sur trois colonnes en
grand écran, une seule sur téléphone, sans rien avoir à régler.

## Deux règles

**`data-url`, jamais `<a>`.** La tuile est déjà un `<button>` ; imbriquer deux
éléments interactifs produit du HTML invalide. L'attribut et le gestionnaire de
`js/ui.js` font le même travail, et ouvrent la page dans un nouvel onglet.

**Une carte sans `data-url` reste affichée mais n'est pas cliquable** — pratique
pour annoncer une création en préparation.

Les fichiers déposés ici partent en ligne au prochain `firebase deploy`.
