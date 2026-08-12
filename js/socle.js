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

    function cible(exact){
      if(exact)return[W,H];
      if(panel.classList.contains('zooming'))return[innerWidth,innerHeight];
      return[W*1.8,H];
    }
    function alloc(exact){
      const[tw,th]=cible(exact),s=scaleFor(tw,th);
      hooks.alloc(Math.round(tw*s),Math.round(th*s),W,H);
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
      if(canvas.width<W*scaleFor(W,H)*0.99){   /* sous-échantillonné : agrandir */
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
