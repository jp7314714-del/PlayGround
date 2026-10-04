import * as THREE from 'three';

// ============ EQUIPOS estilo FC (genéricos) ============
const TEAMS = [
  { name:'Real Blanco', short:'RMA', c1:0xffffff, c2:0xc9a227, rating:92 },
  { name:'Azulgrana', short:'BAR', c1:0x1a2fbf, c2:0xa50044, rating:91 },
  { name:'City Celeste', short:'MCI', c1:0x6ecaf5, c2:0xffffff, rating:90 },
  { name:'Rojos United', short:'MUN', c1:0xd00000, c2:0x000000, rating:86 },
  { name:'París Azul', short:'PSG', c1:0x0a1e5e, c2:0xff3b3b, rating:88 },
  { name:'Albiceleste MX', short:'MEX', c1:0x0a7a3d, c2:0xffffff, rating:82 },
  { name:'Cafeteros', short:'COL', c1:0xffd23f, c2:0x0a3d91, rating:84 },
  { name:'Andinos', short:'ARG', c1:0x75aadb, c2:0xffffff, rating:89 },
];
const DIFFS = [
  { cpuSpeed:0.86, cpuReact:0.9, cpuError:3.2, steal:0.38 },
  { cpuSpeed:0.97, cpuReact:0.45, cpuError:1.6, steal:0.52 },
  { cpuSpeed:1.08, cpuReact:0.22, cpuError:0.7, steal:0.65 },
];
const FIELD = { W:40, L:60, goalW:7.4, goalH:2.6 };

// ============ ESTADO ============
const S = {
  phase:'menu', home:0, away:4, duration:240, diff:1, quality:'low',
  scoreH:0, scoreV:0, time:0, shotsH:0, shotsV:0, possH:0, possT:0,
  owner:null, controlled:null, camMode:1, charging:0, chargingOn:false,
  sprint:false, stamina:1, tackleCD:0, switchCD:0, goalTimer:0, aiTimer:0,
  paused:false, vibrate:true,
};
const $ = id => document.getElementById(id);
const ui = { menu:$('menu'), howto:$('howto'), apk:$('apkscreen'), pause:$('pause'), ft:$('fulltime') };

// selects equipos
TEAMS.forEach((t,i)=>{
  const o1=document.createElement('option'); o1.value=i; o1.textContent=`${t.name} (${t.rating})`;
  const o2=o1.cloneNode(true);
  $('sel-home').appendChild(o1); $('sel-away').appendChild(o2);
});
$('sel-home').value='0'; $('sel-away').value='4';

// ============ AUDIO sintetizado ============
let AC=null, crowdGain=null;
function audio(){ if(!AC){ AC=new (window.AudioContext||window.webkitAudioContext)(); startCrowd(); } if(AC.state==='suspended')AC.resume(); }
function startCrowd(){
  const len=2*AC.sampleRate, buf=AC.createBuffer(1,len,AC.sampleRate), d=buf.getChannelData(0);
  for(let i=0;i<len;i++)d[i]=Math.random()*2-1;
  const src=AC.createBufferSource(); src.buffer=buf; src.loop=true;
  const f=AC.createBiquadFilter(); f.type='bandpass'; f.frequency.value=900; f.Q.value=0.6;
  crowdGain=AC.createGain(); crowdGain.gain.value=0.035;
  src.connect(f).connect(crowdGain).connect(AC.destination); src.start();
}
function beep(freq,dur,type='sine',vol=0.25){ if(!AC)return; const o=AC.createOscillator(),g=AC.createGain(); o.type=type;o.frequency.value=freq; g.gain.setValueAtTime(vol,AC.currentTime); g.gain.exponentialRampToValueAtTime(0.001,AC.currentTime+dur); o.connect(g).connect(AC.destination); o.start(); o.stop(AC.currentTime+dur); }
function kickSound(p=1){ beep(120+60*p,0.12,'triangle',0.5); }
function whistle(n=1){ for(let i=0;i<n;i++) setTimeout(()=>beep(2300,0.5,'square',0.12),i*600); }
function cheer(){ if(!AC||!crowdGain)return; crowdGain.gain.cancelScheduledValues(AC.currentTime); crowdGain.gain.setValueAtTime(0.16,AC.currentTime); crowdGain.gain.exponentialRampToValueAtTime(0.035,AC.currentTime+2.5); beep(523,0.3,'sawtooth',0.08); setTimeout(()=>beep(659,0.3,'sawtooth',0.08),150); setTimeout(()=>beep(784,0.5,'sawtooth',0.1),300); }
function vibrate(ms){ try{ if(S.vibrate&&navigator.vibrate)navigator.vibrate(ms);}catch(e){} }

// ============ THREE SETUP ============
const canvas=$('game-canvas');
const renderer=new THREE.WebGLRenderer({canvas,antialias:false,powerPreference:'high-performance'});
renderer.setPixelRatio(Math.min(devicePixelRatio||1,2));
renderer.shadowMap.enabled=false;
const scene=new THREE.Scene();
scene.background=new THREE.Color(0x0b1e3a);
scene.fog=new THREE.Fog(0x0b1e3a,90,220);
const camera=new THREE.PerspectiveCamera(58,innerWidth/innerHeight,0.1,500);
camera.position.set(0,30,42);
scene.add(new THREE.HemisphereLight(0xffffff,0x1a3a1a,0.95));
const sun=new THREE.DirectionalLight(0xffffff,1.15); sun.position.set(30,50,20); scene.add(sun);

// ---- campo con textura canvas ----
function fieldTexture(){
  const c=document.createElement('canvas'); c.width=512; c.height=768;
  const g=c.getContext('2d');
  for(let i=0;i<16;i++){ g.fillStyle=i%2?'#2f9e44':'#2b9348'; g.fillRect(0,i*48,512,48); }
  g.strokeStyle='#fff'; g.lineWidth=5;
  g.strokeRect(24,24,464,720);
  g.beginPath(); g.moveTo(24,384); g.lineTo(488,384); g.stroke();
  g.beginPath(); g.arc(256,384,70,0,7); g.stroke();
  g.fillStyle='#fff'; g.beginPath(); g.arc(256,384,9,0,7); g.fill();
  g.strokeRect(156,24,200,110); g.strokeRect(156,634,200,110);
  g.strokeRect(206,24,100,44); g.strokeRect(206,680,100,44);
  const t=new THREE.CanvasTexture(c); t.anisotropy=4; t.colorSpace=THREE.SRGBColorSpace; return t;
}
const pitch=new THREE.Mesh(new THREE.PlaneGeometry(FIELD.W+8,FIELD.L+8),new THREE.MeshLambertMaterial({map:fieldTexture()}));
pitch.rotation.x=-Math.PI/2; scene.add(pitch);
const outer=new THREE.Mesh(new THREE.PlaneGeometry(300,300),new THREE.MeshBasicMaterial({color:0x0e2a12}));
outer.rotation.x=-Math.PI/2; outer.position.y=-0.05; scene.add(outer);

// líneas de portería + porterías
function makeGoal(z,dir){
  const grp=new THREE.Group(); const mat=new THREE.MeshBasicMaterial({color:0xffffff});
  const w=FIELD.goalW/2,h=FIELD.goalH;
  const postG=new THREE.CylinderGeometry(0.12,0.12,h,8);
  const p1=new THREE.Mesh(postG,mat); p1.position.set(-w,h/2,0);
  const p2=new THREE.Mesh(postG,mat); p2.position.set(w,h/2,0);
  const bar=new THREE.Mesh(new THREE.CylinderGeometry(0.12,0.12,w*2,8),mat);
  bar.rotation.z=Math.PI/2; bar.position.set(0,h,0);
  const netMat=new THREE.MeshBasicMaterial({color:0xffffff,transparent:true,opacity:0.22,wireframe:true});
  const net=new THREE.Mesh(new THREE.BoxGeometry(w*2,h,2.4),netMat); net.position.set(0,h/2,dir*1.2);
  grp.add(p1,p2,bar,net); grp.position.set(0,0,z); scene.add(grp);
}
makeGoal(-FIELD.L/2,-1); makeGoal(FIELD.L/2,1);

// estadio simple
{
  const standMat=new THREE.MeshLambertMaterial({color:0x16213e});
  for(const [x,z,w,d] of [[0,-42,70,10],[0,42,70,10],[-32,0,10,74],[32,0,10,74]]){
    const m=new THREE.Mesh(new THREE.BoxGeometry(w,9,d),standMat); m.position.set(x,4.5,z); scene.add(m);
    const crowd=new THREE.Mesh(new THREE.BoxGeometry(w,1.6,d),new THREE.MeshBasicMaterial({color:0x3a506b}));
    crowd.position.set(x,9.6,z); scene.add(crowd);
  }
  const lampMat=new THREE.MeshBasicMaterial({color:0xfff9c4});
  for(const [x,z] of [[-28,-36],[28,-36],[-28,36],[28,36]]){
    const pole=new THREE.Mesh(new THREE.CylinderGeometry(0.3,0.3,26,6),new THREE.MeshLambertMaterial({color:0x333}));
    pole.position.set(x,13,z); scene.add(pole);
    const lamp=new THREE.Mesh(new THREE.BoxGeometry(4,2,0.6),lampMat); lamp.position.set(x,26,z); scene.add(lamp);
  }
}

// ---- balón ----
function ballTexture(){
  const c=document.createElement('canvas'); c.width=c.height=128; const g=c.getContext('2d');
  g.fillStyle='#fff'; g.fillRect(0,0,128,128); g.fillStyle='#111';
  g.beginPath(); g.arc(64,64,22,0,7); g.fill();
  for(let i=0;i<5;i++){ const a=i/5*Math.PI*2; g.beginPath(); g.arc(64+Math.cos(a)*52,64+Math.sin(a)*52,16,0,7); g.fill(); }
  const t=new THREE.CanvasTexture(c); t.colorSpace=THREE.SRGBColorSpace; return t;
}
const ballMesh=new THREE.Mesh(new THREE.SphereGeometry(0.42,20,16),new THREE.MeshLambertMaterial({map:ballTexture()}));
scene.add(ballMesh);
const ball={ pos:new THREE.Vector3(0,0.42,0), vel:new THREE.Vector3(), spin:new THREE.Vector3() };

// ---- jugadores ----
const skins=[0xffdbac,0xf1c27d,0xe0ac69,0xc68642,0x8d5524];
function makePlayerMesh(c1,c2,skin){
  const g=new THREE.Group();
  const torso=new THREE.Mesh(new THREE.CapsuleGeometry(0.42,0.55,4,10),new THREE.MeshLambertMaterial({color:c1}));
  torso.position.y=1.15; g.add(torso);
  const stripe=new THREE.Mesh(new THREE.CylinderGeometry(0.43,0.43,0.16,12),new THREE.MeshLambertMaterial({color:c2}));
  stripe.position.y=1.15; g.add(stripe);
  const shorts=new THREE.Mesh(new THREE.CylinderGeometry(0.34,0.38,0.4,10),new THREE.MeshLambertMaterial({color:0x111111}));
  shorts.position.y=0.62; g.add(shorts);
  const head=new THREE.Mesh(new THREE.SphereGeometry(0.26,14,12),new THREE.MeshLambertMaterial({color:skin}));
  head.position.y=1.95; g.add(head);
  const legG=new THREE.BoxGeometry(0.16,0.55,0.16); const legM=new THREE.MeshLambertMaterial({color:0x111111});
  const l1=new THREE.Mesh(legG,legM); l1.position.set(-0.16,0.28,0);
  const l2=new THREE.Mesh(legG,legM); l2.position.set(0.16,0.28,0);
  g.add(l1,l2); g.userData={torso,head,l1,l2};
  const ring=new THREE.Mesh(new THREE.RingGeometry(0.6,0.85,24),new THREE.MeshBasicMaterial({color:0xffffff,transparent:true,opacity:0.9,side:THREE.DoubleSide}));
  ring.rotation.x=-Math.PI/2; ring.position.y=0.06; ring.visible=false; g.add(ring); g.userData.ring=ring;
  return g;
}
class P {
  constructor(team,idx,role,hx,hz){
    this.team=team; this.idx=idx; this.role=role; this.home=new THREE.Vector3(hx,0,hz);
    this.pos=new THREE.Vector3(hx,0,hz); this.vel=new THREE.Vector3();
    this.speed=7.2; this.dir=0; this.anim=Math.random()*9; this.stun=0; this.dive=0;
    const t=TEAMS[team==='H'?S.home:S.away];
    this.mesh=makePlayerMesh(t.c1,t.c2,skins[(idx*2+(team==='H'?0:3))%skins.length]);
    scene.add(this.mesh);
  }
}
let players=[];
function formation(sign){
  // 5v5: GK, DF, MF, MF, FW  (x lateral, z largo)
  return [
    {r:'GK',x:0,z:sign*28.5},
    {r:'DF',x:-6,z:sign*16},
    {r:'MF',x:6,z:sign*12},
    {r:'MF',x:-5,z:sign*4},
    {r:'FW',x:5,z:sign*1},
  ];
}
function buildTeams(){
  players.forEach(p=>scene.remove(p.mesh));
  players=[];
  formation(1).forEach((f,i)=>players.push(new P('H',i,f.r,f.x,f.z)));
  formation(-1).forEach((f,i)=>players.push(new P('V',i,f.r,f.x,f.z)));
  // velocidades por rating + random
  const rh=TEAMS[S.home].rating, rv=TEAMS[S.away].rating;
  players.forEach(p=>{
    const base=p.team==='H'?rh:rv;
    p.speed=6.4+(base-80)*0.09+Math.random()*0.5-(p.role==='GK'?1.2:0)+(p.role==='FW'?0.7:0);
    if(p.role==='GK')p.speed=5.4;
  });
  S.owner=null; S.controlled=players[3];
}
function teamOf(p){return p.team;}
function goalZ(team){ return team==='H'? -FIELD.L/2 : FIELD.L/2; } // arco que ataca
function ownGoalZ(team){ return team==='H'? FIELD.L/2 : -FIELD.L/2; }

// ============ INPUT joystick + botones + teclado ============
const joy={x:0,y:0,active:false,id:null};
const joyEl=$('joystick'), stick=$('stick');
function joyPos(e){ const r=joyEl.getBoundingClientRect(); const cx=r.left+r.width/2, cy=r.top+r.height/2; let dx=e.clientX-cx, dy=e.clientY-cy; const m=Math.hypot(dx,dy),max=r.width/2-10; if(m>max){dx*=max/m;dy*=max/m;} stick.style.transform=`translate(calc(-50% + ${dx}px),calc(-50% + ${dy}px))`; joy.x=dx/max; joy.y=dy/max; }
joyEl.addEventListener('pointerdown',e=>{joy.active=true;joy.id=e.pointerId;joyEl.setPointerCapture(e.pointerId);joyPos(e);});
joyEl.addEventListener('pointermove',e=>{if(joy.active&&e.pointerId===joy.id)joyPos(e);});
const endJoy=e=>{if(e.pointerId===joy.id){joy.active=false;joy.x=joy.y=0;stick.style.transform='translate(-50%,-50%)';}};
joyEl.addEventListener('pointerup',endJoy); joyEl.addEventListener('pointercancel',endJoy);
const keys={};
addEventListener('keydown',e=>{keys[e.key.toLowerCase()]=true; if(e.key.toLowerCase()==='p')togglePause(); if(e.key.toLowerCase()==='j')doPass(); if(e.key.toLowerCase()==='u')doTackle();});
addEventListener('keyup',e=>{keys[e.key.toLowerCase()]=false; if(e.key.toLowerCase()==='k')releaseShoot();});
function inputVec(){
  let x=joy.x,y=joy.y;
  if(keys['w']||keys['arrowup'])y-=1; if(keys['s']||keys['arrowdown'])y+=1;
  if(keys['a']||keys['arrowleft'])x-=1; if(keys['d']||keys['arrowright'])x+=1;
  const m=Math.hypot(x,y); if(m>1){x/=m;y/=m;}
  return {x,y};
}
// botones
let shootStart=0;
function bindHold(el,down,up){
  el.addEventListener('pointerdown',e=>{e.preventDefault();audio();down();},{passive:false});
  el.addEventListener('pointerup',e=>{e.preventDefault();up&&up();});
  el.addEventListener('pointercancel',()=>up&&up());
  el.addEventListener('pointerleave',()=>up&&up());
}
bindHold($('btn-pass'),()=>doPass(),null);
bindHold($('btn-shoot'),()=>{S.chargingOn=true;S.charging=0;shootStart=performance.now();},()=>releaseShoot());
bindHold($('btn-tackle'),()=>doTackle(),null);
bindHold($('btn-sprint'),()=>{S.sprint=true;},()=>{S.sprint=false;});
addEventListener('keydown',e=>{if(e.key.toLowerCase()==='k'&&!e.repeat){S.chargingOn=true;S.charging=0;} if(e.key.toLowerCase()==='l')S.sprint=true;});
addEventListener('keyup',e=>{if(e.key.toLowerCase()==='l')S.sprint=false;});
setInterval(()=>{ if(S.chargingOn){ S.charging=Math.min(1,S.charging+0.025); $('power-bar').style.width=(S.charging*100)+'%'; $('power-wrap').classList.remove('hidden'); } },50);

// ============ ACCIONES ============
function controlled(){ return S.controlled; }
function nearestToBall(team,excludeGK=true){
  let best=null,bd=1e9;
  for(const p of players){ if(p.team!==team)continue; if(excludeGK&&p.role==='GK')continue; const d=p.pos.distanceTo(ball.pos); if(d<bd){bd=d;best=p;} }
  return best;
}
function bestPassMate(){
  const me=controlled(); const iv=inputVec();
  let aim=new THREE.Vector3(iv.x,0,iv.y);
  if(aim.length()<0.2) aim=new THREE.Vector3(0,0,me.team==='H'?-1:1);
  aim.normalize();
  let best=null,bs=-2;
  for(const p of players){ if(p.team!==me.team||p===me)continue; if(p.role==='GK'&&Math.random()<0.7)continue;
    const to=new THREE.Vector3().subVectors(p.pos,me.pos); to.y=0; const dist=to.length(); to.normalize();
    const score=to.dot(aim)-dist*0.02; if(score>bs){bs=score;best=p;} }
  return best;
}
function doPass(){
  audio(); if(S.phase!=='play')return;
  const me=controlled();
  if(S.owner&&S.owner.team==='H'&&S.owner!==me){ /* si no tengo balón, cambiar */ }
  if(S.owner===me){
    const mate=bestPassMate();
    if(mate){
      const dir=new THREE.Vector3().subVectors(mate.pos,me.pos); dir.y=0; const d=dir.length(); dir.normalize();
      ball.vel.set(dir.x*(13+d*0.45),1.2,dir.z*(13+d*0.45));
      ball.pos.copy(me.pos).addScaledVector(dir,0.9); ball.pos.y=0.42;
      S.owner=null; kickSound(0.6); S.possT++;
      // el receptor corre al balón, control pasa al receptor
      S.controlled=mate;
    }
  } else if(!S.owner||S.owner.team!=='H'){
    // cambiar a más cercano
    const n=nearestToBall('H'); if(n){S.controlled=n; beep(600,0.06,'square',0.06);}
  } else {
    // compañero tiene balón: cambiar a él
    S.controlled=S.owner;
  }
}
function releaseShoot(){
  if(!S.chargingOn)return; S.chargingOn=false; $('power-wrap').classList.add('hidden');
  if(S.phase!=='play'){S.charging=0;return;}
  const me=controlled(); const pow=S.charging; S.charging=0;
  if(S.owner===me){
    shoot(me,Math.max(0.25,pow)); S.shotsH++;
  } else if(S.owner&&S.owner.team==='H'){
    // pase al hueco largo si mantengo sin balón: tiro del compañero? nada
  }
  // si defiendo, tiro = entrada fuerte
  if(S.owner!==me&&(!S.owner||S.owner.team!=='H')) doTackle();
}
function shoot(p,power){
  audio();
  const gz=goalZ(p.team);
  const aimX=(Math.random()-0.5)*2*DIFFS[S.diff].cpuError*(p.team==='H'?1:1);
  const tx=THREE.MathUtils.clamp(aimX,-3,3);
  const dir=new THREE.Vector3(tx-p.pos.x,0,gz-p.pos.z).normalize();
  const dist=Math.abs(gz-p.pos.z);
  const speed=16+power*16+dist*0.08;
  const lift=2.2+power*5.5-(dist<12?1.5:0);
  ball.vel.set(dir.x*speed,lift,dir.z*speed);
  ball.pos.copy(p.pos).addScaledVector(dir,1.0); ball.pos.y=0.6;
  S.owner=null; kickSound(power); vibrate(30);
}
function doTackle(){
  audio(); if(S.phase!=='play')return;
  if(S.tackleCD>0)return; S.tackleCD=0.6;
  const me=controlled(); me.stun=0.25;
  // lunge
  const iv=inputVec(); let d=new THREE.Vector3(iv.x,0,iv.y);
  if(d.length()<0.2&&S.owner) d=new THREE.Vector3().subVectors(S.owner.pos,me.pos).setY(0).normalize();
  if(d.length()>0.1){d.normalize(); me.pos.addScaledVector(d,1.1);}
  if(S.owner&&S.owner.team!=='H'){
    const dist=me.pos.distanceTo(S.owner.pos);
    const prob=S.owner.role==='GK'?0.25:DIFFS[S.diff].steal*(S.owner.team==='V'?1:0.6);
    if(dist<2.1&&Math.random()<prob+0.18){
      S.owner=me; kickSound(0.4); beep(400,0.08,'square',0.1); vibrate(20);
    } else beep(200,0.1,'sawtooth',0.08);
  }
  // CPU barrida si está cerca del portador humano
  clampPlayers();
}

// ============ IA ============
function aiMove(p,dt){
  const D=DIFFS[S.diff];
  const hasBall=S.owner===p;
  const myGoal=ownGoalZ(p.team), atkGoal=goalZ(p.team);
  const v=new THREE.Vector3();
  if(p.role==='GK'){
    // portero: sigue x del balón, sale si está cerca
    const tz=ownGoalZ(p.team)+(p.team==='H'?-0.8:0.8);
    const tx=THREE.MathUtils.clamp(ball.pos.x*0.55,-3,3);
    v.set(tx-p.pos.x,0,tz-p.pos.z);
    const ballClose=Math.abs(ball.pos.z-tz)<10&&Math.abs(ball.pos.x-p.pos.x)<8;
    if(!S.owner&&ballClose){ v.set(ball.pos.x-p.pos.x,0,ball.pos.z-p.pos.z); }
    if(S.owner&&S.owner.team!==p.team&&Math.abs(S.owner.pos.z-tz)<7){
      v.set(S.owner.pos.x-p.pos.x,0,(S.owner.pos.z-p.pos.z)*0.6); // achique
    }
    movePlayer(p,v,1,dt);
    return;
  }
  if(hasBall){
    if(p.team==='V'){
      // CPU con balón: avanza, regatea, pasa o tira
      p.aiT=(p.aiT||0)-dt;
      const distGoal=Math.abs(atkGoal-p.pos.z);
      if(distGoal<16&&Math.abs(p.pos.x)<12){
        if((p.aiT||0)<=0){ shoot(p,0.5+Math.random()*0.5); S.shotsV++; p.aiT=2; return; }
      }
      if((p.aiT||0)<=0&&Math.random()<0.02){
        // pase CPU
        const mates=players.filter(q=>q.team==='V'&&q!==p&&q.role!=='GK');
        const m=mates[Math.floor(Math.random()*mates.length)];
        if(m){ const dir=new THREE.Vector3().subVectors(m.pos,p.pos).setY(0).normalize();
          ball.vel.set(dir.x*15,1.4,dir.z*15); ball.pos.copy(p.pos).addScaledVector(dir,1); S.owner=null; kickSound(0.5); }
        p.aiT=1.5; return;
      }
      // conducir a portería con zigzag
      const dodge=Math.sin(performance.now()/500+p.idx)*3;
      v.set((0-p.pos.x)*0.06+dodge*0.3,0,(atkGoal-p.pos.z)>0?1:-1);
      // evitar humano cercano
      const h=nearestToBall('H');
      if(h&&h.pos.distanceTo(p.pos)<3){ v.x+=(p.pos.x-h.pos.x)*0.8; }
      movePlayer(p,v,D.cpuSpeed*(S.diff===2?1.06:1),dt);
    } else {
      // humano con balón lo mueve el input (no IA)
    }
    return;
  }
  // sin balón
  const myTeamBall=S.owner&&S.owner.team===p.team;
  const oppBall=S.owner&&S.owner.team!==p.team;
  if(p.team==='V'){
    // CPU defensivo/ofensivo
    if(!S.owner){
      // balón suelto: el más cercano va
      const chaser=[...players].filter(q=>q.team==='V'&&q.role!=='GK').sort((a,b)=>a.pos.distanceTo(ball.pos)-b.pos.distanceTo(ball.pos))[0];
      if(p===chaser) v.set(ball.pos.x-p.pos.x,0,ball.pos.z-p.pos.z);
      else v.set(p.home.x+ (ball.pos.x*0.25)-p.pos.x,0,p.home.z*0.7+(ball.pos.z*0.3)-p.pos.z);
    } else if(oppBall){
      const carrier=S.owner;
      // presiona con 1-2 jugadores
      const pressers=[...players].filter(q=>q.team==='V'&&q.role!=='GK').sort((a,b)=>a.pos.distanceTo(carrier.pos)-b.pos.distanceTo(carrier.pos)).slice(0,S.diff+1);
      if(pressers.includes(p)){
        v.set(carrier.pos.x-p.pos.x,0,carrier.pos.z-p.pos.z);
        // intentar robar
        p.stealT=(p.stealT||0)-dt;
        if(p.pos.distanceTo(carrier.pos)<1.5&&p.stealT<=0){ p.stealT=1.2; if(Math.random()<D.steal*0.5){S.owner=p; beep(300,0.08,'square',0.1);} }
      } else {
        // marca / repliegue
        v.set(p.home.x*0.8-p.pos.x+(ball.pos.x*0.15),0,(p.home.z+myGoal)/2*0.4+ball.pos.z*0.25-p.pos.z);
      }
    } else if(myTeamBall){
      // desmarque: sube
      const adv=p.team==='V'?-1:1;
      v.set(p.home.x-p.pos.x+(ball.pos.x-p.pos.x)*0.2,0,(p.home.z+adv*-14)*0.5+ball.pos.z*0.2-p.pos.z);
      // apoyo
      if(Math.abs(p.pos.z-ball.pos.z)>18) v.z+=(adv*-1)*4;
    }
    // reacción limitada por dificultad
    if(Math.random()<D.cpuReact*dt*2) v.multiplyScalar(0.2);
    movePlayer(p,v,D.cpuSpeed,dt);
  } else {
    // compañeros humanos (H, no controlados): posicionamiento + apoyo
    if(p===S.controlled) return; // lo mueve el jugador
    if(!S.owner){
      const chaser=[...players].filter(q=>q.team==='H'&&q.role!=='GK'&&q!==S.controlled).sort((a,b)=>a.pos.distanceTo(ball.pos)-b.pos.distanceTo(ball.pos))[0];
      // el controlado ya va; los demás mantienen forma
      v.set(p.home.x+(ball.pos.x*0.3)-p.pos.x,0,p.home.z*0.6+ball.pos.z*0.35-p.pos.z);
      if(p===chaser&&S.controlled.pos.distanceTo(ball.pos)>6) v.set(ball.pos.x-p.pos.x,0,ball.pos.z-p.pos.z);
    } else if(S.owner.team==='H'){
      // ataque: abrirse
      const fwd=p.team==='H'?-1:1;
      v.set(p.home.x*1.3-p.pos.x+(p.pos.x<0?-4:4)*0.3,0,p.home.z+fwd*6+ball.pos.z*0.15-p.pos.z);
    } else {
      // defensa: el 2º más cercano presiona si el humano está lejos
      const rank=[...players].filter(q=>q.team==='H'&&q.role!=='GK').sort((a,b)=>a.pos.distanceTo(S.owner.pos)-b.pos.distanceTo(S.owner.pos));
      if(rank[1]===p&&S.controlled.pos.distanceTo(S.owner.pos)>7) v.set(S.owner.pos.x-p.pos.x,0,S.owner.pos.z-p.pos.z);
      else v.set(p.home.x-p.pos.x+(ball.pos.x-p.pos.x)*0.25,0,p.home.z*0.7+ball.pos.z*0.3-p.pos.z);
    }
    movePlayer(p,v,0.92,dt);
  }
}
function movePlayer(p,v,mult,dt){
  if(p.stun>0){p.stun-=dt;return;}
  const m=v.length();
  if(m>0.05){
    v.normalize();
    const sprint=p===S.controlled&&S.sprint&&S.stamina>0.05?1.35:1;
    const sp=p.speed*mult*sprint*dt;
    p.pos.x+=v.x*sp; p.pos.z+=v.z*sp;
    p.dir=Math.atan2(v.x,v.z);
    p.anim+=dt*(6+sprint*4);
    if(p===S.controlled&&S.sprint&&m>0.3){S.stamina=Math.max(0,S.stamina-dt*0.35);}
  }
  clampPlayers(p);
}
function clampPlayers(one){
  const list=one?[one]:players;
  for(const p of list){
    p.pos.x=THREE.MathUtils.clamp(p.pos.x,-FIELD.W/2-2,FIELD.W/2+2);
    if(p.role!=='GK') p.pos.z=THREE.MathUtils.clamp(p.pos.z,-FIELD.L/2-2,FIELD.L/2+2);
    else p.pos.z=THREE.MathUtils.clamp(p.pos.z,ownGoalZ(p.team)-3,ownGoalZ(p.team)+3-(p.team==='H'?0:0));
  }
}

// ============ FÍSICA BALÓN ============
function updateBall(dt){
  if(S.owner){
    const o=S.owner;
    const fx=Math.sin(o.dir),fz=Math.cos(o.dir);
    const lead=o===S.controlled?0.85:0.8;
    ball.pos.set(o.pos.x+fx*lead,0.42,o.pos.z+fz*lead);
    ball.vel.set(0,0,0);
    // robar por contacto si rival muy pegado y lleva mucho
    return;
  }
  ball.vel.y-=24*dt;
  ball.pos.addScaledVector(ball.vel,dt);
  // fricción
  if(ball.pos.y<=0.45){ ball.pos.y=0.42; if(ball.vel.y<0)ball.vel.y*=-0.55; ball.vel.x*= (1-1.4*dt); ball.vel.z*=(1-1.4*dt); ball.vel.y*=(1-1.2*dt); if(ball.vel.length()<0.4)ball.vel.set(0,0,0);}
  else { ball.vel.x*=(1-0.25*dt); ball.vel.z*=(1-0.25*dt); }
  ballMesh.rotation.x+=ball.vel.z*dt*2; ballMesh.rotation.z-=ball.vel.x*dt*2;
  // paredes laterales (modo arcade indoor) excepto boca de gol
  const inMouth=Math.abs(ball.pos.x)<FIELD.goalW/2&&ball.pos.y<FIELD.goalH;
  if(Math.abs(ball.pos.x)>FIELD.W/2){
    ball.pos.x=Math.sign(ball.pos.x)*FIELD.W/2; ball.vel.x*=-0.6; kickSound(0.2);
  }
  if(Math.abs(ball.pos.z)>FIELD.L/2){
    if(inMouth){
      // deja pasar para detectar gol; red frena
      if(Math.abs(ball.pos.z)>FIELD.L/2+2.2){ ball.vel.multiplyScalar(0.1); }
    } else { ball.pos.z=Math.sign(ball.pos.z)*FIELD.L/2; ball.vel.z*=-0.6; kickSound(0.2); }
  }
  // posesión: alguien la caza
  if(ball.vel.length()<9){
    for(const p of players){
      if(p.stun>0)continue;
      const d=Math.hypot(p.pos.x-ball.pos.x,p.pos.z-ball.pos.z);
      const r=p.role==='GK'?1.5:1.05;
      if(d<r&&ball.pos.y<1.6){
        S.owner=p;
        if(p.team==='H'&&p.role!=='GK'){ if(S.controlled.role==='GK'||Math.random()<0.85) S.controlled=p; }
        if(p.team==='V'){ /* CPU la toma */ }
        ball.vel.set(0,0,0);
        break;
      }
    }
  }
  // GOL
  checkGoal();
}
function checkGoal(){
  const inMouth=Math.abs(ball.pos.x)<FIELD.goalW/2-0.2&&ball.pos.y<FIELD.goalH;
  if(!inMouth)return;
  if(ball.pos.z<-FIELD.L/2-0.4){
    // entró en arco norte (ataca H)
    onGoal('H');
  } else if(ball.pos.z>FIELD.L/2+0.4){
    onGoal('V');
  }
}
function onGoal(team){
  if(S.phase!=='play')return;
  S.phase='goal'; S.goalTimer=2.4;
  if(team==='H'){S.scoreH++;}else{S.scoreV++;}
  $('hud-score').textContent=`${S.scoreH} - ${S.scoreV}`;
  $('goal-flash').textContent=team==='H'?'¡GOOOL!':'Gol rival…';
  $('goal-flash').classList.remove('hidden');
  cheer(); vibrate([60,40,120]); whistle(0);
  showMsg(team==='H'?'⚽ ¡GOLAZO!':'🥅 Gol del rival');
}
function showMsg(t,ms=1600){
  const m=$('msg-banner'); m.textContent=t; m.classList.remove('hidden');
  clearTimeout(m._t); m._t=setTimeout(()=>m.classList.add('hidden'),ms);
}

// ============ CÁMARA / RADAR ============
function updateCamera(dt){
  const isPortrait=innerHeight>innerWidth;
  const mid=new THREE.Vector3((ball.pos.x+(S.controlled?S.controlled.pos.x:0))/2,0,(ball.pos.z+(S.controlled?S.controlled.pos.z:0))/2);
  let tp=new THREE.Vector3(),lk=new THREE.Vector3();
  if(S.camMode===0){ // TV lateral
    tp.set(mid.x*0.5,26,mid.z*0.4+34); lk.set(mid.x*0.5,0,mid.z*0.4);
  } else if(S.camMode===1){ // seguidora
    const d=isPortrait?1.35:1;
    tp.set(mid.x*0.75,22*d,mid.z*0.75+(isPortrait?34:26)*d); lk.set(mid.x*0.8,0,mid.z*0.8-4);
  } else { // cenital
    tp.set(0,58,mid.z*0.3+8); lk.set(0,0,mid.z*0.3);
  }
  camera.position.lerp(tp,1-Math.pow(0.001,dt));
  const cl=camera.position.clone().lerp(lk,0.12);
  camera.lookAt(lk);
  camera.fov=isPortrait?68:55; camera.updateProjectionMatrix();
}
const radar=$('radar').getContext('2d');
let radarT=0;
function drawRadar(){
  const w=180,h=120; radar.clearRect(0,0,w,h);
  radar.fillStyle='#0a5c1e'; radar.fillRect(0,0,w,h);
  radar.strokeStyle='#fff'; radar.lineWidth=2; radar.strokeRect(6,6,w-12,h-12);
  radar.beginPath(); radar.moveTo(6,h/2); radar.lineTo(w-6,h/2); radar.stroke();
  radar.beginPath(); radar.arc(w/2,h/2,14,0,7); radar.stroke();
  const sx=x=>(x/FIELD.W+0.5)*w, sz=z=>(z/FIELD.L+0.5)*h;
  radar.fillStyle='#fff'; radar.fillRect(w/2-8,2,16,6); radar.fillRect(w/2-8,h-8,16,6);
  for(const p of players){
    radar.fillStyle=p.team==='H'?'#00e5ff':'#ff5252';
    if(p===S.controlled){radar.fillStyle='#ffff00';}
    radar.beginPath(); radar.arc(sx(p.pos.x),sz(p.pos.z),p===S.controlled?4:3,0,7); radar.fill();
  }
  radar.fillStyle='#fff'; radar.beginPath(); radar.arc(sx(ball.pos.x),sz(ball.pos.z),3,0,7); radar.fill();
}

// ============ PARTIDO ============
function startMatch(){
  S.home=+$('sel-home').value; S.away=+$('sel-away').value;
  if(S.home===S.away)S.away=(S.away+1)%TEAMS.length;
  S.duration=+$('sel-time').value; S.diff=+$('sel-diff').value; S.quality=$('sel-quality').value;
  renderer.setPixelRatio(S.quality==='high'?Math.min(devicePixelRatio||1,2):1);
  renderer.shadowMap.enabled=(S.quality==='high');
  S.scoreH=0;S.scoreV=0;S.time=0;S.shotsH=0;S.shotsV=0;S.stamina=1;S.charging=false;S.chargingOn=false;
  buildTeams(); kickoff(true);
  $('hud-home').textContent=TEAMS[S.home].short; $('hud-home').style.background='#'+TEAMS[S.home].c1.toString(16).padStart(6,'0');
  $('hud-away').textContent=TEAMS[S.away].short; $('hud-away').style.background='#'+TEAMS[S.away].c1.toString(16).padStart(6,'0');
  $('hud-score').textContent='0 - 0';
  Object.values(ui).forEach(e=>e.classList.add('hidden'));
  $('hud-top').classList.remove('hidden'); $('touch-ui').classList.remove('hidden');
  $('stamina-wrap').classList.remove('hidden');
  S.phase='play'; S.paused=false;
  audio(); whistle(1); showMsg('¡Arranca el partido! ⚽');
}
function kickoff(center=true){
  const fh=formation(1),fv=formation(-1);
  players.forEach(p=>{
    const f=(p.team==='H'?fh:fv)[p.idx];
    p.pos.set(f.x+(Math.random()-0.5),0,f.z); p.vel.set(0,0,0); p.stun=0;
  });
  ball.pos.set(0,0.42,0); ball.vel.set(0,0,0);
  S.owner=players.find(p=>p.team==='H'&&p.role==='FW');
  S.controlled=S.owner;
}
function endMatch(){
  S.phase='full'; whistle(3);
  $('touch-ui').classList.add('hidden'); $('hud-top').classList.add('hidden');
  $('stamina-wrap').classList.add('hidden'); $('power-wrap').classList.add('hidden');
  const w=S.scoreH>S.scoreV?'🏆 ¡VICTORIA!':S.scoreH<S.scoreV?'😞 Derrota…':'🤝 Empate';
  $('ft-title').textContent=w;
  $('ft-score').textContent=`${TEAMS[S.home].short} ${S.scoreH} - ${S.scoreV} ${TEAMS[S.away].short}`;
  $('ft-stats').textContent=`Tiros: ${S.shotsH} - ${S.shotsV} · Dificultad: ${['Amateur','Profesional','Leyenda'][S.diff]}`;
  ui.ft.classList.remove('hidden');
}
function togglePause(){
  if(S.phase!=='play'&&!S.paused)return;
  S.paused=!S.paused;
  ui.pause.classList.toggle('hidden',!S.paused);
}

// botones menú
$('btn-play').onclick=()=>{audio();startMatch();};
$('btn-how').onclick=()=>{ui.howto.classList.remove('hidden');};
$('btn-how-back').onclick=()=>ui.howto.classList.add('hidden');
$('btn-apk').onclick=()=>ui.apk.classList.remove('hidden');
$('btn-apk-back').onclick=()=>ui.apk.classList.add('hidden');
$('btn-pause').onclick=()=>togglePause();
$('btn-resume').onclick=()=>togglePause();
$('btn-quit').onclick=()=>{S.paused=false;S.phase='menu';ui.pause.classList.add('hidden');ui.menu.classList.remove('hidden');$('touch-ui').classList.add('hidden');$('hud-top').classList.add('hidden');};
$('btn-cam').onclick=()=>{S.camMode=(S.camMode+1)%3;showMsg(['📷 Cámara TV','📷 Cámara Seguidora','📷 Cámara Cenital'][S.camMode]);};
$('btn-rematch').onclick=()=>{ui.ft.classList.add('hidden');startMatch();};
$('btn-menu2').onclick=()=>{ui.ft.classList.add('hidden');S.phase='menu';ui.menu.classList.remove('hidden');};
// PWA install
let deferred=null;
addEventListener('beforeinstallprompt',e=>{e.preventDefault();deferred=e;$('btn-install').classList.remove('hidden');});
$('btn-install').onclick=async()=>{ if(deferred){deferred.prompt();await deferred.userChoice;deferred=null;$('btn-install').classList.add('hidden');} else ui.apk.classList.remove('hidden'); };

// ============ LOOP ============
const clock=new THREE.Clock();
function frame(){
  requestAnimationFrame(frame);
  const dt=Math.min(clock.getDelta(),0.033);
  if(S.phase==='play'&&!S.paused){
    S.time+=dt;
    // reloj 90' escalado
    const min90=S.time/S.duration*90;
    const showMin=Math.min(90,Math.floor(min90)+1);
    $('hud-time').textContent=`${showMin}' / 90'`;
    if(S.time>=S.duration){ endMatch(); }
    // input humano
    const me=S.controlled;
    if(me&&me.role!=='GK'){
      const iv=inputVec();
      const v=new THREE.Vector3(iv.x,0,iv.y);
      if(S.owner===me){
        // conducir: limita giro brusco con balón
        if(v.length()>0.15) movePlayer(me,v,0.95,dt);
        S.possH+=dt;
      } else if(!S.owner||S.owner.team!=='H'){
        if(v.length()>0.15) movePlayer(me,v,1,dt);
        else clampPlayers(me);
        // auto-switch si otro está mucho más cerca del balón suelto
        S.switchCD-=dt;
        if(!S.owner&&S.switchCD<=0){
          const n=nearestToBall('H');
          if(n&&n!==me&&n.pos.distanceTo(ball.pos)<me.pos.distanceTo(ball.pos)-4){S.controlled=n;S.switchCD=1;}
        }
      } else {
        if(v.length()>0.15) movePlayer(me,v,1,dt);
      }
      // stamina regen
      if(!S.sprint)S.stamina=Math.min(1,S.stamina+dt*0.25);
      $('stamina-bar').style.width=(S.stamina*100)+'%';
      $('stamina-bar').style.background=S.stamina>0.3?'#2ecc71':'#e74c3c';
    } else if(me&&me.role==='GK'){
      // si controla portero (raro), permitir moverlo en área
      const iv=inputVec(); movePlayer(me,new THREE.Vector3(iv.x,0,iv.y),1,dt);
    }
    S.possT+=dt;
    S.tackleCD-=dt;
    // IA resto
    S.aiTimer-=dt;
    for(const p of players){
      if(p===S.controlled) { if(p.team==='V')aiMove(p,dt); continue; }
      aiMove(p,dt);
    }
    updateBall(dt);
    if(S.phase==='goal'){
      S.goalTimer-=dt;
      // balón al fondo de red frenado
      ball.vel.multiplyScalar(0.95);
      if(S.goalTimer<=0){
        $('goal-flash').classList.add('hidden');
        if(S.time>=S.duration-0.5){endMatch();}
        else{S.phase='play';kickoff();showMsg('⏱ Se reanuda…');}
      }
    }
  } else if(S.phase==='goal'&&!S.paused){
    // cuenta atrás de celebración aunque dt siga
    S.goalTimer-=dt;
    ball.pos.addScaledVector(ball.vel,dt); ball.vel.multiplyScalar(0.94);
    if(S.goalTimer<=0){ $('goal-flash').classList.add('hidden'); S.phase='play'; kickoff(); }
  }
  // animación visual jugadores
  for(const p of players){
    p.mesh.position.copy(p.pos);
    p.mesh.rotation.y=p.dir;
    const u=p.mesh.userData;
    const run=(p===S.controlled&&inputVecLength()>0.2)||(S.owner===p&&p.team==='V')||moving.has(p);
    const t=performance.now()/1000;
    const swing=run?Math.sin(p.anim)*0.6:Math.sin(t*2+p.idx)*0.05;
    u.l1.rotation.x=swing; u.l2.rotation.x=-swing;
    u.torso.position.y=1.15+(run?Math.abs(Math.sin(p.anim))*0.06:Math.sin(t*2)*0.02);
    u.ring.visible=(p===S.controlled&&S.phase==='play');
  }
  moving.clear();
  ballMesh.position.copy(ball.pos);
  // sombra balón
  updateCamera(dt||0.016);
  radarT-=dt||0.016; if(radarT<=0){drawRadar();radarT=0.12;}
  renderer.render(scene,camera);
}
const moving=new Set();
// marca movimiento CPU para animar (hook en movePlayer)
const _mp=movePlayer;
function inputVecLength(){ const iv=inputVec(); return Math.hypot(iv.x,iv.y); }
setInterval(()=>{ // registra quién se movió para animación simple
  for(const p of players){ if(p._lx===undefined){p._lx=p.pos.x;p._lz=p.pos.z;continue;}
    if(Math.hypot(p.pos.x-p._lx,p.pos.z-p._lz)>0.02)moving.add(p);
    p._lx=p.pos.x;p._lz=p.pos.z;
  }
},100);

function resize(){
  camera.aspect=innerWidth/innerHeight; camera.updateProjectionMatrix();
  renderer.setSize(innerWidth,innerHeight,false);
}
addEventListener('resize',resize); resize();
buildTeams(); // fondo animado tras el menú
S.phase='menu';
frame();
