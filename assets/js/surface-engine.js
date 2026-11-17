/* ==========================================================================
   Good Pressure — surface engine
   Procedural "dirty vs clean" surfaces rendered with WebGL. No images, no deps.

   How it works
   - bake(): renders two static layers once per size into textures:
       clean  = lit surface colour            (concrete, pavers, roof tiles ...)
       dirt   = grime colour + coverage alpha (mould, lichen, oil, leaves ...)
   - draw(): a cheap per-frame composite: an analytic "sweep" mask that mimics a
     pressure-washer pass (back-and-forth rows), wet sheen behind the nozzle,
     spray foam at the cleaning edge, optional reverse-graffiti text mask.
   ========================================================================== */
(function (global) {
  'use strict';

  /* ------------------------------------------------------------------ GLSL */
  const VERT = 'attribute vec2 a;void main(){gl_Position=vec4(a,0.,1.);}';

  const NOISE = `
float hash12(vec2 p){vec3 p3=fract(vec3(p.xyx)*.1031);p3+=dot(p3,p3.yzx+33.33);return fract((p3.x+p3.y)*p3.z);}
vec2 hash22(vec2 p){vec3 p3=fract(vec3(p.xyx)*vec3(.1031,.1030,.0973));p3+=dot(p3,p3.yzx+33.33);return fract((p3.xx+p3.yz)*p3.zy);}
float gnoise(vec2 p){
  vec2 i=floor(p),f=fract(p);
  vec2 u=f*f*f*(f*(f*6.-15.)+10.);
  float a=dot(hash22(i)*2.-1.,f);
  float b=dot(hash22(i+vec2(1.,0.))*2.-1.,f-vec2(1.,0.));
  float c=dot(hash22(i+vec2(0.,1.))*2.-1.,f-vec2(0.,1.));
  float d=dot(hash22(i+vec2(1.,1.))*2.-1.,f-vec2(1.,1.));
  return 1.42*mix(mix(a,b,u.x),mix(c,d,u.x),u.y);
}
`;

  const STATIC_HEAD = `
uniform vec2 u_res;
uniform float u_ppm;
uniform vec2 u_origin;
uniform float u_seed;
uniform float u_layer;
#define PXW (1./u_ppm)
#define SEED (vec2(u_seed*13.17,u_seed*7.31))
const mat2 RT=mat2(.8,.6,-.6,.8);
float fbm(vec2 p){float s=0.,a=.5;for(int i=0;i<5;i++){s+=a*gnoise(p);p=RT*p*2.03+vec2(1.7,9.2);a*=.5;}return s;}
float fbm3(vec2 p){float s=0.,a=.5;for(int i=0;i<3;i++){s+=a*gnoise(p);p=RT*p*2.03+vec2(1.7,9.2);a*=.5;}return s;}
float sat(float x){return clamp(x,0.,1.);}
vec2 rot(vec2 p,float a){float c=cos(a),s=sin(a);return vec2(c*p.x-s*p.y,s*p.x+c*p.y);}
/* cellular noise: x = distance to nearest point, y = cell hash, z = F2-F1 (edge distance) */
vec3 voro(vec2 p){
  vec2 n=floor(p),f=fract(p);float d1=8.,d2=8.;vec2 id=n;
  for(int j=-1;j<=1;j++)for(int i=-1;i<=1;i++){
    vec2 g=vec2(float(i),float(j));vec2 r=g+hash22(n+g)-f;float d=dot(r,r);
    if(d<d1){d2=d1;d1=d;id=n+g;}else if(d<d2){d2=d;}
  }
  d1=sqrt(d1);d2=sqrt(d2);return vec3(d1,hash12(id+.71),d2-d1);
}
/* clustered lichen / mould dots. scale = cells per metre, dens = share of cells with a dot inside a
   cluster, rmin..rmax = dot radius (cell units, biased small), patch = 0..1 cluster mask */
float spots(vec2 q,float scale,float dens,float rmin,float rmax,float patch){
  vec3 v=voro(q*scale);
  float h2=fract(v.y*13.7);
  float r=mix(rmin,rmax,h2*h2);
  float on=step(1.-dens*patch,fract(v.y*7.31));
  float n=gnoise(q*scale*3.1)*.07;
  return on*(1.-smoothstep(r*.6,r,v.x+n));
}
float patchy(vec2 q,float f,float lo,float hi){return smoothstep(lo,hi,fbm3(q*f+vec2(11.3,4.7)));}
vec2 worldPos(){vec2 px=vec2(gl_FragCoord.x,u_res.y-gl_FragCoord.y)-.5*u_res;return px/u_ppm+u_origin;}
vec2 halfExt(){return .5*u_res/u_ppm;}
/* scattered gum leaves (with soft shadows) */
void gumLeaves(vec2 p,float cell,float chance,inout vec3 col,inout float cov){
  vec2 c0=floor(p/cell);
  for(int j=-1;j<=1;j++)for(int i=-1;i<=1;i++){
    vec2 c=c0+vec2(float(i),float(j));
    if(hash12(c*1.37+vec2(4.1,7.7)+SEED)>chance)continue;
    vec2 ctr=(c+hash22(c+vec2(9.7,2.2)+SEED))*cell;
    float ang=hash12(c+vec2(2.3,5.1))*6.2832;
    float L=cell*mix(.09,.16,hash12(c+vec2(5.5,1.)));
    float W=L*mix(.15,.23,hash12(c+vec2(6.6,3.)));
    float bend=(hash12(c+vec2(7.7,4.))-.5)*5.5/L*.1;
    float R=(L*L/W+W)*.5,cc=(L*L/W-W)*.5;
    vec2 qs=rot(p-ctr-vec2(.3,.45)*W,ang);qs.y+=bend*qs.x*qs.x;
    float ds=max(length(qs-vec2(0.,-cc))-R,length(qs-vec2(0.,cc))-R);
    float sh=1.-smoothstep(-W*.2,W*.9,ds);
    col*=1.-.4*sh;
    vec2 q=rot(p-ctr,ang);q.y+=bend*q.x*q.x;
    float d=max(length(q-vec2(0.,-cc))-R,length(q-vec2(0.,cc))-R);
    float a=1.-smoothstep(-PXW*.8,PXW*.8,d);
    float t=hash12(c+vec2(8.8,6.));
    vec3 lc=mix(vec3(.43,.42,.27),vec3(.53,.31,.17),smoothstep(.3,.7,t));
    lc=mix(lc,vec3(.67,.59,.40),step(.82,t));
    float xn=clamp(q.x/L,-1.,1.);
    lc*=.85+.24*(xn*.5+.5);
    lc*=1.+.18*(1.-smoothstep(0.,W*.13,abs(q.y)))*(1.-abs(xn));
    lc*=.93+.09*gnoise(q/PXW*.35);
    float stem=(1.-smoothstep(W*.05,W*.05+PXW,abs(q.y)))*step(L*.92,-q.x)*step(-q.x,L*1.22);
    a=max(a,stem*.9);
    col=mix(col,lc,a);
    cov=max(cov,max(a,sh*.55));
  }
}
`;

  const STATIC_MAIN = `
void main(){
  vec2 p=worldPos();
  float e=PXW*1.25;
  float h=surfH(p);
  float hx=surfH(p+vec2(e,0.));
  float hy=surfH(p+vec2(0.,e));
  vec3 n=normalize(vec3((h-hx)*BUMP/e,(h-hy)*BUMP/e,1.));
  float lam=dot(n,vec3(-.45,-.55,.70));
  float shade=.80+.29*lam;
  vec3 cc=surfClean(p,h);
  if(u_layer<.5){gl_FragColor=vec4(clamp(cc*shade,0.,1.),1.);}
  else{vec4 d=surfDirt(p,h,cc);gl_FragColor=vec4(clamp(d.rgb*mix(1.,shade,.85),0.,1.),d.a);}
}
`;

  /* ---------- materials: each defines BUMP, surfH, surfClean, surfDirt ---------- */
  const MATERIALS = {};

  /* Broom-finish concrete driveway with saw-cut joints, tyre tracks, oil and gum leaves */
  MATERIALS.concrete = `
#define BUMP .010
float jd(vec2 p){float dx=abs(fract(p.x/3.1+.5)-.5)*3.1;float dy=abs(fract(p.y/2.9)-.5)*2.9;return min(dx,dy);}
float surfH(vec2 p){
  vec2 q=p+SEED;float d=jd(p);
  float groove=1.-smoothstep(.0042,.0075,d);
  float broom=gnoise(vec2(q.x*3.,q.y*230.))*.55+gnoise(vec2(q.x*7.,q.y*480.))*.3;
  float grain=gnoise(q*310.)*.5+gnoise(q*700.)*.25;
  vec3 v=voro(q*60.);float pit=smoothstep(.13,.05,v.x)*step(.9,v.y);
  return .5+broom*.03+grain*.035-groove*.6-pit*.1;
}
vec3 surfClean(vec2 p,float h){
  vec2 q=p+SEED;
  float n1=fbm(q*.55),n2=fbm3(q*3.2+7.),n3=gnoise(q*28.);
  float g1=gnoise(q*160.),g2=gnoise(q*390.);
  vec3 col=vec3(.80,.785,.755);
  col*=1.+n1*.075+n2*.04+n3*.02+g1*.03+g2*.028;
  col=mix(col,col*vec3(1.035,1.,.95),smoothstep(-.25,.35,n2));
  vec3 v=voro(q*85.);float fl=smoothstep(.17,.07,v.x);
  col=mix(col,col*.72,fl*step(.82,v.y));
  col=mix(col,min(col*1.12,vec3(1.)),fl*step(v.y,.07));
  float d=jd(p);
  col*=1.-(1.-smoothstep(0.,.045,d))*.09;
  col=mix(col,vec3(.25,.245,.23),1.-smoothstep(.0042,.0072,d));
  return col;
}
float tyre(vec2 p){
  vec2 q=p+SEED;float lane=abs(p.x)-1.55;float d=abs(abs(lane)-.78);
  float w=.10+.025*gnoise(vec2(p.y*1.7,3.));
  float t=1.-smoothstep(w*.5,w,d+gnoise(q*30.)*.025);
  t*=.4+.6*smoothstep(-.55,.45,gnoise(vec2(q.x*2.,q.y*.6)));
  t*=.8+.2*gnoise(vec2(q.x*90.,q.y*8.));
  return sat(t);
}
float oilBlob(vec2 p,vec2 c,float r,out float ring){
  vec2 q=p-c;q+=vec2(fbm(q*2.2+c*3.),fbm(q*2.2+c*3.+4.7))*.22;
  float d=length(q*vec2(1.,1.25))-r;ring=exp(-abs(d+.01)*60.);
  return 1.-smoothstep(-.07,.03,d);
}
vec4 surfDirt(vec2 p,float h,vec3 cc){
  vec2 q=p+SEED;
  float n1=fbm(q*.35+3.3),n2=fbm(q*1.6+9.1),n3=gnoise(q*21.),n4=gnoise(q*95.);
  float d=jd(p);
  float edge=1.-smoothstep(0.,.4,d);
  float cov=.74+n1*.36+n2*.16+n3*.05+n4*.04+edge*.14;
  vec3 col=mix(vec3(.37,.355,.31),vec3(.25,.245,.21),smoothstep(-.5,.05,n2));
  col=mix(col,vec3(.115,.13,.095),smoothstep(-.05,.6,n1+n2*.45+edge*.35));
  col*=.9+n4*.09+n3*.07;
  /* lichen: clustered black dots, mostly small, a few larger colonies */
  float cl=smoothstep(.0,.5,fbm3(q*.8+7.)+edge*.3);
  vec3 v=voro(q*34.);
  float r=mix(.09,.33,fract(v.y*13.7)*fract(v.y*13.7));
  float spot=step(1.-cl*.6,fract(v.y*7.31))*(1.-smoothstep(r*.62,r,v.x+n4*.05));
  vec3 v2=voro(q*10.);
  float r2=mix(.07,.2,fract(v2.y*5.3));
  float spot2=step(1.-cl*.28,fract(v2.y*3.17))*(1.-smoothstep(r2*.55,r2,v2.x+n4*.07));
  float sp=max(spot,spot2);
  col=mix(col,vec3(.05,.056,.045),sp*.92);
  float t=tyre(p);col=mix(col,vec3(.1,.1,.095),t*.45);
  float r1,r2b,r3;
  float o=oilBlob(p,vec2(-1.55,-.55),.2,r1);
  o=max(o,oilBlob(p,vec2(1.6,.95),.17,r2b));
  o=max(o,oilBlob(p,vec2(1.32,-1.22),.06,r3));
  float ring=max(r1,max(r2b,r3));
  col=mix(col,mix(vec3(.14,.115,.085),vec3(.07,.06,.05),smoothstep(-.3,.3,n3)),o*.62);
  col=mix(col,vec3(.05,.045,.04),ring*.35*o);
  float mw=.006+.012*smoothstep(-.2,.6,gnoise(q*6.));
  float moss=1.-smoothstep(mw*.5,mw,d+n4*.002);
  col=mix(col,mix(vec3(.17,.23,.08),vec3(.25,.29,.1),n3*.5+.5),moss*.9);
  cov=max(cov,max(sp,max(t*.9,max(o,moss))));
  gumLeaves(p,.6,.42,col,cov);
  return vec4(col,sat(cov));
}
`;

  /* Exposed-aggregate ("pebblecrete") concrete */
  MATERIALS.aggregate = `
#define BUMP .018
vec3 pebPal(float h){
  vec3 c=vec3(.56,.44,.32);
  if(h<.16)c=vec3(.80,.74,.64);else if(h<.30)c=vec3(.47,.45,.43);else if(h<.44)c=vec3(.62,.36,.24);
  else if(h<.56)c=vec3(.30,.28,.27);else if(h<.70)c=vec3(.72,.60,.44);else if(h<.84)c=vec3(.56,.44,.32);else c=vec3(.86,.84,.80);
  return c;
}
float pebField(vec2 q,out float id){vec3 v=voro(q*62.);id=v.y;float r=.40+.12*fract(v.y*7.7);return min(r-v.x,v.z*.5-.055);}
float surfH(vec2 p){
  vec2 q=p+SEED;float id;float s=pebField(q,id);
  float dome=smoothstep(0.,.22,s);
  vec3 v2=voro(q*150.);float sand=smoothstep(.35,.1,v2.x)*.3;
  return .3+dome*.55+sand*(1.-dome)*.4+gnoise(q*500.)*.02;
}
vec3 surfClean(vec2 p,float h){
  vec2 q=p+SEED;float id;float s=pebField(q,id);
  float inP=smoothstep(-.01,.04,s);
  vec3 pc=pebPal(id)*(.86+.28*fract(id*31.7));
  pc*=1.+gnoise(q*420.)*.06+gnoise(q*160.+id*9.)*.08;
  pc*=1.+.06*sin((q.x*cos(id*6.)+q.y*sin(id*6.))*900.)*step(.6,fract(id*3.3));
  vec3 v2=voro(q*150.);
  vec3 mx=vec3(.60,.585,.55)*(1.+gnoise(q*260.)*.07);
  mx=mix(mx,pebPal(v2.y)*.9,smoothstep(.32,.12,v2.x)*.7);
  vec3 col=mix(mx,pc,inP);
  col+=vec3(.06)*smoothstep(.12,.3,s)*smoothstep(.4,.9,gnoise(q*40.+id)*.5+.5);
  return col;
}
vec4 surfDirt(vec2 p,float h,vec3 cc){
  vec2 q=p+SEED;
  float n1=fbm(q*1.2+2.),n2=fbm3(q*6.+5.),n4=gnoise(q*120.);
  float cov=.86+n1*.2+n2*.08-(h-.5)*.15;
  vec3 col=mix(vec3(.23,.225,.19),vec3(.14,.16,.11),smoothstep(-.2,.5,n2+n1*.5));
  col=mix(col,cc*.38,.18);col*=.9+n4*.12;
  float spot=spots(q,26.,.6,.1,.36,patchy(q,1.4,0.,.45));
  col=mix(col,vec3(.05,.06,.045),spot*.9);cov=max(cov,spot);
  gumLeaves(p,.5,.22,col,cov);
  return vec4(col,sat(cov));
}
`;

  /* Herringbone clay pavers */
  MATERIALS.pavers = `
#define BUMP .016
void herring(vec2 u,out vec2 loc,out vec2 sz,out float id){
  vec2 c=floor(u);float n=floor((c.y-c.x+1.)/4.);
  vec2 v=u-vec2(0.,4.*n);vec2 cv=floor(v);float dv=cv.y-cv.x;
  if(dv<-.5){float k=cv.y;loc=v-vec2(k,k);sz=vec2(2.,1.);id=hash12(vec2(k,n)*1.7+.3);}
  else if(dv<.5){float k=cv.x;loc=v-vec2(k,k);sz=vec2(2.,1.);id=hash12(vec2(k,n)*1.7+.3);}
  else{float k=cv.x;loc=v-vec2(k,k+1.);sz=vec2(1.,2.);id=hash12(vec2(k,n)*2.3+5.1);}
}
float pavE(vec2 p,out float id){
  vec2 u=rot(p+vec2(.013,.021),.7854)/.1;vec2 loc,sz;herring(u,loc,sz,id);
  return min(min(loc.x,sz.x-loc.x),min(loc.y,sz.y-loc.y))*.1;
}
float surfH(vec2 p){
  float id;float e=pavE(p,id);vec2 q=p+SEED;
  float body=smoothstep(.0015,.0055,e);
  return .2+body*.55+gnoise(q*300.)*.03*body+gnoise(q*90.+id*7.)*.02;
}
vec3 surfClean(vec2 p,float h){
  float id;float e=pavE(p,id);vec2 q=p+SEED;
  vec3 pc=mix(vec3(.74,.62,.48),vec3(.62,.47,.36),smoothstep(.2,.8,id));
  pc=mix(pc,vec3(.50,.44,.40),step(.84,id));
  pc*=.9+.18*fract(id*91.3);
  pc*=1.+gnoise(q*130.)*.05+gnoise(q*300.)*.045+fbm3(q*10.+id*20.)*.07;
  vec3 v=voro(q*220.);pc*=1.-.18*smoothstep(.2,.08,v.x)*step(.7,v.y);
  vec3 jc=vec3(.56,.52,.44)*(1.+gnoise(q*400.)*.12);
  return mix(jc*.7,pc,smoothstep(.0015,.003,e));
}
vec4 surfDirt(vec2 p,float h,vec3 cc){
  float id;float e=pavE(p,id);vec2 q=p+SEED;
  float n1=fbm(q*.9+4.),n2=fbm3(q*5.+1.),n4=gnoise(q*110.);
  float cov=.62+n1*.35+n2*.12+n4*.04;
  vec3 col=mix(vec3(.30,.285,.24),vec3(.16,.19,.12),smoothstep(-.2,.5,n2+n1*.6));
  col=mix(col,cc*.45,.25);col*=.9+n4*.12;
  float near=1.-smoothstep(0.,.012,e);
  col=mix(col,vec3(.10,.13,.07),near*.6);cov=max(cov,near*.9);
  float jm=(1.-smoothstep(.001,.004,e))*smoothstep(-.1,.4,gnoise(q*14.));
  col=mix(col,mix(vec3(.2,.27,.09),vec3(.3,.36,.12),n4*.5+.5),jm);cov=max(cov,jm);
  float spot=spots(q,30.,.55,.1,.34,patchy(q,1.1,.05,.5));
  col=mix(col,vec3(.06,.065,.05),spot*.85);cov=max(cov,spot);
  gumLeaves(p,.6,.3,col,cov);
  return vec4(col,sat(cov));
}
`;

  /* Terracotta roof tiles (S-profile), front view */
  MATERIALS.tiles = `
#define BUMP .028
void tileUV(vec2 p,out float ly,out float tx,out float course,out float prof){
  tx=p.x/.30;prof=sin(tx*6.2832);
  float y=p.y-.025*prof;course=floor(y/.34);ly=fract(y/.34);
}
float surfH(vec2 p){
  float ly,tx,course,prof;tileUV(p,ly,tx,course,prof);
  float h=.45+.25*prof+ly*.2;
  h-=(1.-smoothstep(0.,.06,ly))*.35;
  return h;
}
vec3 surfClean(vec2 p,float h){
  float ly,tx,course,prof;tileUV(p,ly,tx,course,prof);vec2 q=p+SEED;
  float id=hash12(vec2(floor(tx),course)+.37);
  vec3 tc=mix(vec3(.74,.37,.22),vec3(.62,.30,.19),id);
  tc=mix(tc,vec3(.80,.46,.27),step(.86,id)*.7);
  tc*=1.+gnoise(q*120.)*.05+gnoise(q*300.)*.04+fbm3(q*8.+id*13.)*.06;
  tc*=1.-(1.-smoothstep(0.,.16,ly))*.55;
  tc*=1.+smoothstep(.9,.99,ly)*.08;
  float ds=abs(tx-floor(tx+.5))*.30;
  tc*=1.-(1.-smoothstep(.001,.004,ds))*.35;
  return tc;
}
vec4 surfDirt(vec2 p,float h,vec3 cc){
  float ly,tx,course,prof;tileUV(p,ly,tx,course,prof);vec2 q=p+SEED;
  float n1=fbm(q*.8+6.),n2=fbm3(q*4.+2.),n4=gnoise(q*90.);
  float cov=.74+n1*.3+n2*.12;
  vec3 col=mix(vec3(.33,.30,.25),vec3(.17,.17,.14),smoothstep(-.3,.4,n2+n1*.5));
  col=mix(col,cc*.5,.22);col*=.9+n4*.1;
  float valley=smoothstep(.2,-.8,prof);
  float streak=smoothstep(.1,.6,fbm3(vec2(q.x*9.,q.y*1.6)+3.))*(.5+.5*valley);
  col=mix(col,vec3(.08,.085,.07),streak*.75);cov=max(cov,streak);
  float moss=(1.-smoothstep(0.,.14,ly))*smoothstep(-.2,.5,gnoise(q*9.)+.2);
  col=mix(col,mix(vec3(.24,.29,.1),vec3(.33,.37,.14),n4*.5+.5),moss*.85);cov=max(cov,moss);
  float pa=patchy(q,1.3,.0,.5);
  vec3 v=voro(q*9.);
  float on=step(1.-.55*pa,fract(v.y*5.3));
  float r=mix(.12,.42,fract(v.y*17.1)*fract(v.y*17.1));
  float rim=gnoise(q*60.)*.08+gnoise(q*160.)*.04;
  float lich=on*(1.-smoothstep(r*.7,r,v.x+rim));
  vec3 lc=fract(v.y*29.)>.3?vec3(.66,.66,.56):vec3(.78,.53,.22);
  col=mix(col,lc*(.82+n4*.18),lich*.92);cov=max(cov,lich);
  float blk=spots(q,34.,.55,.1,.3,pa);
  col=mix(col,vec3(.06,.06,.05),blk*.85);cov=max(cov,blk);
  return vec4(col,sat(cov));
}
`;

  /* Merbau timber decking */
  MATERIALS.timber = `
#define BUMP .014
void board(vec2 p,out float bid,out float dg,out float butt,out vec2 lp){
  float pitch=.143;float by=p.y/pitch;float row=floor(by);float ly=(by-row)*pitch;
  dg=min(ly,pitch-ly);
  float off=hash12(vec2(row,3.1))*7.;float segL=2.4+hash12(vec2(row,8.4))*2.6;
  float x=p.x+off;float seg=floor(x/segL);float lx=x-seg*segL;
  butt=min(lx,segL-lx);bid=hash12(vec2(row,seg)+.5);lp=vec2(x,ly);
}
float surfH(vec2 p){
  float bid,dg,butt;vec2 lp;board(p,bid,dg,butt,lp);
  float e=min(dg-.003,butt-.0012);float body=smoothstep(0.,.004,e);
  float grain=gnoise(vec2((lp.x+bid*30.)*2.,lp.y*90.))*.5;
  return .15+body*(.6+grain*.04);
}
vec3 surfClean(vec2 p,float h){
  float bid,dg,butt;vec2 lp;board(p,bid,dg,butt,lp);
  vec2 g=vec2(lp.x+bid*31.,lp.y);
  float warp=fbm3(vec2(g.x*.45,bid*9.+g.y*2.))*2.;
  float rings=sin(g.y*120.+warp*6.+bid*40.+fbm3(vec2(g.x*1.4,g.y*8.))*4.);
  float fine=gnoise(vec2(g.x*14.,g.y*700.))*.5+gnoise(vec2(g.x*40.,g.y*1500.))*.3;
  vec3 wc=mix(vec3(.50,.25,.14),vec3(.60,.33,.18),bid);
  wc=mix(wc,vec3(.42,.20,.12),step(.85,bid)*.6);
  wc*=1.-.09*smoothstep(.3,1.,rings);
  wc*=1.+fine*.05+fbm3(vec2(g.x*.6,g.y*20.))*.07;
  wc+=vec3(.035,.02,.01)*smoothstep(.02,.065,dg);
  float jx=abs(fract(p.x/.45)-.5)*.45;float sy=abs(dg-.025);
  float scr=1.-smoothstep(.0028,.0036,length(vec2(jx,sy)));
  wc=mix(wc,vec3(.16,.14,.13),scr);
  float e=min(dg-.003,butt-.0012);
  return mix(vec3(.05,.04,.035),wc,smoothstep(-.0005,.001,e));
}
vec4 surfDirt(vec2 p,float h,vec3 cc){
  float bid,dg,butt;vec2 lp;board(p,bid,dg,butt,lp);vec2 q=p+SEED;
  vec2 g=vec2(lp.x+bid*31.,lp.y);
  float fine=gnoise(vec2(g.x*14.,g.y*700.));
  float n1=fbm(q*.9+1.),n2=fbm3(q*5.+8.),n4=gnoise(q*100.);
  float lum=dot(cc,vec3(.3,.59,.11));
  vec3 col=vec3(.47,.455,.43)*(.78+lum*.5)*(.92+fine*.1);
  col=mix(col,vec3(.27,.27,.24),smoothstep(-.1,.6,n1+n2*.4)*.7);
  float cov=.86+n1*.15;
  float spot=spots(q,34.,.5,.08,.3,patchy(q,1.5,.08,.55));
  col=mix(col,vec3(.08,.08,.07),spot*.85);
  float edge=1.-smoothstep(0.,.03,dg);
  col=mix(col,vec3(.22,.28,.14),edge*smoothstep(-.3,.4,n2)*.65);
  float gap=1.-smoothstep(.002,.0035,dg);
  col=mix(col,vec3(.07,.06,.05),gap);
  cov=max(cov,max(spot,gap));
  gumLeaves(p,.55,.28,col,cov);
  return vec4(col,sat(cov));
}
`;

  /* Face-brick wall (house wash), with a cobweb in the corner */
  MATERIALS.brick = `
#define BUMP .016
vec2 brickCell(vec2 p,out vec2 f,out float dm){
  vec2 b=vec2(p.x/.24,p.y/.086);float row=floor(b.y);b.x+=mod(row,2.)*.5;
  vec2 cell=floor(b);f=fract(b);
  dm=min(min(f.x,1.-f.x)*.24,min(f.y,1.-f.y)*.086);
  return cell;
}
float surfH(vec2 p){
  vec2 f;float dm;vec2 c=brickCell(p,f,dm);vec2 q=p+SEED;
  float body=smoothstep(.0045,.007,dm);
  float rough=gnoise(q*260.)*.5+gnoise(q*90.)*.3;
  return .25+body*(.55+rough*.05)+(1.-body)*gnoise(q*500.)*.03;
}
vec3 surfClean(vec2 p,float h){
  vec2 f;float dm;vec2 c=brickCell(p,f,dm);vec2 q=p+SEED;
  float id=hash12(c+.13);
  vec3 bc=mix(vec3(.66,.33,.21),vec3(.55,.25,.17),id);
  bc=mix(bc,vec3(.40,.20,.15),step(.82,id)*.8);
  bc=mix(bc,vec3(.74,.45,.30),step(id,.1)*.7);
  bc*=1.+gnoise(q*140.)*.06+gnoise(q*320.)*.05+fbm3(q*14.+id*9.)*.08;
  vec3 v=voro(q*180.);bc*=1.-.3*smoothstep(.22,.08,v.x)*step(.75,v.y);
  vec3 mc=vec3(.74,.72,.67)*(1.+gnoise(q*420.)*.08);
  return mix(mc*.92,bc,smoothstep(.0045,.0055,dm));
}
vec4 surfDirt(vec2 p,float h,vec3 cc){
  vec2 f;float dm;vec2 c=brickCell(p,f,dm);vec2 q=p+SEED;
  vec2 hs=halfExt();
  float yn=clamp((p.y+hs.y)/(2.*hs.y),0.,1.);
  float n1=fbm(q*.8+2.),n4=gnoise(q*110.);
  float streak=smoothstep(0.,.6,fbm3(vec2(q.x*7.,q.y*.7)+4.)+.15);
  float cov=.42+n1*.3+streak*.4+yn*.2;
  vec3 col=mix(vec3(.30,.28,.24),vec3(.12,.12,.10),streak);
  col=mix(col,vec3(.20,.27,.13),smoothstep(.55,1.,yn)*.6*(n1*.5+.6));
  col*=.9+n4*.1;
  float mort=1.-smoothstep(.0045,.0065,dm);
  col=mix(col,vec3(.16,.16,.13),mort*.5);cov=max(cov,mort*.7);
  vec2 wd=p-(-hs+vec2(.012));float wr=length(wd);
  if(wr<.34&&wd.x>0.&&wd.y>0.){
    float wa=atan(wd.y,wd.x);float stp=1.5708/7.;
    float da=abs(fract(wa/stp+.5)-.5)*stp;
    float spk=1.-smoothstep(0.,PXW*.9,wr*da);
    float rg=abs(fract(wr/.026+.2*sin(wa*11.))-.5)*.026;
    float th=(1.-smoothstep(0.,PXW*.8,rg))*step(.02,wr);
    float web=max(spk,th)*(1.-smoothstep(.2,.34,wr))*.7;
    col=mix(col,vec3(.86,.86,.83),web);cov=max(cov,web);
  }
  return vec4(col,sat(cov));
}
`;

  /* Mono solar panels on a dark roof */
  MATERIALS.solar = `
#define BUMP .008
void panel(vec2 p,out vec2 q,out float inP,out float fd,out vec2 pid){
  vec2 pitch=vec2(1.04,1.74);vec2 pp=(p+vec2(.37,.61))/pitch;pid=floor(pp);
  q=(pp-pid)*pitch-vec2(.02);
  inP=step(0.,q.x)*step(q.x,1.)*step(0.,q.y)*step(q.y,1.7);
  fd=min(min(q.x,1.-q.x),min(q.y,1.7-q.y));
}
float surfH(vec2 p){
  vec2 q,pid;float inP,fd;panel(p,q,inP,fd,pid);
  float frame=smoothstep(0.,.006,fd)*(1.-smoothstep(.03,.036,fd));
  return inP*(.5+frame*.3);
}
vec3 surfClean(vec2 p,float h){
  vec2 q,pid;float inP,fd;panel(p,q,inP,fd,pid);vec2 s=p+SEED;
  vec3 roof=vec3(.16,.16,.17)*(1.+gnoise(s*80.)*.1);
  vec3 fr=vec3(.72,.74,.76)*(.9+.1*gnoise(s*200.));
  vec2 inner=(q-vec2(.035))/vec2(.93,1.63);
  vec2 cg=inner*vec2(6.,10.);vec2 cid=floor(cg),cf=fract(cg);
  vec2 cm=abs(cf-.5);
  float gapC=step(.475,max(cm.x,cm.y));
  float corner=step(.88,cm.x+cm.y);
  vec3 cell=vec3(.05,.07,.12)+vec3(0.,.01,.04)*gnoise(s*60.);
  cell+=vec3(.02,.03,.05)*smoothstep(.2,.9,fract(hash12(cid+pid*7.)*3.));
  vec3 pc=mix(cell,vec3(.56,.60,.66),max(gapC,corner));
  float busD=abs(fract(cf.x*3.)-.5)*.0517;
  pc=mix(pc,vec3(.36,.39,.44),(1.-smoothstep(0.,PXW*.9,busD))*.5*(1.-max(gapC,corner)));
  float refl=(1.-q.y/1.7)*.035+smoothstep(.35,0.,abs(q.x-q.y*.55-.2))*.05;
  pc+=vec3(.6,.75,1.)*refl;
  vec3 col=mix(pc,fr,1.-smoothstep(.033,.036,fd));
  return mix(roof,col,inP);
}
vec4 surfDirt(vec2 p,float h,vec3 cc){
  vec2 q,pid;float inP,fd;panel(p,q,inP,fd,pid);vec2 s=p+SEED;
  float n1=fbm(s*1.1+3.),n2=fbm3(s*6.+2.),n4=gnoise(s*140.);
  float low=smoothstep(.6,0.,1.7-q.y)*inP;
  float band=smoothstep(.08,0.,1.7-q.y-.035)*inP;
  float cov=.6+n1*.24+n2*.08+low*.25;
  vec3 col=vec3(.60,.565,.49)*(.9+n4*.08+n2*.08);
  col=mix(col,vec3(.38,.34,.27),low*.5);
  col=mix(col,vec3(.26,.23,.18),band*.85);cov=max(cov,band*.95);
  vec3 v=voro(s*2.6);
  float on=step(.86,fract(v.y*5.7));
  float r=mix(.1,.2,fract(v.y*11.3));
  vec2 w=vec2(fbm3(s*9.+v.y*7.),fbm3(s*9.+v.y*7.+3.3));
  float dd=v.x+w.x*.22+fbm3(s*30.+v.y*5.)*.05;
  float drop=on*(1.-smoothstep(r*.75,r,dd));
  float core=on*(1.-smoothstep(r*.15,r*.4,v.x+w.y*.25))*.55;
  float splat=on*(1.-smoothstep(r*1.1,r*1.6,dd))*.25;
  col=mix(col,vec3(.80,.79,.74),splat);
  col=mix(col,vec3(.93,.92,.88),drop);
  col=mix(col,vec3(.52,.50,.46),core);
  cov=max(cov,max(drop,splat));
  cov=mix(cov,.9,(1.-inP)*.5);
  gumLeaves(p,.7,.22,col,cov);
  return vec4(col,sat(cov));
}
`;

  /* ---------------------------------------------------------- composite */
  const COMPOSITE = `
uniform sampler2D u_clean,u_dirt,u_text,u_mask;
uniform vec2 u_res;
uniform float u_prog,u_rows,u_vertical,u_margin,u_time,u_spray;
uniform float u_hasText,u_textReveal,u_dry,u_shine,u_full,u_wetDark,u_vig,u_useMask;
float sweep(float apx,float cpx,float L,float A,out float tp,out float inRow,out float row){
  float rowPx=A/u_rows;
  float wob=gnoise(vec2(apx/170.,5.3))*.075+gnoise(vec2(apx/45.,9.1))*.018;
  float rb=cpx/rowPx+wob;
  row=clamp(floor(rb),0.,u_rows-1.);
  inRow=clamp(rb-row,0.,1.);
  float span=L+2.*u_margin;
  float an=(apx+u_margin)/span;
  float sp=mod(row,2.)<.5?an:1.-an;
  float b=inRow-.5;
  float bow=b*b*1.1*rowPx/span;
  float jit=(gnoise(vec2(cpx/6.,row*3.7))*2.4+gnoise(vec2(cpx/1.7,row*1.3+u_time*u_spray*3.))*.9)/span;
  tp=row+sp+bow+jit;
  float e=1.4/span;
  return 1.-smoothstep(-e,e,tp-u_prog);
}
void main(){
  vec2 uv=gl_FragCoord.xy/u_res;
  vec2 st=vec2(uv.x,1.-uv.y);
  vec3 C=texture2D(u_clean,uv).rgb;
  vec4 D=texture2D(u_dirt,uv);
  float L=mix(u_res.x,u_res.y,u_vertical),A=mix(u_res.y,u_res.x,u_vertical);
  float apx=mix(st.x,st.y,u_vertical)*L,cpx=mix(st.y,st.x,u_vertical)*A;
  float tp,inRow,row,tp2,ir2,row2;
  float mS=sweep(apx,cpx-.33,L,A,tp,inRow,row);
  mS=.5*(mS+sweep(apx,cpx+.33,L,A,tp2,ir2,row2));
  if(u_useMask>.5)mS=texture2D(u_mask,uv).r;
  if(u_full>.5)mS=1.;else if(u_full<-.5)mS=0.;
  float m=mS;
  float tfoam=0.;
  if(u_hasText>.5){
    float t=texture2D(u_text,uv).r;
    float tn=gnoise(gl_FragCoord.xy/4.5)*.55+gnoise(gl_FragCoord.xy/1.6)*.3;
    float tm=smoothstep(.36,.64,t+tn*.17);
    float front=st.x*.82+st.y*.18;
    float rv=u_textReveal*1.15-.06;
    tm*=smoothstep(front-.012,front+.012,rv);
    tfoam=smoothstep(.2,.6,t)*exp(-abs(front-rv)*120.)*(1.-step(.999,u_textReveal));
    m=max(m,tm);
  }
  vec3 dirty=mix(C,D.rgb,D.a);
  vec3 col=mix(dirty,C,m);
  float age=u_prog-tp;
  float wet=mS*(1.-smoothstep(0.,1.35,age))*(1.-u_dry)*(1.-u_useMask)*(1.-step(.5,abs(u_full)));
  wet*=.8+.2*gnoise(gl_FragCoord.xy/110.);
  float lum=dot(col,vec3(.299,.587,.114));
  vec3 wc=mix(vec3(lum),col,1.22)*u_wetDark;
  wc+=smoothstep(0.,1.,1.-st.y)*.07+gnoise(gl_FragCoord.xy/160.+vec2(u_time*.04,0.))*.025;
  col=mix(col,wc,clamp(wet,0.,1.));
  float cur=min(floor(u_prog),u_rows-1.);
  float f=u_prog-cur;
  float span=L+2.*u_margin;
  float an=(apx+u_margin)/span;
  float sp=mod(cur,2.)<.5?an:1.-an;
  float dH=(sp-f)*span;
  float isCur=1.-step(.5,abs(row-cur));
  float band=smoothstep(0.,.14,inRow)*smoothstep(1.,.86,inRow);
  float t1=gnoise(vec2(dH/7.-u_time*14.,cpx/7.))*.5+.5;
  float t2=gnoise(vec2(dH/20.+u_time*4.,cpx/18.-u_time*3.))*.5+.5;
  float impact=exp(-abs(dH+2.)/5.)*(.55+.45*t1);
  float film=dH<0.?exp(dH/55.)*(.15+.55*t2):0.;
  float mist=exp(-abs(dH)/34.)*t2*.5;
  float foam=isCur*band*u_spray*clamp(impact+film*.45+mist,0.,1.);
  foam=max(foam,tfoam*.9);
  col=mix(col,vec3(.94,.97,1.),foam*.85);
  float sx=st.x*.75+st.y*.25;
  col+=exp(-pow((sx-u_shine)*6.5,2.))*.09*m;
  vec2 vv=st-.5;col*=1.-u_vig*dot(vv,vv)*1.1;
  col+=(hash12(gl_FragCoord.xy+fract(u_time)*17.)-.5)/255.;
  gl_FragColor=vec4(col,1.);
}
`;

  /* -------------------------------------------- material settings (JS side) */
  const SETTINGS = {
    concrete:  { ppm: 210, rows: 5, vertical: 0, wetDark: .64 },
    aggregate: { ppm: 760, rows: 4, vertical: 0, wetDark: .68 },
    pavers:    { ppm: 330, rows: 4, vertical: 0, wetDark: .70 },
    tiles:     { ppm: 230, rows: 4, vertical: 0, wetDark: .72 },
    timber:    { ppm: 300, rows: 5, vertical: 0, wetDark: .62 },
    brick:     { ppm: 330, rows: 4, vertical: 1, wetDark: .70 },
    solar:     { ppm: 150, rows: 3, vertical: 0, wetDark: .90 },
  };

  /* ---------------------------------------------------------------- Engine */
  class Engine {
    constructor(canvas, opts) {
      opts = opts || {};
      const attrs = {
        alpha: false, antialias: false, depth: false, stencil: false,
        premultipliedAlpha: false, preserveDrawingBuffer: !!opts.preserve,
        powerPreference: 'high-performance',
        failIfMajorPerformanceCaveat: !(opts.allowSoftware || /[?&]sw=1/.test(location.search)),
      };
      const gl = canvas.getContext('webgl', attrs) || canvas.getContext('experimental-webgl', attrs);
      if (!gl) throw new Error('WebGL unavailable');
      this.gl = gl;
      this.canvas = canvas;
      const hp = gl.getShaderPrecisionFormat(gl.FRAGMENT_SHADER, gl.HIGH_FLOAT);
      this.precision = hp && hp.precision > 0 ? 'highp' : 'mediump';
      this.maxTex = gl.getParameter(gl.MAX_TEXTURE_SIZE) || 4096;
      this.vbo = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, this.vbo);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
      gl.disable(gl.DEPTH_TEST);
      gl.disable(gl.BLEND);
      this.progs = {};
      this.black = this._texture(1, 1, new Uint8Array([0, 0, 0, 255]));
      this.lost = false;
      canvas.addEventListener('webglcontextlost', (e) => { e.preventDefault(); this.lost = true; if (this.onlost) this.onlost(); }, false);
    }

    _shader(type, src) {
      const gl = this.gl, s = gl.createShader(type);
      gl.shaderSource(s, src);
      gl.compileShader(s);
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS) && !gl.isContextLost()) {
        const log = gl.getShaderInfoLog(s);
        console.error('[surface] shader compile error:\n' + log);
        throw new Error('shader compile failed');
      }
      return s;
    }

    _program(key, fragBody) {
      if (this.progs[key]) return this.progs[key];
      const gl = this.gl;
      const src = 'precision ' + this.precision + ' float;\n' + NOISE + fragBody;
      const p = gl.createProgram();
      gl.attachShader(p, this._shader(gl.VERTEX_SHADER, VERT));
      gl.attachShader(p, this._shader(gl.FRAGMENT_SHADER, src));
      gl.bindAttribLocation(p, 0, 'a');
      gl.linkProgram(p);
      if (!gl.getProgramParameter(p, gl.LINK_STATUS) && !gl.isContextLost()) {
        throw new Error('program link failed: ' + gl.getProgramInfoLog(p));
      }
      const prog = { p, u: {} };
      const n = gl.getProgramParameter(p, gl.ACTIVE_UNIFORMS);
      for (let i = 0; i < n; i++) {
        const info = gl.getActiveUniform(p, i);
        prog.u[info.name] = gl.getUniformLocation(p, info.name);
      }
      return (this.progs[key] = prog);
    }

    _texture(w, h, data) {
      const gl = this.gl, t = gl.createTexture();
      gl.bindTexture(gl.TEXTURE_2D, t);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, w, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, data || null);
      return t;
    }

    _layer(w, h) {
      const gl = this.gl, tex = this._texture(w, h), fbo = gl.createFramebuffer();
      gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
      gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      return { tex, fbo };
    }

    /** A render target holds the two baked layers (and optional text/mask textures). */
    target(w, h, old) {
      if (old && old.w === w && old.h === h) return old;
      if (old) this.dispose(old);
      return { w, h, clean: this._layer(w, h), dirt: this._layer(w, h), text: null, mask: null, baked: null };
    }

    dispose(t) {
      const gl = this.gl;
      [t.clean, t.dirt].forEach((l) => { if (l) { gl.deleteTexture(l.tex); gl.deleteFramebuffer(l.fbo); } });
      if (t.text) gl.deleteTexture(t.text);
      if (t.mask) gl.deleteTexture(t.mask);
    }

    _quad() {
      const gl = this.gl;
      gl.bindBuffer(gl.ARRAY_BUFFER, this.vbo);
      gl.enableVertexAttribArray(0);
      gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
    }

    /** Bake clean + dirt layers for a material. ppm = device pixels per metre. */
    bake(t, material, ppm, seed, origin) {
      const gl = this.gl;
      const pr = this._program('m:' + material, STATIC_HEAD + MATERIALS[material] + STATIC_MAIN);
      gl.useProgram(pr.p);
      this._quad();
      gl.uniform2f(pr.u.u_res, t.w, t.h);
      gl.uniform1f(pr.u.u_ppm, ppm);
      gl.uniform2f(pr.u.u_origin, origin ? origin[0] : 0, origin ? origin[1] : 0);
      gl.uniform1f(pr.u.u_seed, seed || 1);
      gl.viewport(0, 0, t.w, t.h);
      gl.bindFramebuffer(gl.FRAMEBUFFER, t.clean.fbo);
      gl.uniform1f(pr.u.u_layer, 0);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
      gl.bindFramebuffer(gl.FRAMEBUFFER, t.dirt.fbo);
      gl.uniform1f(pr.u.u_layer, 1);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      t.baked = material;
    }

    /** Upload a 2D canvas (white-on-black) as the reverse-graffiti text mask. */
    setText(t, source) {
      const gl = this.gl;
      if (!t.text) t.text = this._texture(1, 1);
      gl.bindTexture(gl.TEXTURE_2D, t.text);
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, source);
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
    }

    /** Upload a painted clean-mask canvas (white = clean). */
    setMask(t, source) {
      const gl = this.gl;
      if (!t.mask) t.mask = this._texture(1, 1);
      gl.bindTexture(gl.TEXTURE_2D, t.mask);
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, source);
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
    }

    /** Composite a frame into the canvas (bottom-left w x h region). */
    draw(t, o) {
      const gl = this.gl;
      if (this.lost || gl.isContextLost()) return false;
      const pr = this._program('composite', COMPOSITE);
      const u = pr.u;
      gl.useProgram(pr.p);
      this._quad();
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      gl.viewport(0, 0, t.w, t.h);
      gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, t.clean.tex); gl.uniform1i(u.u_clean, 0);
      gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, t.dirt.tex); gl.uniform1i(u.u_dirt, 1);
      gl.activeTexture(gl.TEXTURE2); gl.bindTexture(gl.TEXTURE_2D, t.text || this.black); if (u.u_text) gl.uniform1i(u.u_text, 2);
      gl.activeTexture(gl.TEXTURE3); gl.bindTexture(gl.TEXTURE_2D, t.mask || this.black); if (u.u_mask) gl.uniform1i(u.u_mask, 3);
      const set = (name, v) => { if (u[name]) gl.uniform1f(u[name], v); };
      gl.uniform2f(u.u_res, t.w, t.h);
      set('u_prog', o.prog || 0);
      set('u_rows', o.rows || 4);
      set('u_vertical', o.vertical ? 1 : 0);
      set('u_margin', o.margin || 0);
      set('u_time', o.time || 0);
      set('u_spray', o.spray || 0);
      set('u_hasText', t.text && o.text !== false ? 1 : 0);
      set('u_textReveal', o.textReveal == null ? 1 : o.textReveal);
      set('u_dry', o.dry || 0);
      set('u_shine', o.shine == null ? -2 : o.shine);
      set('u_full', o.full || 0);
      set('u_wetDark', o.wetDark || .66);
      set('u_vig', o.vig == null ? .3 : o.vig);
      set('u_useMask', o.useMask && t.mask ? 1 : 0);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
      return true;
    }
  }

  /* One shared offscreen engine for all the small surfaces (cards, before/after). */
  let shared = null, sharedFailed = false;
  function getShared() {
    if (shared || sharedFailed) return shared;
    try {
      const c = document.createElement('canvas');
      c.width = 1024; c.height = 768;
      shared = new Engine(c);
      shared.ensure = function (w, h) {
        if (c.width < w || c.height < h) { c.width = Math.max(c.width, w); c.height = Math.max(c.height, h); }
      };
      /** Draw a frame and copy it into a visible 2D canvas. */
      shared.blit = function (t, o, ctx) {
        shared.ensure(t.w, t.h);
        if (!shared.draw(t, o)) return false;
        ctx.drawImage(c, 0, c.height - t.h, t.w, t.h, 0, 0, t.w, t.h);
        return true;
      };
    } catch (e) {
      sharedFailed = true;
      shared = null;
    }
    return shared;
  }

  global.GPSurface = { Engine, SETTINGS, shared: getShared, materials: Object.keys(MATERIALS) };
})(window);
