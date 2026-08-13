# Mes créations

Déposez ici vos pages autonomes — une par création, en un seul fichier HTML si
possible, pour qu'elles s'ouvrent d'un double-clic comme en ligne.

    creations/
    ├── ma-premiere-creation.html
    └── une-autre.html

Puis ajoutez une ligne à la liste « Mes créations » du chapitre Catherine, dans
`index.html` :

```html
<li><span class="c-act c-lien" data-url="creations/ma-premiere-creation.html">Le titre</span><span class="c-det">deux mots sur la technique</span></li>
```

L'attribut `data-url` suffit : le titre devient cliquable et s'ouvre dans un
nouvel onglet. On ne met pas de balise `<a>` — la tuile est déjà un `<button>`,
et imbriquer deux éléments interactifs produit du HTML invalide.

Les fichiers déposés ici sont mis en ligne au prochain `firebase deploy`.
