/* ============================================================
   EAU : simulation liquide interactive
   heightfield 2D : ondes qui se propagent, réfraction du fond,
   houle permanente, vagues à la souris, splash au clic
   ============================================================ */
(function(){
  if(matchMedia('(prefers-reduced-motion:reduce)').matches) return;

  const CONFIGS=[
    {sel:'.p-eau',rate:.7,damp:.982,refract:2.2,rain:.10,
     spec:[215,255,250],shade:[2,26,36],
     stops:[[0,'#0d9aa0'],[.30,'#076a76'],[.55,'#054453'],[.78,'#03303e'],[1,'#021a24']]}];

  function makeBackground(w,h,cfg){
    const c=document.createElement('canvas');c.width=w;c.height=h;
    const x=c.getContext('2d');
    const g=x.createLinearGradient(0,0,w*.25,h);
    cfg.stops.forEach(s=>g.addColorStop(s[0],s[1]));
    x.fillStyle=g;x.fillRect(0,0,w,h);
    const r=x.createRadialGradient(w*.5,h*.30,4,w*.5,h*.30,w*.9);
    r.addColorStop(0,'rgba(255,255,255,.30)');r.addColorStop(1,'rgba(255,255,255,0)');
    x.fillStyle=r;x.fillRect(0,0,w,h);
    return x.getImageData(0,0,w,h).data;
  }

  function initPanel(cfg){
    const panel=document.querySelector(cfg.sel);
    if(!panel) return null;
    const canvas=panel.querySelector('.liquid-sim');
    const ctx=canvas&&canvas.getContext('2d');
    if(!ctx) return null;
    let w=0,h=0,curr,prev,bg,img;

    /* la tuile passe en plein écran à l'ouverture du chapitre : sans plafond,
       le heightfield exploserait (chaque cellule est traitée deux fois par
       image). On plafonne la grille — le rendu est de toute façon adouci
       par l'agrandissement CSS du canvas. */
    const MAXW=420,MAXH=560;
    function rebuild(){
      const r=panel.getBoundingClientRect();
      const nw=Math.min(MAXW,Math.max(60,Math.round(r.width/2)));
      const nh=Math.min(MAXH,Math.max(60,Math.round(r.height/2)));
      if(nw===w&&nh===h)return;          /* rien n'a bougé : on ne jette rien */
      /* On REPORTE les ondes en cours sur la nouvelle grille (plus proche
         voisin) plutôt que de repartir d'une surface plate : sans cela, l'eau
         que l'on venait d'agiter redevenait lisse à la fin de l'élargissement,
         ce qui coupait net le geste. */
      const oc=curr,op=prev,ow=w,oh=h;
      w=nw;h=nh;
      canvas.width=w;canvas.height=h;
      const nc=new Float32Array(w*h),np=new Float32Array(w*h);
      if(oc&&ow&&oh){
        for(let y=0;y<h;y++){
          const so=Math.min(oh-1,(y*oh/h)|0)*ow,dn=y*w;
          for(let x=0;x<w;x++){
            const sx=Math.min(ow-1,(x*ow/w)|0);
            nc[dn+x]=oc[so+sx];np[dn+x]=op[so+sx];
          }
        }
      }
      curr=nc;prev=np;
      bg=makeBackground(w,h,cfg);
      img=ctx.createImageData(w,h);
    }
    /* Contrairement aux autres matières, la grille ne peut pas être
       redimensionnée à bas coût : il faut réallouer deux Float32Array et
       re-rendre le fond. Pendant le survol (« flex » animé sur 0,85 s),
       ResizeObserver tire à chaque image — on remettait donc l'eau à plat
       cinquante fois de suite, ondes comprises. Tout est différé : le temps
       de la transition, l'ancienne grille est simplement étirée par le CSS,
       ce qui ne se voit pas sur une surface d'eau. */
    let resizeT=0;
    rebuild();
    new ResizeObserver(()=>{
      clearTimeout(resizeT);
      resizeT=setTimeout(rebuild,150);
    }).observe(panel);

    function disturb(px,py,radius,strength){
      const x0=Math.round(px),y0=Math.round(py);
      for(let dy=-radius;dy<=radius;dy++)for(let dx=-radius;dx<=radius;dx++){
        const x=x0+dx,y=y0+dy;
        if(x<1||y<1||x>=w-1||y>=h-1)continue;
        const d=Math.hypot(dx,dy);
        if(d<=radius)curr[y*w+x]+=strength*Math.cos(d/radius*Math.PI/2);
      }
    }

    function step(){
      for(let y=1;y<h-1;y++){
        const row=y*w;
        for(let x=1;x<w-1;x++){
          const i=row+x;
          let v=(curr[i-1]+curr[i+1]+curr[i-w]+curr[i+w])*.5-prev[i];
          prev[i]=v*cfg.damp;
        }
      }
      const t=curr;curr=prev;prev=t;
    }

    function render(){
      const d=img.data,k=cfg.refract,[sr,sg,sb]=cfg.spec,[hr,hg,hb]=cfg.shade;
      for(let y=1;y<h-1;y++){
        const row=y*w;
        for(let x=1;x<w-1;x++){
          const i=row+x;
          const gx=curr[i+1]-curr[i-1],gy=curr[i+w]-curr[i-w];
          let sx=x+(gx*k)|0,sy=y+(gy*k)|0;
          if(sx<0)sx=0;else if(sx>=w)sx=w-1;
          if(sy<0)sy=0;else if(sy>=h)sy=h-1;
          const b=(sy*w+sx)*4,o=i*4;
          const lum=gx-gy;
          if(lum>0){const s=Math.min(1,lum*.14);
            d[o]=bg[b]+(sr-bg[b])*s;d[o+1]=bg[b+1]+(sg-bg[b+1])*s;d[o+2]=bg[b+2]+(sb-bg[b+2])*s;
          }else{const s=Math.min(1,-lum*.10);
            d[o]=bg[b]+(hr-bg[b])*s;d[o+1]=bg[b+1]+(hg-bg[b+1])*s;d[o+2]=bg[b+2]+(hb-bg[b+2])*s;}
          d[o+3]=255;
        }
      }
      ctx.putImageData(img,0,0);
    }

    /* remous permanents */
    let t=0;
    function agitate(){
      t++;
      /* houle : trains de vagues larges et lents */
      if(t%22===0)disturb(Math.random()*w,h*(.3+Math.random()*.6),8,1.1);
      /* gouttes ambiantes */
      if(Math.random()<cfg.rain)disturb(Math.random()*w,Math.random()*h,2,1.4);
    }

    /* interaction souris */
    let lastX=-1,lastY=-1;
    panel.addEventListener('pointermove',e=>{
      const r=panel.getBoundingClientRect();
      const x=(e.clientX-r.left)/r.width*w,y=(e.clientY-r.top)/r.height*h;
      if(lastX>=0){
        const speed=Math.hypot(x-lastX,y-lastY);
        const n=Math.max(1,Math.min(6,speed|0));
        for(let i=1;i<=n;i++)
          disturb(lastX+(x-lastX)*i/n,lastY+(y-lastY)*i/n,3,Math.min(6,1.5+speed*.35));
      }
      lastX=x;lastY=y;
    });
    panel.addEventListener('pointerleave',()=>{lastX=-1;lastY=-1});
    panel.addEventListener('pointerdown',e=>{
      const r=panel.getBoundingClientRect();
      disturb((e.clientX-r.left)/r.width*w,(e.clientY-r.top)/r.height*h,7,14);
    });

    /* cfg.rate : fraction de pas de simulation par frame (1 = pleine vitesse) */
    let simAcc=0;
    return function frame(){
      simAcc+=cfg.rate||1;
      if(simAcc<1)return;
      simAcc-=1;
      agitate();step();render();
    };
  }

  const frames=CONFIGS.map(initPanel).filter(Boolean);
  if(!frames.length) return;
  (function loop(){frames.forEach(f=>f());requestAnimationFrame(loop);})();
})();
