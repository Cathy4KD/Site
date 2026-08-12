/* ============================================================
   COPEAUX : simulation d'usinage. Un outil carbure coupe le métal ;
   au point de coupe incandescent jaillissent des copeaux (arc
   balistique + rotation, refroidissant du jaune au bleu acier) et
   une gerbe d'étincelles chaudes qui éclatent en fin de course.
   ============================================================ */
(function(){
  const panel=document.querySelector('.p-cop');
  if(!panel) return;
  const canvas=panel.querySelector('.cop-sim');
  const ctx=canvas&&canvas.getContext('2d');
  if(!ctx) return;
  const reduce=matchMedia('(prefers-reduced-motion:reduce)').matches;
  const R=(a,b)=>a+Math.random()*(b-a);
  let W=0,H=0,Px=0,Py=0;

  /* fond métal brossé pré-rendu */
  const mc=document.createElement('canvas'),mx=mc.getContext('2d');
  /* couche persistante des traces d'usinage (rainures laissées par l'outil) */
  const tr=document.createElement('canvas'),trx=tr.getContext('2d');

  /* trace de fraisage : le tracé est mémorisé, puis toute la rainure est
     REDESSINÉE lissée à chaque frame (traits épais empilés, jointures
     rondes) → bande continue, sans carrés ni recouvrements visibles. */
  const path=[];const LIFE=6;               /* durée de vie de la trace (s) */
  function pushPoint(x,y,t){path.push({x,y,t});}
  const TLAYERS=[[26,'#1a2836'],[22,'#6f88a2']];
  function drawTrace(tS){
    while(path.length&&path[0].t<tS-LIFE)path.shift();
    trx.clearRect(0,0,W,H);
    if(path.length<2)return;
    trx.lineCap='round';trx.lineJoin='round';
    for(const L of TLAYERS){
      trx.strokeStyle=L[1];trx.lineWidth=L[0];
      trx.beginPath();trx.moveTo(path[0].x,path[0].y);
      for(let i=1;i<path.length;i++)trx.lineTo(path[i].x,path[i].y);
      trx.stroke();
    }
  }
  /* Brossage en pixels réels, à densité constante — voir fibre.js. Chaque trait
     tire sa graine de son indice : en ajouter en bas ne déplace pas ceux du
     haut, et le grain ne grossit pas quand la tuile s'agrandit. */
  const trait=n=>Matiere.seeded(0x5EED1^Math.imul(n,2654435761));

  function buildMetal(pw,ph,W,H){   /* W,H : dimensions CIBLES */
    mc.width=pw;mc.height=ph;
    mx.setTransform(pw/W,0,0,ph/H,0,0);

    const g=mx.createLinearGradient(0,0,W*.3,H);
    g.addColorStop(0,'#2c3a4a');g.addColorStop(.4,'#20303f');
    g.addColorStop(.72,'#182430');g.addColorStop(1,'#0d141c');
    mx.fillStyle=g;mx.fillRect(0,0,W,H);

    /* rayures de brossage : une tous les 0,7 px */
    const PAS=.7,n=Math.ceil(H/PAS);
    for(let i=0;i<n;i++){
      const r=trait(i);
      const y=i*PAS+(r()*2-1)*PAS*1.5;
      mx.strokeStyle=(r()<.5?'rgba(190,215,240,':'rgba(8,14,22,')+(.02+r()*.05).toFixed(3)+')';
      mx.lineWidth=.5+r()*.8;
      mx.beginPath();mx.moveTo(0,y);mx.lineTo(W,y+(r()*2-1));mx.stroke();
    }

    const rg=mx.createRadialGradient(W*.4,H*.3,4,W*.4,H*.3,W*1.1);
    rg.addColorStop(0,'rgba(168,196,224,.12)');rg.addColorStop(1,'rgba(168,196,224,0)');
    mx.fillStyle=rg;mx.fillRect(0,0,W,H);
    const vg=mx.createRadialGradient(W*.5,H*.5,H*.3,W*.5,H*.5,H*.82);
    vg.addColorStop(0,'rgba(0,0,0,0)');vg.addColorStop(1,'rgba(0,0,0,.42)');
    mx.fillStyle=vg;mx.fillRect(0,0,W,H);
  }

  /* On transpose l état au lieu de le jeter : effacer la rainure et renvoyer
     l outil au centre coupait net le geste en cours. */
  function transpose(sx,sy){
    for(const p of path){p.x*=sx;p.y*=sy;}
    for(const c of chips){c.x*=sx;c.y*=sy;}
    for(const s of sparks){s.x*=sx;s.y*=sy;}
    Px*=sx;Py*=sy;
  }
  function matrices(){
    ctx.setTransform(canvas.width/W,0,0,canvas.height/H,0,0);
    trx.setTransform(tr.width/W,0,0,tr.height/H,0,0);
  }

  const chips=[],sparks=[];
  let dirx=1,diry=0;                         /* sens de coupe = dernier mouvement souris */
  function spawnChip(){
    const k=Math.random();
    const ang=Math.atan2(-diry,-dirx)+R(-.6,.6),sp=R(55,150);
    chips.push({x:Px+R(-3,3),y:Py+R(-3,3),
      vx:Math.cos(ang)*sp,vy:Math.sin(ang)*sp-R(50,140),
      rot:R(0,6.28),vr:R(-9,9),r:R(6,15),w:R(2,3.4),
      kind:k<.4?'coil':(k<.75?'arc':'needle'),age:0,life:R(1.2,2.2)});
  }
  function spawnSpark(x,y,speedMul){
    const ang=Math.atan2(-diry,-dirx)+R(-.7,.7),sp=R(180,470)*(speedMul||1);
    sparks.push({x:(x==null?Px:x)+R(-2,2),y:(y==null?Py:y)+R(-2,2),
      vx:Math.cos(ang)*sp,vy:Math.sin(ang)*sp-R(20,80),age:0,life:R(.3,.85),
      w:R(.8,1.7),fork:Math.random()<.14});
  }

  const mix=(a,b,u)=>[a[0]+(b[0]-a[0])*u,a[1]+(b[1]-a[1])*u,a[2]+(b[2]-a[2])*u];
  /* couleurs de revenu de l'acier : argenté → paille → violet → bleu d'usinage */
  function chipColor(t){
    const A=[214,224,234],B=[198,184,150],C=[124,124,182],D=[42,96,205];
    if(t<.3)return mix(A,B,t/.3);
    if(t<.6)return mix(B,C,(t-.3)/.3);
    return mix(C,D,Math.min(1,(t-.6)/.4));
  }
  function drawChip(p){
    const t=p.age/p.life,c=chipColor(t);
    ctx.save();ctx.translate(p.x,p.y);ctx.rotate(p.rot);
    ctx.lineCap='round';ctx.lineWidth=p.w;
    ctx.strokeStyle='rgb('+(c[0]|0)+','+(c[1]|0)+','+(c[2]|0)+')';
    ctx.beginPath();
    if(p.kind==='coil'){ctx.arc(0,0,p.r,.2,4.3);ctx.stroke();ctx.beginPath();ctx.arc(p.r*.55,0,p.r*.6,-.4,3.4);}
    else if(p.kind==='arc'){ctx.arc(0,0,p.r,.4,3.5);}
    else{ctx.moveTo(-p.r,0);ctx.lineTo(p.r,0);}
    ctx.stroke();
    ctx.strokeStyle='rgba(255,255,255,'+(.4*(1-t)).toFixed(3)+')';ctx.lineWidth=p.w*.4;ctx.stroke();
    ctx.restore();
  }
  /* plaquette d'outil (insert carbure) : coin de coupe au contact, corps
     qui traîne derrière le sens de déplacement */
  function drawInsert(){
    ctx.save();ctx.translate(Px,Py);ctx.rotate(Math.atan2(diry,dirx));
    ctx.beginPath();
    ctx.moveTo(3,0);ctx.lineTo(-8,-10);ctx.lineTo(-26,-6);
    ctx.lineTo(-26,6);ctx.lineTo(-8,10);ctx.closePath();
    const g=ctx.createLinearGradient(-26,-10,-4,10);
    g.addColorStop(0,'#26313c');g.addColorStop(.5,'#4c5b69');g.addColorStop(1,'#657585');
    ctx.fillStyle=g;ctx.fill();
    ctx.strokeStyle='rgba(18,26,36,.7)';ctx.lineWidth=1;ctx.stroke();
    ctx.strokeStyle='rgba(226,239,252,.9)';ctx.lineWidth=1.6;ctx.lineJoin='round';
    ctx.beginPath();ctx.moveTo(-8,-10);ctx.lineTo(3,0);ctx.lineTo(-8,10);ctx.stroke();
    ctx.restore();
  }
  function drawGlow(fl){
    ctx.globalCompositeOperation='lighter';
    const gg=ctx.createRadialGradient(Px,Py,0,Px,Py,44);
    gg.addColorStop(0,'rgba(255,250,232,'+(.9*fl).toFixed(3)+')');
    gg.addColorStop(.25,'rgba(255,200,120,'+(.6*fl).toFixed(3)+')');
    gg.addColorStop(.6,'rgba(255,120,40,'+(.24*fl).toFixed(3)+')');
    gg.addColorStop(1,'rgba(255,80,20,0)');
    ctx.fillStyle=gg;ctx.beginPath();ctx.arc(Px,Py,44,0,6.2832);ctx.fill();
    ctx.globalCompositeOperation='source-over';
  }

  function drawStatic(){
    ctx.setTransform(canvas.width/W,0,0,canvas.height/H,0,0);ctx.clearRect(0,0,W,H);
    ctx.drawImage(mc,0,0,W,H);drawInsert();drawGlow(.9);
    for(let i=0;i<9;i++){const a=-2.3+i*.16;
      drawChip({x:Px+Math.cos(a)*(30+i*10),y:Py+Math.sin(a)*(30+i*9),
        rot:a,r:4+i%3*2,w:2,kind:i%3===0?'coil':(i%3===1?'arc':'needle'),
        age:.4+i*.06,life:1});}
  }

  let last=0,accC=0,accS=0,cut=0,over=false;
  function render(now){
    /* voir acier.js : dt borné à zéro, sinon un redessin hors rAF le rend
       négatif et les copeaux repartent à l'envers */
    const dt=Math.max(0,Math.min(.05,(now-last)/1000));last=now;
    cut=Math.max(0,cut-dt*2.6);                 /* la coupe retombe quand on arrête */
    if(over&&cut>.02){
      accC+=dt*cut*24;while(accC>=1){accC--;spawnChip();}
      accS+=dt*cut*230;while(accS>=1){accS--;spawnSpark();}
    }
    ctx.setTransform(canvas.width/W,0,0,canvas.height/H,0,0);ctx.clearRect(0,0,W,H);
    ctx.drawImage(mc,0,0,W,H);
    /* rainure entière redessinée lissée, puis composée à opacité fixe */
    drawTrace(now/1000);
    ctx.globalAlpha=.6;ctx.drawImage(tr,0,0,W,H);ctx.globalAlpha=1;
    if(cut>.02){
      drawInsert();
      drawGlow(Math.min(1,cut)*(.75+.25*Math.sin(now*.05))+R(-.03,.03));
    }
    for(let i=chips.length-1;i>=0;i--){const p=chips[i];
      p.age+=dt;p.vy+=300*dt;p.x+=p.vx*dt;p.y+=p.vy*dt;p.rot+=p.vr*dt;
      if(p.age>p.life||p.y>H+20){chips.splice(i,1);continue;}
      drawChip(p);
    }
    ctx.globalCompositeOperation='lighter';
    for(let i=sparks.length-1;i>=0;i--){const s=sparks[i];
      s.age+=dt;const px=s.x,py=s.y;
      s.vx*=(1-1.6*dt);s.vy=s.vy*(1-1.6*dt)+340*dt;
      s.x+=s.vx*dt;s.y+=s.vy*dt;
      if(s.age>s.life||s.y>H+10){
        if(s.fork&&s.y<H)for(let j=0;j<3;j++)spawnSpark(s.x,s.y,.35);
        sparks.splice(i,1);continue;
      }
      const a=1-s.age/s.life;
      ctx.strokeStyle='rgba(255,'+(140+120*a|0)+','+(40+50*a|0)+','+a.toFixed(2)+')';
      ctx.lineWidth=s.w;
      ctx.beginPath();ctx.moveTo(px,py);ctx.lineTo(s.x,s.y);ctx.stroke();
    }
    ctx.globalCompositeOperation='source-over';
  }
  function frame(now){render(now);requestAnimationFrame(frame);}

  /* interaction : la plaquette coupe là où passe la souris */
  let pmx=-1,pmy=-1;
  const pos=e=>{const r=panel.getBoundingClientRect();return[e.clientX-r.left,e.clientY-r.top];};
  panel.addEventListener('pointermove',e=>{
    const [x,y]=pos(e);over=true;
    if(pmx>=0){const dx=x-pmx,dy=y-pmy,d=Math.hypot(dx,dy);
      if(d>.01){dirx=dx/d;diry=dy/d;pushPoint(x,y,performance.now()/1000);}
      cut=Math.min(1,cut+d*.05);}                 /* plus tu vas vite, plus ça coupe */
    pmx=x;pmy=y;Px=x;Py=y;
  });
  panel.addEventListener('pointerenter',e=>{const[x,y]=pos(e);pmx=x;pmy=y;Px=x;Py=y;over=true;});
  panel.addEventListener('pointerleave',()=>{over=false;pmx=-1;pmy=-1;});

  Matiere.sizing(panel,canvas,{
    setSize:(w,h)=>{if(!W){Px=w*.5;Py=h*.45;}W=w;H=h;},
    transpose,
    /* le métal se rebâtit avec le tampon, à sa taille — voir fibre.js */
    alloc:(bw,bh,lw,lh)=>{canvas.width=bw;canvas.height=bh;
                    tr.width=bw;tr.height=bh;matrices();
                    buildMetal(bw,bh,lw,lh);if(reduce)drawStatic();},
    remap:matrices,
    redraw:()=>{if(!reduce)render(last);}
  });
  if(!reduce){last=performance.now();requestAnimationFrame(frame);}
})();
