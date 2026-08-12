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
  const reduce=matchMedia('(prefers-reduced-motion:reduce)').matches;
  const R=(a,b)=>a+Math.random()*(b-a);
  const now=()=>performance.now()/1000;
  let W=0,H=0;

  /* papier fibreux pré-rendu (statique) */
  const paper=document.createElement('canvas');
  const pctx=paper.getContext('2d');


  /* Le grain est bâti UNE SEULE FOIS, pour la plus grande taille utile — le
     plein écran — puis dessiné 1:1 et simplement rogné par la tuile. Il garde
     donc exactement la même finesse dans tous les états : agrandir la carte
     révèle davantage de feuille, sans jamais l'étirer ni la redessiner.

     Auparavant il était rebâti au moment du clic, dimensionné pour le plein
     écran puis étiré dans une tuile encore petite : le grain devenait trois
     fois plus fin d'un coup, et la reconstruction de ~2400 traits figeait une
     image au pire moment.

     Chaque brin tire sa graine de son INDICE, chaque tache des COORDONNÉES de
     sa cellule. Un flux commun divergerait dès que le nombre de tirages change,
     et c'est ce qui faisait sauter le motif.

     Le fond et les bords vieillis, eux, se tracent à chaque rendu, à la taille
     de la tuile : ce sont des éléments de composition, comme un éclairage, et
     il est juste qu'ils suivent le cadre. */
  const brin=n=>Matiere.seeded(0xFA9B1^Math.imul(n,2654435761));
  const cellule=(cx,cy)=>Matiere.seeded(0x5A17^Math.imul(cx,73856093)^Math.imul(cy,19349663));

  let grainW=0,grainH=0;
  function buildGrain(){
    /* Budget propre, plus large que celui des tampons redessinés à chaque
       image : cette couche-ci est statique, on peut se permettre du détail. */
    const lw=Math.max(innerWidth,1000),lh=Math.max(innerHeight,1000);
    const d=Math.min(2,window.devicePixelRatio||1);
    const s=Math.min(d,Math.sqrt(4e6/(lw*lh)));
    paper.width=Math.round(lw*s);paper.height=Math.round(lh*s);
    grainW=lw;grainH=lh;
    pctx.setTransform(s,0,0,s,0,0);
    pctx.clearRect(0,0,lw,lh);
    pctx.lineCap='round';pctx.lineJoin='round';

    /* plages de tons : irrégularités de la feuille */
    for(let i=0;i<10;i++){
      const r=brin(9000+i);
      const x=r()*lw,y=r()*lh,rr=(.15+r()*.3)*lh;
      const m=pctx.createRadialGradient(x,y,0,x,y,rr);
      m.addColorStop(0,r()<.5?'rgba(255,246,214,.13)':'rgba(150,120,66,.11)');
      m.addColorStop(1,'rgba(0,0,0,0)');
      pctx.fillStyle=m;pctx.beginPath();pctx.arc(x,y,rr,0,6.2832);pctx.fill();
    }

    const SEG=60;                    /* pas d'échantillonnage des ondulations */

    /* grain dominant : fibres horizontales, une tous les 0,9 px */
    const PAS_H=.9,nH=Math.ceil(lh/PAS_H);
    for(let i=0;i<nH;i++){
      const r=brin(i);
      const y=i*PAS_H+(r()*2-1)*PAS_H*1.6;
      pctx.strokeStyle=(r()<.5?'rgba(255,247,218,':'rgba(116,90,46,')+(.03+r()*.08).toFixed(3)+')';
      pctx.lineWidth=.6+r()*1.1;
      const amp=.4+r()*1.4,ph2=r()*6.2832,fq=.01+r()*.02;
      pctx.beginPath();
      for(let x=0;x<=lw;x+=SEG){const yy=y+Math.sin(x*fq+ph2)*amp;x?pctx.lineTo(x,yy):pctx.moveTo(x,yy);}
      pctx.stroke();
    }

    /* sous-couche : fibres croisées, plus rares et plus discrètes */
    const PAS_V=2,nV=Math.ceil(lw/PAS_V);
    for(let i=0;i<nV;i++){
      const r=brin(400000+i);
      const x=i*PAS_V+(r()*2-1)*PAS_V*1.4;
      pctx.strokeStyle=(r()<.5?'rgba(255,247,218,':'rgba(116,90,46,')+(.02+r()*.04).toFixed(3)+')';
      pctx.lineWidth=.6+r()*.8;
      const amp=.4+r()*1.2,ph2=r()*6.2832,fq=.01+r()*.02;
      pctx.beginPath();
      for(let y=0;y<=lh;y+=SEG){const xx=x+Math.sin(y*fq+ph2)*amp;y?pctx.lineTo(xx,y):pctx.moveTo(xx,y);}
      pctx.stroke();
    }

    /* jointures de lamelles : une bande tous les ~50 px */
    const PAS_J=50,nJ=Math.ceil(lh/PAS_J);
    for(let i=1;i<nJ;i++){
      const r=brin(800000+i);
      const y=i*PAS_J+(r()*2-1)*PAS_J*.4;
      pctx.strokeStyle='rgba(96,72,36,'+(.05+r()*.07).toFixed(3)+')';
      pctx.lineWidth=.8+r()*.8;
      const amp=.6+r()*1.4,ph2=r()*6.2832,fq=.008+r()*.012;
      pctx.beginPath();
      for(let x=0;x<=lw;x+=SEG){const yy=y+Math.sin(x*fq+ph2)*amp;x?pctx.lineTo(x,yy):pctx.moveTo(x,yy);}
      pctx.stroke();
    }

    /* taches d'âge : une par cellule de 51 px, graine tirée de ses coordonnées */
    const CEL=51;
    for(let cy=0;cy<Math.ceil(lh/CEL);cy++)
      for(let cx=0;cx<Math.ceil(lw/CEL);cx++){
        const r=cellule(cx,cy);
        if(r()>.62)continue;
        const x=(cx+r())*CEL,y=(cy+r())*CEL,rr=6+r()*20;
        const m=pctx.createRadialGradient(x,y,0,x,y,rr);
        m.addColorStop(0,'rgba(120,84,40,'+(.03+r()*.05).toFixed(3)+')');
        m.addColorStop(1,'rgba(120,84,40,0)');
        pctx.fillStyle=m;pctx.beginPath();pctx.arc(x,y,rr,0,6.2832);pctx.fill();
      }
  }



  /* les signes déjà écrits suivent l'agrandissement de la feuille */
  function transpose(sx,sy){
    for(const g of glyphs){g.x*=sx;g.y*=sy;}
    if(lastX>=0){lastX*=sx;lastY*=sy;}
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
    ctx.setTransform(canvas.width/W,0,0,canvas.height/H,0,0);
    ctx.clearRect(0,0,W,H);
    /* fond papyrus : composition, donc à la taille de la tuile */
    const g=ctx.createLinearGradient(0,0,W*.15,H);
    g.addColorStop(0,'#ecdcb0');g.addColorStop(.5,'#ddc890');g.addColorStop(1,'#ccb075');
    ctx.fillStyle=g;ctx.fillRect(0,0,W,H);
    /* grain 1:1 : la tuile en montre ce qu'elle peut, jamais étiré */
    ctx.drawImage(paper,0,0,grainW,grainH);
    /* bords vieillis : composition */
    const vg=ctx.createRadialGradient(W*.5,H*.5,H*.3,W*.5,H*.5,H*.82);
    vg.addColorStop(0,'rgba(0,0,0,0)');vg.addColorStop(1,'rgba(70,46,18,.28)');
    ctx.fillStyle=vg;ctx.fillRect(0,0,W,H);
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

  buildGrain();
  let grainT=0;
  addEventListener('resize',()=>{
    clearTimeout(grainT);
    grainT=setTimeout(()=>{
      if(innerWidth>grainW||innerHeight>grainH){buildGrain();dirty=true;render();}
    },400);
  });

  Matiere.sizing(panel,canvas,{
    setSize:(w,h)=>{W=w;H=h;},
    transpose,
    /* Le tampon seul est redimensionné : le grain, lui, ne bouge jamais. */
    alloc:(bw,bh)=>{canvas.width=bw;canvas.height=bh;},
    remap:()=>{dirty=true;},
    redraw:render
  });

  const pos=e=>{const r=panel.getBoundingClientRect();return[e.clientX-r.left,e.clientY-r.top];};
  panel.addEventListener('pointermove',e=>{const[x,y]=pos(e);onMove(x,y);});
  panel.addEventListener('pointerdown',e=>{const[x,y]=pos(e);seqI=0;lastX=x;lastY=y;drop(x,y);});
  panel.addEventListener('pointerleave',()=>{lastX=-1;lastY=-1;acc=0;});

  loop();
})();
