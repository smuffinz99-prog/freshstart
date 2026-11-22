/* ==========================================================================
   FreshStart Pressure Washing — photo cleaning engine (WebGL)
   Takes a BEFORE and AFTER photo of the same surface and reveals the clean
   one with a pressure-washer pass: back-and-forth strips with a soft spray
   edge, wet sheen behind the nozzle and foam at the cleaning line.
   Strips can follow a ground plane in perspective (homography) so they line
   up with real driveway joints.
   ========================================================================== */
(function (global) {
  'use strict';

  const VERT = 'attribute vec2 a;void main(){gl_Position=vec4(a,0.,1.);}';

  const NOISE = `
float hash12(vec2 p){vec3 p3=fract(vec3(p.xyx)*.1031);p3+=dot(p3,p3.yzx+33.33);return fract((p3.x+p3.y)*p3.z);}
vec2 hash22(vec2 p){vec3 p3=fract(vec3(p.xyx)*vec3(.1031,.1030,.0973));p3+=dot(p3,p3.yzx+33.33);return fract((p3.xx+p3.yz)*p3.zy);}
float gnoise(vec2 p){
  vec2 i=floor(p),f=fract(p);vec2 u=f*f*f*(f*(f*6.-15.)+10.);
  float a=dot(hash22(i)*2.-1.,f),b=dot(hash22(i+vec2(1.,0.))*2.-1.,f-vec2(1.,0.));
  float c=dot(hash22(i+vec2(0.,1.))*2.-1.,f-vec2(0.,1.)),d=dot(hash22(i+vec2(1.,1.))*2.-1.,f-vec2(1.,1.));
  return 1.42*mix(mix(a,b,u.x),mix(c,d,u.x),u.y);
}`;

  /* Where does cleaning change the picture? Blurred |before - after|, computed once per photo pair. */
  const MASK = `
uniform sampler2D u_after,u_before;
uniform vec2 u_res;
uniform vec4 u_brect;
vec3 bef(vec2 iuv){vec2 b=(iuv-u_brect.xy)/(u_brect.zw-u_brect.xy);
  if(b.x<0.||b.y<0.||b.x>1.||b.y>1.)return texture2D(u_after,vec2(iuv.x,1.-iuv.y)).rgb;
  return texture2D(u_before,vec2(b.x,1.-b.y)).rgb;}
void main(){
  vec2 iuv=vec2(gl_FragCoord.x/u_res.x,1.-gl_FragCoord.y/u_res.y);
  float s=0.;
  for(int j=-2;j<=2;j++)for(int i=-2;i<=2;i++){
    vec2 q=iuv+vec2(float(i),float(j))*.012;
    s+=length(bef(q)-texture2D(u_after,vec2(q.x,1.-q.y)).rgb);
  }
  s/=25.;
  gl_FragColor=vec4(vec3(smoothstep(.015,.09,s)),1.);
}`;

  const COMPOSITE = `
uniform sampler2D u_after,u_before,u_mask;
uniform vec2 u_res;
uniform vec4 u_map,u_brect,u_sweep,u_vmap;
uniform mat3 u_H;
uniform float u_useH,u_prog,u_rows,u_margin,u_time,u_spray,u_dry,u_shine,u_wetDark,u_vig,u_full,u_vertical;
#ifdef GL_OES_standard_derivatives
#define FW(x) fwidth(x)
#else
#define FW(x) (0.002)
#endif
vec3 bef(vec2 iuv,vec3 A){vec2 b=(iuv-u_brect.xy)/(u_brect.zw-u_brect.xy);
  if(b.x<0.||b.y<0.||b.x>1.||b.y>1.)return A;
  return texture2D(u_before,vec2(b.x,1.-b.y)).rgb;}
/* path time at which a point (a = along row 0..1, rb = row coordinate) gets cleaned */
float pathT(float a,float row,float inRow,float across){
  float span=1.+2.*u_margin;
  float an=(a+u_margin)/span;
  float sp=mod(row,2.)<.5?an:1.-an;
  float b=inRow-.5;
  float jit=gnoise(vec2(across*u_rows*14.,row*3.7))*.004+gnoise(vec2(across*u_rows*52.,row*1.3+u_time*u_spray*2.))*.0016;
  return row+sp+b*b*.05+jit;
}
void main(){
  vec2 suv=vec2(gl_FragCoord.x/u_res.x,1.-gl_FragCoord.y/u_res.y);
  vec2 iuv=suv*u_map.xy+u_map.zw;
  vec3 A=texture2D(u_after,vec2(iuv.x,1.-iuv.y)).rgb;
  vec3 B=bef(iuv,A);
  float mk=texture2D(u_mask,vec2(iuv.x,1.-iuv.y)).r;
  vec2 P;
  if(u_useH>.5){vec3 q=u_H*vec3(iuv,1.);P=q.xy/q.z;}else{P=mix(suv,suv.yx,u_vertical);}
  float a=(P.x-u_sweep.x)/(u_sweep.y-u_sweep.x);
  float yv=u_useH>.5?(u_vmap.x*P.y+u_vmap.y)/(u_vmap.z*P.y+u_vmap.w):P.y;
  float across=(yv-u_sweep.z)/(u_sweep.w-u_sweep.z);
  float wob=gnoise(vec2(a*6.,5.3))*.07+gnoise(vec2(a*22.,9.1))*.02;
  float rb=across*u_rows+wob;
  float row=clamp(floor(rb),0.,u_rows-1.);
  float inRow=clamp(rb-row,0.,1.);
  float tp=pathT(a,row,inRow,across);
  float e=max(FW(tp)*1.2,1e-5);
  float mS=1.-smoothstep(-e,e,tp-u_prog);
  /* soften the boundary between rows */
  float fw=max(FW(rb),1e-6);
  float dTop=inRow/fw,dBot=(1.-inRow)/fw;
  float nRow=dTop<dBot?row-1.:row+1.;
  if(min(dTop,dBot)<1.3&&nRow>=0.&&nRow<=u_rows-1.){
    float t2=pathT(a,nRow,dTop<dBot?1.:0.,across);
    float m2=1.-smoothstep(-e,e,t2-u_prog);
    mS=mix(mS,m2,.5*(1.-smoothstep(0.,1.2,min(dTop,dBot))));
  }
  if(u_full>.5)mS=1.;else if(u_full<-.5)mS=0.;
  vec3 col=mix(B,A,mS);
  /* wet sheen behind the nozzle, drying as the pass moves on */
  float age=u_prog-tp;
  float wet=mS*(1.-smoothstep(0.,1.25,age))*(1.-u_dry)*mk*(1.-step(.5,abs(u_full)));
  if(wet>.002){
    float lum=dot(col,vec3(.299,.587,.114));
    vec3 wc=mix(vec3(lum),col,1.18)*u_wetDark+gnoise(gl_FragCoord.xy/120.+vec2(u_time*.05,0.))*.02;
    col=mix(col,wc,clamp(wet,0.,1.));
  }
  /* spray at the cleaning line */
  float cur=min(floor(u_prog),u_rows-1.);
  float f=u_prog-cur;
  float span=1.+2.*u_margin;
  float an=(a+u_margin)/span;
  float sp=mod(cur,2.)<.5?an:1.-an;
  float dH=(sp-f)*span;
  float isCur=1.-step(.5,abs(row-cur));
  if(isCur>.5&&u_spray>.002&&dH>-.12&&dH<.08){
    float band=smoothstep(0.,.16,inRow)*smoothstep(1.,.84,inRow);
    float t1=gnoise(vec2(dH*180.-u_time*14.,across*u_rows*9.))*.5+.5;
    float t2=gnoise(vec2(dH*60.+u_time*4.,across*u_rows*4.-u_time*3.))*.5+.5;
    float impact=exp(-abs(dH+.003)/.0045)*(.55+.45*t1);
    float film=dH<0.?exp(dH/.035)*(.15+.5*t2):0.;
    float mist=exp(-abs(dH)/.022)*t2*.45;
    float foam=band*u_spray*clamp(impact+film*.45+mist,0.,1.)*smoothstep(.05,.35,mk);
    col=mix(col,vec3(.94,.97,1.),foam*.8);
  }
  /* glint once dry */
  float sx=suv.x*.75+suv.y*.25;
  if(u_shine>-1.)col+=exp(-pow((sx-u_shine)*6.5,2.))*.07*mS*mk;
  vec2 vv=suv-.5;col*=1.-u_vig*dot(vv,vv)*1.1;
  col+=(hash12(gl_FragCoord.xy+fract(u_time)*17.)-.5)/255.;
  gl_FragColor=vec4(col,1.);
}`;

  /* --------------------------------------------------------------- maths helpers */
  /** Homography mapping 4 src points to 4 dst points (row-major 3x3, h33 = 1). */
  function homography(src, dst) {
    const A = [], b = [];
    for (let i = 0; i < 4; i++) {
      const [x, y] = src[i], [u, v] = dst[i];
      A.push([x, y, 1, 0, 0, 0, -x * u, -y * u]); b.push(u);
      A.push([0, 0, 0, x, y, 1, -x * v, -y * v]); b.push(v);
    }
    for (let c = 0; c < 8; c++) {
      let p = c;
      for (let r = c + 1; r < 8; r++) if (Math.abs(A[r][c]) > Math.abs(A[p][c])) p = r;
      [A[c], A[p]] = [A[p], A[c]]; [b[c], b[p]] = [b[p], b[c]];
      for (let r = 0; r < 8; r++) if (r !== c) { const f = A[r][c] / A[c][c]; for (let k = c; k < 8; k++) A[r][k] -= f * A[c][k]; b[r] -= f * b[c]; }
    }
    const h = b.map((v, i) => v / A[i][i]);
    return [h[0], h[1], h[2], h[3], h[4], h[5], h[6], h[7], 1];
  }
  function invert3(m) {
    const [a, b, c, d, e, f, g, h, i] = m;
    const A = e * i - f * h, B = -(d * i - f * g), C = d * h - e * g;
    const det = a * A + b * B + c * C;
    return [A / det, -(b * i - c * h) / det, (b * f - c * e) / det, B / det, (a * i - c * g) / det, -(a * f - c * d) / det, C / det, -(a * h - b * g) / det, (a * e - b * d) / det];
  }
  function apply3(m, x, y) { const w = m[6] * x + m[7] * y + m[8]; return [(m[0] * x + m[1] * y + m[2]) / w, (m[3] * x + m[4] * y + m[5]) / w]; }

  /* --------------------------------------------------------------- Engine */
  class Engine {
    constructor(canvas, opts) {
      opts = opts || {};
      const attrs = {
        alpha: false, antialias: false, depth: false, stencil: false, premultipliedAlpha: false,
        preserveDrawingBuffer: !!opts.preserve, powerPreference: opts.lowPower ? 'low-power' : 'high-performance',
        failIfMajorPerformanceCaveat: !(opts.allowSoftware || /[?&]sw=1/.test(location.search)),
      };
      const gl = canvas.getContext('webgl', attrs) || canvas.getContext('experimental-webgl', attrs);
      if (!gl) throw new Error('WebGL unavailable');
      this.gl = gl; this.canvas = canvas;
      this.deriv = !!gl.getExtension('OES_standard_derivatives');
      const hp = gl.getShaderPrecisionFormat(gl.FRAGMENT_SHADER, gl.HIGH_FLOAT);
      this.precision = hp && hp.precision > 0 ? 'highp' : 'mediump';
      this.maxTex = gl.getParameter(gl.MAX_TEXTURE_SIZE) || 4096;
      this.vbo = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, this.vbo);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
      gl.disable(gl.DEPTH_TEST); gl.disable(gl.BLEND);
      this.progs = {};
      this.lost = false;
      canvas.addEventListener('webglcontextlost', (e) => { e.preventDefault(); this.lost = true; if (this.onlost) this.onlost(); }, false);
    }

    _program(key, body) {
      if (this.progs[key]) return this.progs[key];
      const gl = this.gl;
      const head = (this.deriv && key === 'composite' ? '#extension GL_OES_standard_derivatives : enable\n' : '') + 'precision ' + this.precision + ' float;\n';
      const mk = (type, src) => {
        const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s);
        if (!gl.getShaderParameter(s, gl.COMPILE_STATUS) && !gl.isContextLost()) { console.error('[surface] shader error:\n' + gl.getShaderInfoLog(s)); throw new Error('shader compile failed'); }
        return s;
      };
      const p = gl.createProgram();
      gl.attachShader(p, mk(gl.VERTEX_SHADER, VERT));
      gl.attachShader(p, mk(gl.FRAGMENT_SHADER, head + NOISE + body));
      gl.bindAttribLocation(p, 0, 'a'); gl.linkProgram(p);
      if (!gl.getProgramParameter(p, gl.LINK_STATUS) && !gl.isContextLost()) throw new Error('program link failed');
      const prog = { p, u: {} };
      const n = gl.getProgramParameter(p, gl.ACTIVE_UNIFORMS);
      for (let i = 0; i < n; i++) { const info = gl.getActiveUniform(p, i); prog.u[info.name] = gl.getUniformLocation(p, info.name); }
      return (this.progs[key] = prog);
    }

    _texture(src, w, h) {
      const gl = this.gl, t = gl.createTexture();
      gl.bindTexture(gl.TEXTURE_2D, t);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      if (src) { gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true); gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, src); gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false); }
      else gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, w, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
      return t;
    }

    _quad() { const gl = this.gl; gl.bindBuffer(gl.ARRAY_BUFFER, this.vbo); gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0); }

    /** A photo pair. brect = where the before photo sits inside the after photo (normalised x0,y0,x1,y1). */
    pair(afterImg, beforeImg, brect) {
      const gl = this.gl;
      const p = { after: this._texture(afterImg), before: this._texture(beforeImg), brect: brect || [0, 0, 1, 1],
        iw: afterImg.naturalWidth || afterImg.width, ih: afterImg.naturalHeight || afterImg.height, maskData: null, mw: 0, mh: 0 };
      /* difference mask at low resolution */
      const mw = 192, mh = Math.max(8, Math.round(192 * p.ih / p.iw));
      p.mask = this._texture(null, mw, mh);
      const fbo = gl.createFramebuffer();
      gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
      gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, p.mask, 0);
      const pr = this._program('mask', MASK);
      gl.useProgram(pr.p); this._quad(); gl.viewport(0, 0, mw, mh);
      gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, p.after); gl.uniform1i(pr.u.u_after, 0);
      gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, p.before); gl.uniform1i(pr.u.u_before, 1);
      gl.uniform2f(pr.u.u_res, mw, mh); gl.uniform4fv(pr.u.u_brect, p.brect);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
      const px = new Uint8Array(mw * mh * 4);
      gl.readPixels(0, 0, mw, mh, gl.RGBA, gl.UNSIGNED_BYTE, px);
      gl.bindFramebuffer(gl.FRAMEBUFFER, null); gl.deleteFramebuffer(fbo);
      p.maskData = px; p.mw = mw; p.mh = mh; /* rows bottom-up */
      return p;
    }

    /** Mask value (0..1) at a normalised image point (top-left origin). */
    maskAt(p, x, y) {
      if (!p.maskData) return 1;
      const ix = Math.min(p.mw - 1, Math.max(0, Math.floor(x * p.mw))), iy = Math.min(p.mh - 1, Math.max(0, Math.floor((1 - y) * p.mh)));
      return p.maskData[(iy * p.mw + ix) * 4] / 255;
    }

    release(p) { const gl = this.gl; if (!p) return; [p.after, p.before, p.mask].forEach((t) => t && gl.deleteTexture(t)); p.after = p.before = p.mask = null; }

    /** Draw a frame of pair p into the canvas region w x h (bottom-left). */
    draw(p, w, h, o) {
      const gl = this.gl;
      if (this.lost || gl.isContextLost() || !p.after) return false;
      const pr = this._program('composite', COMPOSITE), u = pr.u;
      gl.useProgram(pr.p); this._quad();
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      gl.viewport(0, 0, w, h);
      gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, p.after); gl.uniform1i(u.u_after, 0);
      gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, p.before); gl.uniform1i(u.u_before, 1);
      gl.activeTexture(gl.TEXTURE2); gl.bindTexture(gl.TEXTURE_2D, p.mask); gl.uniform1i(u.u_mask, 2);
      const f1 = (n, v) => { if (u[n]) gl.uniform1f(u[n], v); };
      gl.uniform2f(u.u_res, w, h);
      gl.uniform4fv(u.u_map, o.map || [1, 1, 0, 0]);
      gl.uniform4fv(u.u_brect, p.brect);
      gl.uniform4fv(u.u_sweep, o.sweep || [0, 1, 0, 1]);
      if (u.u_vmap) gl.uniform4fv(u.u_vmap, o.vmap || [0, 0, 0, 1]);
      const H = o.H || [1, 0, 0, 0, 1, 0, 0, 0, 1];
      if (u.u_H) gl.uniformMatrix3fv(u.u_H, false, [H[0], H[3], H[6], H[1], H[4], H[7], H[2], H[5], H[8]]);
      f1('u_useH', o.H ? 1 : 0);
      f1('u_vertical', o.vertical ? 1 : 0);
      f1('u_prog', o.prog || 0); f1('u_rows', o.rows || 4); f1('u_margin', o.margin == null ? 0.04 : o.margin);
      f1('u_time', o.time || 0); f1('u_spray', o.spray || 0); f1('u_dry', o.dry || 0);
      f1('u_shine', o.shine == null ? -2 : o.shine); f1('u_wetDark', o.wetDark || 0.68); f1('u_vig', o.vig == null ? 0.2 : o.vig);
      f1('u_full', o.full || 0);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
      return true;
    }
  }

  /** Cover-fit mapping: screen uv -> image uv, keeping the focus point in view. */
  function coverMap(cw, ch, iw, ih, fx, fy) {
    const ca = cw / ch, ia = iw / ih;
    let sx = 1, sy = 1;
    if (ca > ia) sy = ia / ca; else sx = ca / ia;
    const ox = (1 - sx) * (fx == null ? 0.5 : fx), oy = (1 - sy) * (fy == null ? 0.5 : fy);
    return [sx, sy, ox, oy];
  }

  const loadImage = (src) => new Promise((res, rej) => {
    const i = new Image(); i.decoding = 'async';
    i.onload = () => (i.decode ? i.decode().catch(() => {}).then(() => res(i)) : res(i));
    i.onerror = () => rej(new Error('image failed: ' + src));
    i.src = src;
  });

  global.GPSurface = { Engine, homography, invert3, apply3, coverMap, loadImage };
})(window);
