/* gerbe d'aciérie : étincelles CSS de secours (masquées dès que le canvas prend le relais) */
(function(){
  const g=document.querySelector('.gerbe');
  const R=(a,b)=>a+Math.random()*(b-a);
  for(let i=0;i<150;i++){
    const s=document.createElement('div');
    s.className='splash';
    const side=Math.random()<.5?-1:1;
    s.style.cssText=`--dx:${(side*R(8,130)).toFixed(0)}px;--peak:${(-R(40,230)).toFixed(0)}px;`+
      `--dur:${R(1,2.4).toFixed(2)}s;--delay:${R(0,4).toFixed(2)}s;`+
      `--s:${Math.random()<.25?'4px':(Math.random()<.5?'2px':'3px')}`;
    g.appendChild(s);
  }
  for(let i=0;i<30;i++){
    const p=document.createElement('div');
    p.className='spatter';
    p.style.cssText=`--dx:${R(-34,34).toFixed(0)}px;--dy:${(-R(4,30)).toFixed(0)}px;`+
      `--dur:${R(.7,1.3).toFixed(2)}s;--delay:${R(0,1.6).toFixed(2)}s`;
    g.appendChild(p);
  }
})();

/* ============================================================
   ACIER : coulée interactive sur canvas
   une sphère suit le curseur ; la lave épouse son contour et
   coule d'un côté ou des deux selon la position. Aux transitions,
   l'ancien tronçon se détache et tombe, la nouvelle branche
   "pousse" depuis la sphère (tête qui chute) avant l'impact.
   ============================================================ */
(function(){
  if(matchMedia('(prefers-reduced-motion:reduce)').matches) return;
  const panel=document.querySelector('.p-aci');
  if(!panel) return;
  const canvas=panel.querySelector('.lava-gl');
  const ctx=canvas&&canvas.getContext('2d');
  if(!ctx) return;                      /* pas de canvas : coulée CSS statique */
  panel.classList.add('canvasjet');
  const STREAM=.56, R=15, CATCH=R+16, GRAV=2600;
  let W=0,H=0,mx=-1,my=-1;
  let bx=-200,by=-200,heat=0;          /* sphère amortie + chauffe progressive */

  /* Affecter canvas.width réalloue le tampon ET l'efface : c'est l'opération
     chère. Les deux extrêmes que j'ai essayés sont mauvais — le redimensionner
     à chaque image du survol (une cinquantaine de fois, sur cinq tuiles) coûte
     la fluidité ; ne jamais le redimensionner donne du flou, un mauvais
     rapport d'aspect, puis un saut en fin de course.

     Compromis : on réaligne le tampon au plus une fois toutes les 100 ms, et
     la matrice absorbe l'écart résiduel — qui reste sous les 10 %, donc
     invisible, là où 80 % ne l'était pas. La géométrie est ainsi juste en
     permanence, pour huit réallocations par transition au lieu de cinquante.

     À noter : les rappels de ResizeObserver s'exécutent APRÈS les
     requestAnimationFrame mais AVANT le rendu. Comme la réallocation efface le
     canvas, il faut redessiner dans le même rappel, sinon une image
     entièrement vide s'affiche — c'était le clignotement. */
  /* Étincelles et tronçons en vol sont transposés vers la nouvelle taille :
     sinon ils sautaient d'un coup. Le garde « oldW » saute ce bloc au tout
     premier appel, où parts et branches ne sont pas encore déclarés. */
  function transpose(sx,sy){
    for(const p of parts){p.x*=sx;p.y*=sy;}
    branches.forEach(b=>{b.tipY*=sy;});
    for(const rm of remnants){rm.topY*=sy;rm.cx*=sx;rm.cy*=sy;}
  }
  Matiere.sizing(panel,canvas,{
    setSize:(w,h)=>{W=w;H=h;},
    transpose,
    alloc:(bw,bh)=>{canvas.width=bw;canvas.height=bh;
                    ctx.setTransform(bw/W,0,0,bh/H,0,0);},
    remap:()=>ctx.setTransform(canvas.width/W,0,0,canvas.height/H,0,0),
    redraw:()=>step(lastT)
  });

  panel.addEventListener('pointermove',e=>{
    const r=panel.getBoundingClientRect();
    mx=e.clientX-r.left;my=e.clientY-r.top;
  });
  panel.addEventListener('pointerleave',()=>{mx=-1;my=-1});

  const smooth=(a,b,x)=>{const t=Math.max(0,Math.min(1,(x-a)/(b-a)));return t*t*(3-2*t)};
  const rnd=(a,b)=>a+Math.random()*(b-a);

  /* --- particules : étincelles, éclaboussures, gouttes (gravité + rebond) --- */
  const parts=[];
  function spawn(x,y,vx,vy,size,life,canBurst){
    if(parts.length>900)parts.shift();
    /* une partie des étincelles éclate en vol (le carbone explose) */
    const burstAt=canBurst&&Math.random()<.65?life*rnd(.2,.6):0;
    parts.push({x,y,vx,vy,size,life,age:0,burstAt});
  }
  function burst(p){
    const n=4+(Math.random()*5|0);
    for(let j=0;j<n;j++){
      const a=rnd(0,Math.PI*2),v=rnd(90,380);
      spawn(p.x,p.y,p.vx*.5+Math.cos(a)*v,p.vy*.35+Math.sin(a)*v,
        p.size*rnd(.35,.55),rnd(.3,.8),false);
    }
  }
  function stepParts(dt){
    for(let i=parts.length-1;i>=0;i--){
      const p=parts[i];
      p.age+=dt;
      if(p.age>=p.life){parts.splice(i,1);continue}
      if(p.burstAt&&p.age>=p.burstAt){parts.splice(i,1);burst(p);continue}
      p.vy+=GRAV*.5*dt;p.vx*=1-.22*dt;
      p.x+=p.vx*dt;p.y+=p.vy*dt;
      if(p.y>H){p.y=H;p.vy*=-.35;p.vx*=.6;p.age+=p.life*.25}
    }
  }
  function drawParts(){
    parts.forEach(p=>{
      const a=1-p.age/p.life;
      ctx.fillStyle=`rgba(255,140,40,${(.30*a).toFixed(3)})`;
      ctx.beginPath();ctx.arc(p.x,p.y,p.size*2.4,0,Math.PI*2);ctx.fill();
      ctx.fillStyle=`rgba(255,240,200,${(.95*a).toFixed(3)})`;
      ctx.beginPath();ctx.arc(p.x,p.y,p.size,0,Math.PI*2);ctx.fill();
    });
  }

  /* pseudo-bruit 1D : sinus superposés à fréquences incommensurables,
     chaque octave descend à sa propre vitesse → jamais de motif répété */
  function noise(y,t,ph){
    return Math.sin(y*.028-t*9.4+ph)
      +.55*Math.sin(y*.061-t*14.6+ph*1.7+1.3)
      +.22*Math.sin(y*.117-t*5.8+ph*2.9+4.1)
      +.08*Math.sin(y*.219-t*22.2+ph*.6+2.2);
  }

  /* --- géométrie d'une branche : suit le contour exact de la sphère ---
     la lave frappe le sommet, glisse le long de l'arc du cercle,
     puis retombe tangente au flanc en reconvergeant légèrement */
  function buildBranch(side,active,cx,cy,t,phase,baseW){
    const sx=W*STREAM,clear=R+5,pts=[];
    const wrap=active&&side!==0;
    for(let y=0;y<=H;y+=3){
      let x=sx+.9*noise(y,t,phase*2.1);
      if(wrap){
        const dy=y-cy;
        /* pénétration de la sphère dans le jet : 0 = tangente, 1 = en plein axe */
        const pen=Math.max(0,Math.min(1,(clear-side*(x-cx))/clear));
        if(dy>-clear&&dy<0){
          /* au-dessus de l'équateur : dévié UNIQUEMENT là où le cercle bloque */
          const chord=Math.sqrt(clear*clear-dy*dy);
          if(side*(x-cx)<chord)x=cx+side*chord;
        }else if(dy>=0){
          /* sous l'équateur : chute décalée proportionnellement à la pénétration */
          const eqX=cx+side*Math.max(clear,side*(x-cx));
          const fall=x+side*clear*1.35*pen;
          const c2=eqX+(fall-eqX)*smooth(0,60,dy);
          if(side*(c2-x)>0)x=c2;
          if(dy>clear)x+=.8*Math.sin(y*.06-t*7+phase);
        }
      }
      const w=baseW*(1-.12*y/H)*(1+.09*noise(y*.8,t*1.8,phase+3.7));
      pts.push([x,y,Math.max(2.5,w)]);
    }
    return pts;
  }

  /* remplissage à largeur variable (bords gauche puis droit) */
  function fillPoly(pts,scale,color,blur){
    if(pts.length<2)return;
    ctx.beginPath();
    pts.forEach((p,i)=>{const x=p[0]-p[2]*scale*.5;
      i?ctx.lineTo(x,p[1]):ctx.moveTo(x,p[1])});
    for(let i=pts.length-1;i>=0;i--)
      ctx.lineTo(pts[i][0]+pts[i][2]*scale*.5,pts[i][1]);
    ctx.closePath();
    ctx.fillStyle=color;ctx.filter=blur?`blur(${blur}px)`:'none';
    ctx.fill();ctx.filter='none';
  }

  function drawStream(pts,t,k,flick){
    if(pts.length<2)return;
    fillPoly(pts,2.6,`rgba(255,115,25,${(.28*flick).toFixed(3)})`,9);
    fillPoly(pts,1.45,`rgba(255,170,70,${(.55*flick).toFixed(3)})`,3);
    fillPoly(pts,1,'#ffb95e');
    fillPoly(pts,.5,'#fff3d0');
    /* filets brillants qui descendent le long du jet */
    ctx.beginPath();
    pts.forEach((p,i)=>i?ctx.lineTo(p[0],p[1]):ctx.moveTo(p[0],p[1]));
    ctx.strokeStyle='rgba(255,255,245,.5)';
    ctx.lineWidth=Math.max(1.5,pts[0][2]*.28);
    ctx.lineCap='round';
    ctx.setLineDash([6+k*3.7%9,14+k*5.3%13,11+k*2.9%7,19+k*4.1%11]);
    ctx.lineDashOffset=-t*340-k*11;
    ctx.stroke();ctx.setLineDash([]);
  }

  function drawImpact(x,t,k,dt){
    const pulse=1+.35*Math.sin(t*14+k*2);
    const g=ctx.createRadialGradient(x,H,2,x,H,26*pulse);
    g.addColorStop(0,'rgba(255,243,208,.95)');
    g.addColorStop(.35,'rgba(255,190,90,.55)');
    g.addColorStop(1,'rgba(255,120,30,0)');
    ctx.fillStyle=g;
    ctx.beginPath();ctx.ellipse(x,H,30*pulse,13*pulse,0,0,Math.PI*2);ctx.fill();
    /* fontaine d'étincelles à l'impact : gerbe dense, balistique + éclatements */
    const n=2+(Math.random()*4|0)+(Math.random()<dt*160?2:0);
    for(let i=0;i<n;i++)
      spawn(x+rnd(-9,9),H-3,rnd(-340,340),rnd(-720,-180),rnd(.8,2.4),rnd(.8,2.2),true);
  }

  function drawSphere(t){
    const glow=Math.min(1,heat);
    ctx.globalCompositeOperation='lighter';
    /* grande lueur qui inonde le fond au point de contact lave/sphère */
    const cyc=by-R;                      /* le contact est au sommet de la bille */
    const flash=.5+.5*glow+.08*Math.sin(t*31)+.05*Math.sin(t*47);
    const b=ctx.createRadialGradient(bx,cyc,2,bx,cyc,R*7);
    b.addColorStop(0,`rgba(255,220,150,${(.50*flash).toFixed(3)})`);
    b.addColorStop(.25,`rgba(255,160,60,${(.30*flash).toFixed(3)})`);
    b.addColorStop(1,'rgba(255,110,25,0)');
    ctx.fillStyle=b;ctx.beginPath();ctx.arc(bx,cyc,R*7,0,Math.PI*2);ctx.fill();
    ctx.globalCompositeOperation='source-over';
    /* bouclier invisible : seule la lave qui glisse dessus le révèle —
       liseré incandescent le long de l'arc + calotte qui s'accumule dessus */
    ctx.filter='blur(1.2px)';
    ctx.strokeStyle=`rgba(255,215,140,${(.6+.35*glow).toFixed(3)})`;
    ctx.lineWidth=2.5+1.5*glow;
    ctx.beginPath();ctx.arc(bx,by,R+1.5,-Math.PI*.88,-Math.PI*.12);ctx.stroke();
    ctx.fillStyle=`rgba(255,190,100,${(.55+.3*glow).toFixed(3)})`;
    ctx.beginPath();
    ctx.ellipse(bx,by-R+1.5,R*.62,3.2+1.2*Math.sin(t*9),0,Math.PI,0);ctx.fill();
    ctx.filter='none';
  }

  /* branches vivantes (tête qui pousse) + tronçons détachés (qui tombent) */
  let branches=new Map(),remnants=[],lastT=performance.now();
  const t0=lastT;

  function step(now){
    /* dt borné à zéro par le bas : un redessin déclenché hors rAF passe un
       horodatage postérieur à celui de l'image suivante, ce qui rendait dt
       négatif — particules à reculons et phase du bruit qui saute. */
    const t=(now-t0)/1000,dt=Math.max(0,Math.min(.05,(now-lastT)/1000));lastT=now;
    if(!W)return;
    ctx.clearRect(0,0,W,H);
    const sx=W*STREAM;
    /* la sphère suit le curseur avec un amorti (mouvement organique) */
    if(mx>=0){
      if(bx<-100){bx=mx;by=my}
      bx+=(mx-bx)*Math.min(1,dt*16);by+=(my-by)*Math.min(1,dt*16);
    }else{bx=-200;by=-200}
    const active=mx>=0&&Math.abs(bx-sx)<CATCH&&by>6&&by<H-10;
    heat=active?Math.min(1.3,heat+dt*.8):Math.max(0,heat-dt*1.4);

    /* répartition continue du débit entre les deux flancs :
       curseur à droite → plus de lave à gauche, et inversement */
    let want;
    if(!active)want=[{key:'c',side:0,w:15}];
    else{
      const c=Math.max(-1,Math.min(1,(bx-sx)/CATCH));
      const shareL=smooth(-.7,.7,c),shareR=1-shareL;
      want=[];
      if(shareL>.05)want.push({key:'l',side:-1,w:3+12*Math.sqrt(shareL)});
      if(shareR>.05)want.push({key:'r',side:1,w:3+12*Math.sqrt(shareR)});
    }
    const startY=active?by:0;
    /* nouvelles branches : la tête part du point de coupe et tombe ;
       la largeur suit sa cible avec un lissage (transitions douces) */
    want.forEach(b=>{
      if(!branches.has(b.key))
        branches.set(b.key,{tipY:startY,v:80,w:Math.max(3,b.w*.4),
          side:b.side,phase:rnd(0,7)});
      const s=branches.get(b.key);
      s.side=b.side;
      s.w+=(b.w-s.w)*Math.min(1,dt*9);
    });
    /* branches taries : le tronçon se détache et tombe */
    [...branches.keys()].forEach(key=>{
      if(!want.find(b=>b.key===key)){
        const s=branches.get(key);
        remnants.push({side:s.side,w:s.w,cx:bx,cy:by,
          wasActive:key!=='c',topY:Math.max(0,startY),v:0,phase:s.phase});
        branches.delete(key);
      }
    });

    ctx.globalCompositeOperation='lighter';
    const flick=.9+.1*Math.sin(t*7)+.04*Math.sin(t*23);
    let k=0;
    branches.forEach(s=>{
      if(s.tipY<H){s.v+=GRAV*dt;s.tipY=Math.min(H,s.tipY+s.v*dt)}
      const pts=buildBranch(s.side,active,bx,by,t,s.phase,s.w)
        .filter(p=>p[1]<=s.tipY);
      drawStream(pts,t,k,flick);
      if(pts.length){
        if(s.tipY>=H)drawImpact(pts[pts.length-1][0],t,k,dt);
        else{ /* tête qui tombe : goutte renflée */
          const tip=pts[pts.length-1];
          ctx.fillStyle='#fff3d0';
          ctx.beginPath();
          ctx.ellipse(tip[0],tip[1],tip[2]*.8,tip[2]*1.3,0,0,Math.PI*2);ctx.fill();
        }
      }
      k++;
    });
    /* tronçons détachés : drainent par le haut, gouttelettes à la queue */
    remnants=remnants.filter(rm=>{
      rm.v+=GRAV*dt;rm.topY+=rm.v*dt;
      if(rm.topY>=H)return false;
      const pts=buildBranch(rm.side,rm.wasActive,rm.cx,rm.cy,t,rm.phase,rm.w)
        .filter(p=>p[1]>=rm.topY);
      drawStream(pts,t,k,flick*.9);
      if(pts.length){
        drawImpact(pts[pts.length-1][0],t,k,dt);
        const top=pts[0];
        if(Math.random()<dt*24)
          spawn(top[0]+rnd(-3,3),top[1],rnd(-30,30),rm.v*.5,rnd(1,2),rnd(.4,.8));
      }
      k++;return true;
    });
    stepParts(dt);drawParts();
    ctx.globalCompositeOperation='source-over';

    if(active){
      drawSphere(t);
      /* gerbe au contact : étincelles projetées du côté de la déviation */
      const c=(bx-sx)/CATCH,both=Math.abs(c)<.4;
      if(Math.random()<dt*55){
        const dir=both?(Math.random()<.5?-1:1):(c<0?1:-1);
        spawn(bx+dir*rnd(2,8),by-R-2,dir*rnd(120,520),rnd(-560,-160),rnd(1,2.4),rnd(.8,1.8),true);
      }
      /* la lave perle sous la sphère quand elle est bien chaude */
      if(heat>.4&&Math.random()<dt*4)
        spawn(bx+rnd(-R*.5,R*.5),by+R-2,rnd(-15,15),rnd(0,40),rnd(1.6,2.6),rnd(.7,1.3));
    }
  }
  (function loop(now){requestAnimationFrame(loop);step(now);})(performance.now());
})();
