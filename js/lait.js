/* ============================================================
   LAIT : shader WebGL fluide — goutte, gerbe d'impact,
   jet de rebond, vagues au passage de la souris
   ============================================================ */
(function(){
  if(matchMedia('(prefers-reduced-motion:reduce)').matches) return;
  const panel=document.querySelector('.p-lait');
  if(!panel) return;
  const canvas=panel.querySelector('.lait-gl');
  const gl=canvas&&canvas.getContext('webgl',{antialias:false,alpha:false});
  if(!gl) return;                       /* pas de WebGL : fond CSS statique */
  gl.getExtension('OES_standard_derivatives');
  const DPR=Math.min(2,window.devicePixelRatio||1);

  const VS=`attribute vec2 a;void main(){gl_Position=vec4(a,0.,1.);}`;
  const FS=`
#extension GL_OES_standard_derivatives : enable
precision highp float;
uniform vec2 uRes;uniform float uT;uniform vec4 uM[10];uniform vec2 uCur;

float smin(float a,float b,float k){
  float h=clamp(.5+.5*(b-a)/k,0.,1.);return mix(b,a,h)-k*h*(1.-h);}
float ell(vec2 q,vec2 c,vec2 r){return (length((q-c)/r)-1.)*min(r.x,r.y);}

const float T=3.4;
const float TI=.92;
const float SURF=.27;

float surfY(float x,float A,float t){
  float y=SURF
    +.002*sin(x*47.-uT*2.6)
    +.0015*sin(x*29.+uT*1.9)
    +.001*sin(x*83.+uT*3.7);
  for(int k=0;k<2;k++){
    float tt=t-TI+float(k)*T;
    if(tt>0.){
      float d=abs(x-.5)*A;
      y+=.022*sin(d*80.-tt*11.)*exp(-d*5.-tt*2.0);
      y+=.010*sin(d*140.-tt*17.)*exp(-d*9.-tt*3.5);
      y+=.030*exp(-d*34.)*sin(clamp(tt/.42,0.,1.)*3.14159)*exp(-tt*1.5);
    }
  }
  return y;
}

void main(){
  float A=uRes.x/uRes.y;
  vec2 p=gl_FragCoord.xy/uRes;
  vec2 q=vec2(p.x*A,p.y);
  float t=mod(uT,T);

  float ys=surfY(p.x,A,t);
  for(int i=0;i<10;i++){
    float age=uT-uM[i].z;
    if(uM[i].w>0.&&age>0.&&age<3.5){
      float d=abs(p.x-uM[i].x)*A;
      ys+=uM[i].w*sin(d*38.-age*7.5)*exp(-d*3.5-age*1.6);
    }
  }
  if(uCur.y>0.){
    float d=abs(p.x-uCur.x)*A;
    ys-=.014*exp(-d*22.);
  }
  float dSurf=p.y-ys;

  float prog=clamp(t/TI,0.,1.);
  float ease=prog*prog;
  float yd=mix(1.06,SURF-.01,ease);
  float stretch=1.+.55*prog;
  vec2 rd=vec2(.034/sqrt(stretch),.034*stretch);
  float dDrop=ell(q,vec2(.5*A,yd),rd);
  float fade=smoothstep(TI+.14,TI+.02,t);
  dDrop+=(1.-fade)*.3;

  float dJet=1e3,dD2=1e3;
  float tj=t-TI-.10;
  if(tj>0.&&tj<.85){
    float h=sin(clamp(tj/.5,0.,1.)*3.14159);
    dJet=ell(q,vec2(.5*A,SURF+.10*h-.02),vec2(.016,.05*h+.015));
  }
  float td=t-TI-.28;
  if(td>0.&&td<.95){
    float y2=SURF+.42*td-.62*td*td;
    float sq=1.+.3*sin(td*9.);
    dD2=ell(q,vec2(.5*A,y2+.02),vec2(.017*sq,.017/sq));
  }

  float dSpl=1e3;
  for(int i=0;i<6;i++){
    float fi=float(i);
    float h1=fract(sin(fi*12.9898)*43758.55);
    float h2=fract(sin(fi*78.2330)*12543.21);
    float side=mod(fi,2.)<1.?-1.:1.;
    float ts=t-TI-.02-.05*h2;
    if(ts>0.&&ts<1.){
      float vx=side*(.05+.08*h1);
      float vy=.55+.40*h2;
      float sx=.5*A+vx*ts;
      float sy=SURF+vy*ts-1.35*ts*ts;
      float sr=.009+.007*h1;
      float squash=1.+.5*exp(-ts*3.);
      dSpl=min(dSpl,ell(q,vec2(sx,sy),vec2(sr/squash,sr*squash)));
    }
  }

  float f=smin(dSurf,dDrop,.05);
  f=smin(f,dJet,.045);
  f=smin(f,dD2,.04);
  f=smin(f,dSpl,.035);

  /* fond plus profond et légèrement froid : le lait blanc s'en détache */
  vec3 bg=mix(vec3(.86,.82,.72),vec3(.55,.51,.44),1.-p.y);
  bg+=vec3(.05,.05,.045)*exp(-length((p-vec2(.5,.88))*vec2(1.6,1.))*1.6);
  bg-=vec3(.10,.11,.14)*exp(-length(q-vec2(.5*A+.014,yd-.012))*22.)*fade;

  float nx=dFdx(f),ny=dFdy(f);
  vec3 n=normalize(vec3(-nx,-ny,6.5/uRes.y));
  vec3 L=normalize(vec3(-.35,.55,.75));
  float diff=clamp(dot(n,L),0.,1.);
  float spec=pow(clamp(dot(reflect(-L,n),vec3(0.,0.,1.)),0.,1.),18.);
  float shade=smoothstep(-.04,-.006,f);
  /* lait franchement blanc, plus modelé par la lumière + spéculaire net */
  vec3 milk=vec3(1.,.995,.978)*(.82+.18*diff*shade)+vec3(spec*.22*shade);
  /* ombré froid dans les creux → volume plus lisible */
  milk-=vec3(.10,.12,.16)*shade*smoothstep(0.,-.004,f)*.8;

  float edge=smoothstep(1.5/uRes.y,-1.5/uRes.y,f);
  vec3 col=mix(bg,milk,edge);
  gl_FragColor=vec4(col,1.);
}`;

  function sh(type,src){
    const s=gl.createShader(type);gl.shaderSource(s,src);gl.compileShader(s);
    if(!gl.getShaderParameter(s,gl.COMPILE_STATUS))
      throw new Error(gl.getShaderInfoLog(s));
    return s;
  }
  const prog=gl.createProgram();
  gl.attachShader(prog,sh(gl.VERTEX_SHADER,VS));
  gl.attachShader(prog,sh(gl.FRAGMENT_SHADER,FS));
  gl.linkProgram(prog);gl.useProgram(prog);
  gl.bindBuffer(gl.ARRAY_BUFFER,gl.createBuffer());
  gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([-1,-1,3,-1,-1,3]),gl.STATIC_DRAW);
  const aLoc=gl.getAttribLocation(prog,'a');
  gl.enableVertexAttribArray(aLoc);gl.vertexAttribPointer(aLoc,2,gl.FLOAT,false,0,0);
  const uRes=gl.getUniformLocation(prog,'uRes');
  const uT=gl.getUniformLocation(prog,'uT');
  const uM=gl.getUniformLocation(prog,'uM');
  const uCur=gl.getUniformLocation(prog,'uCur');

  /* Le shader tire son rapport d'aspect de uRes : figer uRes pendant toute la
     transition le faisait calculer sur l'ancienne forme, et la goutte se
     remettait d'un coup à la fin — le saut. Le réaligner à chaque image coûtait
     la fluidité. On le réaligne donc au plus une fois toutes les 100 ms :
     l'erreur d'aspect reste alors sous les 10 %, imperceptible.
     Redessin dans le même rappel, car le tampon fraîchement dimensionné est
     vide et ResizeObserver s'exécute après les requestAnimationFrame. */
  /* Budget de pixels par canvas. Mesuré : en plein écran un tampon à pleine
     densité atteint 7 Mpx — huit fois la taille au repos — redessinés à chaque
     image. Sur deux ouvertures et deux fermetures de chapitre, douze images
     étaient perdues pour une seule tâche longue : le coût était donc dans le
     rendu, pas dans le script. On plafonne, quitte à descendre sous la densité
     de l écran — ces effets sont doux, la perte ne se voit pas. */
  const MAXPX=2.4e6;
  function scaleFor(w,h){
    const d=Math.min(2,window.devicePixelRatio||1);
    const px=w*h*d*d;
    return px>MAXPX?d*Math.sqrt(MAXPX/px):d;
  }
  const ALLOC_MS=100;
  let lastAlloc=0,allocT=0;
  function alloc(){
    const r=panel.getBoundingClientRect();
    if(!r.width||!r.height)return false;
    const s=scaleFor(r.width,r.height);
    const w=Math.round(r.width*s),h=Math.round(r.height*s);
    if(w===canvas.width&&h===canvas.height)return false;
    canvas.width=w;canvas.height=h;
    gl.viewport(0,0,w,h);
    gl.uniform2f(uRes,w,h);          /* uRes normalise p ET donne le rapport d'aspect */
    lastAlloc=performance.now();
    return true;
  }
  function syncSize(){
    if(performance.now()-lastAlloc>ALLOC_MS){
      if(alloc())draw();             /* le tampon vient d'être effacé */
      return;
    }
    clearTimeout(allocT);
    allocT=setTimeout(()=>{if(alloc())draw();},ALLOC_MS+40);
  }
  alloc();
  new ResizeObserver(syncSize).observe(panel);

  const M=new Float32Array(40);
  let mi=0,lastMx=-1,lastAdd=0,curX=-1,t0=performance.now();
  panel.addEventListener('pointermove',e=>{
    const r=panel.getBoundingClientRect();
    const x=(e.clientX-r.left)/r.width;
    curX=x;
    const now=(performance.now()-t0)/1000;
    const speed=lastMx<0?0:Math.abs(x-lastMx);
    lastMx=x;
    if(now-lastAdd<.05)return;
    lastAdd=now;
    M[mi*4]=x;M[mi*4+1]=0;M[mi*4+2]=now;
    M[mi*4+3]=Math.min(.032,.008+speed*.45);
    mi=(mi+1)%10;
  });
  panel.addEventListener('pointerdown',e=>{
    const r=panel.getBoundingClientRect();
    M[mi*4]=(e.clientX-r.left)/r.width;M[mi*4+1]=0;
    M[mi*4+2]=(performance.now()-t0)/1000;M[mi*4+3]=.045;
    mi=(mi+1)%10;
  });
  panel.addEventListener('pointerleave',()=>{lastMx=-1;curX=-1});

  function draw(){
    gl.uniform1f(uT,(performance.now()-t0)/1000);
    gl.uniform4fv(uM,M);
    gl.uniform2f(uCur,curX,curX>=0?1:0);
    gl.drawArrays(gl.TRIANGLES,0,3);
  }
  (function loop(){draw();requestAnimationFrame(loop);})();
})();
