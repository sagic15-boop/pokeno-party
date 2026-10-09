/* ===================================================================
   פוקינו מסיבה — לוגיקת האפליקציה (Firebase)
   =================================================================== */

/* ▼▼▼ הדבק כאן את ההגדרות של Firebase שלך (Project Settings) ▼▼▼ */
const firebaseConfig = {
  apiKey: "AIzaSyDAgdp4yjmrnHJRVNwZQKrPGlylL5eRh8I",
  authDomain: "pokeno-party.firebaseapp.com",
  databaseURL: "https://pokeno-party-default-rtdb.firebaseio.com",
  projectId: "pokeno-party",
  storageBucket: "pokeno-party.firebasestorage.app",
  messagingSenderId: "987116014340",
  appId: "1:987116014340:web:6754d230995dc6d0a51e51"
};
/* ▲▲▲ עד כאן — אל תשנה שום דבר אחר ▲▲▲ */

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getAuth, signInAnonymously, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import {
  getDatabase, ref, set, update, get, remove, push,
  onValue, onDisconnect, serverTimestamp,
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-database.js";

let app, auth, db, uid;
try { app = initializeApp(firebaseConfig); auth = getAuth(app); db = getDatabase(app); }
catch (e) { console.error(e); }

/* ---------- מצב ---------- */
const S = {
  room:null, name:null, isAdmin:false, status:"lobby", gameId:1,
  scheduledStart:null, autoStart:false, scheduledEnd:null,
  joined:false, board:[], marks:new Set(), fired:new Set(),
  live:{phase:"play"}, subscribed:false,
  w:{s60:false,s0:false,e300:false,e60:false,e0:false},
};
const $ = (id) => document.getElementById(id);
const screens = ["loading","home","name","lobby","game"];
function goScreen(n){ screens.forEach(s=>$(`screen-${s}`).classList.toggle("hidden", s!==n)); }

let toastT; function toast(m){ const t=$("toast"); t.textContent=m; t.classList.remove("hidden"); clearTimeout(toastT); toastT=setTimeout(()=>t.classList.add("hidden"),2600); }
let bannerT; function banner(m,{end=false,ms=4000}={}){ const b=$("banner"); b.textContent=m; b.className="banner"+(end?" end":""); clearTimeout(bannerT); if(ms) bannerT=setTimeout(()=>b.classList.add("hidden"),ms); }

/* ===================================================================
   קלפים + לוח (25 קלפים, בלי משבצת חינם)
   =================================================================== */
const RANKS=["2","3","4","5","6","7","8","9","10","J","Q","K","A"];
const SUITS=[{s:"♠",c:"black"},{s:"♥",c:"red"},{s:"♦",c:"red"},{s:"♣",c:"black"}];
function fullDeck(){ const d=[]; for(const su of SUITS) for(const r of RANKS) d.push({rank:r,suit:su.s,color:su.c}); return d; }
function seedRand(str){let h=1779033703^str.length;for(let i=0;i<str.length;i++){h=Math.imul(h^str.charCodeAt(i),3432918353);h=(h<<13)|(h>>>19);}let a=(h^=h>>>16)>>>0;return function(){a|=0;a=(a+0x6d2b79f5)|0;let t=Math.imul(a^(a>>>15),1|a);t=(t+Math.imul(t^(t>>>7),61|t))^t;return((t^(t>>>14))>>>0)/4294967296;};}

function buildBoard(){
  const rnd=seedRand(`${S.room}:${uid}:${S.gameId}`);
  const deck=fullDeck();
  for(let i=deck.length-1;i>0;i--){ const j=Math.floor(rnd()*(i+1)); [deck[i],deck[j]]=[deck[j],deck[i]]; }
  S.board=deck.slice(0,25);
  S.marks=new Set(); S.fired=new Set();
  const saved=localStorage.getItem(marksKey());
  if(saved){ try{ JSON.parse(saved).forEach(i=>S.marks.add(i)); }catch{} }
  renderBoard();
  checkWins({silent:true});
}
function marksKey(){ return `marks:${S.room}:${S.gameId}`; }
function saveMarks(){ try{ localStorage.setItem(marksKey(), JSON.stringify([...S.marks])); }catch{} }

function renderBoard(){
  const el=$("board"); el.innerHTML="";
  S.board.forEach((c,i)=>{
    const d=document.createElement("div"); d.className="cell "+c.color; d.dataset.i=i;
    d.innerHTML=`<span class="rank">${c.rank}</span><span class="suit">${c.suit}</span>`;
    if(S.marks.has(i)) d.classList.add("marked");
    d.addEventListener("click",()=>toggleCell(i));
    el.appendChild(d);
  });
  el.classList.toggle("locked", S.live.phase==="paused");
}
function toggleCell(i){
  if(S.status!=="playing" || S.live.phase==="paused") return;
  S.marks.has(i)?S.marks.delete(i):S.marks.add(i);
  saveMarks();
  document.querySelector(`.cell[data-i="${i}"]`)?.classList.toggle("marked",S.marks.has(i));
  checkWins({silent:false});
}

const LINES=(()=>{const L={};for(let r=0;r<5;r++)L["r"+r]=[0,1,2,3,4].map(c=>r*5+c);for(let c=0;c<5;c++)L["c"+c]=[0,1,2,3,4].map(r=>r*5+c);L.d0=[0,6,12,18,24];L.d1=[4,8,12,16,20];return L;})();
function checkWins({silent}){
  const won=[];
  for(const[k,idxs]of Object.entries(LINES)){ if(idxs.every(i=>S.marks.has(i)) && !S.fired.has(k)){ S.fired.add(k); if(!silent) won.push({idxs}); } }
  if(silent || !won.length) return;
  won.forEach(({idxs})=>flashLine(idxs));
  fireConfetti();                 // משוב מיידי אצלי
  recordWinner(S.name);           // רישום לפיד
  pauseForWinner();               // עצירה אצל כולם — אני הזוכה שממשיך
}
function flashLine(idxs){ idxs.forEach(i=>{const c=document.querySelector(`.cell[data-i="${i}"]`); if(c){c.classList.add("win-flash"); setTimeout(()=>c.classList.remove("win-flash"),900);} }); }
function fireConfetti(){
  if(typeof confetti!=="function") return;
  const end=Date.now()+1400; const pal=["#fbbf24","#ec4899","#7c3aed","#38bdf8","#34d399","#fb923c","#fff"];
  (function f(){ confetti({particleCount:6,angle:60,spread:75,origin:{x:0},colors:pal}); confetti({particleCount:6,angle:120,spread:75,origin:{x:1},colors:pal}); if(Date.now()<end) requestAnimationFrame(f); })();
  confetti({particleCount:140,spread:100,origin:{y:.6},colors:pal});
}
function recordWinner(name){
  push(ref(db,`rooms/${S.room}/winners`),{ uid, name:name||"שחקן", at:serverTimestamp() }).catch(e=>console.warn("winner write failed",e));
}

/* ===================================================================
   עצירה/המשך — נשלט ע"י הזוכה (לא ע"י האדמין)
   =================================================================== */
function pauseForWinner(){
  update(ref(db,`rooms/${S.room}/live`),{ phase:"paused", winnerUid:uid, winnerName:S.name||"שחקן", at:serverTimestamp() })
    .catch(e=>console.warn("pause write failed",e));
}
function resumeGame(){
  update(ref(db,`rooms/${S.room}/live`),{ phase:"play", winnerUid:null, winnerName:null }).catch(e=>toast("שגיאה בהמשך"));
}
function applyLive(live){
  S.live = live || {phase:"play"};
  renderBoard();
  if(S.status!=="playing"){ $("winOverlay").classList.add("hidden"); return; }
  const body=$("winModalBody");
  if(S.live.phase==="paused"){
    if(S.live.winnerUid===uid){
      body.innerHTML = `<div class="burst">🎉</div><h2>זכית!</h2>
        <div class="gift"><span class="em">🎁</span>לך תבחר או תגנוב מתנה</div>
        <button class="btn btn-gold" id="btnContinue">בחרתי מתנה — המשך לכולם ▶</button>
        <p class="waitdots">המשחק מחכה לך. כשתסיים, לחץ והוא ימשיך לכולם.</p>`;
      body.querySelector("#btnContinue").onclick=resumeGame;
    } else {
      const nm = S.live.winnerName || "שחקן";
      body.innerHTML = `<div class="burst">🎁</div><h2>${esc(nm)} זכה!</h2>
        <div class="gift">בוחר או גונב מתנה…</div>
        <div class="spinner"></div>
        <p class="waitdots">המשחק יחזור כש־${esc(nm)} יסיים ויבחר מתנה.</p>`;
    }
    $("winOverlay").classList.remove("hidden");
  } else {
    $("winOverlay").classList.add("hidden");
  }
}

/* ===================================================================
   חדר
   =================================================================== */
function roomCodeFromURL(){ const p=new URLSearchParams(location.search); const c=(p.get("r")||"").toUpperCase().replace(/[^A-Z0-9]/g,""); return c||null; }
function setURLRoom(code){ history.replaceState(null,"",`${location.pathname}?r=${code}`); }
function genCode(){ const ch="ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; let s=""; for(let i=0;i<4;i++) s+=ch[Math.floor(Math.random()*ch.length)]; return s; }

async function createRoom(){
  let code, exists=true, tries=0;
  while(exists && tries<6){ code=genCode(); exists=(await get(ref(db,`rooms/${code}/meta`))).exists(); tries++; }
  await set(ref(db,`rooms/${code}/meta`),{ status:"lobby", adminUid:uid, gameId:1, scheduledStart:null, autoStart:false, scheduledEnd:null, createdAt:serverTimestamp() });
  await set(ref(db,`rooms/${code}/live`),{ phase:"play" });
  S.room=code; setURLRoom(code); goToName();
}
async function enterRoom(code){
  const snap=await get(ref(db,`rooms/${code}/meta`));
  if(!snap.exists()){ toast("החדר לא נמצא 🤔"); history.replaceState(null,"",location.pathname); showHome(); return; }
  S.room=code; setURLRoom(code);
  const savedName=localStorage.getItem(`name:${code}`);
  if(savedName){ await joinAsPlayer(savedName); } else goToName();
}
async function joinAsPlayer(name){
  S.name=name; try{ localStorage.setItem(`name:${S.room}`,name); }catch{}
  const pRef=ref(db,`rooms/${S.room}/players/${uid}`);
  await set(pRef,{ name, joinedAt:serverTimestamp() });
  onDisconnect(pRef).remove();
  S.joined=true;
  subscribeRoom();
}

function subscribeRoom(){
  if(S.subscribed) return; S.subscribed=true;
  const base=`rooms/${S.room}`;
  onValue(ref(db,`${base}/meta`), s=>applyMeta(s.val()));
  onValue(ref(db,`${base}/players`), s=>renderPlayers(s.val()));
  onValue(ref(db,`${base}/winners`), s=>renderWinners(s.val()));
  onValue(ref(db,`${base}/live`), s=>applyLive(s.val()));
}

function applyMeta(meta){
  if(!meta) return;
  const prevStatus=S.status, prevGame=S.gameId;
  S.isAdmin = meta.adminUid===uid;
  S.status = meta.status||"lobby";
  S.gameId = meta.gameId||1;
  S.autoStart = !!meta.autoStart;
  if(meta.scheduledStart!==S.scheduledStart){ S.scheduledStart=meta.scheduledStart||null; S.w.s60=S.w.s0=false; }
  if(meta.scheduledEnd!==S.scheduledEnd){ S.scheduledEnd=meta.scheduledEnd||null; S.w.e300=S.w.e60=S.w.e0=false; }

  if(S.gameId!==prevGame && S.joined) buildBoard();

  if(S.status==="playing"){
    if(prevStatus!=="playing" || S.board.length===0){ if(S.board.length===0) buildBoard(); if(prevStatus!=="playing") banner("🚀 המשחק התחיל! בהצלחה",{ms:2500}); }
    showGame();
  } else {
    showLobby();
  }
  updateAdminUI();
}

/* ---------- מסכים ---------- */
function showHome(){ goScreen("home"); }
function goToName(){ goScreen("name"); $("nameInput").focus(); }
function showLobby(){
  goScreen("lobby");
  $("shareCard").classList.toggle("hidden", !S.isAdmin);
  $("adminPanel").classList.toggle("hidden", !S.isAdmin);
  $("waitCard").classList.toggle("hidden", S.isAdmin);
  if(S.isAdmin) renderShare();
  $("countdownCard").classList.toggle("hidden", !(S.scheduledStart && S.status==="lobby"));
}
function showGame(){
  goScreen("game");
  $("adminGamePanel").classList.toggle("hidden", !S.isAdmin);
  $("endCountCard").classList.toggle("hidden", !S.scheduledEnd);
}
function updateAdminUI(){ if(S.isAdmin) $("autoStart").checked=S.autoStart; }

function renderShare(){
  const link=`${location.origin}${location.pathname}?r=${S.room}`;
  $("lobbyCode").textContent=S.room; $("shareLink").textContent=link;
  const box=$("qrBox");
  if(box && !box.dataset.done){ box.innerHTML=""; try{ new QRCode(box,{text:link,width:160,height:160,correctLevel:QRCode.CorrectLevel.M}); box.dataset.done="1"; }catch(e){ box.textContent="QR"; } }
}
function renderPlayers(players){
  const list=Object.entries(players||{});
  $("playerCount").textContent=list.length;
  const ul=$("playersList"); ul.innerHTML="";
  if(!list.length){ ul.innerHTML='<li class="empty">עוד לא הצטרפו משתתפים…</li>'; return; }
  list.sort((a,b)=>(a[1].joinedAt||0)-(b[1].joinedAt||0)).forEach(([pid,p])=>{ const li=document.createElement("li"); if(pid===uid) li.classList.add("me"); li.textContent=p.name||"שחקן"; ul.appendChild(li); });
}
function renderWinners(winners){
  const ul=$("winnersList");
  const list=Object.values(winners||{}).sort((a,b)=>(b.at||0)-(a.at||0));
  if(!list.length){ ul.innerHTML='<li class="empty subtle" style="background:none;border:none;list-style:none">עוד אין זוכים — בהצלחה!</li>'; return; }
  ul.innerHTML=""; list.forEach(w=>{ const li=document.createElement("li"); li.innerHTML=`🎁 <span class="name">${esc(w.name||"שחקן")}</span> זכה במתנה!`; ul.appendChild(li); });
}
function esc(s){ return String(s).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c])); }

/* ---------- ספירות לאחור + התראות ---------- */
function fmt(ms){ const sec=Math.max(0,Math.floor(ms/1000)); return `${String(Math.floor(sec/60)).padStart(2,"0")}:${String(sec%60).padStart(2,"0")}`; }
setInterval(()=>{
  if(!S.joined) return;
  if(S.status==="lobby" && S.scheduledStart){
    const rem=S.scheduledStart-Date.now();
    $("cdTime").textContent=fmt(rem); $("countdown").classList.toggle("soon",rem<=60000);
    if(rem<=60000 && !S.w.s60){ S.w.s60=true; banner("⏰ עוד דקה והמשחק מתחיל — תתכוננו!",{ms:4000}); }
    if(rem<=0 && !S.w.s0){ S.w.s0=true; banner("🎉 הגיעה שעת ההתחלה!",{ms:6000}); if(S.isAdmin && S.autoStart) startGame(); }
  }
  if(S.status==="playing" && S.scheduledEnd){
    const rem=S.scheduledEnd-Date.now();
    $("endTimeTxt").textContent=fmt(rem); $("endCountdown").classList.toggle("soon",rem<=60000);
    if(rem<=300000 && rem>60000 && !S.w.e300){ S.w.e300=true; banner("⏳ נותרו 5 דקות עד הסיום",{end:true,ms:4000}); }
    if(rem<=60000 && rem>0 && !S.w.e60){ S.w.e60=true; banner("⏰ דקה אחרונה! השלימו קווים",{end:true,ms:4000}); }
    if(rem<=0 && !S.w.e0){ S.w.e0=true; banner("🏁 הגיע זמן הסיום!",{end:true,ms:7000}); }
  }
},500);

/* ---------- פעולות מנהל ---------- */
async function startGame(){ await update(ref(db,`rooms/${S.room}/meta`),{ status:"playing", startedAt:serverTimestamp() }).catch(()=>toast("שגיאה בהתחלה")); await set(ref(db,`rooms/${S.room}/live`),{ phase:"play" }).catch(()=>{}); }
async function newRound(){
  await remove(ref(db,`rooms/${S.room}/winners`)).catch(()=>{});
  await set(ref(db,`rooms/${S.room}/live`),{ phase:"play" }).catch(()=>{});
  try{ localStorage.removeItem(`marks:${S.room}:${(S.gameId||1)+1}`); }catch{}
  await update(ref(db,`rooms/${S.room}/meta`),{ gameId:(S.gameId||1)+1, status:"playing" });
  toast("סבב חדש! לוחות חדשים לכולם 🔀");
}
async function backToLobby(){ await set(ref(db,`rooms/${S.room}/live`),{ phase:"play" }).catch(()=>{}); await update(ref(db,`rooms/${S.room}/meta`),{ status:"lobby", scheduledStart:null, scheduledEnd:null }); }
async function setTimes(){
  const mk=(v)=>{ if(!v) return null; const [h,m]=v.split(":").map(Number); const d=new Date(); d.setHours(h,m,0,0); if(d.getTime()<Date.now()-60000) d.setDate(d.getDate()+1); return d.getTime(); };
  await update(ref(db,`rooms/${S.room}/meta`),{ scheduledStart:mk($("startTime").value), autoStart:$("autoStart").checked, scheduledEnd:mk($("endTime").value) }).catch(()=>toast("שגיאה בשמירה"));
  toast("השעות נשמרו ✓");
}

/* ---------- חיווט ---------- */
function wireEvents(){
  $("btnCreate").addEventListener("click",()=>{ $("btnCreate").disabled=true; createRoom().catch(e=>{console.error(e);toast("שגיאה ביצירת חדר");$("btnCreate").disabled=false;}); });
  $("btnGoJoin").addEventListener("click",()=>{ const code=$("joinCode").value.toUpperCase().replace(/[^A-Z0-9]/g,""); if(code.length<3){toast("קוד לא תקין");return;} enterRoom(code); });
  $("btnJoinRoom").addEventListener("click",()=>{ const n=$("nameInput").value.trim(); if(!n){$("nameErr").textContent="צריך שם 🙂";$("nameErr").classList.remove("hidden");return;} $("btnJoinRoom").disabled=true; joinAsPlayer(n).catch(e=>{console.error(e);toast("שגיאה בהצטרפות");$("btnJoinRoom").disabled=false;}); });
  $("nameInput").addEventListener("keydown",e=>{if(e.key==="Enter")$("btnJoinRoom").click();});
  $("joinCode").addEventListener("keydown",e=>{if(e.key==="Enter")$("btnGoJoin").click();});
  $("btnStart").addEventListener("click",startGame);
  $("btnSetTimes").addEventListener("click",setTimes);
  $("btnNewRound").addEventListener("click",newRound);
  $("btnBackLobby").addEventListener("click",backToLobby);
  $("btnCopy").addEventListener("click",async()=>{ const link=`${location.origin}${location.pathname}?r=${S.room}`; try{ await navigator.clipboard.writeText(link); toast("הלינק הועתק! ✓"); }catch{ toast("העתק ידנית את הלינק"); } });
}

/* ---------- הפעלה ---------- */
function fatal(msg){ $("screen-loading").innerHTML=`<p class="err">${msg}</p>`; goScreen("loading"); }
function boot(){
  wireEvents();
  if(!app || firebaseConfig.apiKey==="PASTE_API_KEY"){ fatal("⚠️ חסרות הגדרות Firebase. פתח את app.js והדבק את הקונפיג (ראה README)."); return; }
  onAuthStateChanged(auth,(user)=>{ if(!user) return; uid=user.uid; const code=roomCodeFromURL(); if(code) enterRoom(code).catch(e=>{console.error(e);showHome();}); else showHome(); });
  signInAnonymously(auth).catch(e=>{ console.error(e); fatal("⚠️ נכשלה התחברות אנונימית. ודא שהפעלת Anonymous Auth ב-Firebase (ראה README)."); });
}
boot();
