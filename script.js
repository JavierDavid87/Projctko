const CATS=[
 ["quiz","Quiz","Short quizzes I have taken."],
 ["longquiz","Long Quiz","Longer quizzes covering full lessons."],
 ["midterms","Midterms","Midterm exams and results."],
 ["finals","Finals","Final exams and results."],
 ["activity","Activity","Classroom and take-home activities."],
 ["project","Project","Projects I built and presented."]
];

const $=s=>document.querySelector(s);
const mem={files:[],meta:{}};
let db=null, SITE=null;
const publicMode=()=>SITE!==null && !/[?&]admin(?:=1)?(?:&|$)/.test(location.search);

function openDB(){
 return new Promise(resolve=>{
  try{
   const q=indexedDB.open("my-portfolio-v2",1);
   q.onupgradeneeded=()=>{const d=q.result;if(!d.objectStoreNames.contains("files"))d.createObjectStore("files",{keyPath:"id"});if(!d.objectStoreNames.contains("meta"))d.createObjectStore("meta")};
   q.onsuccess=()=>{db=q.result;resolve()};
   q.onerror=()=>resolve();
  }catch(e){resolve()}
 });
}
const req=q=>new Promise((res,rej)=>{q.onsuccess=()=>res(q.result);q.onerror=()=>rej(q.error)});
const store=(n,m="readonly")=>db.transaction(n,m).objectStore(n);
async function allFiles(){try{return db?await req(store("files").getAll()):mem.files}catch(e){return mem.files}}
async function putFile(f){try{db?await req(store("files","readwrite").put(f)):mem.files.push(f)}catch(e){mem.files.push(f)}}
async function delFile(id){try{db?await req(store("files","readwrite").delete(id)):mem.files=mem.files.filter(f=>f.id!==id)}catch(e){}}
async function setMeta(k,v){try{db?await req(store("meta","readwrite").put(v,k)):mem.meta[k]=v}catch(e){mem.meta[k]=v}}
async function getMeta(k){try{return db?await req(store("meta").get(k)):mem.meta[k]}catch(e){return mem.meta[k]}}

const host=$("#sections"),menu=$("#menu");
CATS.forEach(([id,title,desc])=>{
 menu.insertAdjacentHTML("beforeend",`<li><a href="#${id}">${title}</a></li>`);
 host.insertAdjacentHTML("beforeend",`<section class="blk rv" id="${id}">
 <h2>${title}</h2><p class="sub">${desc}</p>
 <label class="drop admin-only" data-c="${id}">
 <input type="file" multiple hidden>
 <div><b>Upload pictures or files</b><br>Drag and drop here or click to choose.</div>
 </label>
 <div class="grid" id="g-${id}"></div></section>`);
});

const size=n=>n>1048576?(n/1048576).toFixed(1)+" MB":Math.max(1,Math.round(n/1024))+" KB";
const urls=[];
let toastTimer;
function toast(m){const t=$("#toast");t.textContent=m;t.classList.add("show");clearTimeout(toastTimer);toastTimer=setTimeout(()=>t.classList.remove("show"),2600)}
function esc(s){return String(s).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]))}

async function publicFiles(){
 if(!SITE||!Array.isArray(SITE.files))return [];
 return SITE.files.map((x,i)=>({...x,id:i,pub:true,cloud:true,url:x.path}));
}

async function render(){
 urls.forEach(u=>URL.revokeObjectURL(u));urls.length=0;
 const files=publicMode()?await publicFiles():await allFiles();
 CATS.forEach(([id])=>{
  const g=$("#g-"+id),list=files.filter(f=>f.cat===id);g.innerHTML="";
  if(!list.length){g.innerHTML='<p class="empty">Nothing here yet.</p>';return}
  list.forEach(f=>{
   const u=f.cloud?f.url:URL.createObjectURL(f.blob);if(!f.cloud)urls.push(u);
   const img=(f.type||"").startsWith("image/");
   const ext=(f.name.split(".").pop()||"file").slice(0,5).toUpperCase();
   const el=document.createElement("div");el.className="item";
   el.innerHTML=`<div class="thumb">${img?`<img src="${esc(u)}" alt="${esc(f.name)}">`:`<span class="ext">${esc(ext)}</span>`}</div>
    <div class="meta"><div title="${esc(f.name)}">${esc(f.name)}</div><small>${size(f.size||0)}</small></div>
    <div class="acts">${img?'<button class="view">View</button>':`<a href="${esc(u)}" target="_blank" rel="noopener">Open</a>`}
    <a href="${esc(u)}" download="${esc(f.name)}">Save</a>
    ${publicMode()?"":'<button class="del">Delete</button>'}</div>`;
   if(img)el.querySelector(".thumb").onclick=el.querySelector(".view").onclick=()=>{ $("#lb img").src=u;$("#lb").classList.add("lbshow");$("#lb").setAttribute("aria-hidden","false") };
   if(!publicMode())el.querySelector(".del").onclick=async()=>{if(confirm("Delete this file?")){await delFile(f.id);render()}};
   g.appendChild(el);
  });
 });
 stats(files);
}

function stats(files){
 const vals=[["s1",files.length],["s2",files.filter(x=>(x.type||"").startsWith("image/")).length],["s3",files.filter(x=>!(x.type||"").startsWith("image/")).length]];
 vals.forEach(([id,v])=>{$("#"+id).textContent=v});
}

async function add(cat,files){
 for(const f of files){
  const id=Date.now()+"-"+crypto.getRandomValues(new Uint32Array(1))[0];
  await putFile({id,cat,name:f.name,type:f.type||"application/octet-stream",size:f.size,blob:f});
 }
 await render();
 toast(`${files.length} file${files.length>1?"s":""} saved on this device. Use Export site to publish them.`);
}

function setupUploads(){
 document.querySelectorAll(".drop").forEach(d=>{
  const inp=d.querySelector("input"),c=d.dataset.c;
  inp.onchange=()=>{if(inp.files.length)add(c,[...inp.files]);inp.value=""};
  ["dragenter","dragover"].forEach(e=>d.addEventListener(e,x=>{x.preventDefault();d.classList.add("over")}));
  ["dragleave","drop"].forEach(e=>d.addEventListener(e,x=>{x.preventDefault();d.classList.remove("over")}));
  d.addEventListener("drop",x=>{if(x.dataTransfer.files.length)add(c,[...x.dataTransfer.files])});
 });
}

function setPic(url){
 const p=$("#pic");p.querySelector("img")?.remove();
 const i=document.createElement("img");i.alt="Profile photo";i.src=url;p.appendChild(i);
}
async function showPic(){
 const b=await getMeta("pic");if(b)setPic(URL.createObjectURL(b));
}

async function loadText(){
 for(const el of document.querySelectorAll("[data-k]")){
  const v=await getMeta("t-"+el.dataset.k);if(v)el.textContent=v;
 }
}

function setupEditing(){
 document.querySelectorAll("[data-k]").forEach(el=>{
  el.addEventListener("input",async()=>{
   await setMeta("t-"+el.dataset.k,el.textContent);
  });
  el.addEventListener("keydown",e=>{if(e.key==="Enter"&&el.tagName!=="P"){e.preventDefault();el.blur()}});
 });
 $("#picIn").onchange=async e=>{
  const f=e.target.files[0];if(!f)return;
  await setMeta("pic",f);setPic(URL.createObjectURL(f));toast("Profile photo saved on this device. Export site to publish it.");
 };
 $("#pic").onkeydown=e=>{if(e.key==="Enter"||e.key===" "){e.preventDefault();$("#picIn").click()}};
}

function applyPublic(){
 document.body.classList.add("pub");
 const p=SITE.profile||{};
 $("#publicName").textContent=p.name||"My Portfolio";
 $("#publicRole").textContent=p.role||"Student · Aspiring Developer";
 $("#publicBio").textContent=p.bio||"";
 $("#publicFacts").innerHTML=[p.f1,p.f2,p.f3].filter(Boolean).map(x=>`<span>${esc(x)}</span>`).join("");
 if(p.pic)setPic(p.pic);else{$("#pic").style.display="none"}
}

async function exportSite(){
 if(!window.JSZip){toast("Export requires an internet connection the first time.");return}
 const z=new JSZip(),up=z.folder("uploads"),out=[];
 for(const f of (await allFiles()).sort((a,b)=>String(a.id).localeCompare(String(b.id)))){
  const safe=f.name.replace(/[^\w.\-]+/g,"_");
  const nm=`${f.id}-${safe}`;
  up.file(nm,f.blob);
  out.push({cat:f.cat,name:f.name,type:f.type,size:f.size,path:"uploads/"+nm});
 }
 const profile={};
 document.querySelectorAll("[data-k]").forEach(el=>profile[el.dataset.k]=el.textContent.trim());
 const pic=await getMeta("pic");
 if(pic){
  const ext=(pic.type.split("/")[1]||"jpg").replace("jpeg","jpg");
  const n="profile-photo."+ext;up.file(n,pic);profile.pic="uploads/"+n;
 }
 z.file("content.json",JSON.stringify({profile,files:out},null,2));
 const readme=`MY PORTFOLIO - PUBLISHING GUIDE

1. Unzip this file.
2. The folder contains index.html, style.css, script.js, content.json and uploads/.
3. Upload ALL of those files/folders to a GitHub repository.
4. Enable GitHub Pages for that repository.
5. Open the GitHub Pages URL. Anyone with the URL can view your portfolio on phones, tablets and computers.

IMPORTANT:
- The public website is read-only.
- To change your portfolio, open index.html locally, edit/upload your content, click Export site, then replace the published files on GitHub.
- Files are not automatically uploaded to GitHub from a browser. A backend such as Firebase/Supabase is required for live online uploads.
`;
 z.file("README-PUBLISH.txt",readme);
 const blob=await z.generateAsync({type:"blob"});
 const a=document.createElement("a");a.href=URL.createObjectURL(blob);a.download="my-portfolio-publish.zip";a.click();
 setTimeout(()=>URL.revokeObjectURL(a.href),3000);
 toast("Export complete. Upload the ZIP contents to GitHub Pages.");
}

$("#exp").onclick=exportSite;
$("#lb").onclick=()=>{$("#lb").classList.remove("lbshow");$("#lb").setAttribute("aria-hidden","true")};
$("#lbClose").onclick=e=>{e.stopPropagation();$("#lb").click()};
addEventListener("keydown",e=>{if(e.key==="Escape")$("#lb").click()});

$("#menuBtn").onclick=()=>{
 const open=menu.classList.toggle("open");
 $("#menuBtn").setAttribute("aria-expanded",open);
};
menu.addEventListener("click",e=>{if(e.target.tagName==="A")menu.classList.remove("open")});

const words=["I build things for the web.","I keep every quiz, exam and project here.","Welcome to my portfolio."];
let wi=0,ci=0,del=false;
(function tick(){
 const t=$("#type"),w=words[wi];t.textContent=w.slice(0,ci);
 if(!del&&ci===w.length){del=true;return setTimeout(tick,1600)}
 if(del&&ci===0){del=false;wi=(wi+1)%words.length}
 ci+=del?-1:1;setTimeout(tick,del?25:55)
})();

const cv=$("#fx"),cx=cv.getContext("2d");let P=[],mx=-999,my=-999;
function size2(){cv.width=cv.offsetWidth;cv.height=cv.offsetHeight;P=Array.from({length:Math.min(65,Math.floor(cv.width/16))},()=>({x:Math.random()*cv.width,y:Math.random()*cv.height,vx:(Math.random()-.5)*.5,vy:(Math.random()-.5)*.5,r:Math.random()*2+1}))}
size2();addEventListener("resize",size2);
const still=matchMedia("(prefers-reduced-motion:reduce)").matches;
(function loop(){
 cx.clearRect(0,0,cv.width,cv.height);
 P.forEach((p,i)=>{
  if(!still){p.x+=p.vx;p.y+=p.vy}
  if(p.x<0||p.x>cv.width)p.vx*=-1;if(p.y<0||p.y>cv.height)p.vy*=-1;
  cx.fillStyle="#4cc9ff";cx.beginPath();cx.arc(p.x,p.y,p.r,0,7);cx.fill();
  for(let j=i+1;j<P.length;j++){const d=Math.hypot(p.x-P[j].x,p.y-P[j].y);if(d<120){cx.strokeStyle=`rgba(76,201,255,${.15*(1-d/120)})`;cx.beginPath();cx.moveTo(p.x,p.y);cx.lineTo(P[j].x,P[j].y);cx.stroke()}}
 });
 if(!still)requestAnimationFrame(loop);
})();

const io=new IntersectionObserver(es=>es.forEach(e=>{if(e.isIntersecting)e.target.classList.add("in")}),{threshold:.08});
document.querySelectorAll(".rv").forEach(s=>io.observe(s));
const links=[...menu.querySelectorAll("a")];
const so=new IntersectionObserver(es=>es.forEach(e=>{if(e.isIntersecting)links.forEach(a=>a.classList.toggle("on",a.getAttribute("href")==="#"+e.target.id))}),{rootMargin:"-45% 0px -50% 0px"});
document.querySelectorAll("header,section").forEach(s=>so.observe(s));
addEventListener("scroll",()=>{$("#bar").style.width=(scrollY/Math.max(1,document.documentElement.scrollHeight-innerHeight))*100+"%"},{passive:true});
addEventListener("pointermove",e=>{if(innerWidth>700){mx=e.clientX;my=e.clientY;$("#glow").style.left=mx+"px";$("#glow").style.top=my+"px"}});

(async()=>{
 await openDB();
 let loaded=false;
 try{
  const r=await fetch("content.json",{cache:"no-store"});
  if(r.ok){SITE=await r.json();loaded=true}
 }catch(e){}
 if(loaded){applyPublic();render()}
 else{await loadText();await showPic();setupEditing();setupUploads();render()}
})();
