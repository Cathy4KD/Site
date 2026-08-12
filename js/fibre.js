/* ============================================================
   FIBRE : feuille de PAPYRUS (bandes croisées, striations, taches
   d'âge). Au passage de la souris on ÉCRIT : des hiéroglyphes à
   l'encre s'inscrivent le long du curseur, puis s'effacent.
   ============================================================ */
(function(){
  const panel=document.querySelector('.p-fib');
  if(!panel) return;
  const canvas=panel.querySelector('.fibre-mat');
  const ctx=canvas&&canvas.getContext('2d');
  if(!ctx) return;
  const DPR=Math.min(2,window.devicePixelRatio||1);
  const reduce=matchMedia('(prefers-reduced-motion:reduce)').matches;
  const R=(a,b)=>a+Math.random()*(b-a);
  const now=()=>performance.now()/1000;
  let W=0,H=0;

  /* papier fibreux pré-rendu (statique) */
  const paper=document.createElement('canvas');
  const pctx=paper.getContext('2d');

  /* Générateur déterministe (mulberry32) réservé à la texture du papyrus.
     Avec Math.random(), chaque reconstruction retirait des fibres et des
     taches différentes : le papier changeait de motif sous les yeux à chaque
     survol. Même graine = même feuille, quelle que soit la taille. */
  function seeded(seed){
    return function(){
      seed=seed+0x6D2B79F5|0;
      let t=Math.imul(seed^seed>>>15,1|seed);
      t=t+Math.imul(t^t>>>7,61|t)^t;
      return((t^t>>>14)>>>0)/4294967296;
    };
  }

  function buildPaper(){
    /* texture reproductible : voir le commentaire de seeded() */
    const rnd=seeded(0xFA9B1),RR=(a,b)=>a+rnd()*(b-a);
    paper.width=Math.round(W*DPR);paper.height=Math.round(H*DPR);
    pctx.setTransform(DPR,0,0,DPR,0,0);
    pctx.lineCap='round';
    pctx.lineJoin='round';
    /* fond papyrus : beige chaud */
    const g=pctx.createLinearGradient(0,0,W*.15,H);
    g.addColorStop(0,'#ecdcb0');g.addColorStop(.5,'#ddc890');g.addColorStop(1,'#ccb075');
    pctx.fillStyle=g;pctx.fillRect(0,0,W,H);

    /* grandes plages de tons : casse l'uniformité (pas de grille) */
    for(let i=0;i<7;i++){
      const x=RR(0,W),y=RR(0,H),rr=RR(H*.2,H*.55);
      const m=pctx.createRadialGradient(x,y,0,x,y,rr);
      m.addColorStop(0,rnd()<.5?'rgba(255,246,214,.12)':'rgba(150,120,66,.10)');
      m.addColorStop(1,'rgba(0,0,0,0)');
      pctx.fillStyle=m;pctx.beginPath();pctx.arc(x,y,rr,0,6.2832);pctx.fill();
    }

    /* grain principal : longues fibres horizontales ondulées (dominante) */
    const nH=Math.round(H*1.1);
    for(let i=0;i<nH;i++){
      const y=RR(-4,H+4);
      pctx.strokeStyle=(rnd()<.5?'rgba(255,247,218,':'rgba(116,90,46,')+RR(.03,.11).toFixed(3)+')';
      pctx.lineWidth=RR(.6,1.7);
      const amp=RR(.4,1.8),ph=RR(0,6.2832),fq=RR(.01,.03);
      pctx.beginPath();
      for(let x=0;x<=W;x+=W/8){const yy=y+Math.sin(x*fq+ph)*amp;x?pctx.lineTo(x,yy):pctx.moveTo(x,yy);}
      pctx.stroke();
    }
    /* sous-couche verticale : grain beaucoup plus faible = fibres croisées discrètes */
    const nV=Math.round(W*.5);
    for(let i=0;i<nV;i++){
      const x=RR(-4,W+4);
      pctx.strokeStyle=(rnd()<.5?'rgba(255,247,218,':'rgba(116,90,46,')+RR(.02,.06).toFixed(3)+')';
      pctx.lineWidth=RR(.6,1.4);
      const amp=RR(.4,1.6),ph=RR(0,6.2832),fq=RR(.01,.03);
      pctx.beginPath();
      for(let y=0;y<=H;y+=H/8){const xx=x+Math.sin(y*fq+ph)*amp;y?pctx.lineTo(xx,y):pctx.moveTo(xx,y);}
      pctx.stroke();
    }
    /* jointures de lamelles : lignes horizontales douces, espacées au hasard */
    for(let y=RR(20,60);y<H;y+=RR(30,72)){
      pctx.strokeStyle='rgba(96,72,36,'+RR(.05,.12).toFixed(3)+')';pctx.lineWidth=RR(.8,1.6);
      const amp=RR(.6,2),ph=RR(0,6.2832),fq=RR(.008,.02);
      pctx.beginPath();
      for(let x=0;x<=W;x+=W/8){const yy=y+Math.sin(x*fq+ph)*amp;x?pctx.lineTo(x,yy):pctx.moveTo(x,yy);}
      pctx.stroke();
    }
    /* taches d'âge */
    const M=Math.round(W*H/2600);
    for(let i=0;i<M;i++){
      const x=RR(0,W),y=RR(0,H),rr=RR(6,26);
      const m=pctx.createRadialGradient(x,y,0,x,y,rr);
      m.addColorStop(0,'rgba(120,84,40,'+RR(.03,.08).toFixed(3)+')');
      m.addColorStop(1,'rgba(120,84,40,0)');
      pctx.fillStyle=m;pctx.beginPath();pctx.arc(x,y,rr,0,6.2832);pctx.fill();
    }
    /* bords vieillis */
    const vg=pctx.createRadialGradient(W*.5,H*.5,H*.3,W*.5,H*.5,H*.82);
    vg.addColorStop(0,'rgba(0,0,0,0)');vg.addColorStop(1,'rgba(70,46,18,.28)');
    pctx.fillStyle=vg;pctx.fillRect(0,0,W,H);
  }

  /* Le survol anime « flex » sur 0,85 s : ResizeObserver tire à chaque image.
     Redessiner la feuille (~2900 traits, plus les gradients et les taches)
     autant de fois bloquait le fil principal — celui qui calcule justement la
     transition. Le canvas est redimensionné tout de suite, la feuille est
     différée ; entre-temps drawImage étire l'ancienne, ce qui ne se voit pas
     sur des fibres horizontales. */
  function resize(){
    const r=panel.getBoundingClientRect();
    W=r.width;H=r.height;
    if(!W||!H)return;
    canvas.width=Math.round(W*DPR);canvas.height=Math.round(H*DPR);
    ctx.setTransform(DPR,0,0,DPR,0,0);
    buildPaper();
    dirty=true;
  }

  /* ---- écriture hiéroglyphique ---- */
  let dirty=true;
  const glyphs=[];               /* {type,x,y,rot,s,red,born} */
  const WRITE=.42;               /* durée du tracé « à la plume » (s) */
  const HOLD=2.4, FADE=2.6;      /* lisibilité puis effacement (s) */
  const SPACING=30;              /* distance entre deux signes */
  /* Les hiéroglyphes notent l'ÉGYPTIEN ANCIEN, pas le français : on écrit
     « nfr wrt » (nefer weret), litt. « très parfait / très beau »,
     translittéré en signes uniconsonantiques réels :
       n = eau · f = vipère · r = bouche · w = poussin · t = pain */
  const TRANSLIT="nfr wrt";
  const SIGN={a:'bird',i:'reed',j:'reed',y:'reed',e:'forearm',
    w:'chick',u:'chick',b:'stand',p:'loaf',f:'viper',m:'owl',n:'water',
    r:'mouth',h:'ankh',s:'cloth',t:'loaf',d:'mouth',g:'stand',k:'basket',
    q:'basket',c:'basket',l:'lion',o:'chick',v:'viper',x:'basket',z:'cloth'};
  const SEQ=[];
  for(const ch of TRANSLIT) SEQ.push(ch===' '?'space':(SIGN[ch]||'reed'));
  let seqI=0,lastX=-1,lastY=-1,acc=0;

  function ink(a,red){return red?'rgba(150,48,28,'+a.toFixed(3)+')':'rgba(36,23,11,'+a.toFixed(3)+')';}

  /* Un signe = une liste de traits ordonnés (polylignes échantillonnées +
     éventuels remplissages), avec leur longueur → on peut le tracer petit
     à petit comme s'il était écrit. Boîte ~ s, centrée sur l'origine. */
  function makeGlyph(type,s){
    const h=s*.5, parts=[];
    const line=pts=>{let L=0;for(let i=1;i<pts.length;i++)L+=Math.hypot(pts[i][0]-pts[i-1][0],pts[i][1]-pts[i-1][1]);parts.push({pts,len:L});};
    const quad=(x0,y0,cx,cy,x1,y1)=>{const p=[],n=10;for(let i=0;i<=n;i++){const t=i/n,u=1-t;p.push([u*u*x0+2*u*t*cx+t*t*x1,u*u*y0+2*u*t*cy+t*t*y1]);}line(p);};
    const arc=(cx,cy,rx,ry,a0,a1)=>{const p=[],n=Math.max(8,Math.round(Math.abs(a1-a0)/.35));for(let i=0;i<=n;i++){const a=a0+(a1-a0)*i/n;p.push([cx+rx*Math.cos(a),cy+ry*Math.sin(a)]);}line(p);};
    const dot=(cx,cy,r)=>{const pa=new Path2D();pa.arc(cx,cy,r,0,6.2832);parts.push({fill:pa,len:r*3});};
    switch(type){
      case 'ankh':
        arc(0,-h*.55,h*.26,h*.34,-1.6,4.7);
        line([[0,-h*.2],[0,h]]);
        line([[-h*.5,-h*.04],[h*.5,-h*.04]]);break;
      case 'water':
        {const p=[];let wx=-h;p.push([wx,0]);for(let k=0;k<3;k++){p.push([wx+h*.33,-h*.28]);p.push([wx+h*.66,0]);wx+=h*.66;}line(p);}break;
      case 'bird':
        arc(0,0,h*.55,h*.3,-2.5,3.8);
        arc(h*.5,-h*.32,h*.17,h*.17,0,6.2832);
        line([[h*.66,-h*.32],[h*.95,-h*.22]]);
        line([[-h*.1,h*.28],[-h*.1,h*.78]]);
        line([[h*.18,h*.28],[h*.18,h*.78]]);
        line([[-h*.5,0],[-h*.98,h*.16]]);break;
      case 'reed':
        line([[0,h],[0,-h]]);
        quad(0,-h,h*.34,-h*.72,0,-h*.5);
        for(let k=-2;k<=2;k++){const yy=k*h*.26;line([[0,yy],[h*.3,yy+h*.12]]);}break;
      case 'mouth':
        quad(-h*.8,0,0,-h*.34,h*.8,0);
        quad(h*.8,0,0,h*.34,-h*.8,0);break;
      case 'chick':                                  /* caille (w/u/o) */
        arc(0,h*.15,h*.38,h*.42,0,6.2832);
        arc(-h*.18,-h*.5,h*.2,h*.2,0,6.2832);
        line([[-h*.36,-h*.5],[-h*.64,-h*.44]]);
        line([[-h*.06,h*.55],[-h*.06,h]]);
        line([[h*.14,h*.5],[h*.14,h]]);break;
      case 'cloth':                                  /* étoffe pliée (s) */
        quad(0,-h,h*.55,-h*.5,h*.08,-h*.02);
        quad(h*.08,-h*.02,-h*.45,h*.2,0,h);break;
      case 'basket':                                 /* corbeille (c/k/q) */
        quad(-h*.7,-h*.05,0,h*.5,h*.7,-h*.05);
        line([[-h*.1,-h*.2],[h*.1,-h*.2]]);break;
      case 'forearm':                                /* avant-bras (e) */
        line([[-h*.7,h*.15],[h*.35,h*.15]]);
        line([[h*.35,h*.15],[h*.55,-h*.15]]);
        line([[h*.55,-h*.15],[h*.78,-h*.3]]);break;
      case 'loaf':                                   /* pain (t/p) */
        line([[-h*.55,h*.22],[h*.55,h*.22]]);
        quad(-h*.55,h*.22,0,-h*.5,h*.55,h*.22);break;
      case 'owl':                                    /* chouette (m) */
        arc(0,-h*.25,h*.34,h*.32,0,6.2832);
        dot(-h*.13,-h*.28,h*.06);dot(h*.13,-h*.28,h*.06);
        line([[0,-h*.02],[0,h*.08]]);
        arc(0,h*.42,h*.3,h*.42,0,6.2832);
        line([[-h*.12,h*.8],[-h*.12,h]]);
        line([[h*.12,h*.8],[h*.12,h]]);break;
      case 'stand':                                  /* support de jarre (g) */
        line([[-h*.4,-h*.6],[h*.4,-h*.6]]);
        line([[-h*.4,h*.6],[h*.4,h*.6]]);
        quad(-h*.4,-h*.6,0,0,-h*.4,h*.6);
        quad(h*.4,-h*.6,0,0,h*.4,h*.6);break;
      case 'lion':                                   /* lion couché (l) */
        arc(0,0,h*.6,h*.32,0,6.2832);
        arc(h*.55,-h*.18,h*.2,h*.2,0,6.2832);
        line([[-h*.55,-h*.05],[-h*.92,-h*.26]]);
        line([[-h*.3,h*.28],[-h*.3,h*.7]]);
        line([[h*.1,h*.28],[h*.1,h*.7]]);
        line([[h*.35,h*.28],[h*.35,h*.7]]);break;
      case 'viper':                                  /* vipère à cornes (f) */
        {const p=[];for(let i=0;i<=14;i++){const t=i/14;p.push([-h*.85+t*h*1.55,Math.sin(t*6.2832)*h*.17]);}line(p);}
        line([[h*.7,-h*.02],[h*.9,-h*.22]]);          /* corne */
        line([[h*.7,-h*.02],[h*.92,h*.06]]);          /* mâchoire */
        break;
    }
    let total=0;for(const p of parts)total+=p.len;
    return {parts,total};
  }

  function strokePart(pts,maxLen){
    ctx.beginPath();ctx.moveTo(pts[0][0],pts[0][1]);
    let a=0;
    for(let i=1;i<pts.length;i++){
      const dx=pts[i][0]-pts[i-1][0],dy=pts[i][1]-pts[i-1][1],d=Math.hypot(dx,dy);
      if(maxLen<0||a+d<=maxLen){ctx.lineTo(pts[i][0],pts[i][1]);a+=d;}
      else{const u=(maxLen-a)/d;ctx.lineTo(pts[i-1][0]+dx*u,pts[i-1][1]+dy*u);break;}
    }
    ctx.stroke();
  }

  /* dessine le signe rempli à la fraction pr (0→1 = en train de s'écrire) */
  function drawGlyph(g,al,pr){
    ctx.lineWidth=Math.max(1,g.s*.11);ctx.lineCap='round';ctx.lineJoin='round';
    const col=ink(al,g.red);ctx.strokeStyle=col;ctx.fillStyle=col;
    let target=pr*g.total, acc2=0;
    for(const p of g.parts){
      if(acc2>=target)break;
      const remain=target-acc2;
      if(p.fill){if(remain>=p.len)ctx.fill(p.fill);acc2+=p.len;continue;}
      if(remain>=p.len)strokePart(p.pts,-1);
      else{strokePart(p.pts,remain);break;}
      acc2+=p.len;
    }
  }

  function drop(x,y){
    if(!SEQ.length)return;
    const tok=SEQ[seqI%SEQ.length];seqI++;
    if(tok==='space')return;                        /* séparation de mot = petit vide */
    const g=makeGlyph(tok,R(14,20));
    g.x=x;g.y=y;g.rot=R(-.12,.12);g.red=Math.random()<.18;g.born=now();
    glyphs.push(g);
    if(glyphs.length>160)glyphs.shift();
    dirty=true;
  }

  function onMove(x,y){
    if(lastX<0){seqI=0;lastX=x;lastY=y;drop(x,y);return;}  /* nouvelle entrée = phrase au début */
    acc+=Math.hypot(x-lastX,y-lastY);lastX=x;lastY=y;
    while(acc>=SPACING){acc-=SPACING;drop(x,y);}
  }

  function render(){
    ctx.setTransform(DPR,0,0,DPR,0,0);
    ctx.clearRect(0,0,W,H);
    ctx.drawImage(paper,0,0,W,H);
    const t=now();
    for(let i=glyphs.length-1;i>=0;i--){
      const g=glyphs[i];const age=t-g.born;let a=1,pr=1;
      if(!reduce){
        pr=age<WRITE?age/WRITE:1;                 /* tracé progressif */
        if(age>HOLD){a=1-(age-HOLD)/FADE;if(a<=0){glyphs.splice(i,1);continue;}}
      }
      ctx.save();ctx.translate(g.x,g.y);ctx.rotate(g.rot);
      drawGlyph(g,a,pr);
      ctx.restore();
    }
    dirty=!reduce&&glyphs.length>0;    /* continue tant qu'il reste des signes à animer */
  }

  function loop(){if(dirty)render();requestAnimationFrame(loop);}

  let resizeT=0;
  resize();
  new ResizeObserver(()=>{
    clearTimeout(resizeT);resizeT=setTimeout(resize,150);
  }).observe(panel);

  const pos=e=>{const r=panel.getBoundingClientRect();return[e.clientX-r.left,e.clientY-r.top];};
  panel.addEventListener('pointermove',e=>{const[x,y]=pos(e);onMove(x,y);});
  panel.addEventListener('pointerdown',e=>{const[x,y]=pos(e);seqI=0;lastX=x;lastY=y;drop(x,y);});
  panel.addEventListener('pointerleave',()=>{lastX=-1;lastY=-1;acc=0;});

  loop();
})();
