(function(){
  /* Essais de fond : ?fond=encre|voile|sable pose une classe sur le corps.
     Sans paramètre, rien ne change. À retirer une fois la piste choisie. */
  const essai=new URLSearchParams(location.search).get('fond');
  if(['encre','voile','sable'].includes(essai))
    document.body.classList.add('fond-'+essai);

  /* Bandeau de liens : le nom en toutes lettres tient lieu de repli tant que
     le fichier du logo n'est pas déposé. Dès qu'une image charge, elle prend
     la place du nom ; si elle manque, on la retire pour éviter l'icône brisée.
     Déposer img/logo-pemac.svg ou img/logo-sti.svg suffit donc à basculer. */
  document.querySelectorAll('.liens img').forEach(img=>{
    img.addEventListener('load',()=>img.closest('a').classList.add('avec-logo'));
    img.addEventListener('error',()=>img.remove());
  });

  /* Créations consultables : data-url plutôt que <a>, la tuile étant déjà un
     <button> et l'imbrication de deux éléments interactifs étant invalide.
     On arrête la propagation pour que le clic n'atteigne pas la délégation
     de la rangée, qui ouvrirait ou fermerait le chapitre. */
  document.addEventListener('click',e=>{
    const l=e.target.closest('[data-url]');
    if(!l)return;
    e.stopPropagation();
    window.open(l.dataset.url,'_blank','noopener');
  });

  /* zoom panneau → chapitre (FLIP) */
  let openPanel=null,spacer=null;
  function openChapter(panel){
    if(openPanel)return;
    openPanel=panel;
    /* Le chapitre « moi » défile désormais — sans cette remise à zéro, le
       rouvrir le rendait à l'endroit où on l'avait laissé, c'est-à-dire au
       milieu des créations plutôt qu'à la présentation. */
    const det=panel.querySelector('.detail');
    if(det)det.scrollTop=0;
    const r=panel.getBoundingClientRect();
    /* clone visible : la tuile reste dans la rangée pendant le plein écran.
       Il naît à la largeur exacte de la tuile survolée (aucun rééquilibrage
       visible), puis se détend une fois masqué par le plein écran. */
    spacer=panel.cloneNode(true);
    spacer.classList.add('spacer');
    spacer.setAttribute('aria-hidden','true');
    spacer.disabled=true;
    /* cloneNode ne copie que le DOM : les canvas du clone naissent vides. On y
       recopie l'image courante, ce qui rend le clone indiscernable de la tuile
       et coûte un simple transfert de pixels.
       Auparavant je retirais « canvasjet » du clone pour lui rendre le décor
       CSS de secours : cela rallumait d'un coup 180 éléments animés sur la
       tuile Acier — 150 étincelles et 30 gouttelettes — plus la coulée CSS et
       son ombre portée. D'où une saccade au moment précis de l'ouverture. */
    const src=panel.querySelectorAll('canvas'),dst=spacer.querySelectorAll('canvas');
    for(let i=0;i<src.length&&i<dst.length;i++){
      const s=src[i],d=dst[i];
      if(!s.width||!s.height)continue;
      d.width=s.width;d.height=s.height;
      try{d.getContext('2d').drawImage(s,0,0);}catch(_){}
    }
    spacer.style.flex=getComputedStyle(panel).flex;
    panel.parentNode.insertBefore(spacer,panel);
    setTimeout(()=>{if(spacer)spacer.style.flex=''},1000);
    panel.style.top=r.top+'px';panel.style.left=r.left+'px';
    panel.style.width=r.width+'px';panel.style.height=r.height+'px';
    panel.classList.add('zooming');
    panel.getBoundingClientRect(); // reflow
    panel.classList.add('open');
    document.body.classList.add('chapter-open');
    setTint(panel.dataset.chapter);
    document.body.style.overflow='hidden';
  }
  function closeChapter(){
    if(!openPanel)return;
    const panel=openPanel;
    /* Le clone a pu naître à la largeur d'une tuile survolée (flex 2,2) et ne
       pas encore s'être détendu. Fermer vers CETTE largeur, puis rendre la
       tuile à sa largeur naturelle, produisait un saut sec à l'arrivée. On
       détend donc le clone d'abord, transition coupée, et on vise la place
       réelle qu'occupera la tuile. */
    spacer.style.transition='none';
    spacer.style.flex='';
    const r=spacer.getBoundingClientRect();
    panel.classList.remove('open');
    panel.style.top=r.top+'px';panel.style.left=r.left+'px';
    panel.style.width=r.width+'px';panel.style.height=r.height+'px';
    let settled=false;
    function settle(){
      if(settled)return;settled=true;
      /* la tuile D'ORIGINE reprend sa place, et c'est le clone qui disparaît.
         Un clone n'est qu'une copie inerte du DOM : ses <canvas> sont vides et
         aucune simulation n'y est branchée. Le promouvoir en tuile éteindrait
         définitivement la matière. La géométrie étant identique à celle du
         clone, la bascule ne produit aucun saut visible.
         (un clone ne copie que le DOM, jamais le bitmap d'un canvas) */
      /* Retirer « zooming » retire aussi son flex:none, et .panel reprend la
         main avec flex:1 ET sa transition de 0,85 s. La tuile repartait donc
         de sa largeur auto — quasi nulle, ses enfants étant tous en position
         absolue — pour s'ouvrir en grandissant : on la voyait se refermer puis
         se rouvrir. Le clone, lui, n'avait jamais porté « zooming ».
         On coupe donc la transition le temps de la remise en place, avec une
         lecture de géométrie entre les deux pour forcer le recalcul : sans
         elle, le navigateur regrouperait les deux écritures et l'animation
         se déclencherait quand même. */
      panel.style.transition='none';
      spacer.remove();
      panel.classList.remove('zooming');
      panel.style.top=panel.style.left=panel.style.width=panel.style.height='';
      panel.getBoundingClientRect();
      panel.style.transition='';
      spacer=null;openPanel=null;
      document.body.classList.remove('chapter-open');
      setTint(null);
    }
    panel.addEventListener('transitionend',function done(e){
      if(e.propertyName!=='width')return;
      panel.removeEventListener('transitionend',done);
      settle();
    });
    setTimeout(settle,1000); /* filet : jamais coincé en mode fixe */
  }
  /* délégation : clics et survols valent pour toute tuile, clones compris */
  const row=document.getElementById('row');
  /* ouverture sur pointerdown : insensible au déplacement de la tuile
     sous le curseur pendant son expansion de survol */
  row.addEventListener('pointerdown',e=>{
    if(e.button!==0)return;
    const p=e.target.closest('.panel');
    if(!p||p.classList.contains('spacer')||p.classList.contains('open'))return;
    openChapter(p);
  });
  row.addEventListener('click',e=>{
    const p=e.target.closest('.panel');
    if(!p)return;
    if(p.classList.contains('open')){
      if(e.target.closest('.back'))closeChapter();
      return;
    }
    /* filet : clavier et environnements sans PointerEvents */
    if(!p.classList.contains('spacer'))openChapter(p);
  });
  let tintOut=null,tintIn=null;
  row.addEventListener('mouseover',e=>{
    const p=e.target.closest('.panel');
    if(!p||openPanel)return;
    if(p.contains(e.relatedTarget))return;
    clearTimeout(tintOut);clearTimeout(tintIn);
    /* 90 ms d'attente avant de teinter, sur une transition raccourcie, faisait
       encore traîner le halo derrière le curseur : ramené à 45 ms. Le délai
       reste utile — il évite d'allumer cinq teintes pendant un simple
       balayage — mais il n'a plus à couvrir une transition d'une seconde. */
    tintIn=setTimeout(()=>setTint(p.dataset.chapter),45);
  });
  row.addEventListener('mouseout',e=>{
    const p=e.target.closest('.panel');
    if(!p||openPanel)return;
    if(p.contains(e.relatedTarget))return;
    clearTimeout(tintIn);clearTimeout(tintOut);
    tintOut=setTimeout(()=>setTint(null),300);
  });

  /* ===== halo de matière : crossfade fluide entre deux calques ===== */
  const TINTS={
    moi:'radial-gradient(ellipse at 50% 40%,rgba(74,97,114,.16),rgba(40,56,68,.07) 55%,transparent 80%)',
    eau:'radial-gradient(ellipse at 50% 40%,rgba(31,122,114,.16),rgba(8,80,90,.07) 55%,transparent 80%)',
    copeaux:'radial-gradient(ellipse at 50% 40%,rgba(62,106,149,.15),rgba(32,48,63,.08) 55%,transparent 80%)',
    fibre:'radial-gradient(ellipse at 50% 40%,rgba(176,143,68,.17),rgba(125,101,56,.08) 55%,transparent 80%)',
    lait:'radial-gradient(ellipse at 50% 40%,rgba(255,252,240,.55),rgba(226,215,190,.2) 55%,transparent 80%)',
    acier:'radial-gradient(ellipse at 50% 40%,rgba(212,85,26,.15),rgba(120,40,10,.08) 55%,transparent 80%)'
  };
  const TINTS_DARK={...TINTS,
    lait:'radial-gradient(ellipse at 50% 40%,rgba(240,232,210,.10),rgba(226,215,190,.04) 55%,transparent 80%)'
  };
  const layers=[document.getElementById('tintA'),document.getElementById('tintB')];
  let front=0,currentTint=null;
  function setTint(name){
    if(name===currentTint)return;
    currentTint=name;
    if(!name){layers.forEach(l=>l.classList.remove('on'));return}
    const dark=document.documentElement.getAttribute('data-theme')==='dark';
    const back=1-front;
    layers[back].style.background=(dark?TINTS_DARK:TINTS)[name];
    layers[back].classList.add('on');
    layers[front].classList.remove('on');
    front=back;
  }
  addEventListener('keydown',e=>{if(e.key==='Escape')closeChapter()});

  /* ===== thème clair / sombre — balayage circulaire depuis le bouton ===== */
  const KEY='cf-theme';
  const root=document.documentElement;
  const saved=localStorage.getItem(KEY);
  if(saved)root.setAttribute('data-theme',saved);
  const btn=document.querySelector('.theme-btn');
  btn.addEventListener('click',()=>{
    const next=root.getAttribute('data-theme')==='dark'?'light':'dark';
    const apply=()=>{
      if(next==='dark')root.setAttribute('data-theme','dark');
      else root.removeAttribute('data-theme');
      localStorage.setItem(KEY,next);
    };
    if(!document.startViewTransition||
       matchMedia('(prefers-reduced-motion:reduce)').matches){apply();return}
    const r=btn.getBoundingClientRect();
    const x=r.left+r.width/2,y=r.top+r.height/2;
    const rad=Math.hypot(Math.max(x,innerWidth-x),Math.max(y,innerHeight-y));
    root.style.setProperty('--theme-x',x+'px');
    root.style.setProperty('--theme-y',y+'px');
    root.style.setProperty('--theme-r',rad+'px');
    /* aller : le sombre s'étend — retour : il se rétracte */
    if(next==='light')root.setAttribute('data-wipe','retract');
    const vt=document.startViewTransition(apply);
    vt.finished.finally(()=>root.removeAttribute('data-wipe'));
  });
})();
