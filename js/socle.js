/* ============================================================
   SOCLE — ce que les matières partagent
   Chargé avant elles. Aucune matière ne dépend d'une autre ;
   toutes dépendent d'ici.
   ============================================================ */
window.Matiere=(function(){

  /* ---- budget de pixels ------------------------------------------------
     En plein écran, un tampon à pleine densité atteint 7 Mpx sur un écran
     2560 en densité 1,5 — huit fois la taille au repos, redessinés à chaque
     image. Mesuré : douze images perdues par ouverture de chapitre pour une
     seule tâche longue, donc un coût de rendu et non de script. On plafonne,
     quitte à descendre sous la densité de l'écran : ces effets sont doux, la
     finesse perdue ne se voit pas, les images perdues se voyaient. */
  const MAXPX=2.4e6;
  function scaleFor(w,h){
    const d=Math.min(2,window.devicePixelRatio||1);
    const px=w*h*d*d;
    return px>MAXPX?d*Math.sqrt(MAXPX/px):d;
  }

  /* ---- hasard reproductible (mulberry32) -------------------------------
     Les textures de fond doivent être identiques d'une reconstruction à
     l'autre, sinon le grain change sous les yeux à chaque redimensionnement.
     Attention : une graine fixe ne suffit pas si le NOMBRE de tirages varie.
     C'est pourquoi les textures se dessinent dans un repère de référence
     fixe, jamais aux dimensions courantes. */
  function seeded(seed){
    return function(){
      seed=seed+0x6D2B79F5|0;
      let t=Math.imul(seed^seed>>>15,1|seed);
      t=t+Math.imul(t^t>>>7,61|t)^t;
      return((t^t>>>14)>>>0)/4294967296;
    };
  }

  /* ---- dimensionnement -------------------------------------------------
     Une tuile change de taille tout le temps : au survol (environ 1,8x) et à
     l'ouverture d'un chapitre (jusqu'à 6x). Trois pièges, tous rencontrés :

     1. Affecter canvas.width réalloue le tampon ET l'efface. Le rappel de
        ResizeObserver s'exécutant APRÈS les requestAnimationFrame mais AVANT
        le rendu, il faut redessiner dans le même rappel — sinon une image
        entièrement vide s'affiche.
     2. Réallouer à chaque image coûte la fluidité ; ne jamais réallouer donne
        du flou, un mauvais rapport d'aspect, puis un saut.
     3. Réallouer par paliers fait osciller la netteté : elle se dégrade sur un
        tampon figé pendant que la tuile grandit, puis remonte d'un coup. Des
        sauts de +35 % d'une image à l'autre, qu'on voit clignoter.

     D'où une CIBLE STABLE. Pendant un zoom de chapitre elle est connue — le
     plein écran — et une seule allocation couvre toute la transition. Sinon on
     vise 1,8x la largeur courante, ce qui couvre l'élargissement au survol en
     une fois. Le tampon est alors sur-échantillonné, ce qui ne se voit pas :
     c'est le sous-échantillonnage qui floute. Entre deux allocations, la
     matrice du contexte absorbe l'écart, de sorte que la géométrie reste juste
     en permanence. Un ajustement à la taille exacte suit 250 ms après l'arrêt.

     hooks :
       alloc(bw,bh,W,H) — dimensionner les tampons à bw x bh pixels
       remap(W,H)       — recaler les matrices sans réallouer
       redraw()         — redessiner immédiatement (le tampon vient d'être vidé)
       setSize(W,H)     — facultatif : la matière met à jour ses propres W,H
       transpose(sx,sy) — facultatif : mettre l'état en vol à l'échelle
       onSize(W,H)      — facultatif : appelé à chaque changement (textures…)
  */
  function sizing(panel,canvas,hooks){
    const mesure=()=>{const r=panel.getBoundingClientRect();
      return[r.width||1,r.height||1];};
    let [W,H]=mesure(),settleT=0;

    /* La marge est UNIFORME : le tampon garde le rapport d'aspect de la tuile.
       Viser le plein écran pendant un zoom donnait certes une cible stable,
       mais un tampon au format 2,1 affiché sur une tuile au format 0,46 —
       une anisotropie de 4,5x. Les matrices rétablissent la géométrie, pas le
       reste : les flous et les pointillés s'écrasaient horizontalement, et le
       Lait, en WebGL, n'a aucune matrice — son shader composait pour le format
       du tampon, donc la goutte se déformait pendant toute la transition.
       Avec 1,15x uniforme, l'anisotropie tombe à 1,14x et les sauts de netteté
       de 35 % à 15 %. La marge se règle elle-même : on ne réalloue que
       lorsqu'elle est consommée. */
    function cible(exact){
      if(exact)return[W,H];
      /* Pendant un zoom, la cible est le plein écran : une seule allocation
         couvre toute la transition et la densité décroît alors de façon
         continue, sans jamais remonter. Ce sont les remontées qu'on voit
         comme des flashs. */
      if(zoom())return[innerWidth,innerHeight];
      return[W*1.15,H*1.15];
    }
    /* Un zoom de chapitre et un survol ne demandent pas le même compromis.

       Au SURVOL, cinq tuiles changent de taille en même temps : on prend une
       marge et on ne réalloue qu'une fois, quand elle est consommée.

       Au ZOOM, une seule tuile bouge — les autres sont figées derrière le plein
       écran — et l'écart de taille est bien plus grand. On peut donc coller
       exactement à la tuile, image par image. C'est ce qui compte pour l'œil :
       avec une marge, la densité se dégrade puis remonte d'un cran à chaque
       réallocation, et ce sont ces remontées qu'on voyait comme des flashs.
       Simulation sur la trajectoire d'ouverture : les pics de +12, +15 et +13 %
       disparaissent, il ne reste que la décrue régulière du budget de pixels.
       La tuile portrait, elle, n'a aucun canvas — d'où son ouverture sans
       défaut, qui a mis sur la piste. */
    const zoom=()=>panel.classList.contains('zooming');
    function alloc(exact){
      const[tw,th]=cible(exact),s=scaleFor(tw,th);
      /* On transmet les dimensions CIBLES, pas les courantes : pendant un zoom
         le tampon vise déjà le plein écran, et une texture bâtie pour la taille
         courante serait clairsemée puis étirée — l'effet de loupe qu'on cherche
         justement à supprimer. */
      hooks.alloc(Math.round(tw*s),Math.round(th*s),tw,th);
    }
    function sync(){
      const r=panel.getBoundingClientRect();
      if(!r.width||!r.height)return;
      const oW=W,oH=H;
      W=r.width;H=r.height;
      if(oW===W&&oH===H)return;
      if(hooks.setSize)hooks.setSize(W,H);
      if(hooks.transpose&&oW&&oH)hooks.transpose(W/oW,H/oH);
      if(hooks.onSize)hooks.onSize(W,H);
      const[tw,th]=cible(false);
      const vise=Math.round(tw*scaleFor(tw,th));
      /* au zoom la cible ne bouge pas : une seule allocation, au premier appel.
         au survol : seulement si le tampon est devenu trop petit, donc flou. */
      if(zoom()?canvas.width!==vise:canvas.width<Math.round(W*scaleFor(W,H))*0.99){
        alloc(false);hooks.redraw();
      }else if(hooks.remap){
        hooks.remap(W,H);
      }
      clearTimeout(settleT);
      settleT=setTimeout(()=>{alloc(true);hooks.redraw();},250);
    }

    if(hooks.setSize)hooks.setSize(W,H);
    alloc(true);
    new ResizeObserver(sync).observe(panel);
  }

  return{scaleFor,seeded,sizing};
})();
