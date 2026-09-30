/* V31.52 — isolamento visual do Briefing */
function hzIsBriefingTarget(el){
 const txt=((el?.dataset?.tab||'')+' '+(el?.getAttribute?.('href')||'')+' '+(el?.getAttribute?.('onclick')||'')+' '+(el?.textContent||'')).toLowerCase();
 return txt.includes('briefing');
}
function hzHideBriefingOutside(){
 ['briefingFormBox','briefingList','briefingContent','briefingPanel'].forEach(id=>{
   const el=document.getElementById(id); if(el)el.style.display='none';
 });
 document.querySelectorAll('[data-briefing-only="true"]').forEach(el=>el.style.display='none');
}
document.addEventListener('click',e=>{
 const nav=e.target.closest('button,a,[data-tab],[data-section]');
 if(!nav)return;
 const navtxt=((nav.dataset?.tab||'')+' '+(nav.dataset?.section||'')+' '+(nav.getAttribute('onclick')||'')+' '+(nav.textContent||'')).toLowerCase();
 if((/equipe|capta[cç][aã]o|calend|cliente|demanda|ag[eê]ncia|macro|roteiro|or[cç]amento|lixeira|vis[aã]o geral/.test(navtxt)) && !hzIsBriefingTarget(nav)){
   hzHideBriefingOutside();
 }
},true);


/* V31.52 — visão administrativa das atividades por integrante */
function hzNorm(v){return String(v||'').trim().toLowerCase()}
function hzAssigneeMatches(item,member){
 const email=hzNorm(member?.email), name=hzNorm(member?.name||member?.nome);
 const vals=[
   item?.responsibleEmail,item?.responsavelEmail,item?.assignedToEmail,item?.assigneeEmail,
   item?.responsible,item?.responsavel,item?.assignedTo,item?.assignee,item?.teamMember,
   ...(Array.isArray(item?.participantEmails)?item.participantEmails:[]),
   ...(Array.isArray(item?.participants)?item.participants:[])
 ].flat().filter(Boolean).map(hzNorm);
 return (!!email&&vals.includes(email)) || (!!name&&vals.includes(name));
}
function hzCollectMemberActivities(member){
 const pools=[
  ['Tarefa interna',window.internalTasks||[]],
  ['Captação',window.captures||[]],
  ['Demanda',window.demands||[]],
  ['Agenda',window.calendarItems||[]]
 ];
 const out=[];
 pools.forEach(([type,arr])=>{
   if(!Array.isArray(arr))return;
   arr.forEach(item=>{if(hzAssigneeMatches(item,member))out.push({type,item})});
 });
 return out;
}
function hzActivityTitle(x){
 const i=x.item||{};
 return i.title||i.name||i.task||i.description||i.clientName||i.clientProspect||i.projectName||'Atividade';
}
function hzActivityStatus(x){
 const i=x.item||{}; return i.status||i.state||(i.done===true?'Concluída':'Pendente');
}
function hzRenderMemberActivities(member,host){
 if(!host)return;
 const list=hzCollectMemberActivities(member);
 host.innerHTML=`<div class="hz-team-activities">
   <div class="hz-team-activities-head"><strong>Atividades atribuídas</strong><span>${list.length}</span></div>
   ${list.length?list.map(x=>`<div class="hz-team-activity">
      <div><b>${hzEsc(x.type)}</b> · ${hzEsc(hzActivityTitle(x))}</div>
      <small>${hzEsc(hzActivityStatus(x))}</small>
   </div>`).join(''):'<div class="muted">Nenhuma atividade atribuída a esta pessoa.</div>'}
 </div>`;
}
window.hzCollectMemberActivities=hzCollectMemberActivities;
window.hzRenderMemberActivities=hzRenderMemberActivities;



function hzIsReferenceLinksTextarea(t){
 const n=(t.id+' '+t.name+' '+(t.placeholder||'')).toLowerCase();
 return /(referenc|reference)/.test(n) && /(link|url)/.test(n);
}
function hzBuildLinksUI(t){
 if(!t || t.dataset.hzLinks==='1')return;
 t.dataset.hzLinks='1';
 // If rich editor was added to this URL field by generic detection, remove only its visual wrapper.
 const rich=document.querySelector(`.hz-rich-wrap[data-hz-for="${CSS.escape(t.id)}"]`);
 if(rich)rich.remove();
 t.classList.add('hz-source-textarea');
 const box=document.createElement('div'); box.className='hz-links-ui'; box.dataset.hzLinksFor=t.id;
 const sync=()=>{
   const vals=[...box.querySelectorAll('input')].map(i=>i.value.trim()).filter(Boolean);
   t.value=vals.join('\n');
   t.dispatchEvent(new Event('input',{bubbles:true}));
   t.dispatchEvent(new Event('change',{bubbles:true}));
 };
 const add=(value='')=>{
   const row=document.createElement('div'); row.className='hz-link-row';
   const inp=document.createElement('input'); inp.type='url'; inp.placeholder='Cole o link da referência'; inp.value=value;
   inp.addEventListener('input',sync);
   const del=document.createElement('button'); del.type='button'; del.textContent='×'; del.title='Remover link';
   del.addEventListener('click',()=>{row.remove(); if(!box.querySelector('.hz-link-row'))add(''); sync();});
   row.append(inp,del); box.insertBefore(row,box.lastElementChild); return inp;
 };
 const btn=document.createElement('button'); btn.type='button'; btn.className='hz-add-link'; btn.textContent='+ Adicionar link';
 btn.addEventListener('click',()=>add('').focus());
 box.appendChild(btn);
 const vals=String(t.value||'').split(/\n+/).map(v=>v.trim()).filter(Boolean);
 (vals.length?vals:['']).forEach(add);
 t.insertAdjacentElement('afterend',box);
}
function hzRefreshReferenceLinks(root=document){
 root.querySelectorAll('textarea').forEach(t=>{if(hzIsReferenceLinksTextarea(t))hzBuildLinksUI(t)});
}
window.addEventListener('DOMContentLoaded',()=>{
 hzRefreshReferenceLinks();
 const ob=new MutationObserver(()=>requestAnimationFrame(()=>hzRefreshReferenceLinks()));
 ob.observe(document.body,{childList:true,subtree:true});
});



/* V31.47 rich text */
function hzSanitizeRichHtml(input){
 const box=document.createElement('div'); box.innerHTML=String(input||'');
 const allowed=new Set(['B','STRONG','I','EM','BR','DIV','P','SPAN','FONT']);
 [...box.querySelectorAll('*')].forEach(el=>{
   if(!allowed.has(el.tagName)){el.replaceWith(...el.childNodes);return}
   [...el.attributes].forEach(a=>{
     if(el.tagName==='SPAN' && a.name==='class' && /^(hz-purple|hz-black|hz-size-sm|hz-size-lg|hz-font-1|hz-font-2)$/.test(a.value)) return;
     if(el.tagName==='FONT' && a.name==='size' && /^[1-7]$/.test(a.value)) return;
     if(el.tagName==='FONT' && a.name==='face' && /^(Arial|Georgia)$/i.test(a.value)) return;
     el.removeAttribute(a.name);
   });
 });
 return box.innerHTML;
}
function hzLooksFormatted(v){return /<(strong|b|em|i|span|br|div|p)\b/i.test(String(v||''))}
function hzInitialHtml(v){
 v=String(v||'');
 if(hzLooksFormatted(v)) return hzSanitizeRichHtml(v);
 const d=document.createElement('div'); d.textContent=v; return d.innerHTML.replace(/\n/g,'<br>');
}
function hzRichToStored(editor){return hzSanitizeRichHtml(editor.innerHTML).replace(/<div><br><\/div>/gi,'<br>')}
function hzSyncRich(editor){
 const id=editor.dataset.sourceId, src=document.getElementById(id); if(!src)return;
 src.value=hzRichToStored(editor);
 src.dispatchEvent(new Event('input',{bubbles:true}));
 src.dispatchEvent(new Event('change',{bubbles:true}));
}
function hzRememberSelection(editor){const s=window.getSelection();if(s&&s.rangeCount&&editor.contains(s.anchorNode))editor._hzRange=s.getRangeAt(0).cloneRange()}
function hzRestoreSelection(editor){const s=window.getSelection();if(editor._hzRange){try{s.removeAllRanges();s.addRange(editor._hzRange);return true}catch(e){}}return false}
function hzInitHistory(editor){if(!editor._hist){editor._hist=[hzRichToStored(editor)];editor._hi=0}}
function hzPushHistory(editor){hzInitHistory(editor);const v=hzRichToStored(editor);if(editor._hist[editor._hi]===v)return;editor._hist=editor._hist.slice(0,editor._hi+1);editor._hist.push(v);editor._hi=editor._hist.length-1}
function hzHistory(editor,d){hzInitHistory(editor);const n=editor._hi+d;if(n<0||n>=editor._hist.length)return;editor._hi=n;editor.innerHTML=editor._hist[n];hzSyncRich(editor);const r=document.createRange(),sel=window.getSelection();r.selectNodeContents(editor);r.collapse(false);sel.removeAllRanges();sel.addRange(r)}
function hzWrap(editor,cls){const sel=window.getSelection();if(!sel||!sel.rangeCount||sel.isCollapsed)return;const r=sel.getRangeAt(0);if(!editor.contains(r.commonAncestorContainer))return;const sp=document.createElement('span');sp.className=cls;sp.appendChild(r.extractContents());r.insertNode(sp);const nr=document.createRange();nr.selectNodeContents(sp);sel.removeAllRanges();sel.addRange(nr);editor._hzRange=nr.cloneRange()}
function hzClear(editor){const sel=window.getSelection();if(!sel||!sel.rangeCount||sel.isCollapsed)return;const r=sel.getRangeAt(0);if(!editor.contains(r.commonAncestorContainer))return;const t=document.createTextNode(r.toString());r.deleteContents();r.insertNode(t);const nr=document.createRange();nr.selectNodeContents(t);sel.removeAllRanges();sel.addRange(nr);editor._hzRange=nr.cloneRange()}
function hzExec(editor,cmd,value){editor.focus();if(cmd==='undo'){hzHistory(editor,-1);return}if(cmd==='redo'){hzHistory(editor,1);return}hzRestoreSelection(editor);hzPushHistory(editor);
if(cmd==='bold')document.execCommand('bold');else if(cmd==='italic')document.execCommand('italic');else if(cmd==='upper'){const x=window.getSelection();if(x&&!x.isCollapsed)document.execCommand('insertText',false,x.toString().toUpperCase())}
else if(cmd==='clear')hzClear(editor);else if(cmd==='purple'||cmd==='black')hzWrap(editor,cmd==='purple'?'hz-purple':'hz-black');else if(cmd==='smaller')hzWrap(editor,'hz-size-sm');else if(cmd==='larger')hzWrap(editor,'hz-size-lg');else if(cmd==='font')hzWrap(editor,value==='Georgia'?'hz-font-2':'hz-font-1');
hzSyncRich(editor);hzPushHistory(editor);hzRememberSelection(editor)}
function hzToolbar(editor){
 const bar=document.createElement('div'); bar.className='hz-rich-toolbar';
 const addBtn=(label,cmd,title,cls='')=>{
   const b=document.createElement('button'); b.type='button'; b.innerHTML=label; b.title=title; if(cls)b.className=cls;
   b.addEventListener('mousedown',e=>{e.preventDefault();hzExec(editor,cmd)}); bar.appendChild(b);
 };
 addBtn('↶','undo','Desfazer');
 addBtn('↷','redo','Refazer');
 const sep=()=>{const x=document.createElement('span');x.className='hz-sep';bar.appendChild(x)};
 sep(); addBtn('<b>B</b>','bold','Negrito'); addBtn('<i>I</i>','italic','Itálico'); addBtn('AA','upper','Caixa alta');
 sep(); addBtn('A−','smaller','Diminuir fonte'); addBtn('A+','larger','Aumentar fonte');
 const fonts=document.createElement('select'); fonts.title='Escolher fonte';
 fonts.innerHTML='<option value="">Fonte</option><option value="Arial">Fonte 1</option><option value="Georgia">Fonte 2</option>';
 fonts.addEventListener('mousedown',()=>hzRememberSelection(editor));
 fonts.addEventListener('change',()=>{if(fonts.value)hzExec(editor,'font',fonts.value);fonts.value=''});
 bar.appendChild(fonts);
 sep(); addBtn('Roxo','purple','Destaque roxo Humaniza','hz-purple-btn'); addBtn('Preto','black','Destaque preto Humaniza','hz-black-btn');
 addBtn('Limpar','clear','Remover formatação do trecho selecionado');
 editor.addEventListener('mouseup',()=>hzRememberSelection(editor));
 editor.addEventListener('keyup',()=>hzRememberSelection(editor));
 return bar;
}
function hzShouldEnhanceTextarea(t){
 if(!t || t.dataset.hzRich==='1' || t.disabled || t.readOnly) return false;
 const n=(t.id+' '+t.name+' '+t.className+' '+(t.placeholder||'')).toLowerCase();

 // Nunca aplicar o editor rico em campos operacionais/administrativos.
 const skip=/(url|link|email|e-mail|telefone|phone|whatsapp|cnpj|cpf|senha|password|agenda|calendar|evento|event|google|local|location|participante|responsavel|responsável|cliente|prospect|observa[cç][aã]o do cliente)/;
 if(skip.test(n)) return false;

 // Editor rico somente em áreas de criação de conteúdo.
 const contentField=/(roteiro|script|copy|legenda|conteudo|conteúdo|gancho|desenvolvimento|cta|texto do post|texto do reel|carrossel|estatico|estático|reel)/.test(n);
 if(contentField) return true;

 // Se o campo estiver dentro da área/cartão de Roteiros, também pode receber o editor.
 const ctx=t.closest('[id*="script" i],[class*="script" i],[id*="roteiro" i],[class*="roteiro" i],[data-format],[data-script-id]');
 return !!ctx;
}
function hzEnhanceTextarea(t){
 if(!hzShouldEnhanceTextarea(t))return;
 if(!t.id)t.id='hzsrc_'+Math.random().toString(36).slice(2);
 t.dataset.hzRich='1'; t.classList.add('hz-source-textarea');
 const wrap=document.createElement('div'); wrap.className='hz-rich-wrap'; wrap.dataset.hzFor=t.id;
 const ed=document.createElement('div'); ed.className='hz-rich-editor'; ed.contentEditable='true'; ed.dataset.sourceId=t.id;
 ed.dataset.placeholder=t.placeholder||'Digite aqui...'; ed.innerHTML=hzInitialHtml(t.value);
 ed.addEventListener('input',()=>{hzSyncRich(ed);clearTimeout(ed._ht);ed._ht=setTimeout(()=>hzPushHistory(ed),250)});
 ed.addEventListener('blur',()=>hzSyncRich(ed));
 wrap.appendChild(hzToolbar(ed)); wrap.appendChild(ed); hzInitHistory(ed);
 t.insertAdjacentElement('afterend',wrap);
}
function hzRefreshRichEditors(root=document){
 root.querySelectorAll('textarea').forEach(t=>{
   if(hzShouldEnhanceTextarea(t)) hzEnhanceTextarea(t);
   else if(t.dataset.hzRich==='1'){
     const wrap=document.querySelector(`.hz-rich-wrap[data-hz-for="${CSS.escape(t.id)}"]`);
     if(wrap) wrap.remove();
     t.dataset.hzRich='0';
     t.classList.remove('hz-source-textarea');
   }
 });
 root.querySelectorAll('.hz-rich-editor').forEach(ed=>{
   const src=document.getElementById(ed.dataset.sourceId);
   if(src && document.activeElement!==ed && hzRichToStored(ed)!==String(src.value||'')) ed.innerHTML=hzInitialHtml(src.value);
 });
}
const hzObserver=new MutationObserver(()=>requestAnimationFrame(()=>hzRefreshRichEditors()));
window.addEventListener('DOMContentLoaded',()=>{
 hzRefreshRichEditors();
 hzObserver.observe(document.body,{childList:true,subtree:true});
 setInterval(()=>hzRefreshRichEditors(),1200);
});


import { initializeApp } from "https://www.gstatic.com/firebasejs/12.13.0/firebase-app.js";
import { getAuth, signInWithEmailAndPassword, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/12.13.0/firebase-auth.js";
import { getFirestore, collection, doc, addDoc, setDoc, getDoc, deleteDoc, onSnapshot, query, where, serverTimestamp } from "https://www.gstatic.com/firebasejs/12.13.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyB2xU6wgDjswece50JVE-thiCb40wP-58M",
  authDomain: "humaniza-os.firebaseapp.com",
  projectId: "humaniza-os",
  storageBucket: "humaniza-os.firebasestorage.app",
  messagingSenderId: "416592042651",
  appId: "1:416592042651:web:66dd16c8e823e57d5b443e",
  measurementId: "G-YQMK274JER"
};

const ADMIN_EMAIL = "agenciahumanizamedia@gmail.com";
const GOOGLE_CALENDAR_CLIENT_ID = "416592042651-633cmcac2hllf6s9vm0po6fsbqu415jj.apps.googleusercontent.com";
const GOOGLE_CALENDAR_SCOPE = "https://www.googleapis.com/auth/calendar.events";
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
let quotes = [];
let unsubQuotes = null;
let quoteSettings = {businessName:'Agência Humaniza',defaultVideoPrice:0,defaultPhotoPrice:0,comboDiscount:0,tiers:[],discountExplanation:''};
let editingQuote = null;
const rawPublicQuoteToken = new URLSearchParams(location.search).get('orcamento') || '';
const publicQuoteToken = rawPublicQuoteToken.trim().replace(/^q_/, '').replace(/[^a-fA-F0-9]/g, '');
let currentUser = null;
let isAdmin = false;
let clients = [];
let demands = [];
let internalTasks = [];
let teamMembers = [];
let editingClient = null, editingDemand = null, editingInternal = null, editingTeam = null;
let selectedClientId = null;
let unsubClients = null, unsubDemands = null, unsubInternal = null, unsubTeam = null;
let isTeamMember = false;
let currentTeamMember = null;
let macroPlans = [];
let calendarItems = [];
let scripts = [];
let captures = [];
let editingMacro = null, editingCalendar = null, editingScript = null, editingCapture = null;
let appSettings = {};
let unsubSettings = null;
let selectedDemandIds=new Set();
let notifications=[];
let trashedDemands=[];
let unsubNotifications=null;
let workFilter='Hoje';
let unsubMacro = null, unsubCalendar = null, unsubScripts = null, unsubCaptures = null;
let agencyAgendaItems=[]; let unsubAgencyAgenda=null; let editingAgencyAgenda=null; let googleAgendaToken=null; let googleTokenClient=null;

const demandStatuses = ['Estratégia','Em produção','Revisão interna','Aguardando aprovação','Aguardando você','Ajustes solicitados','Aprovado','Publicado'];
const internalStatuses = ['A Resolver','Em Produção','Pronto para Revisão','Ajustes Internos','Aprovado Internamente','Entregue ao Cliente','Entregue'];
const OUT_OF_SCOPE = '__HUMANIZA_OUT_OF_SCOPE__';
function responsibilityData(value){ const v=(value||'').trim(); if(v===OUT_OF_SCOPE) return {responsibleEmail:'',responsibleName:'',responsibilityScope:'outside'}; if(!v) return {responsibleEmail:'',responsibleName:'',responsibilityScope:'pending'}; const m=teamMembers.find(x=>(x.email||'').trim().toLowerCase()===v.toLowerCase()); return {responsibleEmail:v,responsibleName:m?.name||'',responsibilityScope:'assigned'}; }
function responsibilityLabel(x){ if(x?.responsibilityScope==='outside') return 'Fora do escopo Humaniza'; if(x?.responsibleName||x?.assignedName) return `Responsável: ${x.responsibleName||x.assignedName}`; return 'Responsável: A definir'; }
function selectResponsibilityValue(x,emailField='responsibleEmail'){ return x?.responsibilityScope==='outside' ? OUT_OF_SCOPE : (x?.[emailField]||''); }

function ne(v){return String(v||'').trim().toLowerCase()}
function generateTemporaryPassword(){const chars='ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%';const bytes=new Uint32Array(14);crypto.getRandomValues(bytes);return Array.from(bytes,n=>chars[n%chars.length]).join('')}
window.fillGeneratedPassword=function(id,confirmId){const p=generateTemporaryPassword();document.getElementById(id).value=p;document.getElementById(confirmId).value=p}
async function createFirebaseAccess(recordId, role, name, email, password){
  throw new Error('No plano Spark gratuito, crie o usuário manualmente no Firebase Authentication.');
}
function accessRoleLabel(role){
  return ({admin:'Administrador',team:'Equipe',client:'Cliente',unknown:'Acesso não vinculado',none:'Sem sessão'})[role]||role;
}
function renderAccessBadge(){
  const el=document.getElementById('accessIdentity');
  if(!el)return;
  const a=resolveCurrentAccess();
  el.innerHTML=`<b>${accessRoleLabel(a.role)}</b><span>${a.name||a.email||''}</span>`;
  el.dataset.role=a.role;
}

function splitDemandTrash(rows){trashedDemands=rows.filter(x=>x.archived===true);demands=rows.filter(x=>x.archived!==true)}

function pEmails(id){return [...document.querySelectorAll(`#${id} input[type=checkbox]:checked`)].map(x=>x.value)}
function pNames(a){return (a||[]).map(e=>teamMembers.find(m=>ne(m.email)===ne(e))?.name||e)}
function fillP(id,selected=[]){const b=document.getElementById(id);if(!b)return;const s=new Set((selected||[]).map(ne));b.innerHTML=teamMembers.filter(m=>m.status!=='Finalizado').map(m=>`<label><input type="checkbox" value="${m.email||''}" ${s.has(ne(m.email))?'checked':''}>${m.name||m.email}</label>`).join('')}
function involved(x,email){return ne(x?.responsibleEmail||x?.assignedEmail)===ne(email)||(x?.participantEmails||[]).some(e=>ne(e)===ne(email))}
function optionsTeam(){return `<option value="">Selecionar responsável</option><option value="${OUT_OF_SCOPE}">Humaniza não cuida desta frente</option>`+teamMembers.filter(m=>m.status!=='Finalizado').map(m=>`<option value="${m.email}">${m.name} • ${m.role||'Equipe'}</option>`).join('')}
function fillDefaults(c=null){[['clientDefaultSocial','defaultSocialEmail'],['clientDefaultDesigner','defaultDesignerEmail'],['clientDefaultVideo','defaultVideoEmail'],['clientDefaultTraffic','defaultTrafficEmail'],['clientDefaultLeader','defaultLeaderEmail']].forEach(([id,k])=>{const e=document.getElementById(id);if(e){e.innerHTML=optionsTeam();e.value=c?.[k]||''}})}
function defaultResp(cid,k){const c=clientById(cid);return c?.[k]||''}
function wDate(x,k){return k==='Roteiro'?(x.publishDate||x.captureDate||''):(x.date||'')}
function wDone(x){return ['Publicado','Aprovado','Entregue','Finalizado'].includes(x.status)}
function wGroup(x,k){if(wDone(x))return 'Concluídos';if(['Pronto para Revisão','Revisão interna'].includes(x.status))return 'Em revisão';if(['Aguardando você','Aguardando aprovação'].includes(x.status))return 'Aguardando cliente';const d=wDate(x,k);if(!d)return 'Próximos';const n=new Date(),td=`${n.getFullYear()}-${String(n.getMonth()+1).padStart(2,'0')}-${String(n.getDate()).padStart(2,'0')}`;return d<td?'Atrasados':d===td?'Hoje':'Próximos'}
function myWork(email){let a=[];internalTasks.filter(x=>involved(x,email)).forEach(x=>a.push({x,k:'Tarefa'}));demands.filter(x=>involved(x,email)).forEach(x=>a.push({x,k:'Demanda'}));scripts.filter(x=>involved(x,email)).forEach(x=>a.push({x,k:'Roteiro'}));captures.filter(x=>involved(x,email)).forEach(x=>a.push({x,k:'Captação'}));return a}
window.setWorkFilter=g=>{workFilter=g;renderUnifiedWork()}
function renderUnifiedWork(){const tabs=['Hoje','Atrasados','Próximos','Em revisão','Aguardando cliente','Concluídos'],all=myWork(currentUser?.email),te=document.getElementById('workTabs'),li=document.getElementById('workList');if(!te||!li)return;te.innerHTML=tabs.map(g=>`<button class="${g===workFilter?'active':''}" onclick="setWorkFilter('${g}')">${g} • ${all.filter(i=>wGroup(i.x,i.k)===g).length}</button>`).join('');const d=all.filter(i=>wGroup(i.x,i.k)===workFilter);li.innerHTML=d.length?d.map(i=>`<div class="work-item"><h4>${i.k} • ${i.x.title||'Sem título'}</h4><div class="meta"><span class="pill">${i.x.status||''}</span>${wDate(i.x,i.k)?`<span class="pill">${formatDate(wDate(i.x,i.k))}</span>`:''}</div><p><b>${ne(i.x.responsibleEmail||i.x.assignedEmail)===ne(currentUser?.email)?'Você é responsável':'Participando'}</b></p>${(i.x.participantNames||[]).length?`<p>Participantes: ${(i.x.participantNames||[]).join(', ')}</p>`:''}${i.x.approvalLink||i.x.link?`<button class="btn-blue" onclick="window.open('${i.x.approvalLink||i.x.link}','_blank')">Ver material no Drive</button>`:''}</div>`).join(''):'<div class="empty">Nenhum item nesta etapa.</div>'}




function adminRecipients(){return [ADMIN_EMAIL.toLowerCase()]}
function clientRecipient(clientId){const c=clientById(clientId);return c?.email?[ne(c.email)]:[]}
async function createNotification(data){const r=[...new Set((data.recipientEmails||[]).map(ne).filter(Boolean))];if(!r.length)return;await addDoc(collection(db,'notifications'),{title:data.title||'Atualização',message:data.message||'',recipientEmails:r,type:data.type||'',entityId:data.entityId||'',clientId:data.clientId||'',readBy:[],createdBy:ne(currentUser?.email),createdAt:serverTimestamp()})}
async function notifyFromForm(prefix,data){let r=[];if(data.responsibleEmail)r.push(data.responsibleEmail);if(data.clientId)r.push(...clientRecipient(data.clientId));r.push(...adminRecipients());r=r.filter(e=>ne(e)!==ne(currentUser?.email));await createNotification({...data,recipientEmails:r})}
function notificationKind(n){const s=(n.type||'').toLowerCase();if(s.includes('script')||s.includes('roteiro'))return'Roteiro';if(s.includes('capture')||s.includes('capta'))return'Captação';if(s.includes('internal')||s.includes('tarefa'))return'Tarefa';return'Demanda'}

window.openTrash=function(btn){
  document.querySelectorAll('.tab').forEach(x=>x.classList.remove('active'));
  if(btn)btn.classList.add('active');
  document.querySelectorAll('main section').forEach(s=>s.classList.add('hidden'));
  const v=document.getElementById('trashView');
  if(v)v.classList.remove('hidden');
  renderTrash();
}

window.openNotifications=function(){renderNotifications();notificationsModal.classList.add('active')}
function renderNotifications(){const e=ne(currentUser?.email),l=document.getElementById('notificationsList');if(!l)return;const a=[...notifications].sort((x,y)=>(y.createdAt?.seconds||0)-(x.createdAt?.seconds||0));l.innerHTML=a.length?a.map(n=>`<div class="notification-row ${(n.readBy||[]).map(ne).includes(e)?'':'unread'}" onclick="openNotificationItem('${n.id}')"><strong>${n.title||'Notificação'}</strong><p>${n.message||''}</p><button>Abrir conteúdo →</button></div>`).join(''):'<div class="empty">Nenhuma notificação.</div>';const c=document.getElementById('notificationCount');if(c)c.textContent=notifications.filter(n=>!(n.readBy||[]).map(ne).includes(e)).length}
window.openNotificationItem=async function(id){const n=notifications.find(x=>x.id===id);if(!n)return;const e=ne(currentUser?.email);await setDoc(doc(db,'notifications',id),{readBy:[...new Set([...(n.readBy||[]),e])]},{merge:true});closeModals();openOperationalItem(notificationKind(n),n.entityId,n.clientId)}
function openOperationalItem(k,id,cid=''){if(k==='Demanda'){if(isAdmin){showView('demands',document.querySelectorAll('.tab')[9]);setTimeout(()=>editDemand(id),40)}else{selectedClientId=cid||selectedClientId;showView('clientPanel',document.querySelectorAll('.tab')[10])}}else if(k==='Roteiro'){showView('scripts',document.querySelectorAll('.tab')[3]);if(isAdmin)setTimeout(()=>editScript(id),40)}else if(k==='Captação'){showView('captures',document.querySelectorAll('.tab')[4]);if(isAdmin)setTimeout(()=>editCapture(id),40)}else{showView('internal',document.querySelectorAll('.tab')[6]);if(isAdmin)setTimeout(()=>editInternal(id),40)}}
window.openAttentionItems=function(title,items){attentionTitle.textContent=title;attentionList.innerHTML=items.length?items.map(i=>`<div class="attention-row" onclick="closeModals();openOperationalItem('${i.kind}','${i.x.id}','${i.x.clientId||''}')"><strong>${i.x.title||i.x.theme||'Sem título'}</strong><div class="meta"><span class="pill">${i.kind}</span><span class="pill">${i.x.status||''}</span></div><button>Abrir conteúdo →</button></div>`).join(''):'<div class="empty">Nenhum item.</div>';attentionModal.classList.add('active')}
window.dashboardAttention=function(type){const a=[...internalTasks.map(x=>({x,kind:'Tarefa'})),...demands.map(x=>({x,kind:'Demanda'}))];if(type==='late')openAttentionItems('Atrasadas',a.filter(i=>isLate(i.x)));if(type==='urgent')openAttentionItems('Urgentes',a.filter(i=>i.x.priority==='Urgente'));if(type==='waiting')openAttentionItems('Aguardando ação',a.filter(i=>['Aguardando aprovação','Aguardando você'].includes(i.x.status)))}
function visibleDemands(){const f=document.getElementById('agencyClientFilter')?.value||'Todos';return isAdmin&&f!=='Todos'?demands.filter(d=>d.clientId===f):demands}
function renderBulkBar(){const b=document.getElementById('demandBulkBar');if(!b)return;b.classList.toggle('active',selectedDemandIds.size>0);demandBulkCount.textContent=`${selectedDemandIds.size} selecionada(s)`;bulkStatus.innerHTML='<option value="">Escolha o status...</option>'+demandStatuses.map(x=>`<option>${x}</option>`).join('');bulkResponsible.innerHTML=optionsTeam()}
window.toggleDemandSelection=(id,on)=>{on?selectedDemandIds.add(id):selectedDemandIds.delete(id);renderBulkBar()}
window.clearDemandSelection=()=>{selectedDemandIds.clear();renderDemands()}
window.demandFilterChanged=()=>{selectedDemandIds.clear();renderDemands()}
window.selectVisibleDemands=()=>{const a=visibleDemands(),all=a.length&&a.every(x=>selectedDemandIds.has(x.id));a.forEach(x=>all?selectedDemandIds.delete(x.id):selectedDemandIds.add(x.id));renderDemands()}
window.bulkStatusApply=async()=>{if(!isAdmin||!selectedDemandIds.size)return;const s=bulkStatus.value;if(!s)return alert('Escolha um status.');if(!confirm(`Alterar ${selectedDemandIds.size} demanda(s)?`))return;await Promise.all([...selectedDemandIds].map(id=>setDoc(doc(db,'demands',id),{status:s,updatedAt:serverTimestamp()},{merge:true})));selectedDemandIds.clear()}
window.bulkResponsibleApply=async()=>{if(!isAdmin||!selectedDemandIds.size)return;const r=responsibilityData(bulkResponsible.value);if(!confirm(`Alterar responsável de ${selectedDemandIds.size} demanda(s)?`))return;await Promise.all([...selectedDemandIds].map(id=>setDoc(doc(db,'demands',id),{assignedEmail:r.responsibleEmail,assignedName:r.responsibleName,responsibilityScope:r.responsibilityScope,updatedAt:serverTimestamp()},{merge:true})));selectedDemandIds.clear()}
window.bulkApproval=async()=>{if(!isAdmin||!selectedDemandIds.size)return;if(!confirm(`Enviar ${selectedDemandIds.size} demanda(s) para aprovação?`))return;const ids=[...selectedDemandIds];await Promise.all(ids.map(id=>setDoc(doc(db,'demands',id),{status:'Aguardando aprovação',updatedAt:serverTimestamp()},{merge:true})));const g={};ids.map(id=>demands.find(d=>d.id===id)).filter(Boolean).forEach(d=>(g[d.clientId]??=[]).push(d));for(const [cid,ds] of Object.entries(g))await createNotification({title:'Conteúdos para aprovação',message:`${ds.length} conteúdo(s) aguardando sua aprovação.`,recipientEmails:clientRecipient(cid),type:'demand',entityId:ds[0].id,clientId:cid});selectedDemandIds.clear()}
window.bulkNotify=async()=>{if(!isAdmin||!selectedDemandIds.size)return;const ids=[...selectedDemandIds],r=new Set();ids.map(id=>demands.find(d=>d.id===id)).filter(Boolean).forEach(d=>{if(d.assignedEmail)r.add(d.assignedEmail);(d.participantEmails||[]).forEach(e=>r.add(e))});if(!r.size)return alert('Nenhum responsável/participante nos itens selecionados.');await createNotification({title:'Demandas precisam de atenção',message:`Há ${ids.length} demanda(s) selecionada(s).`,recipientEmails:[...r],type:'demand',entityId:ids[0]});alert('Notificação enviada.')}

window.bulkDeleteDemands=async()=>{
  if(!isAdmin||!selectedDemandIds.size)return;
  const ids=[...selectedDemandIds];
  const selected=ids.map(id=>demands.find(d=>d.id===id)).filter(Boolean);
  if(!selected.length)return;
  const ok=confirm(`Mover ${selected.length} demanda(s) para a Lixeira?\n\nVocê poderá restaurar depois. Clientes, equipe, roteiros, captações e calendário não serão alterados.`);
  if(!ok)return;
  await Promise.all(selected.map(d=>setDoc(doc(db,'demands',d.id),{
    archived:true,
    archivedAt:serverTimestamp(),
    archivedBy:ne(currentUser?.email),
    updatedAt:serverTimestamp()
  },{merge:true})));
  selectedDemandIds.clear();
}
function renderTrash(){
  const box=document.getElementById('trashList');if(!box)return;
  if(!isAdmin){box.innerHTML='<div class="empty">Acesso restrito ao administrador.</div>';return}
  const filter=document.getElementById('trashClientFilter');
  if(filter){
    const keep=filter.value;
    const ids=[...new Set(trashedDemands.map(d=>d.clientId).filter(Boolean))];
    filter.innerHTML='<option value="">Todos os clientes</option>'+ids.map(id=>`<option value="${id}">${clientById(id)?.name||'Cliente'}</option>`).join('');
    if([...filter.options].some(o=>o.value===keep))filter.value=keep;
  }
  const cid=filter?.value||'';
  const rows=[...trashedDemands].filter(d=>!cid||d.clientId===cid).sort((a,b)=>(b.archivedAt?.seconds||0)-(a.archivedAt?.seconds||0));
  if(!rows.length){box.innerHTML='<div class="empty">A lixeira está vazia para este cliente.</div>';return}
  const groups={};rows.forEach(d=>{const k=d.clientId||'sem-cliente';(groups[k]||(groups[k]=[])).push(d)});
  box.innerHTML=Object.entries(groups).map(([clientId,items])=>`<div class="trash-group"><h3>${clientById(clientId)?.name||items[0]?.clientName||'Cliente'}</h3>${items.map(d=>`<div class="trash-card"><h4>${d.title||'Demanda sem título'}</h4><div class="meta"><span class="pill">${d.status||''}</span></div><p>Removido por: ${d.archivedBy||'—'}</p><div class="actions"><button class="btn-dark" onclick="openDemandHistory('${d.id}')">Ver histórico</button><button class="btn-green" onclick="restoreDemand('${d.id}')">Restaurar</button><button class="btn-danger" onclick="deleteDemandForever('${d.id}')">Excluir definitivamente</button></div></div>`).join('')}</div>`).join('');
}
window.emptyTrash=async function(){
  if(!isAdmin)return;
  const cid=document.getElementById('trashClientFilter')?.value||'';
  const rows=trashedDemands.filter(d=>!cid||d.clientId===cid);
  if(!rows.length)return alert('Não há itens para excluir.');
  const client=cid?clientById(cid):null;
  const scope=client?`do cliente ${client.name}`:'de TODOS os clientes';
  if(!confirm(`ATENÇÃO: excluir definitivamente ${rows.length} item(ns) da lixeira ${scope}?\n\nEsta ação não pode ser desfeita.`))return;
  const typed=prompt('Digite ESVAZIAR para confirmar:');
  if((typed||'').trim().toUpperCase()!=='ESVAZIAR')return alert('Ação cancelada.');
  await Promise.all(rows.map(d=>deleteDoc(doc(db,'demands',d.id))));
}
window.restoreDemand=async function(id){
  if(!isAdmin)return;
  const d=trashedDemands.find(x=>x.id===id);if(!d)return;
  if(!confirm(`Restaurar "${d.title||'esta demanda'}"?`))return;
  await setDoc(doc(db,'demands',id),{archived:false,restoredAt:serverTimestamp(),restoredBy:ne(currentUser?.email),updatedBy:ne(currentUser?.email),updatedByName:actorName(),history:demandHistoryWith(d,historyEvent('Demanda restaurada da Lixeira')),updatedAt:serverTimestamp()},{merge:true});
}
window.deleteDemandForever=async function(id){
  if(!isAdmin)return;
  const d=trashedDemands.find(x=>x.id===id);if(!d)return;
  const ok=confirm(`ATENÇÃO: excluir definitivamente "${d.title||'esta demanda'}"?\n\nDepois desta ação não será possível restaurar pelo sistema.`);
  if(!ok)return;
  const typed=prompt('Digite EXCLUIR para confirmar a exclusão definitiva:');
  if((typed||'').trim().toUpperCase()!=='EXCLUIR')return alert('Exclusão cancelada.');
  await deleteDoc(doc(db,'demands',id));
}



async function uploadSelectedFile(inputId, folder){
  return "";
}

window.login = async function(){
  const email = document.getElementById('loginEmail').value.trim();
  const password = document.getElementById('loginPassword').value;
  const error = document.getElementById('loginError');
  error.style.display = 'none';
  try { await signInWithEmailAndPassword(auth, email, password); }
  catch(e) { error.textContent = 'Erro no login. Confira e-mail e senha.'; error.style.display = 'block'; }
}
window.logout = function(){ signOut(auth); }

onAuthStateChanged(auth, (user) => {
  if(publicQuoteToken) return;
  if(user){
    currentUser = user;
    isAdmin = [ADMIN_EMAIL.toLowerCase()].includes((user.email || '').trim().toLowerCase());
    document.getElementById('loginPage').classList.add('hidden');
    document.getElementById('appPage').classList.remove('hidden');
    startListeners();
    if(isAdmin) loadQuotes();
    adjustViewByRole();
  } else {
    currentUser = null;
    document.getElementById('loginPage').classList.remove('hidden');
    document.getElementById('appPage').classList.add('hidden');
    [unsubClients, unsubDemands, unsubInternal, unsubTeam, unsubSettings, unsubMacro, unsubCalendar, unsubScripts, unsubCaptures, unsubNotifications, unsubQuotes, unsubAgencyAgenda].forEach(fn => { if(fn) fn(); }); unsubQuotes=null;
  }
});


function renderBrandLogo(){
  const logoUrl = appSettings.logoUrl || "";
  const content = logoUrl
    ? `<img class="logo-img" src="${logoUrl}" alt="Agência Humaniza"><span>Agência Humaniza</span>`
    : `Agência Humaniza`;

  const loginLogo = document.getElementById('loginBrandLogo');
  const appLogo = document.getElementById('appBrandLogo') || document.querySelector('header .logo');

  if(loginLogo) loginLogo.innerHTML = content;
  if(appLogo) appLogo.innerHTML = content;

  const preview = document.getElementById('agencyLogoPreview');
  if(preview){
    preview.innerHTML = `
      ${logoUrl ? `<img src="${logoUrl}" alt="Logo Agência Humaniza">` : `<div class="brand-logo-box"></div>`}
      <div>
        <strong>Agência Humaniza</strong>
        <p style="margin:4px 0 0;color:#A6A6A6">Logo atual do sistema.</p>
      </div>
    `;
  }
}


function adjustViewByRole(){
  const tabs = document.querySelectorAll('.tab');
  document.querySelector('header .actions').querySelectorAll('button').forEach(btn => btn.style.display = 'inline-block');
  tabs.forEach(tab => tab.style.display = 'block');

  if(isAdmin){
    updateMobileMenuByRole();
    showView('dashboard', tabs[0]);
    return;
  }

  document.querySelector('header .actions').querySelectorAll('button').forEach(btn => {
    if(btn.textContent !== 'Sair') btn.style.display = 'none';
  });

  if(isTeamMember){
    updateMobileMenuByRole();
    tabs.forEach((tab, index) => { if(![2,3,4,5,6,9,11].includes(index)) tab.style.display = 'none'; });
    showView('internal', tabs[6]);
  } else {
    updateMobileMenuByRole();
    tabs.forEach((tab, index) => { if(![1,2,3,4,5,10].includes(index)) tab.style.display = 'none'; });
    showView('clientPanel', tabs[10]);
  }
}

function startListeners(){
  [unsubClients, unsubDemands, unsubInternal, unsubTeam, unsubSettings, unsubMacro, unsubCalendar, unsubScripts, unsubCaptures, unsubNotifications, unsubAgencyAgenda].forEach(fn => { if(fn) fn(); });

  unsubSettings = onSnapshot(doc(db, 'settings', 'app'), snap => {
    appSettings = snap.exists() ? snap.data() : {};
    renderBrandLogo();
  });
  unsubNotifications=onSnapshot(query(collection(db,'notifications'),where('recipientEmails','array-contains',ne(currentUser.email))),snap=>{notifications=snap.docs.map(d=>({id:d.id,...d.data()}));renderNotifications()});

  const scopedPlanning = (name, setter) => {
    if(isAdmin){ return onSnapshot(collection(db, name), snap => { setter(snap.docs.map(d => ({id:d.id, ...d.data()}))); refreshAll(); }); }
    return onSnapshot(query(collection(db, name), where('clientEmail','==', currentUser.email)), snap => { setter(snap.docs.map(d => ({id:d.id, ...d.data()}))); refreshAll(); });
  };
  unsubMacro = scopedPlanning('macroPlans', data => macroPlans = data);
  unsubCalendar = scopedPlanning('calendarItems', data => calendarItems = data);
  unsubScripts = scopedPlanning('scripts', data => scripts = data);
  unsubCaptures = scopedPlanning('captures', data => captures = data);
  if(isAdmin || isTeamMember){ unsubAgencyAgenda=onSnapshot(collection(db,'agencyAgenda'),snap=>{agencyAgendaItems=snap.docs.map(d=>({id:d.id,...d.data()}));renderAgencyAgenda();}); }

  unsubTeam = onSnapshot(collection(db, 'team'), snap => {
    teamMembers = snap.docs.map(d => ({id:d.id, ...d.data()}));
    currentTeamMember = teamMembers.find(m => (m.email || '').trim().toLowerCase() === (currentUser?.email || '').trim().toLowerCase()) || null;
    const becameTeam=!isTeamMember && !!currentTeamMember;
    isTeamMember = !!currentTeamMember;
    if(!isAdmin && becameTeam){
      [unsubMacro,unsubCalendar,unsubScripts,unsubCaptures].forEach(fn=>{if(fn)fn()});
      unsubMacro=onSnapshot(collection(db,'macroPlans'),snap=>{macroPlans=snap.docs.map(d=>({id:d.id,...d.data()}));refreshAll()});
      unsubCalendar=onSnapshot(collection(db,'calendarItems'),snap=>{calendarItems=snap.docs.map(d=>({id:d.id,...d.data()}));refreshAll()});
      unsubScripts=onSnapshot(collection(db,'scripts'),snap=>{scripts=snap.docs.map(d=>({id:d.id,...d.data()}));refreshAll()});
      unsubCaptures=onSnapshot(collection(db,'captures'),snap=>{captures=snap.docs.map(d=>({id:d.id,...d.data()}));refreshAll()});
    }
    if(!isAdmin) adjustViewByRole();
    refreshAll();
  });

  if(isAdmin){
    unsubClients = onSnapshot(collection(db, 'clients'), snap => { clients = snap.docs.map(d => ({id:d.id, ...d.data()})); selectedClientId = selectedClientId || clients[0]?.id || null; refreshAll(); });
    unsubDemands = onSnapshot(collection(db, 'demands'), snap => { splitDemandTrash(snap.docs.map(d => ({id:d.id, ...d.data()}))); refreshAll(); });
    unsubInternal = onSnapshot(collection(db, 'internalTasks'), snap => { internalTasks = snap.docs.map(d => ({id:d.id, ...d.data()})); refreshAll(); });
  } else if(isTeamMember){
    // Funcionário: carrega as demandas e tarefas atribuídas ao próprio e-mail.
    // A lista de clientes fica vazia porque dados administrativos de clientes
    // continuam restritos ao admin / ao próprio cliente.
    clients = [];
    selectedClientId = null;
    unsubDemands = onSnapshot(query(collection(db, 'demands'), where('assignedEmail','==', currentUser.email)), snap => { splitDemandTrash(snap.docs.map(d => ({id:d.id, ...d.data()}))); refreshAll(); });
    unsubInternal = onSnapshot(query(collection(db, 'internalTasks'), where('assignedEmail','==', currentUser.email)), snap => { internalTasks = snap.docs.map(d => ({id:d.id, ...d.data()})); refreshAll(); });
  } else {
    // Cliente: carrega somente o próprio cadastro e as próprias demandas.
    unsubClients = onSnapshot(query(collection(db, 'clients'), where('email','==', currentUser.email)), snap => { clients = snap.docs.map(d => ({id:d.id, ...d.data()})); selectedClientId = clients[0]?.id || null; refreshAll(); });
    unsubDemands = onSnapshot(query(collection(db, 'demands'), where('clientEmail','==', currentUser.email)), snap => { splitDemandTrash(snap.docs.map(d => ({id:d.id, ...d.data()}))); refreshAll(); });
    unsubInternal = onSnapshot(query(collection(db, 'internalTasks'), where('assignedEmail','==', currentUser.email)), snap => { internalTasks = snap.docs.map(d => ({id:d.id, ...d.data()})); refreshAll(); });
  }
}

window.showView = function(view, el){
  if(view==='briefings')loadProjectBriefings().then(()=>renderBriefings());
  if(!isAdmin && !isTeamMember && !['macro','calendar','scripts','captures','library','clientPanel','agencyAgenda'].includes(view)) return;
  if(isTeamMember && !isAdmin && !['calendar','scripts','captures','library','internal','demands','agencyAgenda'].includes(view)) return;
  document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
  if(el) el.classList.add('active');
  ['dashboard','macro','calendar','scripts','captures','library','internal','team','clients','demands','clientPanel','agencyAgenda','quotes'].forEach(v => document.getElementById(v+'View').classList.add('hidden'));
  document.getElementById(view+'View').classList.remove('hidden');
  if(view==='dashboard') renderDashboard();
  if(view==='macro') renderMacro();
  if(view==='calendar') renderCalendar();
  if(view==='scripts') renderScripts();
  if(view==='captures') renderCaptures();
  if(view==='library') renderLibrary();
  if(view==='internal') renderInternal();
  if(view==='team') renderTeam();
  if(view==='clients') renderClients();
  if(view==='demands') renderDemands();
  if(view==='clientPanel') renderClientPanel(selectedClientId);
  if(view==='agencyAgenda') renderAgencyAgenda();
  if(view==='quotes'){ renderQuotes(); if(isAdmin && !unsubQuotes) loadQuotes(); }
  renderTrash();
}

function formatDate(date){ if(!date) return ''; const d = new Date(date+'T00:00:00'); return d.toLocaleDateString('pt-BR',{day:'2-digit',month:'2-digit'}); }
function todayOnly(){ const n = new Date(); return new Date(n.getFullYear(), n.getMonth(), n.getDate()); }
function isLate(x){ if(!x.date || ['Publicado','Aprovado','Entregue'].includes(x.status)) return false; return new Date(x.date+'T00:00:00') < todayOnly(); }
function clientById(id){ return clients.find(c => c.id === id); }
function calcProgress(list){ if(!list.length) return 0; const done=list.filter(x => ['Aprovado','Publicado','Entregue'].includes(x.status)).length; return Math.round((done/list.length)*100); }

function renderDashboard(){
  if(!isAdmin) return;
  const total = internalTasks.length + demands.length;
  const late = [...internalTasks, ...demands].filter(isLate).length;
  const urgent = [...internalTasks, ...demands].filter(x => x.priority === 'Urgente').length;
  const waiting = demands.filter(d => d.status === 'Aguardando aprovação' || d.status === 'Aguardando você').length;
  const progress = calcProgress([...internalTasks, ...demands]);
  document.getElementById('dashboardView').innerHTML = `
    <div class="stats">
      <div class="stat"><p>Total geral</p><strong>${total}</strong></div>
      <div class="stat clickable" onclick="dashboardAttention('late')"><p>Atrasadas</p><strong>${late}</strong><small>Clique para ver</small></div>
      <div class="stat clickable" onclick="dashboardAttention('urgent')"><p>Urgentes</p><strong>${urgent}</strong><small>Clique para ver</small></div>
      <div class="stat"><p>Progresso geral</p><strong>${progress}%</strong><div class="progress"><span style="width:${progress}%"></span></div></div>
    </div>
    <div class="grid">
      <div class="panel"><h3>📋 Agência</h3><p>${internalTasks.length} tarefa(s) internas no painel.</p><button onclick="document.querySelectorAll('.tab')[6].click()">Abrir agência</button></div>
      <div class="panel"><h3>👨‍💻 Equipe</h3><p>${teamMembers.length} funcionário(s) cadastrado(s).</p><button onclick="document.querySelectorAll('.tab')[7].click()">Abrir equipe</button></div>
      <div class="panel"><h3>👥 Clientes</h3><p>${clients.length} cliente(s) cadastrado(s).</p><button onclick="document.querySelectorAll('.tab')[8].click()">Abrir clientes</button></div>
      <div class="panel clickable" onclick="dashboardAttention('waiting')"><h3>⚠️ Aguardando ação</h3><p>${waiting} demanda(s) aguardando aprovação ou retorno do cliente.</p><button>Abrir itens</button></div>
    </div>`;
}


function getScopedClientId(){ return selectedClientId || clients[0]?.id || ''; }
function currentVisibleClient(){ return selectedClientId ? clientById(selectedClientId) : (clients[0] || null); }
function monthFromDate(date){ return (date || '').slice(0,7); }

const MONTH_NAMES=['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];
function currentCompetence(){const d=new Date();return {month:d.getMonth()+1,year:d.getFullYear()}}
function competenceFromItem(x){
  if(x?.competenceMonth&&x?.competenceYear)return {month:Number(x.competenceMonth),year:Number(x.competenceYear)};
  const ym=x?.month||monthFromDate(x?.publishDate||x?.date||x?.captureDate||'');
  const m=String(ym||'').match(/^(\d{4})-(\d{2})$/);
  if(m)return {month:Number(m[2]),year:Number(m[1])};
  const dt=x?.createdAt?.toDate?.();if(dt)return {month:dt.getMonth()+1,year:dt.getFullYear()};
  return currentCompetence();
}
function setupMonthlyFilter(monthId,yearId,items){
  const ms=document.getElementById(monthId),ys=document.getElementById(yearId);if(!ms||!ys)return currentCompetence();
  const now=currentCompetence(),keepM=ms.value||String(now.month),keepY=ys.value||String(now.year);
  ms.innerHTML=MONTH_NAMES.map((n,i)=>`<option value="${i+1}">${n}</option>`).join('');
  const years=[...new Set([now.year,...items.map(x=>competenceFromItem(x).year).filter(Boolean)])].sort((a,b)=>b-a);
  ys.innerHTML=years.map(y=>`<option value="${y}">${y}</option>`).join('');
  ms.value=[...ms.options].some(o=>o.value===keepM)?keepM:String(now.month);
  ys.value=[...ys.options].some(o=>o.value===keepY)?keepY:String(now.year);
  return {month:Number(ms.value),year:Number(ys.value)};
}
function filterByCompetence(items,monthId,yearId){
  const selected=setupMonthlyFilter(monthId,yearId,items);
  return items.filter(x=>{const c=competenceFromItem(x);return c.month===selected.month&&c.year===selected.year});
}

function scopeByClient(list){ if(isAdmin) return list; let base=list.filter(x=>x.clientEmail===currentUser?.email || involved(x,currentUser?.email)); if(!isTeamMember) base=base.filter(x=>x.visibility!=='Apenas equipe' && x.visibility!=='Apenas admin'); return base; }
function collectionDataWithClient(clientId){ const c=clientById(clientId); return {clientId, clientEmail:c?.email||''}; }
function fillPlanningSelects(){ const clientOptions=clients.map(c=>`<option value="${c.id}">${c.name}</option>`).join(''); ['macroClient','calendarClient','scriptClient','captureClient'].forEach(id=>{const el=document.getElementById(id); if(el){const current=el.value; el.innerHTML=clientOptions; if(current && [...el.options].some(o=>o.value===current)) el.value=current;}}); const filter=document.getElementById('calendarClientFilter'); if(filter){const currentFilter=filter.value||'Todos'; filter.innerHTML='<option value="Todos">Todos os clientes</option>'+clientOptions; if([...filter.options].some(o=>o.value===currentFilter)) filter.value=currentFilter;} const people='<option value="">Selecionar responsável</option><option value="__HUMANIZA_OUT_OF_SCOPE__">Humaniza não cuida desta frente</option>'+teamMembers.map(m=>`<option value="${m.email}">${m.name} • ${m.role||'Equipe'}</option>`).join(''); ['calendarResponsible','scriptResponsible','captureResponsible'].forEach(id=>{const el=document.getElementById(id); if(el){const current=el.value; el.innerHTML=people; if([...el.options].some(o=>o.value===current)) el.value=current;}}); fillP('scriptParticipants',pEmails('scriptParticipants'));fillP('captureParticipants',pEmails('captureParticipants'));fillP('calendarParticipants',pEmails('calendarParticipants')); const month=document.getElementById('calendarMonthFilter'); if(month&&!month.value){const d=new Date(); month.value=`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;} }
window.renderMacro=function(){ fillPlanningSelects(); if(btnMacroNew) btnMacroNew.style.display=isAdmin?'inline-block':'none'; const data=scopeByClient(macroPlans); macroGrid.innerHTML=data.length?data.map(m=>{const c=clientById(m.clientId); return `<div class="planning-card"><h3>${m.title}</h3><div class="meta"><span class="pill">${c?.name||'Cliente'}</span><span class="pill">${m.month||''}</span><span class="pill">${m.status||''}</span></div><p><b>Objetivo:</b> ${m.goal||''}</p><div class="script-block"><b>Datas</b><p>${m.dates||''}</p></div><div class="script-block"><b>Estratégia</b><p>${m.strategy||''}</p></div>${m.clientNote?`<div class="comment-box"><b>Observação do cliente:</b><br>${m.clientNote}</div>`:''}<div class="actions">${isAdmin?`<button class="btn-dark" onclick="editMacro('${m.id}')">Editar</button>`:`<button onclick="approveMacro('${m.id}')">Aprovar macro</button><button class="btn-dark" onclick="commentMacro('${m.id}')">Comentar</button>`}</div></div>`}).join(''):'<div class="empty">Nenhum planejamento macro cadastrado.</div>'; }
window.renderCalendar=function(){ fillPlanningSelects(); if(btnCalendarNew) btnCalendarNew.style.display=isAdmin?'inline-block':'none'; const filter=calendarClientFilter?.value||'Todos'; const month=calendarMonthFilter?.value||new Date().toISOString().slice(0,7); let data=scopeByClient(calendarItems).filter(x=>!x.teamCalendar); if(filter!=='Todos') data=data.filter(x=>x.clientId===filter); data=data.filter(x=>(x.date||'').startsWith(month)); const [year,mon]=month.split('-').map(Number); const first=new Date(year,mon-1,1); const days=new Date(year,mon,0).getDate(); const start=(first.getDay()+6)%7; const total=Math.ceil((start+days)/7)*7; const weekdays=['Seg','Ter','Qua','Qui','Sex','Sáb','Dom'].map(w=>`<div class="calendar-weekday">${w}</div>`).join(''); const cells=Array.from({length:total},(_,i)=>{const day=i-start+1; if(day<1||day>days) return `<div class="calendar-day muted"></div>`; const dateStr=`${month}-${String(day).padStart(2,'0')}`; const items=data.filter(x=>x.date===dateStr); return `<div class="calendar-day"><strong>${day}</strong>${items.length?items.map(item=>`<div class="calendar-item" onclick="${isAdmin?`editCalendarItem('${item.id}')`:`commentCalendarItem('${item.id}')`}"><b>${item.eventType||item.format}${item.startTime?' • '+item.startTime:''}</b>${item.theme}<small>${item.status} • ${responsibilityLabel(item).replace('Responsável: ','')}</small></div>`).join(''):`<div class="calendar-empty-line"></div><div class="calendar-empty-line"></div>`}</div>`}).join(''); calendarGrid.innerHTML=weekdays+cells; }

function shareSafeScript(s){
  return {
    title:s.title||'',format:s.format||'Vídeo / Reel',status:s.status||'',
    captureDate:s.captureDate||'',publishDate:s.publishDate||'',publishTime:s.publishTime||'',
    briefing:s.briefing||'',imageLink:s.imageLink||'',goal:s.goal||'',hook:s.hook||'',
    scenes:s.scenes||'',cardCount:s.cardCount||null,cards:s.cards||'',
    artText:s.artText||'',artDirection:s.artDirection||'',cta:s.cta||'',
    approvalLink:s.approvalLink||'',referenceLink:s.referenceLink||'',referenceLinks:s.referenceLinks||[],driveLinks:s.driveLinks||[],photoHours:s.photoHours||'',treatedPhotos:s.treatedPhotos||'',rawPhotosDelivery:s.rawPhotosDelivery||'',rawPhotosCustom:s.rawPhotosCustom||'',deliveryDays:s.deliveryDays||'',deliveryCustom:s.deliveryCustom||'',photoObjective:s.photoObjective||'',photoLocation:s.photoLocation||'',photoNotes:s.photoNotes||''
  };
}
function encodeSharePayload(obj){
  const bytes=new TextEncoder().encode(JSON.stringify(obj));
  let bin='';bytes.forEach(b=>bin+=String.fromCharCode(b));
  return btoa(bin).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
}
window.shareSingleScript=function(id){
  const s=scripts.find(x=>x.id===id);if(!s)return;
  const c=clientById(s.clientId);
  const payload={kind:'script',client:c?.name||'Cliente',captureDate:s.captureDate||'',items:[shareSafeScript(s)]};
  const link=window.location.origin+'/roteiro.html#'+encodeSharePayload(payload);
  navigator.clipboard?.writeText(link);
  prompt('Link do roteiro pronto. Copie e envie ao cliente:',link);
}
window.shareCaptureScripts=function(id){
  const s=scripts.find(x=>x.id===id);if(!s)return;
  if(!s.captureDate){alert('Defina a data da captação neste roteiro para agrupar os conteúdos.');return;}
  const group=scripts.filter(x=>x.clientId===s.clientId&&x.captureDate===s.captureDate);
  const c=clientById(s.clientId);
  const payload={kind:'capture',client:c?.name||'Cliente',captureDate:s.captureDate,items:group.map(shareSafeScript)};
  const link=window.location.origin+'/roteiro.html#'+encodeSharePayload(payload);
  navigator.clipboard?.writeText(link);
  prompt(`Link da captação pronto (${group.length} roteiro(s)). Copie e envie ao cliente:`,link);
}

function scriptPublicToken(){return 'r_'+crypto.getRandomValues(new Uint32Array(2)).reduce((a,n)=>a+n.toString(36),'').slice(0,12)}
function publicScriptDocId(token){return 'script_'+token.replace(/[^a-zA-Z0-9_-]/g,'')}
window.shareCurrentScriptsPage=async function(){
  const project=selectedUnifiedProject();if(!project){alert('Selecione o cliente/projeto.');return;}
  const data=currentScriptEditorData();if(!data.length){alert('Crie ou carregue os roteiros deste cliente antes de compartilhar.');return;}
  const month=document.getElementById('scriptsMonthFilter')?.value||'',year=document.getElementById('scriptsYearFilter')?.value||'';
  const payload={kind:'scriptsPage',client:project.name,period:[month,year].filter(Boolean).join('/'),captureDates:[...new Set(data.map(s=>s.captureDate).filter(Boolean))].sort(),items:data.map(shareSafeScript),updatedAt:serverTimestamp()};
  const token=scriptPublicToken();
  try{await setDoc(doc(db,'publicQuotes',publicScriptDocId(token)),payload,{merge:false});}
  catch(e){console.error(e);alert('Não foi possível gerar o link público.');return;}
  const link=window.location.origin+'/roteiro.html?p='+encodeURIComponent(token);
  const shareData={title:`Roteiros • ${project.name}`,text:`Roteiros preparados pela Humaniza para ${project.name}.`,url:link};
  if(navigator.share){try{await navigator.share(shareData);return}catch(e){if(e?.name==='AbortError')return;}}
  await navigator.clipboard?.writeText(link);alert('Link curto copiado. É só colar e enviar ao cliente.');
}


function normalizeProjectName(v){return String(v||'').trim().toLocaleLowerCase('pt-BR')}
function humanizaUnifiedProjects(){
  const map=new Map();
  const norm=v=>String(v||'').trim().toLocaleLowerCase('pt-BR').normalize('NFD').replace(/[\u0300-\u036f]/g,'');
  const approved=q=>['aprovado','approved','aceito','accepted'].includes(norm(q.status))||norm(q.status).includes('aprov');
  const quoteName=q=>q.prospectName||q.clientName||q.customerName||q.name||q.client||q.prospect||q.company||q.businessName||'';
  const agendaName=a=>a.clientProspect||a.clientName||a.client||a.prospect||a.titleClient||'';
  const put=(id,name,origin,meta={})=>{
    name=String(name||'').trim();if(!name)return;
    const key=id||('external_'+normalizeProjectName(name).replace(/[^a-z0-9]+/g,'_'));
    const current=map.get(key),rank={agency:5,quote:4,agenda:3,calendar:2,script:1};
    if(!current||(rank[origin]??0)>(rank[current.origin]??0))map.set(key,{id:key,name,origin,...meta});
  };
  clients.forEach(c=>put(c.id,c.name,'agency',{clientId:c.id}));
  (quotes||[]).filter(approved).forEach(q=>{
    const name=quoteName(q);if(!name)return;
    const existing=clients.find(c=>normalizeProjectName(c.name)===normalizeProjectName(name));
    put(existing?.id||('quote_'+q.id),name,existing?'agency':'quote',{quoteId:q.id,clientId:existing?.id||'',captureDate:q.captureDate||q.shootDate||q.eventDate||''});
  });
  (agencyAgendaItems||[]).forEach(a=>{
    const name=agendaName(a);if(!name)return;
    const existing=clients.find(c=>normalizeProjectName(c.name)===normalizeProjectName(name));
    const aq=(quotes||[]).find(q=>approved(q)&&normalizeProjectName(quoteName(q))===normalizeProjectName(name));
    put(existing?.id||(aq?('quote_'+aq.id):('agenda_'+a.id)),name,existing?'agency':(aq?'quote':'agenda'),{agendaId:a.id,quoteId:aq?.id||'',clientId:existing?.id||'',captureDate:a.date||aq?.captureDate||aq?.shootDate||''});
  });
  (calendarItems||[]).forEach(x=>{
    const c=clientById(x.clientId),name=c?.name||x.clientProspect||x.clientName||x.projectName||x.prospect||'';
    if(name){const qid=x.quoteId||x.sourceId||'';const q=(quotes||[]).find(q=>q.id===qid);put(c?.id||x.clientId||(qid?('quote_'+qid):('calendar_'+x.id)),name,c?'agency':(q?'quote':'calendar'),{clientId:c?.id||x.clientId||'',quoteId:qid,captureDate:x.date||''});}
  });
  scripts.forEach(s=>{
    const c=clientById(s.clientId),name=c?.name||s.clientName||s.projectName||'';
    if(name)put(c?.id||s.clientId||('script_'+s.id),name,c?'agency':'script',{clientId:c?.id||s.clientId||''});
  });
  return [...map.values()].sort((a,b)=>a.name.localeCompare(b.name,'pt-BR'));
}
function scriptUnifiedProjects(){return humanizaUnifiedProjects()}
function scriptProjectLabel(p){
  const suffix=p.origin==='agency'?'Cliente da agência':p.origin==='quote'?'Avulso • orçamento aprovado':p.origin==='agenda'?'Avulso • agenda':'Projeto';
  return `${p.name} • ${suffix}`;
}
function selectedUnifiedProject(){
  const id=document.getElementById('scriptsClientFilter')?.value||'';
  return scriptUnifiedProjects().find(p=>p.id===id)||null;
}
function scriptStorageClientId(p){return p?.clientId||p?.id||''}
window.startNewScriptProject=function(){
  const cf=document.getElementById('scriptsClientFilter');
  if(cf)cf.focus();
  document.querySelector('.script-builder')?.scrollIntoView({behavior:'smooth',block:'start'});
}
function scriptEditorField(v=''){return h(v||'')}
function scriptLinksText(v,legacy=''){
  const a=Array.isArray(v)?v:[];
  return [...new Set([...a,legacy].map(x=>String(x||'').trim()).filter(Boolean))].join('\n');
}
function scriptLinksArray(v=''){
  return [...new Set(String(v||'').split(/\r?\n|,\s*(?=https?:\/\/)/).map(x=>x.trim()).filter(Boolean))];
}
function selectedProjectQuote(p){
  if(!p)return null;
  return (quotes||[]).find(q=>q.id===p.quoteId) ||
    (quotes||[]).find(q=>approved(q)&&normalizeProjectName(quoteName(q))===normalizeProjectName(p.name)) || null;
}
function photoDefaultsFromProject(p){
  const q=selectedProjectQuote(p)||{};
  const num=(...vals)=>{for(const v of vals){const n=Number(v);if(Number.isFinite(n)&&n>0)return n}return ''};
  const txt=(...vals)=>{for(const v of vals){if(v!==undefined&&v!==null&&String(v).trim())return String(v).trim()}return ''};
  let raw=txt(q.rawPhotosDelivery,q.uneditedPhotos,q.originalPhotos,q.deliverRawPhotos,q.rawDelivery);
  if(raw==='true'||raw===true)raw='all'; if(raw==='false'||raw===false)raw='none';
  return {
    photoHours:num(q.photoHours,q.hours,q.durationHours,q.captureHours,q.sessionHours),
    treatedPhotos:num(q.treatedPhotos,q.editedPhotos,q.photoQuantity,q.photosQty,q.treatedPhotoQty),
    rawPhotosDelivery:raw||'',
    rawPhotosCustom:txt(q.rawPhotosCustom,q.uneditedPhotosCondition,q.originalPhotosCondition),
    deliveryDays:num(q.deliveryDays,q.photoDeliveryDays),
    deliveryCustom:txt(q.deliveryCustom,q.deliveryDeadline),
    photoLocation:txt(q.captureLocation,q.location),
    captureDate:txt(q.captureDate,q.shootDate,q.eventDate)
  };
}
function editorFormatFields(s,i){
  if(s.format==='Carrossel')return `<div class="full"><label class="field-label">Conteúdo dos cards</label><textarea data-f="cards">${scriptEditorField(s.cards)}</textarea></div><div><label class="field-label">Quantidade de cards</label><input data-f="cardCount" type="number" min="2" value="${scriptEditorField(s.cardCount||'')}"></div>`;
  if(s.format==='Estático')return `<div class="full"><label class="field-label">Texto da arte</label><textarea data-f="artText">${scriptEditorField(s.artText)}</textarea></div><div class="full"><label class="field-label">Direção visual</label><textarea data-f="artDirection">${scriptEditorField(s.artDirection)}</textarea></div>`;
  if(s.format==='Sessão de fotos')return `
    <div><label class="field-label">Carga horária</label><input data-f="photoHours" type="number" min="0" step="0.5" value="${scriptEditorField(s.photoHours||'')}" placeholder="Ex.: 2"></div>
    <div><label class="field-label">Fotos tratadas</label><input data-f="treatedPhotos" type="number" min="0" value="${scriptEditorField(s.treatedPhotos||'')}" placeholder="Ex.: 30"></div>
    <div><label class="field-label">Fotos não tratadas / originais</label><select data-f="rawPhotosDelivery"><option value="" ${!s.rawPhotosDelivery?'selected':''}>A definir</option><option value="all" ${s.rawPhotosDelivery==='all'?'selected':''}>Entregar todas</option><option value="none" ${s.rawPhotosDelivery==='none'?'selected':''}>Não entregar</option><option value="custom" ${s.rawPhotosDelivery==='custom'?'selected':''}>Condição personalizada</option></select></div>
    <div><label class="field-label">Condição dos originais</label><input data-f="rawPhotosCustom" value="${scriptEditorField(s.rawPhotosCustom||'')}" placeholder="Se necessário, detalhe aqui"></div>
    <div><label class="field-label">Prazo de entrega</label><select data-f="deliveryDays">${['','5','7','10','15','20','30','custom'].map(v=>`<option value="${v}" ${String(s.deliveryDays||'')===v?'selected':''}>${v===''?'A definir':v==='custom'?'Personalizado':v+' dias'}</option>`).join('')}</select></div>
    <div><label class="field-label">Prazo personalizado</label><input data-f="deliveryCustom" value="${scriptEditorField(s.deliveryCustom||'')}" placeholder="Ex.: 12 dias úteis"></div>
    <div class="full"><label class="field-label">Objetivo da sessão</label><textarea class="compact" data-f="photoObjective">${scriptEditorField(s.photoObjective||s.goal||'')}</textarea></div>
    <div class="full"><label class="field-label">Local</label><input data-f="photoLocation" value="${scriptEditorField(s.photoLocation||'')}" placeholder="Local da sessão"></div>
    <div class="full"><label class="field-label">Observações / orientações</label><textarea data-f="photoNotes">${scriptEditorField(s.photoNotes||'')}</textarea></div>`;
  return `<div class="full"><label class="field-label">Desenvolvimento / cenas / falas</label><textarea data-f="scenes">${scriptEditorField(s.scenes)}</textarea></div>`;
}

function emptyProjectBriefing(){return {responsible:'',email:'',company:'',cnpj:'',history:'',offer:'',audience:'',marketingGoal:'',important:'',production:'',contentIntent:'',mainMessage:'',references:''}}
function currentProjectBriefingData(){const v=id=>document.getElementById(id)?.value?.trim?.()||'';return {responsible:v('briefResponsible'),email:v('briefEmail'),company:v('briefCompany'),cnpj:v('briefCnpj'),history:v('briefHistory'),offer:v('briefOffer'),audience:v('briefAudience'),marketingGoal:v('briefMarketingGoal'),important:v('briefImportant'),production:v('briefProduction'),contentIntent:v('briefContentIntent'),mainMessage:v('briefMainMessage'),references:v('briefReferences')}}
function projectBriefingText(b){return [['Responsável',b.responsible],['E-mail',b.email],['Empresa / marca',b.company],['CNPJ',b.cnpj],['História',b.history],['Produtos / serviços',b.offer],['Público',b.audience],['Objetivo do marketing',b.marketingGoal],['Informação importante',b.important],['Produção',b.production],['Intenção dos conteúdos',b.contentIntent],['Mensagem principal',b.mainMessage],['Referências',b.references]].filter(x=>x[1]).map(x=>`${x[0]}: ${x[1]}`).join('\n')}
let projectBriefings=[];
function briefingDocId(p){return 'brief_'+normalizeProjectName(scriptStorageClientId(p)||p?.name||'projeto').replace(/[^a-z0-9]+/g,'_').slice(0,80)}
function briefingForProject(p){if(!p)return null;return projectBriefings.find(b=>b.projectKey===scriptStorageClientId(p)||normalizeProjectName(b.clientName)===normalizeProjectName(p.name))||null}
async function loadProjectBriefings(){
 try{
 const snap=await getDocs(collection(db,'projectBriefings'));projectBriefings=snap.docs.map(d=>({id:d.id,...d.data()}));
 for(const b of projectBriefings.filter(x=>x.publicToken)){try{const ps=await getDoc(doc(db,'publicBriefings',b.publicToken));if(ps.exists()){const pd=ps.data();if(pd.status==='completed'){b.answers=pd.answers||b.answers;b.customQuestions=pd.customQuestions||b.customQuestions||[];b.status='completed';b.briefingText=projectBriefingText(b.answers||{});await setDoc(doc(db,'projectBriefings',b.id),{answers:b.answers,customQuestions:b.customQuestions||[],briefingText:b.briefingText,status:'completed',submittedAt:pd.submittedAt||null,updatedAt:serverTimestamp()},{merge:true})}}}catch(_){}}
 }catch(e){console.warn('Briefings:',e);projectBriefings=[]}
}
function fillProjectBriefing(b,p){
 b={...emptyProjectBriefing(),...(b?.answers||b?.projectBriefingData||{})};const q=selectedProjectQuote(p)||{};const put=(id,val)=>{const el=document.getElementById(id);if(el)el.value=val||''};
 put('briefResponsible',b.responsible||q.contactName||q.responsibleName||q.prospectName||'');put('briefEmail',b.email||q.email||q.prospectEmail||q.clientEmail||'');put('briefCompany',b.company||q.companyName||q.businessName||q.prospectName||p?.name||'');put('briefCnpj',b.cnpj||q.cnpj||'');put('briefHistory',b.history);put('briefOffer',b.offer);put('briefAudience',b.audience);put('briefMarketingGoal',b.marketingGoal);put('briefImportant',b.important);put('briefProduction',b.production);put('briefContentIntent',b.contentIntent);put('briefMainMessage',b.mainMessage);put('briefReferences',b.references)
}
function briefCustomQuestionsData(){
 return [...document.querySelectorAll('#briefCustomQuestions .brief-custom-row')].map((row,i)=>({id:row.dataset.id||('q_'+i),question:row.querySelector('.brief-custom-question')?.value?.trim()||'',answer:row.querySelector('.brief-custom-answer')?.value?.trim()||''})).filter(x=>x.question)
}
function renderBriefCustomQuestions(items=[]){
 const box=document.getElementById('briefCustomQuestions');if(!box)return;box.innerHTML='';
 (items||[]).forEach(x=>addBriefCustomQuestion(x));
}
window.addBriefCustomQuestion=function(item={}){
 const box=document.getElementById('briefCustomQuestions');if(!box)return;
 const row=document.createElement('div');row.className='brief-custom-row briefing-box';row.dataset.id=item.id||('q_'+crypto.randomUUID().slice(0,8));row.style.marginTop='10px';
 row.innerHTML=`<div class="script-editor-grid"><div class="full"><label class="field-label">Pergunta</label><input class="brief-custom-question" placeholder="Digite a pergunta específica deste projeto"></div><div class="full"><label class="field-label">Resposta</label><textarea class="compact brief-custom-answer" placeholder="Será respondida pelo cliente"></textarea></div></div><div class="actions" style="margin-top:8px"><button type="button" class="btn-dark" onclick="this.closest('.brief-custom-row').remove()">Remover pergunta</button></div>`;
 row.querySelector('.brief-custom-question').value=item.question||'';row.querySelector('.brief-custom-answer').value=item.answer||'';box.appendChild(row)
}

function clearBriefingProjectForm(){
 const ids=['briefResponsible','briefEmail','briefCompany','briefCnpj','briefHistory','briefOffer','briefAudience','briefMarketingGoal','briefImportant','briefProduction','briefContentIntent','briefMainMessage','briefReferences'];
 ids.forEach(id=>{const el=document.getElementById(id);if(el)el.value=''});
 const custom=document.getElementById('briefCustomQuestions');if(custom)custom.innerHTML='';
 const status=document.getElementById('briefingStatus');if(status)status.textContent='Briefing pendente';
}
window.changeBriefingProject=function(){
 clearBriefingProjectForm();
 const box=document.getElementById('briefingFormBox');
 if(box)box.style.display='none';
 renderBriefings();
}
window.renderBriefings=function(){
 const sel=document.getElementById('briefingProjectFilter');if(!sel)return;
 const keep=sel.value;
 clearBriefingProjectForm();
 const projects=scriptUnifiedProjects();sel.innerHTML='<option value="">Selecione cliente / projeto</option>'+projects.map(p=>`<option value="${h(p.id)}">${h(scriptProjectLabel(p))}</option>`).join('');sel.value=projects.some(p=>p.id===keep)?keep:'';
 const p=projects.find(x=>x.id===sel.value),box=document.getElementById('briefingFormBox');if(!p){box.style.display='none';return}
 box.style.display='block';const b=briefingForProject(p);fillProjectBriefing(b,p);renderBriefCustomQuestions(b?.customQuestions||[]);
 const type=document.getElementById('briefClientType');type.value=b?.clientType||(p.origin==='agency'?'agency':'avulso');briefTypeChanged();
 const st=document.getElementById('briefingStatus');st.textContent=b?.status==='completed'?'Briefing concluído':'Briefing pendente';
}
window.briefTypeChanged=function(){
 const p=scriptUnifiedProjects().find(x=>x.id===document.getElementById('briefingProjectFilter')?.value);
 const isAgency=document.getElementById('briefClientType')?.value==='agency';
 const exists=p&&p.origin==='agency';
 const btn=document.getElementById('briefCreateAgencyBtn');if(btn)btn.style.display=isAgency&&!exists?'inline-block':'none';
 document.querySelectorAll('.brief-avulso-only').forEach(el=>el.style.display=isAgency?'none':'block');
 const ai=document.getElementById('briefAgencyImportant');if(ai)ai.style.display=isAgency?'block':'none';
}
window.saveIndependentBriefing=async function(){
 const p=scriptUnifiedProjects().find(x=>x.id===document.getElementById('briefingProjectFilter')?.value);if(!p)return alert('Selecione o cliente/projeto.');
 const answers=currentProjectBriefingData(),clientType=document.getElementById('briefClientType')?.value||'avulso',id=briefingDocId(p);
 const customQuestions=briefCustomQuestionsData();
 const previous=briefingForProject(p),publicToken=previous?.publicToken||('b_'+crypto.randomUUID().replaceAll('-',''));
 try{
   await setDoc(doc(db,'projectBriefings',id),{projectKey:scriptStorageClientId(p),clientName:p.name,clientType,sourceQuoteId:p.quoteId||'',sourceAgendaId:p.agendaId||'',answers,customQuestions,briefingText:projectBriefingText(answers),publicToken,status:'completed',updatedAt:serverTimestamp(),updatedBy:ne(currentUser?.email),createdAt:previous?.createdAt||serverTimestamp()},{merge:true});
   await setDoc(doc(db,'publicBriefings',publicToken),{projectKey:scriptStorageClientId(p),clientName:p.name,clientType,answers,customQuestions,status:'completed',updatedAt:serverTimestamp()},{merge:true});
   const local={id,projectKey:scriptStorageClientId(p),clientName:p.name,clientType,answers,customQuestions,briefingText:projectBriefingText(answers),publicToken,status:'completed'};const pos=projectBriefings.findIndex(x=>x.id===id);if(pos>=0)projectBriefings[pos]=local;else projectBriefings.push(local);
   renderBriefings();renderScripts();alert('Briefing salvo. Agora ele fica disponível para este projeto antes da etapa de Roteiros.');
 }catch(e){console.error(e);alert('Não foi possível salvar o briefing. Nenhum dado existente foi apagado.')}
}
window.shareIndependentBriefing=async function(){
 const p=scriptUnifiedProjects().find(x=>x.id===document.getElementById('briefingProjectFilter')?.value);if(!p)return alert('Selecione o cliente/projeto.');
 let b=briefingForProject(p),token=b?.publicToken;
 if(!token){
   token='b_'+crypto.randomUUID().replaceAll('-','');
   const id=briefingDocId(p),clientType=document.getElementById('briefClientType')?.value||'avulso',answers=currentProjectBriefingData();
   const customQuestions=briefCustomQuestionsData();
   try{
     await setDoc(doc(db,'projectBriefings',id),{projectKey:scriptStorageClientId(p),clientName:p.name,clientType,answers,customQuestions,briefingText:projectBriefingText(answers),publicToken:token,status:'pending',updatedAt:serverTimestamp(),updatedBy:ne(currentUser?.email),createdAt:serverTimestamp()},{merge:true});
     await setDoc(doc(db,'publicBriefings',token),{projectKey:scriptStorageClientId(p),clientName:p.name,clientType,answers,customQuestions,status:'pending',updatedAt:serverTimestamp()},{merge:true});
     b={id,projectKey:scriptStorageClientId(p),clientName:p.name,clientType,answers,customQuestions,publicToken:token,status:'pending'};projectBriefings.push(b);
   }catch(e){console.error(e);return alert('Não foi possível preparar o link do briefing.')}
 } else {
   try{await setDoc(doc(db,'publicBriefings',token),{projectKey:b.projectKey,clientName:b.clientName,clientType:b.clientType,answers:b.answers||{},customQuestions:b.customQuestions||[],status:b.status||'pending',updatedAt:serverTimestamp()},{merge:true})}catch(e){}
 }
 const url=new URL('briefing.html',location.href);url.searchParams.set('p',token);
 const data={title:'Briefing Humaniza',text:`Olá! Para começarmos o projeto ${p.name}, responda este briefing:`,url:url.href};
 try{if(navigator.share)await navigator.share(data);else{await navigator.clipboard.writeText(url.href);alert('Link do briefing copiado.')}}catch(e){if(e?.name!=='AbortError'){try{await navigator.clipboard.writeText(url.href);alert('Link do briefing copiado.')}catch(_){prompt('Copie o link do briefing:',url.href)}}}
}
window.prepareAgencyClientFromBriefing=function(){
 const p=scriptUnifiedProjects().find(x=>x.id===document.getElementById('briefingProjectFilter')?.value);if(!p)return;
 const b=currentProjectBriefingData();openClientModal();
 setTimeout(()=>{if(document.getElementById('clientName'))clientName.value=b.company||p.name||'';if(document.getElementById('clientEmail'))clientEmail.value=b.email||'';if(document.getElementById('clientObs'))clientObs.value=`Responsável: ${b.responsible||''}${b.cnpj?'\nCNPJ: '+b.cnpj:''}`},50);
}
window.toggleProjectBriefing=function(){
  const b=document.getElementById('scriptProjectBriefingBody');if(b)b.style.display=b.style.display==='none'?'block':'none';
}
window.toggleScriptCard=function(btn){
  const card=btn.closest('.script-editor-card');if(!card)return;
  card.classList.toggle('collapsed');btn.textContent=card.classList.contains('collapsed')?'Expandir':'Recolher';
}
window.completeScriptCard=function(btn){
  const card=btn.closest('.script-editor-card');if(!card)return;
  const status=card.querySelector('[data-f="status"]');
  if(status)status.value='Finalizado';
  card.classList.add('completed','collapsed');
  const toggle=card.querySelector('[data-action="toggle"]');if(toggle)toggle.textContent='Expandir';
  updateScriptProjectProgress();
}
function updateScriptProjectProgress(){
  const cards=[...document.querySelectorAll('#scriptEditorList .script-editor-card')];
  const done=cards.filter(c=>c.querySelector('[data-f="status"]')?.value==='Finalizado').length;
  cards.forEach(c=>c.classList.toggle('completed',c.querySelector('[data-f="status"]')?.value==='Finalizado'));
  const box=document.getElementById('scriptProjectProgress');if(!box)return;
  const pct=cards.length?Math.round(done/cards.length*100):0;
  box.innerHTML=`<strong>${done} de ${cards.length} conteúdos concluídos</strong><div class="script-progress-bar"><span style="width:${pct}%"></span></div>`;
}
function renderScriptEditorCard(s,i){
 const completed=(s.status||'')==='Finalizado';
 return `<div class="script-editor-card ${completed?'completed collapsed':''}" data-script-id="${s.id||''}" data-new="${s._new?'1':'0'}" data-format="${h(s.format||'Vídeo / Reel')}">
 <div class="script-editor-head"><div><span class="pill">${h(s.format||'Vídeo / Reel')}</span><strong style="margin-left:8px">${h(s.title||`Conteúdo ${i+1}`)}</strong>${completed?'<span class="pill" style="margin-left:8px">Concluído</span>':''}</div><div class="script-editor-head-actions"><button class="btn-dark" type="button" data-action="toggle" onclick="toggleScriptCard(this)">${completed?'Expandir':'Recolher'}</button><button type="button" onclick="completeScriptCard(this)">Concluir</button><button class="btn-danger" type="button" onclick="removeScriptEditorCard(this)">Remover</button></div></div>
 <div class="script-editor-grid">
 <div class="full"><label class="field-label">Título / tema</label><input data-f="title" value="${scriptEditorField(s.title)}"></div>
 <div><label class="field-label">Status</label><select data-f="status" onchange="updateScriptProjectProgress()">${['Escrevendo','Aguardando aprovação','Aprovado','Gravar','Editando','Finalizado'].map(x=>`<option ${x===(s.status||'Escrevendo')?'selected':''}>${x}</option>`).join('')}</select></div>
 <div><label class="field-label">Data da captação</label><input data-f="captureDate" type="date" value="${scriptEditorField(s.captureDate||document.getElementById('builderCaptureDate')?.value)}"></div>
 <div><label class="field-label">Data da postagem</label><input data-f="publishDate" type="date" value="${scriptEditorField(s.publishDate||'')}"></div>
 <div><label class="field-label">Horário da postagem</label><input data-f="publishTime" type="time" value="${scriptEditorField(s.publishTime||'')}"></div>
 <div class="full"><label class="field-label">Imagem / foto de referência</label><input data-f="imageLink" value="${scriptEditorField(s.imageLink)}" placeholder="https://..."></div>
 <div class="full"><label class="field-label">Objetivo</label><textarea class="compact" data-f="goal">${scriptEditorField(s.goal)}</textarea></div>
 <div class="full"><label class="field-label">Gancho</label><textarea class="compact" data-f="hook">${scriptEditorField(s.hook)}</textarea></div>
 ${editorFormatFields(s,i)}
 <div class="full"><label class="field-label">CTA</label><textarea class="compact" data-f="cta">${scriptEditorField(s.cta)}</textarea></div>
 <div class="full"><label class="field-label">Links de referência</label><textarea class="compact" data-f="referenceLinks" placeholder="Um link por linha">${scriptEditorField(scriptLinksText(s.referenceLinks,s.referenceLink))}</textarea></div>
 <div class="full"><label class="field-label">Links do Drive / materiais</label><textarea class="compact" data-f="driveLinks" placeholder="Um link por linha">${scriptEditorField(scriptLinksText(s.driveLinks,s.approvalLink))}</textarea></div>
 </div></div>`;
}
window.removeScriptEditorCard=function(btn){if(confirm('Remover este item da tela? A exclusão no Firebase acontece ao salvar o projeto.'))btn.closest('.script-editor-card')?.remove()}
window.buildScriptTemplates=function(){
 const project=selectedUnifiedProject();if(!project)return alert('Selecione primeiro o cliente/projeto.');
 const counts=[['Vídeo / Reel',Number(builderReels.value||0)],['Carrossel',Number(builderCarousels.value||0)],['Estático',Number(builderStatics.value||0)],['Sessão de fotos',Number(document.getElementById('builderPhotos')?.value||0)]];
 const pd=photoDefaultsFromProject(project);
 const newItems=[];counts.forEach(([format,n])=>{for(let i=0;i<n;i++)newItems.push({_new:true,format,status:'Escrevendo',captureDate:builderCaptureDate.value||pd.captureDate||'',title:'',imageLink:'',goal:'',hook:'',scenes:'',cards:'',artText:'',artDirection:'',cta:'',referenceLinks:[],driveLinks:[],referenceLink:'',approvalLink:'',...(format==='Sessão de fotos'?{photoHours:pd.photoHours,treatedPhotos:pd.treatedPhotos,rawPhotosDelivery:pd.rawPhotosDelivery,rawPhotosCustom:pd.rawPhotosCustom,deliveryDays:pd.deliveryDays?String(pd.deliveryDays):'',deliveryCustom:pd.deliveryCustom,photoObjective:'',photoLocation:pd.photoLocation,photoNotes:''}:{})})});
 if(!newItems.length)return alert('Informe pelo menos 1 Reel, Carrossel, Estático ou Sessão de fotos.');
 scriptEditorList.insertAdjacentHTML('beforeend',newItems.map((s,i)=>renderScriptEditorCard(s,scriptEditorList.children.length+i)).join(''));
 builderReels.value=builderCarousels.value=builderStatics.value=0;if(document.getElementById('builderPhotos'))builderPhotos.value=0;
 updateScriptProjectProgress();
}
function currentScriptEditorData(){
 return [...document.querySelectorAll('#scriptEditorList .script-editor-card')].map(card=>{
   const get=f=>card.querySelector(`[data-f="${f}"]`)?.value?.trim?.()||'';
   const refs=scriptLinksArray(get('referenceLinks')),drives=scriptLinksArray(get('driveLinks'));
   return {id:card.dataset.scriptId||'',_new:card.dataset.new==='1',format:card.dataset.format||'Vídeo / Reel',title:get('title'),status:get('status')||'Escrevendo',captureDate:get('captureDate'),publishDate:get('publishDate'),publishTime:get('publishTime'),imageLink:get('imageLink'),goal:get('goal'),hook:get('hook'),scenes:get('scenes'),cardCount:get('cardCount'),cards:get('cards'),artText:get('artText'),artDirection:get('artDirection'),cta:get('cta'),referenceLinks:refs,driveLinks:drives,referenceLink:refs[0]||'',approvalLink:drives[0]||'',photoHours:get('photoHours'),treatedPhotos:get('treatedPhotos'),rawPhotosDelivery:get('rawPhotosDelivery'),rawPhotosCustom:get('rawPhotosCustom'),deliveryDays:get('deliveryDays'),deliveryCustom:get('deliveryCustom'),photoObjective:get('photoObjective'),photoLocation:get('photoLocation'),photoNotes:get('photoNotes')};
 });
}
window.saveScriptProject=async function(){
 const project=selectedUnifiedProject();if(!project)return alert('Selecione o cliente/projeto.');
 const clientId=scriptStorageClientId(project),items=currentScriptEditorData();
 if(!items.length)return alert('Crie os conteúdos antes de salvar.');
 const savedBrief=briefingForProject(project),projectBriefingData=savedBrief?.answers||{},projectBriefing=savedBrief?.briefingText||projectBriefingText(projectBriefingData);
 const selectedProjectId=document.getElementById('scriptsClientFilter')?.value||'';
 try{
   for(const x of items){
     let scriptId=x.id;
     const old=x.id?scripts.find(s=>s.id===x.id):null;
     if(!scriptId)scriptId='rp_'+crypto.getRandomValues(new Uint32Array(2)).reduce((a,n)=>a+n.toString(36),'').slice(0,16);
     const mode=x.publishDate?'defined':'tbd';
     const data={...collectionDataWithClient(clientId),clientName:project.name,projectOrigin:project.origin,sourceQuoteId:project.quoteId||'',sourceAgendaId:project.agendaId||'',title:x.title,format:x.format,status:x.status,responsibleEmail:old?.responsibleEmail||'',responsibilityState:old?.responsibilityState||'unassigned',participantEmails:old?.participantEmails||[],participantNames:old?.participantNames||[],scheduleMode:mode,publishDate:x.publishDate||'',publishTime:x.publishTime||'',captureDate:x.captureDate,projectBriefingData,projectBriefing,briefing:projectBriefing,imageLink:x.imageLink,month:x.publishDate?monthFromDate(x.publishDate):(old?.month||''),goal:x.goal,hook:x.hook,scenes:x.scenes,cardCount:x.cardCount?Number(x.cardCount):null,cards:x.cards,artText:x.artText,artDirection:x.artDirection,cta:x.cta,approvalLink:x.approvalLink,referenceLink:x.referenceLink,referenceLinks:x.referenceLinks||[],driveLinks:x.driveLinks||[],photoHours:x.photoHours?Number(x.photoHours):null,treatedPhotos:x.treatedPhotos?Number(x.treatedPhotos):null,rawPhotosDelivery:x.rawPhotosDelivery||'',rawPhotosCustom:x.rawPhotosCustom||'',deliveryDays:x.deliveryDays||'',deliveryCustom:x.deliveryCustom||'',photoObjective:x.photoObjective||'',photoLocation:x.photoLocation||'',photoNotes:x.photoNotes||'',clientNote:old?.clientNote||'',updatedAt:serverTimestamp(),updatedBy:ne(currentUser?.email),updatedByName:actorName()};
     await setDoc(doc(db,'scripts',scriptId),old?data:{...data,createdAt:serverTimestamp(),createdBy:ne(currentUser?.email),createdByName:actorName(),history:[]},{merge:true});
     await syncScriptCalendar(scriptId,data);
     const local={...(old||{}),...data,id:scriptId,createdAt:old?.createdAt||new Date()};
     const pos=scripts.findIndex(s=>s.id===scriptId);if(pos>=0)scripts[pos]=local;else scripts.push(local);
   }
   if(document.getElementById('scriptsClientFilter'))scriptsClientFilter.value=selectedProjectId;
   renderScripts();
   if(document.getElementById('scriptsClientFilter'))scriptsClientFilter.value=selectedProjectId;
   alert('Projeto salvo no Firebase. Os roteiros permanecem no projeto e as datas de postagem foram sincronizadas com o calendário.');
 }catch(e){console.error(e);alert('Não foi possível salvar o projeto completo. Nada foi apagado automaticamente.');}
}
window.renderScripts=function(){
 if(btnShareScriptsPage)btnShareScriptsPage.style.display=isAdmin?'inline-block':'none';
 if(btnNewScriptProject)btnNewScriptProject.style.display=isAdmin?'inline-block':'none';
 if(saveScriptProjectBtn)saveScriptProjectBtn.style.display=isAdmin?'inline-block':'none';
 const cf=document.getElementById('scriptsClientFilter'),projects=scriptUnifiedProjects();
 if(cf){
   const keep=cf.value;
   cf.innerHTML='<option value="">Selecione cliente / projeto</option>'+projects.map(p=>`<option value="${h(p.id)}">${h(scriptProjectLabel(p))}</option>`).join('');
   cf.value=projects.some(p=>p.id===keep)?keep:'';
 }
 const p=selectedUnifiedProject(),origin=document.getElementById('scriptClientOrigin');
 if(origin)origin.textContent=!p?'':(p.origin==='agency'?'Cliente já cadastrado na agência.':p.origin==='quote'?'Cliente avulso vindo de orçamento aprovado.':p.origin==='agenda'?'Cliente/prospect avulso encontrado na agenda.':'Projeto já existente em Roteiros.');
 if(p?.captureDate&&document.getElementById('builderCaptureDate')&&!builderCaptureDate.value)builderCaptureDate.value=p.captureDate;
 if(!p){scriptEditorList.innerHTML='<div class="empty">Selecione um cliente da agência ou um cliente avulso para abrir o projeto.</div>';return;}
 const storageId=scriptStorageClientId(p);
 const data=(scripts||[]).filter(s=>s.clientId===storageId||normalizeProjectName(s.clientName||s.projectName)===normalizeProjectName(p.name)).sort((a,b)=>(a.createdAt?.toMillis?.()||0)-(b.createdAt?.toMillis?.()||0));
 const brief=briefingForProject(p);
 const briefStatus=brief?.status==='completed'?'<div class="briefing-box"><strong>Briefing concluído ✓</strong><p>As informações deste projeto estão salvas na área Briefings.</p></div>':'<div class="briefing-box"><strong>Briefing pendente</strong><p>Preencha a área Briefings antes de iniciar a produção.</p></div>';
 scriptEditorList.innerHTML=briefStatus+(data.length?data.map(renderScriptEditorCard).join(''):'<div class="empty">Nenhum conteúdo criado ainda. Informe as quantidades e clique em “Criar estrutura”.</div>');
 updateScriptProjectProgress();
}
window.renderCaptures=function(){ if(btnCaptureNew) btnCaptureNew.style.display=isAdmin?'inline-block':'none'; const data=filterByCompetence(scopeByClient(captures),'capturesMonthFilter','capturesYearFilter'); capturesGrid.innerHTML=data.length?data.map(ca=>{const c=clientById(ca.clientId); return `<div class="planning-card"><h3>${ca.title}</h3><div class="meta"><span class="pill">${c?.name||'Cliente'}</span><span class="pill">${ca.status||''}</span><span class="pill">${responsibilityLabel(ca)}</span>${ca.date?`<span class="pill">${formatDate(ca.date)}</span>`:''}</div><div class="script-block"><b>Checklist</b><p>${ca.checklist||''}</p></div>${isAdmin?`<div class="script-block"><b>Observações internas</b><p>${ca.notes||''}</p></div>`:''}${ca.clientNote?`<div class="comment-box"><b>Observação do cliente:</b><br>${ca.clientNote}</div>`:''}<div class="actions">${isAdmin?`<button class="btn-dark" onclick="editCapture('${ca.id}')">Editar</button>`:`<button class="btn-dark" onclick="commentCapture('${ca.id}')">Comentar</button>`}</div></div>`}).join(''):'<div class="empty">Nenhuma captação cadastrada.</div>'; }
window.renderLibrary=function(){ const c=isAdmin?currentVisibleClient():clients[0]; if(!libraryContent) return; if(!c){libraryContent.innerHTML='<div class="empty">Nenhum cliente selecionado.</div>'; return;} libraryContent.innerHTML=`<div class="client-header"><div class="client-title-row">${c.logo?`<div class="brand-logo-box"><img src="${c.logo}" alt="Logo ${c.name}"></div>`:''}<div><h2>${c.name}</h2><p style="color:#A6A6A6;margin:0">Biblioteca da marca do cliente.</p></div></div></div><div class="brand-library-grid"><div class="library-item"><h3>🎨 Identidade</h3><p><b>Logo:</b> ${c.logo?'Cadastrada':'Não informada'}</p><p><b>Observações:</b> ${c.obs||'Nenhuma observação.'}</p></div><div class="library-item"><h3>🔗 Links</h3><p><b>Drive:</b> ${c.drive?`<a href="${c.drive}" target="_blank" style="color:#F2F2F0">Abrir Drive</a>`:'Não informado'}</p><p><b>Instagram:</b> ${c.instagram||'Não informado'}</p></div></div>`; }

window.renderInternal = function(){
  if(!isAdmin && !isTeamMember) return;
  fillInternalStatus();
  const title = document.getElementById('internalViewTitle');
  const summary = document.getElementById('teamWorkSummary');
  const demandSection = document.getElementById('teamClientDemandSection');
  if(title) title.textContent = isTeamMember && !isAdmin ? 'Meu trabalho' : 'Painel interno da agência';
  if(summary) summary.style.display = isTeamMember && !isAdmin ? 'grid' : 'none';
  if(demandSection)demandSection.style.display='none';const uwa=document.getElementById('unifiedWorkArea');if(uwa)uwa.style.display=isTeamMember&&!isAdmin?'block':'none';
  const q = (document.getElementById('internalSearch')?.value || '').toLowerCase();
  const data = internalTasks.filter(t => (t.title||'').toLowerCase().includes(q) || (t.client||'').toLowerCase().includes(q));
  document.getElementById('internalBoard').innerHTML = internalStatuses.map(st => {
    const items = data.filter(t => t.status === st);
    return `<div class="column"><div class="column-title">${st}<span class="count">${items.length}</span></div>${items.length ? items.map(internalCard).join('') : '<div class="empty">Nada aqui</div>'}</div>`;
  }).join('');
  if(isTeamMember && !isAdmin){
    const mw=myWork(currentUser?.email),all=mw.map(i=>i.x);
    const open=all.filter(x=>!['Entregue','Aprovado','Publicado'].includes(x.status)).length;
    const late=all.filter(isLate).length;
    const review=all.filter(x=>['Pronto para Revisão','Revisão interna'].includes(x.status)).length;
    const waiting=demands.filter(x=>x.status==='Aguardando você').length;
    summary.innerHTML=`<div class="stat clickable" onclick="setWorkFilter('Próximos')"><p>Em aberto</p><strong>${open}</strong></div><div class="stat clickable" onclick="setWorkFilter('Atrasados')"><p>Atrasadas</p><strong>${mw.filter(i=>wGroup(i.x,i.k)==='Atrasados').length}</strong></div><div class="stat clickable" onclick="setWorkFilter('Em revisão')"><p>Em revisão</p><strong>${mw.filter(i=>wGroup(i.x,i.k)==='Em revisão').length}</strong></div><div class="stat clickable" onclick="setWorkFilter('Aguardando cliente')"><p>Aguardando cliente</p><strong>${mw.filter(i=>wGroup(i.x,i.k)==='Aguardando cliente').length}</strong></div>`;renderUnifiedWork();
    const board=document.getElementById('teamClientDemandBoard');
    if(board) board.innerHTML=demandStatuses.map(st=>{const items=demands.filter(d=>d.status===st);return `<div class="column"><div class="column-title">${st}<span class="count">${items.length}</span></div>${items.length?items.map(demandCard).join(''):'<div class="empty">Nada aqui</div>'}</div>`}).join('');
  }
}
function internalCard(t){
  const canEdit = isAdmin || currentTeamMember?.permission === 'Líder' || t.assignedEmail === currentUser?.email;
  const assignedInfo = isAdmin ? `<span class="pill">${responsibilityLabel(t)}</span>` : '';
  const comments = t.internalComment ? `<div class="comment-box"><b>Comentário interno:</b><br>${t.internalComment}</div>` : '';
  const actions = canEdit ? `<div class="actions">
    <button class="btn-dark" onclick="moveInternal('${t.id}',-1)">← Voltar</button>
    <button class="btn-dark" onclick="moveInternal('${t.id}',1)">Avançar →</button>
    <button class="btn-blue" onclick="quickComment('${t.id}')">Comentar</button>
    <button class="btn-green" onclick="finishInternal('${t.id}')">Concluir</button>
    ${isAdmin || currentTeamMember?.permission === 'Líder' ? `<button class="btn-gold" onclick="editInternal('${t.id}')">Editar</button>` : ''}
  </div>` : '';
  return `<div class="task ${isLate(t)?'late':''} ${t.priority==='Urgente'?'urgent':''}">
    <div class="icon-actions">${(isAdmin || currentTeamMember?.permission === 'Líder') ? `<button class="icon" onclick="editInternal('${t.id}')">✏️</button>` : ''}</div>
    <h4>${t.title}</h4>
    <span class="badge b-blue">${t.type||'Interno'}</span>${isLate(t)?'<span class="badge b-red">Atrasada</span>':''}${t.priority==='Urgente'?'<span class="badge b-yellow">Urgente</span>':''}
    <p>${t.desc||''}</p>
    <div class="meta">${t.client?`<span class="pill">${t.client}</span>`:''}${assignedInfo}${t.date?`<span class="pill">Prazo: ${formatDate(t.date)}</span>`:''}${t.value?`<span class="pill">${t.value}</span>`:''}</div>
    ${comments}
    ${actions}
  </div>`;
}

window.renderTeam = function(){
  if(!isAdmin) return;
  const grid = document.getElementById('teamGrid');
  const summary = document.getElementById('teamSummary');
  const q = (document.getElementById('teamSearch')?.value || '').toLowerCase();
  const list = teamMembers.filter(m => (m.name||'').toLowerCase().includes(q) || (m.email||'').toLowerCase().includes(q) || (m.role||'').toLowerCase().includes(q));

  const openInternal = internalTasks.filter(t => t.status !== 'Entregue');
  const openDemands = demands.filter(d => !['Aprovado','Publicado'].includes(d.status));
  const totalOpen = openInternal.length + openDemands.length;
  const totalLate = [...internalTasks, ...demands].filter(isLate).length;
  const review = internalTasks.filter(t => t.status === 'Pronto para Revisão').length + demands.filter(d => ['Aguardando aprovação','Revisão interna'].includes(d.status)).length;

  summary.innerHTML = `
    <div class="stat"><p>Tarefas + demandas abertas</p><strong>${totalOpen}</strong></div>
    <div class="stat"><p>Atrasadas</p><strong>${totalLate}</strong></div>
    <div class="stat"><p>Em revisão / aprovação</p><strong>${review}</strong></div>
    <div class="stat"><p>Equipe ativa</p><strong>${teamMembers.filter(m => m.status !== 'Finalizado').length}</strong></div>
  `;

  grid.innerHTML = list.length ? list.map(m => {
    const memberEmail = (m.email || '').trim().toLowerCase();
    const tasks = internalTasks.filter(t => (t.assignedEmail || '').trim().toLowerCase() === memberEmail);
    const memberDemands = demands.filter(d => (d.assignedEmail || '').trim().toLowerCase() === memberEmail);
    const openTasks = tasks.filter(t => t.status !== 'Entregue').length;
    const openClientDemands = memberDemands.filter(d => !['Aprovado','Publicado'].includes(d.status)).length;
    const open = openTasks + openClientDemands;
    const late = [...tasks, ...memberDemands].filter(isLate).length;
    const review = tasks.filter(t => t.status === 'Pronto para Revisão').length + memberDemands.filter(d => ['Aguardando aprovação','Revisão interna'].includes(d.status)).length;

    return `<div class="card">${m.photoUrl?`<div class="avatar-box"><img src="${m.photoUrl}" alt="${m.name}"></div>`:''}<h3>${m.name}</h3><p>${m.role || 'Sem função cadastrada.'}</p><div class="meta"><span class="pill">${m.permission || 'Operacional'}</span><span class="pill">${m.status || 'Ativo'}</span><span class="pill">${m.email || ''}</span><span class="pill">${open} abertas</span><span class="pill">${openClientDemands} demandas cliente</span><span class="pill">${late} atrasadas</span><span class="pill">${review} revisão/aprovação</span></div><div class="actions"><button onclick="openMemberPanel('${m.id}')">Abrir painel</button><button class="btn-dark" onclick="editTeamMember('${m.id}')">Editar</button></div></div>`;
  }).join('') : '<div class="empty">Nenhum funcionário cadastrado.</div>';
  fillTeamSelects();
}

window.renderClients = function(){
  if(!isAdmin) return;
  const grid = document.getElementById('clientsGrid');
  const q = (document.getElementById('clientSearch')?.value||'').toLowerCase();
  const list = clients.filter(c => (c.name||'').toLowerCase().includes(q) || (c.instagram||'').toLowerCase().includes(q));
  grid.innerHTML = list.length ? list.map(c => {
    const ds = demands.filter(d => d.clientId === c.id || d.clientEmail === c.email);
    const approval = ds.filter(d => d.status === 'Aguardando aprovação').length;
    const waiting = ds.filter(d => d.status === 'Aguardando você').length;
    const progress = calcProgress(ds);
    return `<div class="card">${c.logo?`<div class="brand-logo-box"><img src="${c.logo}" alt="Logo ${c.name}"></div>`:''}<h3>${c.name}</h3><p>${c.obs||'Sem observações.'}</p><div class="meta"><span class="pill">${c.status||'Ativo'}</span>${c.email?`<span class="pill">${c.email}</span>`:''}${c.instagram?`<span class="pill">${c.instagram}</span>`:''}<span class="pill">${approval} aprovação</span><span class="pill">${waiting} aguardando cliente</span></div><div class="progress"><span style="width:${progress}%"></span></div><div class="actions"><button onclick="renderClientPanel('${c.id}'); showClientPanelTab()">Abrir tela</button><button class="btn-blue" onclick="openDemandModal('${c.id}')">+ Demanda</button><button class="btn-dark" onclick="editClient('${c.id}')">Editar</button>${c.whatsapp?`<button class="btn-green" onclick="openWhats('${c.whatsapp}','Oi! Tudo bem? Passando para atualizar as demandas da ${c.name}.')">WhatsApp</button>`:''}</div></div>`;
  }).join('') : '<div class="empty">Nenhum cliente cadastrado.</div>';
  fillSelects();
}
function showClientPanelTab(){
  document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
  if(isAdmin) document.querySelectorAll('.tab')[5].classList.add('active');
  ['dashboard','internal','team','clients','demands'].forEach(v => document.getElementById(v+'View').classList.add('hidden'));
  document.getElementById('clientPanelView').classList.remove('hidden');
}
window.showClientPanelTab = showClientPanelTab;

window.renderDemands = function(){
  if(!isAdmin && !isTeamMember) return;
  if(isAdmin) fillSelects();
  const filterEl = document.getElementById('agencyClientFilter');
  if(filterEl) filterEl.style.display = isAdmin ? '' : 'none';
  const filter = isAdmin && filterEl ? filterEl.value : 'Todos';
  const data = filter === 'Todos' ? demands : demands.filter(d => d.clientId === filter);
  renderBulkBar();const sv=document.getElementById('selectVisibleBtn');if(sv)sv.style.display=isAdmin?'':'none';document.getElementById('demandsBoard').innerHTML = demandStatuses.map(st => {
    const items = data.filter(d => d.status === st);
    return `<div class="column"><div class="column-title">${st}<span class="count">${items.length}</span></div>${items.length ? items.map(demandCard).join('') : '<div class="empty">Nada aqui</div>'}</div>`;
  }).join('');
}
window.renderClientPanel = function(clientId){
  selectedClientId = clientId || selectedClientId || clients[0]?.id;
  const c = clientById(selectedClientId);
  const content = document.getElementById('clientPanelContent');
  if(!c){ content.innerHTML = '<div class="empty">Nenhum cliente vinculado a este login ainda.</div>'; return; }
  const data = demands.filter(d => d.clientId === c.id || d.clientEmail === c.email);
  const approval = data.filter(d => d.status === 'Aguardando aprovação');
  const waiting = data.filter(d => d.status === 'Aguardando você');
  const late = data.filter(isLate);
  const progress = calcProgress(data);
  content.innerHTML = `<div class="client-header"><div class="client-title-row">${c.logo?`<div class="brand-logo-box"><img src="${c.logo}" alt="Logo ${c.name}"></div>`:''}<div><h2>${c.name}</h2><p style="color:#A6A6A6;margin:0">${c.obs||''}</p></div></div><div class="meta"><span class="pill">${c.status||'Ativo'}</span>${c.instagram?`<span class="pill">${c.instagram}</span>`:''}${c.drive?'<span class="pill">Drive cadastrado</span>':''}</div><div class="actions">${isAdmin?`<button class="btn-blue" onclick="openDemandModal('${c.id}')">+ Nova demanda</button>`:''}${c.drive?`<button class="btn-dark" onclick="window.open('${c.drive}','_blank')">Abrir Drive</button>`:''}${c.whatsapp?`<button class="btn-green" onclick="openWhats('${c.whatsapp}','Oi! Tudo bem? Passando para atualizar as demandas da ${c.name}.')">WhatsApp</button>`:''}</div></div><div class="stats"><div class="stat"><p>Total</p><strong>${data.length}</strong></div><div class="stat"><p>Aguardando aprovação</p><strong>${approval.length}</strong></div><div class="stat"><p>Aguardando você</p><strong>${waiting.length}</strong></div><div class="stat"><p>Progresso do mês</p><strong>${progress}%</strong><div class="progress"><span style="width:${progress}%"></span></div></div></div><div class="todo-list"><div class="todo"><h4>✅ Aprovar conteúdo</h4><p>${approval.length?`${approval.length} demanda(s) aguardando aprovação.`:'Nenhuma aprovação pendente.'}</p></div><div class="todo"><h4>📩 Aguardando você</h4><p>${waiting.length?`${waiting.length} item(ns) precisam de retorno ou material.`:'Nada pendente com o cliente.'}</p></div><div class="todo"><h4>⚠️ Atenção</h4><p>${late.length?`${late.length} demanda(s) atrasada(s).`:'Tudo dentro do prazo.'}</p></div></div><div class="board-wrap"><div class="board">${demandStatuses.map(st => { const items=data.filter(d => d.status===st); return `<div class="column"><div class="column-title">${st}<span class="count">${items.length}</span></div>${items.length?items.map(demandCard).join(''):'<div class="empty">Nada aqui</div>'}</div>` }).join('')}</div></div>`;
}
function demandCard(d){
  const c = clientById(d.clientId), late = isLate(d), approved = ['Aprovado','Publicado'].includes(d.status), adjust = d.status === 'Ajustes solicitados', waiting = d.status === 'Aguardando você', reviewInternal=d.status==='Revisão interna';
  const responsibility = waiting ? (isAdmin ? `Aguardando cliente${c?.name?`: ${c.name}`:''}` : (isTeamMember ? 'Aguardando cliente' : 'Aguardando você')) : (reviewInternal ? 'Aguardando revisão do admin' : responsibilityLabel(d));
  let actions='';
  if(isAdmin){
    actions=`<button class="btn-dark" onclick="editDemand('${d.id}')">Editar</button>${reviewInternal?`<button class="btn-green" onclick="approveInternalDemand('${d.id}')">Aprovar internamente</button><button class="btn-gold" onclick="requestTeamAdjust('${d.id}')">Solicitar ajuste</button>`:''}<button class="btn-gold" onclick="waitingClient('${d.id}')">Aguardar cliente</button>`;
  } else if(isTeamMember){
    actions=`${!reviewInternal && !approved?`<button class="btn-green" onclick="sendDemandReview('${d.id}')">Enviar para revisão</button>`:''}<button class="btn-blue" onclick="teamDemandComment('${d.id}')">Comentar</button>`;
  } else {
    actions=d.status==='Aguardando aprovação'?`<button class="btn-green" onclick="approveDemand('${d.id}')">Aprovar</button><button class="btn-dark" onclick="requestAdjust('${d.id}')">Pedir ajuste</button>`:'';
  }
  return `<div class="task ${late?'late':''} ${approved?'approved':''} ${adjust?'adjust':''}">${isAdmin?`<label class="selectline"><input type="checkbox" ${selectedDemandIds.has(d.id)?'checked':''} onchange="toggleDemandSelection('${d.id}',this.checked)">Selecionar</label>`:''}<div class="icon-actions">${isAdmin?`<button class="icon" onclick="editDemand('${d.id}')">✏️</button>`:''}</div><h4>${d.title}</h4><span class="badge b-blue">${d.type}</span>${late?'<span class="badge b-red">Atrasada</span>':''}${d.priority==='Urgente'?'<span class="badge b-yellow">Urgente</span>':''}${waiting?`<span class="badge b-yellow">${isAdmin||isTeamMember?'Aguardando cliente':'Aguardando você'}</span>`:''}${reviewInternal?'<span class="badge b-yellow">Revisão interna</span>':''}${approved?'<span class="badge b-green">Aprovado</span>':''}${adjust?'<span class="badge b-yellow">Ajuste</span>':''}<p>${d.desc||''}</p>${d.imageUrl?`<img class="demand-image" src="${d.imageUrl}" alt="Imagem da demanda">`:''}<div class="meta"><span class="pill">${c?c.name:'Cliente'}</span><span class="pill">${responsibilityLabel(d)}</span>${d.date?`<span class="pill">Prazo: ${formatDate(d.date)}</span>`:''}</div><span class="responsibility">${responsibility}</span>${d.comment?`<p><b>Comentário:</b> ${d.comment}</p>`:''}<div class="actions">${actions}${d.imageUrl?`<button class="btn-blue" onclick="window.open('${d.imageUrl}','_blank')">Abrir imagem</button>`:''}${d.link?`<button class="btn-blue" onclick="window.open('${d.link}','_blank')">Ver material no Drive</button>`:''}</div></div>`;
}
function fillSelects(){
  if(!isAdmin) return;
  document.getElementById('demandClient').innerHTML = clients.map(c => `<option value="${c.id}">${c.name}</option>`).join('');
  {
    const agencyFilter=document.getElementById('agencyClientFilter');
    const currentAgencyClient=agencyFilter?.value||'Todos';
    agencyFilter.innerHTML='<option value="Todos">Todos</option>'+clients.map(c=>`<option value="${c.id}">${c.name}</option>`).join('');
    if([...agencyFilter.options].some(o=>o.value===currentAgencyClient)) agencyFilter.value=currentAgencyClient;
  }
  fillTeamSelects();
}
function fillTeamSelects(){
  const demandAssigned = document.getElementById('demandAssigned');
  if(demandAssigned) demandAssigned.innerHTML = '<option value="">Selecionar responsável</option><option value="__HUMANIZA_OUT_OF_SCOPE__">Humaniza não cuida desta frente</option>' + teamMembers.map(m => `<option value="${m.email}">${m.name} • ${m.role || 'Equipe'}</option>`).join('');
  const internalAssigned = document.getElementById('internalAssigned');
  if(internalAssigned) internalAssigned.innerHTML = '<option value="">Selecionar responsável</option><option value="__HUMANIZA_OUT_OF_SCOPE__">Humaniza não cuida desta frente</option>' + teamMembers.map(m => `<option value="${m.email}">${m.name} • ${m.role || 'Equipe'}</option>`).join('');
}
function fillInternalStatus(){ if(!isAdmin) return; document.getElementById('internalStatus').innerHTML = internalStatuses.map(s => `<option>${s}</option>`).join(''); fillTeamSelects(); }



window.openMacroModal=function(){editingMacro=null;fillPlanningSelects();macroModalTitle.textContent='Novo planejamento macro';deleteMacroBtn.style.display='none';['macroTitle','macroMonth','macroGoal','macroDates','macroStrategy','macroClientNote'].forEach(id=>document.getElementById(id).value='');macroStatus.value='Em elaboração';macroClient.value=getScopedClientId();macroModal.classList.add('active')}
window.editMacro=function(id){const m=macroPlans.find(x=>x.id===id);if(!m)return;editingMacro=id;fillPlanningSelects();macroModalTitle.textContent='Editar planejamento macro';deleteMacroBtn.style.display='inline-block';macroClient.value=m.clientId||'';macroTitle.value=m.title||'';macroMonth.value=m.month||'';macroStatus.value=m.status||'Em elaboração';macroGoal.value=m.goal||'';macroDates.value=m.dates||'';macroStrategy.value=m.strategy||'';macroClientNote.value=m.clientNote||'';macroModal.classList.add('active')}
window.saveMacro=async function(){const data={...collectionDataWithClient(macroClient.value),title:macroTitle.value.trim(),month:macroMonth.value,status:macroStatus.value,goal:macroGoal.value.trim(),dates:macroDates.value.trim(),strategy:macroStrategy.value.trim(),clientNote:macroClientNote.value.trim(),updatedAt:serverTimestamp()};if(!data.title){alert('Coloque o nome da campanha.');return} if(editingMacro) await setDoc(doc(db,'macroPlans',editingMacro),data,{merge:true}); else await addDoc(collection(db,'macroPlans'),{...data,createdAt:serverTimestamp()});closeModals()}
window.deleteMacro=async function(){if(editingMacro&&confirm('Excluir planejamento macro?')){await deleteDoc(doc(db,'macroPlans',editingMacro));closeModals()}}
window.approveMacro=async function(id){await setDoc(doc(db,'macroPlans',id),{status:'Aprovado',updatedAt:serverTimestamp()},{merge:true});alert('Campanha macro aprovada. Agora o calendário pode seguir.')}
window.commentMacro=async function(id){const text=prompt('Observação sobre a campanha macro:');if(text!==null) await setDoc(doc(db,'macroPlans',id),{clientNote:text,status:'Ajustes solicitados',updatedAt:serverTimestamp()},{merge:true})}
window.openCalendarModal=function(){editingCalendar=null;fillPlanningSelects();calendarModalTitle.textContent='Novo item no calendário';deleteCalendarBtn.style.display='none';googleCalendarBtn.style.display='none';['calendarDate','calendarStartTime','calendarEndTime','calendarTheme','calendarLocation','calendarTeamNote','calendarClientNote'].forEach(id=>{const el=document.getElementById(id);if(el)el.value=''});calendarVisibility.value='Visível para cliente';calendarResponsible.value='';calendarStatus.value='Agendado';calendarFormat.value='Outro';calendarEventType.value='Conteúdo';calendarClient.value=getScopedClientId();fillP('calendarParticipants',[]);calendarModal.classList.add('active')}
window.editCalendarItem=function(id){const item=calendarItems.find(x=>x.id===id);if(!item)return;editingCalendar=id;fillPlanningSelects();calendarModalTitle.textContent='Editar item do calendário';deleteCalendarBtn.style.display=isAdmin?'inline-block':'none';googleCalendarBtn.style.display='inline-block';calendarClient.value=item.clientId||'';calendarDate.value=item.date||'';calendarStartTime.value=item.startTime||'';calendarEndTime.value=item.endTime||'';calendarEventType.value=item.eventType||'Conteúdo';calendarFormat.value=item.format||'Outro';calendarTheme.value=item.theme||'';calendarLocation.value=item.location||'';calendarStatus.value=item.status||'Agendado';calendarVisibility.value=item.visibility||'Visível para cliente';calendarResponsible.value=selectResponsibilityValue(item);fillP('calendarParticipants',item.participants||[]);calendarTeamNote.value=item.teamNote||'';calendarClientNote.value=item.clientNote||'';calendarModal.classList.add('active')}
window.saveCalendarItem=async function(){const responsibility=responsibilityData(calendarResponsible.value);const participants=pEmails('calendarParticipants');const data={...collectionDataWithClient(calendarClient.value),date:calendarDate.value,month:monthFromDate(calendarDate.value),startTime:calendarStartTime.value||'',endTime:calendarEndTime.value||'',eventType:calendarEventType.value,format:calendarFormat.value,theme:calendarTheme.value.trim(),location:calendarLocation.value.trim(),status:calendarStatus.value,visibility:calendarVisibility.value,...responsibility,participants,teamNote:calendarTeamNote.value.trim(),clientNote:calendarClientNote.value.trim(),updatedAt:serverTimestamp()};if(!data.date||!data.theme){alert('Coloque data e título/tema.');return} if(data.endTime&&data.startTime&&data.endTime<=data.startTime){alert('O horário final precisa ser depois do horário inicial.');return} if(editingCalendar) await setDoc(doc(db,'calendarItems',editingCalendar),data,{merge:true}); else await addDoc(collection(db,'calendarItems'),{...data,createdAt:serverTimestamp()});closeModals()}
window.deleteCalendarItem=async function(){if(editingCalendar&&confirm('Excluir item do calendário?')){await deleteDoc(doc(db,'calendarItems',editingCalendar));closeModals()}}
window.commentCalendarItem=async function(id){const text=prompt('Observação sobre este item do calendário:');if(text!==null) await setDoc(doc(db,'calendarItems',id),{clientNote:text,updatedAt:serverTimestamp()},{merge:true})}
function googleDateTime(date,time){return (date||'').replaceAll('-','')+'T'+(time||'09:00').replace(':','')+'00'}
function googleEndTime(item){if(item.endTime)return item.endTime;if(item.startTime){const [h,m]=item.startTime.split(':').map(Number);const d=new Date(2000,0,1,h,m);d.setHours(d.getHours()+1);return `${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;}return '10:00'}
window.addCalendarItemToGoogle=function(){const item=calendarItems.find(x=>x.id===editingCalendar);if(!item){alert('Salve o compromisso antes de adicionar ao Google Agenda.');return}const client=clients.find(c=>c.id===item.clientId);const resp=item.responsibleEmail?teamMembers.find(m=>String(m.email||'').toLowerCase()===String(item.responsibleEmail||'').toLowerCase()):null;const participantNames=(item.participants||[]).map(email=>teamMembers.find(m=>String(m.email||'').toLowerCase()===String(email).toLowerCase())?.name||email);const details=[client?.name?`Cliente: ${client.name}`:'',item.eventType?`Tipo: ${item.eventType}`:'',resp?`Responsável: ${resp.name}`:(item.responsibleEmail?`Responsável: ${item.responsibleEmail}`:''),participantNames.length?`Participantes: ${participantNames.join(', ')}`:'',item.teamNote?`Observação da equipe: ${item.teamNote}`:'',item.clientNote?`Observação do cliente: ${item.clientNote}`:'','Criado pelo Sistema Agência Humaniza'].filter(Boolean).join('\n');const start=googleDateTime(item.date,item.startTime||'09:00');const end=googleDateTime(item.date,googleEndTime(item));const title=`Humaniza • ${item.theme}${client?.name?' • '+client.name:''}`;const url='https://calendar.google.com/calendar/render?action=TEMPLATE&text='+encodeURIComponent(title)+'&dates='+encodeURIComponent(start+'/'+end)+'&details='+encodeURIComponent(details)+'&location='+encodeURIComponent(item.location||'');window.open(url,'_blank','noopener,noreferrer')}
window.updateScriptFormatFields=function(){const f=document.getElementById('scriptFormat')?.value||'Vídeo / Reel';document.getElementById('scriptVideoFields')?.classList.toggle('hidden',f!=='Vídeo / Reel');document.getElementById('scriptCarouselFields')?.classList.toggle('hidden',f!=='Carrossel');document.getElementById('scriptStaticFields')?.classList.toggle('hidden',f!=='Estático');}
window.updateScriptScheduleFields=function(){const defined=document.getElementById('scriptScheduleMode')?.value==='defined';document.getElementById('scriptPublishDateWrap')?.classList.toggle('hidden',!defined);document.getElementById('scriptPublishTimeWrap')?.classList.toggle('hidden',!defined);}
window.onScriptPublishDateChange=function(){const date=document.getElementById('scriptPublishDate')?.value||'';if(date){document.getElementById('scriptScheduleMode').value='defined';updateScriptScheduleFields();}}
window.openScriptModal=function(){editingScript=null;fillPlanningSelects();scriptModalTitle.textContent='Novo roteiro';deleteScriptBtn.style.display='none';historyScriptBtn.style.display='none';['scriptTitle','scriptCaptureDate','scriptPublishDate','scriptPublishTime','scriptBriefing','scriptImageLink','scriptGoal','scriptHook','scriptScenes','scriptCards','scriptCardCount','scriptArtText','scriptArtDirection','scriptCTA','scriptApprovalLink','scriptReferenceLink','scriptClientNote'].forEach(id=>{const el=document.getElementById(id);if(el)el.value=''});scriptResponsible.value='';scriptStatus.value='Escrevendo';scriptFormat.value='Vídeo / Reel';scriptScheduleMode.value='tbd';scriptClient.value=getScopedClientId();fillP('scriptParticipants',[]);const sr=defaultResp(scriptClient.value,(scriptFormat.value==='Carrossel'||scriptFormat.value==='Estático')?'defaultDesignerEmail':'defaultSocialEmail');if(sr)scriptResponsible.value=sr;updateScriptFormatFields();updateScriptScheduleFields();scriptModal.classList.add('active')}
window.editScript=function(id){const s=scripts.find(x=>x.id===id);if(!s)return;editingScript=id;fillPlanningSelects();scriptModalTitle.textContent='Editar roteiro';deleteScriptBtn.style.display='inline-block';historyScriptBtn.style.display='inline-block';scriptClient.value=s.clientId||'';scriptTitle.value=s.title||'';scriptFormat.value=s.format||'Vídeo / Reel';scriptStatus.value=s.status||'Escrevendo';scriptResponsible.value=selectResponsibilityValue(s);scriptScheduleMode.value=s.scheduleMode||(s.publishDate?'defined':'tbd');scriptPublishDate.value=s.publishDate||'';scriptPublishTime.value=s.publishTime||'';scriptCaptureDate.value=s.captureDate||'';scriptBriefing.value=s.briefing||'';scriptImageLink.value=s.imageLink||'';scriptGoal.value=s.goal||'';scriptHook.value=s.hook||'';scriptScenes.value=s.scenes||'';scriptCardCount.value=s.cardCount||'';scriptCards.value=s.cards||'';scriptArtText.value=s.artText||'';scriptArtDirection.value=s.artDirection||'';scriptCTA.value=s.cta||'';scriptApprovalLink.value=s.approvalLink||'';scriptReferenceLink.value=s.referenceLink||'';scriptClientNote.value=s.clientNote||'';fillP('scriptParticipants',s.participantEmails||[]);updateScriptFormatFields();updateScriptScheduleFields();scriptModal.classList.add('active')}
async function syncScriptCalendar(scriptId,data){
  if(!scriptId) throw new Error('Roteiro sem ID para sincronização.');
  const linked=calendarItems.find(x=>x.sourceType==='script'&&x.sourceId===scriptId);
  const deterministicId=`script_${scriptId}`;
  if(data.scheduleMode!=='defined'||!data.publishDate){
    if(linked) await deleteDoc(doc(db,'calendarItems',linked.id));
    // Também remove o documento determinístico caso exista. deleteDoc é seguro mesmo se não existir.
    if(!linked || linked.id!==deterministicId) await deleteDoc(doc(db,'calendarItems',deterministicId));
    return;
  }
  const calendarData={
    clientId:data.clientId,
    clientEmail:data.clientEmail,
    date:data.publishDate,
    month:monthFromDate(data.publishDate),
    format:data.format==='Vídeo / Reel'?'Reels':(data.format==='Estático'?'Post Estático':(data.format==='Sessão de fotos'?'Fotografia':'Carrossel')),
    clientName:data.clientName||'',
    theme:data.title,
    status:data.status==='Aprovado'?'Aprovado':(data.status==='Finalizado'?'Em produção':'Em roteiro'),
    visibility:'Visível para cliente',
    responsibleEmail:data.responsibleEmail||'',
    responsibleName:data.responsibleName||'',
    responsibilityScope:data.responsibilityScope||'pending',
    participantEmails:data.participantEmails||[],participantNames:data.participantNames||[],
    teamNote:'Criado automaticamente a partir de Roteiros.',
    clientNote:data.clientNote||'',
    sourceType:'script',
    sourceId:scriptId,
    publishTime:data.publishTime||'',
    updatedAt:serverTimestamp()
  };
  // Usa um ID fixo por roteiro. Assim cada roteiro sempre possui exatamente um item automático no calendário.
  // Sempre grava no documento determinístico. Isso elimina dependência do cache local do calendário.
  await setDoc(doc(db,'calendarItems',deterministicId),{...calendarData,createdAt:serverTimestamp()},{merge:true});
  // Remove eventual vínculo antigo criado por versões anteriores para evitar duplicidade.
  if(linked && linked.id!==deterministicId) await deleteDoc(doc(db,'calendarItems',linked.id));
}
window.saveScript=async function(){
  const responsibility=responsibilityData(scriptResponsible.value);
  let mode=scriptScheduleMode.value;
  // Se uma data foi preenchida, ela sempre prevalece e o roteiro passa a ser programado.
  if((scriptPublishDate.value||'').trim()) mode='defined';
  const pe=pEmails('scriptParticipants').filter(e=>ne(e)!==ne(responsibility.responsibleEmail));const data={...collectionDataWithClient(scriptClient.value),title:scriptTitle.value.trim(),format:scriptFormat.value,status:scriptStatus.value,...responsibility,participantEmails:pe,participantNames:pNames(pe),scheduleMode:mode,publishDate:mode==='defined'?scriptPublishDate.value:'',publishTime:mode==='defined'?scriptPublishTime.value:'',captureDate:scriptCaptureDate.value,briefing:scriptBriefing.value.trim(),imageLink:scriptImageLink.value.trim(),month:mode==='defined'?monthFromDate(scriptPublishDate.value):'',goal:scriptGoal.value.trim(),hook:scriptHook.value.trim(),scenes:scriptScenes.value.trim(),cardCount:scriptCardCount.value?Number(scriptCardCount.value):null,cards:scriptCards.value.trim(),artText:scriptArtText.value.trim(),artDirection:scriptArtDirection.value.trim(),cta:scriptCTA.value.trim(),approvalLink:scriptApprovalLink.value.trim(),referenceLink:scriptReferenceLink.value.trim(),clientNote:scriptClientNote.value.trim(),updatedAt:serverTimestamp()};
  if(!data.title){alert('Coloque o título ou tema do conteúdo.');return}
  if(mode==='defined'&&!data.publishDate){alert('Escolha a data de publicação ou marque Data a definir.');return}
  const selectedScriptCompetence=data.publishDate?competenceFromItem({publishDate:data.publishDate}):{
    month:Number(document.getElementById('scriptsMonthFilter')?.value||currentCompetence().month),
    year:Number(document.getElementById('scriptsYearFilter')?.value||currentCompetence().year)
  };
  data.competenceMonth=selectedScriptCompetence.month;data.competenceYear=selectedScriptCompetence.year;
  let id=editingScript;
  try{
    if(editingScript){
      const old=scripts.find(x=>x.id===editingScript);
      data.updatedBy=ne(currentUser?.email);data.updatedByName=actorName();
      data.history=demandHistoryWith(old,historyEvent('Roteiro alterado',`Status: ${old?.status||'—'} → ${data.status} • Responsável: ${old?.responsibleName||'A definir'} → ${data.responsibleName||'A definir'}`));
      await setDoc(doc(db,'scripts',editingScript),data,{merge:true});
    } else{
      const ev=historyEvent('Roteiro criado',`${data.format} • ${data.status}`);
      const ref=await addDoc(collection(db,'scripts'),{...data,createdBy:ne(currentUser?.email),createdByName:actorName(),updatedBy:ne(currentUser?.email),updatedByName:actorName(),history:[ev],createdAt:serverTimestamp()});id=ref.id;
    }
    // Fecha o modal assim que o roteiro principal foi salvo. Integrações secundárias não podem prender a tela.
    closeModals();
    try{await syncScriptCalendar(id,data); if(data.scheduleMode==='defined'&&data.publishDate){ const monthEl=document.getElementById('calendarMonthFilter'); if(monthEl) monthEl.value=monthFromDate(data.publishDate); const clientFilter=document.getElementById('calendarClientFilter'); if(clientFilter && data.clientId) clientFilter.value=data.clientId; renderCalendar(); }}catch(calendarError){console.error('Roteiro salvo, mas houve erro ao sincronizar calendário:',calendarError);alert('Roteiro salvo. Porém, não foi possível sincronizar automaticamente com o calendário.');}
    try{await notifyFromForm('script',{title:'Roteiro atualizado',message:`${data.title} • ${data.format} • ${data.status}`,clientId:data.clientId,responsibleEmail:data.responsibleEmail,type:'script',entityId:id});}catch(notificationError){console.error('Roteiro salvo, mas houve erro na notificação:',notificationError);}
  }catch(error){
    console.error('Erro ao salvar roteiro:',error);
    alert('Não foi possível salvar o roteiro. Tente novamente.');
  }
}
window.deleteScript=async function(){
  if(!editingScript){ alert('Não foi possível identificar o roteiro para exclusão.'); return; }
  const scriptId=editingScript;
  const s=scripts.find(x=>x.id===scriptId);
  const title=s?.title||'este roteiro';
  if(!confirm(`Excluir "${title}"? O item automático vinculado no Calendário também será excluído.`)) return;

  const deleteBtn=document.getElementById('deleteScriptBtn');
  const oldText=deleteBtn?.textContent||'Excluir';
  if(deleteBtn){ deleteBtn.disabled=true; deleteBtn.textContent='Excluindo...'; }

  try{
    // O roteiro é a informação principal. Excluímos primeiro para que uma falha
    // secundária no calendário nunca impeça a exclusão solicitada pelo usuário.
    await deleteDoc(doc(db,'scripts',scriptId));

    // Limpa o item automático determinístico criado pelas versões atuais.
    const deterministicId=`script_${scriptId}`;
    const cleanup=[];
    cleanup.push(deleteDoc(doc(db,'calendarItems',deterministicId)));

    // Também remove vínculos antigos que possam ter sido criados por versões anteriores.
    calendarItems
      .filter(x=>x.sourceType==='script' && x.sourceId===scriptId && x.id!==deterministicId)
      .forEach(item=>cleanup.push(deleteDoc(doc(db,'calendarItems',item.id))));

    const results=await Promise.allSettled(cleanup);
    const calendarFailed=results.some(r=>r.status==='rejected');

    editingScript=null;
    closeModals();
    if(calendarFailed){
      console.warn('Roteiro excluído, mas algum vínculo antigo do calendário não pôde ser removido.',results);
      alert('Roteiro excluído. Um vínculo antigo do calendário pode precisar ser removido manualmente.');
    }
  }catch(error){
    console.error('Erro ao excluir roteiro:',error);
    alert(`Não foi possível excluir o roteiro. ${error?.message||'Tente novamente.'}`);
  }finally{
    if(deleteBtn){ deleteBtn.disabled=false; deleteBtn.textContent=oldText; }
  }
}
window.approveScript=async function(id){const s=scripts.find(x=>x.id===id);await setDoc(doc(db,'scripts',id),{status:'Aprovado',updatedAt:serverTimestamp()},{merge:true});if(s)await syncScriptCalendar(id,{...s,status:'Aprovado'});if(appSettings.notifyClientApproval!==false)await createNotification({title:'Cliente aprovou roteiro',message:`${clientById(s?.clientId)?.name||'Cliente'} aprovou: ${s?.title||'Roteiro'}`,recipientEmails:[...adminRecipients(),s?.responsibleEmail||''],type:'client-approval',entityId:id});alert('Roteiro aprovado.')}
window.commentScript=async function(id){const text=prompt('Observação sobre o roteiro:');if(text!==null)await setDoc(doc(db,'scripts',id),{clientNote:text,status:'Aguardando aprovação',updatedAt:serverTimestamp()},{merge:true})}
window.openCaptureModal=function(){editingCapture=null;fillPlanningSelects();captureModalTitle.textContent='Nova captação';deleteCaptureBtn.style.display='none';historyCaptureBtn.style.display='none';['captureTitle','captureDate','captureChecklist','captureNotes','captureClientNote','captureApprovalLink'].forEach(id=>document.getElementById(id).value='');captureResponsible.value='';captureStatus.value='Planejada';captureClient.value=getScopedClientId();fillP('captureParticipants',[]);const cr=defaultResp(captureClient.value,'defaultVideoEmail');if(cr)captureResponsible.value=cr;captureModal.classList.add('active')}
window.editCapture=function(id){const ca=captures.find(x=>x.id===id);if(!ca)return;editingCapture=id;fillPlanningSelects();captureModalTitle.textContent='Editar captação';deleteCaptureBtn.style.display='inline-block';historyCaptureBtn.style.display='inline-block';captureClient.value=ca.clientId||'';captureTitle.value=ca.title||'';captureDate.value=ca.date||'';captureResponsible.value=selectResponsibilityValue(ca);captureStatus.value=ca.status||'Planejada';captureChecklist.value=ca.checklist||'';captureNotes.value=ca.notes||'';captureClientNote.value=ca.clientNote||'';captureApprovalLink.value=ca.approvalLink||'';fillP('captureParticipants',ca.participantEmails||[]);captureModal.classList.add('active')}
window.saveCapture=async function(){const responsibility=responsibilityData(captureResponsible.value);const pe=pEmails('captureParticipants').filter(e=>ne(e)!==ne(responsibility.responsibleEmail));const data={...collectionDataWithClient(captureClient.value),title:captureTitle.value.trim(),date:captureDate.value,month:monthFromDate(captureDate.value),...responsibility,participantEmails:pe,participantNames:pNames(pe),approvalLink:captureApprovalLink.value.trim(),status:captureStatus.value,checklist:captureChecklist.value.trim(),notes:captureNotes.value.trim(),clientNote:captureClientNote.value.trim(),updatedAt:serverTimestamp()};if(!data.title){alert('Coloque o nome da captação.');return}
const selectedCaptureCompetence=data.date?competenceFromItem({date:data.date}):{
  month:Number(document.getElementById('capturesMonthFilter')?.value||currentCompetence().month),
  year:Number(document.getElementById('capturesYearFilter')?.value||currentCompetence().year)
};
data.competenceMonth=selectedCaptureCompetence.month;data.competenceYear=selectedCaptureCompetence.year;
if(editingCapture){const old=captures.find(x=>x.id===editingCapture);data.updatedBy=ne(currentUser?.email);data.updatedByName=actorName();data.history=demandHistoryWith(old,historyEvent('Captação alterada',`Status: ${old?.status||'—'} → ${data.status} • Responsável: ${old?.responsibleName||'A definir'} → ${data.responsibleName||'A definir'}`));await setDoc(doc(db,'captures',editingCapture),data,{merge:true});} else {const ev=historyEvent('Captação criada',data.status);await addDoc(collection(db,'captures'),{...data,createdBy:ne(currentUser?.email),createdByName:actorName(),updatedBy:ne(currentUser?.email),updatedByName:actorName(),history:[ev],createdAt:serverTimestamp()});}closeModals()}
window.deleteCapture=async function(){if(editingCapture&&confirm('Excluir captação?')){await deleteDoc(doc(db,'captures',editingCapture));closeModals()}}
window.commentCapture=async function(id){const text=prompt('Observação sobre a captação:');if(text!==null) await setDoc(doc(db,'captures',id),{clientNote:text,updatedAt:serverTimestamp()},{merge:true})}

window.openSettingsModal = function(){
  if(!isAdmin) return;
  const input = document.getElementById('agencyLogoFile');
  if(input) input.value = '';
  const link = document.getElementById('agencyLogoLink');
  if(link) link.value = appSettings.logoUrl || '';
  renderBrandLogo();
  document.getElementById('settingsModal').classList.add('active');
}

window.saveSettings = async function(){
  const manualLogo = document.getElementById('agencyLogoLink')?.value.trim() || '';
  const logoUrl = manualLogo || appSettings.logoUrl || '';
  await setDoc(doc(db, 'settings', 'app'), {
    logoUrl,
    name: 'Agência Humaniza',
    updatedAt: serverTimestamp()
  }, {merge:true});
  closeModals();
}


window.openTeamModal = function(){ setTimeout(()=>{teamAccessBox.style.display='block';teamCreateAccess.checked=false;teamTempPassword.value='';teamTempPassword2.value=''},0);
  editingTeam = null;
  document.getElementById('teamModalTitle').textContent = 'Novo funcionário';
  document.getElementById('deleteTeamBtn').style.display = 'none';
  ['teamName','teamEmail','teamRole','teamObs','teamPhotoLink'].forEach(id => document.getElementById(id).value = ''); if(document.getElementById('teamPhotoFile')) document.getElementById('teamPhotoFile').value = '';
  document.getElementById('teamPermission').value = 'Operacional';
  document.getElementById('teamStatus').value = 'Ativo';
  document.getElementById('teamModal').classList.add('active');
}
window.editTeamMember = function(id){ setTimeout(()=>{teamAccessBox.style.display='none'},0);
  const m = teamMembers.find(x => x.id === id);
  if(!m) return;
  editingTeam = id;
  document.getElementById('teamModalTitle').textContent = 'Editar funcionário';
  document.getElementById('deleteTeamBtn').style.display = 'inline-block';
  document.getElementById('teamName').value = m.name || '';
  document.getElementById('teamEmail').value = m.email || '';
  document.getElementById('teamRole').value = m.role || '';
  document.getElementById('teamPhotoLink').value = m.photoUrl || '';
  if(document.getElementById('teamPhotoFile')) document.getElementById('teamPhotoFile').value = '';
  document.getElementById('teamPermission').value = m.permission || 'Operacional';
  document.getElementById('teamStatus').value = m.status || 'Ativo';
  document.getElementById('teamObs').value = m.obs || '';
  document.getElementById('teamModal').classList.add('active');
}
window.saveTeamMember = async function(){
  const existing = editingTeam ? teamMembers.find(x => x.id === editingTeam) : null;
  const manualPhoto = document.getElementById('teamPhotoLink')?.value.trim() || '';
  const data = {
    name: teamName.value.trim(),
    email: teamEmail.value.trim(),
    photoUrl: manualPhoto || existing?.photoUrl || '',
    role: teamRole.value.trim(),
    permission: teamPermission.value,
    status: teamStatus.value,
    obs: teamObs.value.trim(),
    updatedAt: serverTimestamp()
  };
  if(!data.name){ alert('Coloque o nome do funcionário.'); return; }
  if(!data.email){ alert('Coloque o e-mail de login do funcionário.'); return; }
  if(editingTeam) await setDoc(doc(db,'team',editingTeam), data, {merge:true});
  else {
    const ref=await addDoc(collection(db,'team'), {...data, createdAt: serverTimestamp()});
    if(document.getElementById('teamCreateAccess')?.checked){
      const p=teamTempPassword.value,p2=teamTempPassword2.value;
      if(p.length<8||p!==p2){alert('Funcionário salvo. Para criar o acesso, use senha com no mínimo 8 caracteres e confirmação igual.');return}
      try{await createFirebaseAccess({email:data.email,password:p,displayName:data.name,role:'team',recordId:ref.id})}catch(e){alert('Funcionário salvo, mas o acesso não foi criado: '+(e.message||e));return}
    }
  }
  closeModals();
}
window.deleteTeamMember = async function(){
  if(!editingTeam) return;
  if(confirm('Excluir funcionário da equipe?')){
    await deleteDoc(doc(db,'team',editingTeam));
    closeModals();
  }
}

window.openClientModal = function(){ setTimeout(()=>{clientAccessBox.style.display='block';clientCreateAccess.checked=false;clientTempPassword.value='';clientTempPassword2.value=''},0); editingClient = null; document.getElementById('clientModalTitle').textContent = 'Novo cliente'; document.getElementById('deleteClientBtn').style.display = 'none'; ['clientName','clientEmail','clientLogoLink','clientWhatsapp','clientDrive','clientInstagram','clientObs'].forEach(id => document.getElementById(id).value = ''); if(document.getElementById('clientLogoFile')) document.getElementById('clientLogoFile').value = ''; if(document.getElementById('clientLogoFile')) document.getElementById('clientLogoFile').value = ''; document.getElementById('clientStatus').value = 'Ativo';fillDefaults(null); document.getElementById('clientModal').classList.add('active'); }
window.editClient = function(id){ setTimeout(()=>{clientAccessBox.style.display='none'},0); const c = clientById(id); if(!c) return; editingClient = id; document.getElementById('clientModalTitle').textContent = 'Editar cliente'; document.getElementById('deleteClientBtn').style.display = 'inline-block'; document.getElementById('clientName').value = c.name || ''; document.getElementById('clientEmail').value = c.email || ''; if(document.getElementById('clientLogoLink')) document.getElementById('clientLogoLink').value = c.logo || ''; if(document.getElementById('clientLogoFile')) document.getElementById('clientLogoFile').value = ''; document.getElementById('clientWhatsapp').value = c.whatsapp || ''; document.getElementById('clientDrive').value = c.drive || ''; document.getElementById('clientInstagram').value = c.instagram || ''; document.getElementById('clientStatus').value = c.status || 'Ativo'; document.getElementById('clientObs').value = c.obs || '';fillDefaults(c); document.getElementById('clientModal').classList.add('active'); }
window.saveClient = async function(){
  const existing = editingClient ? clientById(editingClient) : null;
  const manualLogo = document.getElementById('clientLogoLink')?.value.trim() || '';
  const data = {
    name: clientName.value.trim(),
    email: clientEmail.value.trim(),
    logo: manualLogo || existing?.logo || '',
    whatsapp: clientWhatsapp.value.trim(),
    drive: clientDrive.value.trim(),
    instagram: clientInstagram.value.trim(),
    status: clientStatus.value,
    obs: clientObs.value.trim(),defaultSocialEmail:clientDefaultSocial.value||'',defaultDesignerEmail:clientDefaultDesigner.value||'',defaultVideoEmail:clientDefaultVideo.value||'',defaultTrafficEmail:clientDefaultTraffic.value||'',defaultLeaderEmail:clientDefaultLeader.value||'',
    updatedAt: serverTimestamp()
  };
  if(!data.name){ alert('Coloque o nome do cliente.'); return; }
  if(!data.email){ alert('Coloque o e-mail de login do cliente.'); return; }
  if(editingClient) await setDoc(doc(db,'clients',editingClient), data, {merge:true});
  else {
    const ref=await addDoc(collection(db,'clients'), {...data, createdAt: serverTimestamp()});
    if(document.getElementById('clientCreateAccess')?.checked){
      const p=clientTempPassword.value,p2=clientTempPassword2.value;
      if(p.length<8||p!==p2){alert('Cliente salvo. Para criar o acesso, use senha com no mínimo 8 caracteres e confirmação igual.');return}
      try{await createFirebaseAccess({email:data.email,password:p,displayName:data.name,role:'client',recordId:ref.id})}catch(e){alert('Cliente salvo, mas o acesso não foi criado: '+(e.message||e));return}
    }
  }
  closeModals();
}
window.deleteClient = async function(){ if(!editingClient) return; if(confirm('Excluir cliente? As demandas dele não serão excluídas automaticamente.')){ await deleteDoc(doc(db,'clients',editingClient)); closeModals(); } }


function actorName(){
  if(isAdmin) return 'Administrador';
  if(currentTeamMember?.name) return currentTeamMember.name;
  const c=clients.find(x=>ne(x.email)===ne(currentUser?.email));
  return c?.name || currentUser?.email || 'Usuário';
}
function historyEvent(action,detail=''){
  return {action,detail,byEmail:ne(currentUser?.email),byName:actorName(),at:new Date().toISOString()};
}
function demandHistoryWith(d,event){return [...(Array.isArray(d?.history)?d.history:[]),event]}
function demandChangeDetail(oldD,newD){
  const changes=[];
  if((oldD?.status||'')!==newD.status) changes.push(`Status: ${oldD?.status||'—'} → ${newD.status}`);
  if((oldD?.priority||'')!==newD.priority) changes.push(`Prioridade: ${oldD?.priority||'—'} → ${newD.priority}`);
  if(ne(oldD?.assignedEmail)!==ne(newD.assignedEmail)) changes.push(`Responsável: ${oldD?.assignedName||'A definir'} → ${newD.assignedName||'A definir'}`);
  if((oldD?.date||'')!==newD.date) changes.push(`Data: ${oldD?.date||'—'} → ${newD.date||'—'}`);
  if((oldD?.type||'')!==newD.type) changes.push(`Categoria: ${oldD?.type||'—'} → ${newD.type||'—'}`);
  return changes.length?changes.join(' • '):'Informações da demanda atualizadas';
}

function renderEntityHistory(title,item){
  const list=document.getElementById('historyList');
  document.getElementById('historyModalTitle').textContent=title;
  const h=[...(Array.isArray(item?.history)?item.history:[])].reverse();
  list.innerHTML=h.length?h.map(x=>{
    const dt=x.at?new Date(x.at):null;
    const when=dt&&!isNaN(dt)?dt.toLocaleString('pt-BR'):'';
    return `<div class="trash-card"><b>${x.action||'Alteração'}</b><p>${x.detail||''}</p><small>${x.byName||x.byEmail||'Usuário'}${when?' • '+when:''}</small></div>`;
  }).join(''):'<div class="empty">Ainda não há histórico registrado para este item. O histórico começa a partir da V26.</div>';
  document.getElementById('historyModal').classList.add('active');
}
window.openScriptHistory=id=>{const x=scripts.find(v=>v.id===id);if(x)renderEntityHistory('Histórico do roteiro',x)}
window.openCaptureHistory=id=>{const x=captures.find(v=>v.id===id);if(x)renderEntityHistory('Histórico da captação',x)}
window.openInternalHistory=id=>{const x=internalTasks.find(v=>v.id===id);if(x)renderEntityHistory('Histórico da tarefa interna',x)}
window.openDemandHistory=function(id){
  const d=demands.find(x=>x.id===id)||trashedDemands.find(x=>x.id===id); if(!d)return;
  const list=document.getElementById('historyList');
  const h=[...(Array.isArray(d.history)?d.history:[])].reverse();
  list.innerHTML=h.length?h.map(x=>{
    const dt=x.at?new Date(x.at):null;
    const when=dt&&!isNaN(dt)?dt.toLocaleString('pt-BR'):'';
    return `<div class="trash-card"><b>${x.action||'Alteração'}</b><p>${x.detail||''}</p><small>${x.byName||x.byEmail||'Usuário'}${when?' • '+when:''}</small></div>`;
  }).join(''):'<div class="empty">Ainda não há histórico registrado para esta demanda. O histórico começa a partir da V24.</div>';
  document.getElementById('historyModal').classList.add('active');
}

window.openDemandModal = function(clientId){ editingDemand = null; document.getElementById('demandModalTitle').textContent = 'Nova demanda'; document.getElementById('deleteDemandBtn').style.display = 'none'; document.getElementById('historyDemandBtn').style.display='none'; fillSelects(); document.getElementById('demandClient').value = clientId || selectedClientId || clients[0]?.id || ''; ['demandTitle','demandDate','demandLink','demandImageLink','demandDesc','demandComment'].forEach(id => { const el = document.getElementById(id); if(el) el.value = ''; }); if(document.getElementById('demandImageFile')) document.getElementById('demandImageFile').value = ''; document.getElementById('demandType').value = 'Estratégia'; document.getElementById('demandStatus').value = 'Estratégia'; document.getElementById('demandPriority').value = 'Normal';document.getElementById('demandAssigned').value='';fillP('demandParticipants',[]); document.getElementById('demandModal').classList.add('active'); }
window.editDemand = function(id){ const d = demands.find(x => x.id === id); if(!d) return; editingDemand = id; fillSelects(); document.getElementById('demandModalTitle').textContent = 'Editar demanda'; document.getElementById('deleteDemandBtn').style.display = 'inline-block'; document.getElementById('historyDemandBtn').style.display='inline-block'; document.getElementById('demandClient').value = d.clientId; document.getElementById('demandTitle').value = d.title || ''; document.getElementById('demandType').value = d.type || 'Estratégia'; document.getElementById('demandStatus').value = d.status || 'Estratégia'; document.getElementById('demandDate').value = d.date || ''; document.getElementById('demandPriority').value = d.priority || 'Normal'; document.getElementById('demandAssigned').value = selectResponsibilityValue(d,'assignedEmail'); document.getElementById('demandLink').value = d.link || ''; document.getElementById('demandDesc').value = d.desc || ''; document.getElementById('demandComment').value = d.comment || ''; if(document.getElementById('demandImageLink')) document.getElementById('demandImageLink').value = d.imageUrl || ''; if(document.getElementById('demandImageFile')) document.getElementById('demandImageFile').value = '';fillP('demandParticipants',d.participantEmails||[]); document.getElementById('demandModal').classList.add('active'); }
window.saveDemand = async function(){
  const c = clientById(demandClient.value);
  const responsibility = responsibilityData(demandAssigned.value);
  const imageLink = document.getElementById('demandImageLink')?.value.trim() || '';const pe=pEmails('demandParticipants').filter(e=>ne(e)!==ne(responsibility.responsibleEmail));
  const data = {
    clientId: demandClient.value,
    clientEmail: c?.email || '',
    title: demandTitle.value.trim(),
    type: demandType.value,
    status: demandStatus.value,
    date: demandDate.value,
    priority: demandPriority.value,
    assignedEmail: responsibility.responsibleEmail,
    assignedName: responsibility.responsibleName,
    responsibilityScope: responsibility.responsibilityScope,participantEmails:pe,participantNames:pNames(pe),
    link: demandLink.value.trim(),
    imageUrl: imageLink,
    desc: demandDesc.value.trim(),
    comment: demandComment.value.trim(),
    updatedAt: serverTimestamp()
  };
  if(!data.clientId){ alert('Cadastre um cliente primeiro.'); return; }
  if(!data.title){ alert('Coloque o nome da demanda.'); return; }
  if(editingDemand){
    const oldD=demands.find(x=>x.id===editingDemand);
    data.updatedBy=ne(currentUser?.email); data.updatedByName=actorName();
    data.history=demandHistoryWith(oldD,historyEvent('Demanda alterada',demandChangeDetail(oldD,data)));
    await setDoc(doc(db,'demands',editingDemand), data, {merge:true});
  } else {
    const ev=historyEvent('Demanda criada',`Criada com status ${data.status}`);
    await addDoc(collection(db,'demands'), {...data,createdBy:ne(currentUser?.email),createdByName:actorName(),updatedBy:ne(currentUser?.email),updatedByName:actorName(),history:[ev],createdAt:serverTimestamp()});
  }
  selectedClientId = data.clientId;
  closeModals();
}
window.deleteDemand = async function(){
  if(!editingDemand) return;
  const d=demands.find(x=>x.id===editingDemand);
  if(!confirm(`Mover "${d?.title||'esta demanda'}" para a Lixeira?\n\nVocê poderá restaurar depois.`)) return;
  await setDoc(doc(db,'demands',editingDemand),{
    archived:true,
    archivedAt:serverTimestamp(),
    archivedBy:ne(currentUser?.email),
    updatedBy:ne(currentUser?.email),
    updatedByName:actorName(),
    history:demandHistoryWith(d,historyEvent('Movida para a Lixeira')),
    updatedAt:serverTimestamp()
  },{merge:true});
  closeModals();
}
window.approveDemand = async function(id){ const d=demands.find(x=>x.id===id); await setDoc(doc(db,'demands',id), {status:'Aprovado',updatedBy:ne(currentUser?.email),updatedByName:actorName(),history:demandHistoryWith(d,historyEvent('Demanda aprovada')),updatedAt:serverTimestamp()}, {merge:true}); }
window.waitingClient = async function(id){ const d=demands.find(x=>x.id===id); await setDoc(doc(db,'demands',id), {status:'Aguardando você',updatedBy:ne(currentUser?.email),updatedByName:actorName(),history:demandHistoryWith(d,historyEvent('Enviada para o cliente')),updatedAt:serverTimestamp()}, {merge:true}); }
window.requestAdjust = async function(id){ const text=prompt('Qual ajuste deseja solicitar?'); if(text===null)return; const d=demands.find(x=>x.id===id); await setDoc(doc(db,'demands',id), {status:'Ajustes solicitados',comment:text||'',updatedBy:ne(currentUser?.email),updatedByName:actorName(),history:demandHistoryWith(d,historyEvent('Ajuste solicitado',text||'')),updatedAt:serverTimestamp()}, {merge:true}); }

window.openInternalModal = function(){ editingInternal = null; fillInternalStatus(); document.getElementById('internalModalTitle').textContent = 'Nova tarefa interna'; document.getElementById('deleteInternalBtn').style.display = 'none'; document.getElementById('historyInternalBtn').style.display='none'; ['internalTitle','internalClient','internalValue','internalDate','internalDesc','internalComment'].forEach(id => document.getElementById(id).value = '');
  fillTeamSelects();
  document.getElementById('internalAssigned').value = ''; document.getElementById('internalType').value = 'Edição de Vídeo'; document.getElementById('internalPriority').value = 'Normal'; document.getElementById('internalStatus').value = 'A Resolver'; document.getElementById('internalModal').classList.add('active'); }
window.editInternal = function(id){ const t = internalTasks.find(x => x.id === id); if(!t) return; editingInternal = id; fillInternalStatus(); document.getElementById('internalModalTitle').textContent = 'Editar tarefa interna'; document.getElementById('deleteInternalBtn').style.display = 'inline-block'; document.getElementById('historyInternalBtn').style.display='inline-block'; document.getElementById('internalTitle').value = t.title || ''; document.getElementById('internalClient').value = t.client || ''; document.getElementById('internalValue').value = t.value || ''; document.getElementById('internalType').value = t.type || 'Edição de Vídeo'; document.getElementById('internalPriority').value = t.priority || 'Normal'; document.getElementById('internalAssigned').value = selectResponsibilityValue(t,'assignedEmail'); document.getElementById('internalStatus').value = t.status || 'A Resolver'; document.getElementById('internalDate').value = t.date || ''; document.getElementById('internalDesc').value = t.desc || '';
  document.getElementById('internalComment').value = t.internalComment || ''; document.getElementById('internalModal').classList.add('active'); }
window.saveInternal = async function(){ const responsibility = responsibilityData(internalAssigned.value);
  const data = { title: internalTitle.value.trim(), client: internalClient.value.trim(), value: internalValue.value.trim(), type: internalType.value, priority: internalPriority.value, assignedEmail: responsibility.responsibleEmail, assignedName: responsibility.responsibleName, responsibilityScope: responsibility.responsibilityScope, status: internalStatus.value, date: internalDate.value, desc: internalDesc.value.trim(), internalComment: internalComment.value.trim(), updatedAt: serverTimestamp() }; if(!data.title){ alert('Coloque o nome da tarefa.'); return; } if(editingInternal){const old=internalTasks.find(x=>x.id===editingInternal);data.updatedBy=ne(currentUser?.email);data.updatedByName=actorName();data.history=demandHistoryWith(old,historyEvent('Tarefa interna alterada',`Status: ${old?.status||'—'} → ${data.status} • Responsável: ${old?.assignedName||'A definir'} → ${data.assignedName||'A definir'}`));await setDoc(doc(db,'internalTasks',editingInternal),data,{merge:true});} else {const ev=historyEvent('Tarefa interna criada',data.status);await addDoc(collection(db,'internalTasks'),{...data,createdBy:ne(currentUser?.email),createdByName:actorName(),updatedBy:ne(currentUser?.email),updatedByName:actorName(),history:[ev],createdAt:serverTimestamp()});} closeModals(); }
window.deleteInternal = async function(){ if(!editingInternal) return; if(confirm('Excluir essa tarefa?')){ await deleteDoc(doc(db,'internalTasks',editingInternal)); closeModals(); } }
window.moveInternal = async function(id, dir){ const t = internalTasks.find(x => x.id === id); if(!t) return; const i = internalStatuses.indexOf(t.status); const status = internalStatuses[Math.max(0, Math.min(internalStatuses.length-1, i+dir))]; await setDoc(doc(db,'internalTasks',id), {status, updatedAt:serverTimestamp()}, {merge:true}); }
window.finishInternal = async function(id){ const status=(isTeamMember&&!isAdmin)?'Pronto para Revisão':'Entregue'; await setDoc(doc(db,'internalTasks',id), {status, lastActionBy:currentUser?.email||'', lastActionName:currentTeamMember?.name||(isAdmin?'Admin':''), updatedAt:serverTimestamp()}, {merge:true}); }


window.sendDemandReview=async function(id){ await setDoc(doc(db,'demands',id),{status:'Revisão interna',lastActionBy:currentUser?.email||'',lastActionName:currentTeamMember?.name||'',updatedAt:serverTimestamp()},{merge:true}); }
window.approveInternalDemand=async function(id){ await setDoc(doc(db,'demands',id),{status:'Aguardando aprovação',lastActionBy:currentUser?.email||'',lastActionName:'Admin',updatedAt:serverTimestamp()},{merge:true}); }
window.requestTeamAdjust=async function(id){ const text=prompt('Qual ajuste a equipe precisa fazer?'); if(text===null)return; await setDoc(doc(db,'demands',id),{status:'Ajustes solicitados',comment:text||'',lastActionBy:currentUser?.email||'',lastActionName:'Admin',updatedAt:serverTimestamp()},{merge:true}); }
window.teamDemandComment=async function(id){ const d=demands.find(x=>x.id===id); const text=prompt('Comentário sobre a demanda:',d?.comment||''); if(text!==null) await setDoc(doc(db,'demands',id),{comment:text,lastActionBy:currentUser?.email||'',lastActionName:currentTeamMember?.name||'',updatedAt:serverTimestamp()},{merge:true}); }
window.openMemberPanel=function(id){ const m=teamMembers.find(x=>x.id===id); if(!m)return; const email=(m.email||'').trim().toLowerCase(); const tasks=internalTasks.filter(t=>(t.assignedEmail||'').trim().toLowerCase()===email); const ds=demands.filter(d=>(d.assignedEmail||'').trim().toLowerCase()===email); const all=[...tasks,...ds]; const open=all.filter(x=>!['Entregue','Aprovado','Publicado'].includes(x.status)).length; const late=all.filter(isLate).length; const review=all.filter(x=>['Pronto para Revisão','Revisão interna'].includes(x.status)).length; const done=all.filter(x=>['Entregue','Aprovado','Publicado'].includes(x.status)).length; document.getElementById('memberPanelTitle').textContent=m.name; document.getElementById('memberPanelSubtitle').textContent=`${m.role||'Equipe'} • ${m.permission||'Operacional'} • ${m.email||''}`; const item=(x,kind)=>`<div class="member-work-item"><h4>${x.title||'Sem título'}</h4><div class="meta"><span class="pill">${kind}</span><span class="pill">${x.status||''}</span>${x.date?`<span class="pill">Prazo: ${formatDate(x.date)}</span>`:''}${x.priority?`<span class="pill">${x.priority}</span>`:''}</div><p>${x.desc||x.internalComment||''}</p>${kind==='Demanda de cliente'?`<button class="btn-dark" onclick="closeModals(); showView('demands',document.querySelectorAll('.tab')[9])">Abrir demandas</button>`:''}</div>`; document.getElementById('memberPanelContent').innerHTML=`<div class="member-panel-grid"><div class="stat"><p>Em aberto</p><strong>${open}</strong></div><div class="stat"><p>Atrasadas</p><strong>${late}</strong></div><div class="stat"><p>Em revisão</p><strong>${review}</strong></div><div class="stat"><p>Concluídas</p><strong>${done}</strong></div></div><h3>Demandas de clientes</h3><div class="member-panel-list">${ds.length?ds.map(x=>item(x,'Demanda de cliente')).join(''):'<div class="empty">Nenhuma demanda atribuída.</div>'}</div><h3 style="margin-top:22px">Tarefas internas</h3><div class="member-panel-list">${tasks.length?tasks.map(x=>item(x,'Tarefa interna')).join(''):'<div class="empty">Nenhuma tarefa interna atribuída.</div>'}</div>`; document.getElementById('memberPanelModal').classList.add('active'); }
window.quickComment = async function(id){
  const t = internalTasks.find(x => x.id === id);
  const text = prompt('Comentário interno:', t?.internalComment || '');
  if(text !== null){
    await setDoc(doc(db,'internalTasks',id), {internalComment:text, updatedAt:serverTimestamp()}, {merge:true});
  }
}
window.openWhats = function(phone,text){ const clean=String(phone||'').replace(/\D/g,''); const msg=encodeURIComponent(text||'Oi! Tudo bem?'); if(clean) window.open(`https://wa.me/55${clean}?text=${msg}`,'_blank'); else window.open(`https://wa.me/?text=${msg}`,'_blank'); }


function quoteMoney(v){return Number(v||0).toLocaleString('pt-BR',{style:'currency',currency:'BRL'})}
function quoteEsc(v){return String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
function effectiveQuoteTier(qty){return [...(quoteSettings.tiers||[])].filter(t=>Number(t.qty)<=qty).sort((a,b)=>Number(b.qty)-Number(a.qty))[0]?.pct||0}
function collectQuoteExtras(){return [...document.querySelectorAll('#quoteExtras .quote-extra-row')].map(r=>({name:r.querySelector('.quote-extra-name').value.trim(),value:Number(r.querySelector('.quote-extra-value').value||0)})).filter(x=>x.name||x.value)}
function randomQuoteToken(){const a=new Uint8Array(24);crypto.getRandomValues(a);return [...a].map(x=>x.toString(16).padStart(2,'0')).join('')}
function publicQuoteId(t){return 'q_'+t}
window.addQuoteExtra=function(name='',value=''){const d=document.createElement('div');d.className='quote-extra-row';d.innerHTML=`<input class="quote-extra-name" placeholder="Adicional" value="${quoteEsc(name)}"><input class="quote-extra-value" type="number" min="0" step="0.01" placeholder="Valor (R$)" value="${quoteEsc(value)}" oninput="recalcQuote()"><button class="btn-danger" type="button" onclick="this.parentElement.remove();recalcQuote()">×</button>`;quoteExtras.appendChild(d)}
window.addQuoteTier=function(qty='',pct=''){const d=document.createElement('div');d.className='quote-tier-row';d.innerHTML=`<input class="quote-tier-qty" type="number" min="1" placeholder="A partir de quantos" value="${quoteEsc(qty)}"><input class="quote-tier-pct" type="number" min="0" max="100" step="0.1" placeholder="Desconto (%)" value="${quoteEsc(pct)}"><button class="btn-danger" type="button" onclick="this.parentElement.remove()">×</button>`;quoteTiers.appendChild(d)}
window.setQuoteService=function(service){
  quoteService.value=service;
  const v=service==='Vídeo'||service==='Vídeo + Foto',p=service==='Foto'||service==='Vídeo + Foto';
  if(service==='Vídeo' && Number(quoteVideoQuantity.value||0)<1) quoteVideoQuantity.value=1;
  if(service==='Foto' && Number(quotePhotoQuantity.value||0)<1) quotePhotoQuantity.value=1;
  if(service==='Vídeo + Foto'){
    if(Number(quoteVideoQuantity.value||0)<1) quoteVideoQuantity.value=1;
    if(Number(quotePhotoQuantity.value||0)<1) quotePhotoQuantity.value=1;
  }quoteVideoBlock.classList.toggle('hidden',!v);quotePhotoBlock.classList.toggle('hidden',!p);quoteComboBox.classList.toggle('hidden',service!=='Vídeo + Foto');quoteTypeVideo.classList.toggle('active',service==='Vídeo');quoteTypePhoto.classList.toggle('active',service==='Foto');quoteTypeBoth.classList.toggle('active',service==='Vídeo + Foto');recalcQuote()}
window.toggleManualQuoteFinal=function(){quoteManualFinalBox.classList.toggle('hidden',!quoteManualFinalEnabled.checked);recalcQuote()}
window.recalcQuote=function(){const service=quoteService.value||'Vídeo',vq=(service==='Vídeo'||service==='Vídeo + Foto')?Number(quoteVideoQuantity.value||0):0,vuBase=Number(quoteVideoUnitPrice.value||600),vh=Number(document.getElementById('quoteVideoHours')?.value||2),vBaseH=Number(quoteSettings.defaultVideoHours||2),vu=vuBase*(vh/vBaseH),pq=(service==='Foto'||service==='Vídeo + Foto')?Number(quotePhotoQuantity.value||0):0,puBase=Number(quotePhotoUnitPrice.value||350),ph=Number(document.getElementById('quotePhotoHours')?.value||2),pBaseH=Number(quoteSettings.defaultPhotoHours||2),pu=puBase*(ph/pBaseH),video=vq*vu,photo=pq*pu,extras=collectQuoteExtras(),extrasTotal=extras.reduce((a,x)=>a+x.value,0),auto=Math.min(100,Math.max(0,Number(effectiveQuoteTier(vq+pq)||0))),manual=quoteManualDiscount.value===''?null:Math.min(100,Math.max(0,Number(quoteManualDiscount.value||0))),pct=manual===null?auto:manual,base=video+photo,discount=base*pct/100,comboPct=service==='Vídeo + Foto'?Math.min(100,Math.max(0,Number(quoteSettings.comboDiscount||0))):0,combo=(base-discount)*comboPct/100,automaticTotal=base-discount-combo+extrasTotal,manualEnabled=quoteManualFinalEnabled.checked,manualFinal=manualEnabled?Math.max(0,Number(quoteManualFinal.value||0)):null,total=manualEnabled?manualFinal:automaticTotal,subtotal=base+extrasTotal,effectiveDiscountAmount=manualEnabled?Math.max(0,subtotal-total):(discount+combo),effectiveDiscountPct=manualEnabled&&subtotal>0?Math.min(100,Math.max(0,(effectiveDiscountAmount/subtotal)*100)):pct;quoteAutoDiscount.value=`${auto}%${comboPct?` + combo ${comboPct}%`:''}`;quoteCalc.innerHTML=`<div class="quote-price-grid"><div class="quote-price-box">Vídeo<strong>${quoteMoney(video)}</strong></div><div class="quote-price-box">Ensaio fotográfico<strong>${quoteMoney(photo)}</strong></div><div class="quote-price-box">Adicionais<strong>${quoteMoney(extrasTotal)}</strong></div><div class="quote-price-box">${manualEnabled?'Desconto calculado':'Automático'}<strong>${manualEnabled?`${effectiveDiscountPct.toLocaleString('pt-BR',{minimumFractionDigits:2,maximumFractionDigits:2})}%`:quoteMoney(automaticTotal)}</strong></div><div class="quote-price-box">${manualEnabled?'Final manual':'Total'}<strong>${quoteMoney(total)}</strong></div></div>`;return{service,videoQuantity:vq,videoUnitPrice:vuBase,videoHours:vh,photoQuantity:pq,photoUnitPrice:puBase,photoHours:ph,extras,autoDiscountPct:auto,discountPct:effectiveDiscountPct,comboDiscountPct:comboPct,subtotal,discountAmount:effectiveDiscountAmount,automaticTotal,manualFinalEnabled:manualEnabled,manualFinal,total}}
window.openQuoteModal=function(){if(!isAdmin)return;editingQuote=null;quoteModalTitle.textContent='Novo orçamento';['quoteProspectName','quoteEmail','quoteWhatsapp','quoteSegment','quoteObjective','quoteMacro','quoteDeliverables','quoteManualDiscount','quoteNotes','quoteManualFinal','quotePayment'].forEach(id=>document.getElementById(id).value='');quoteManualFinalEnabled.checked=false;toggleManualQuoteFinal();quoteVideoQuantity.value=1;quotePhotoQuantity.value=0;document.getElementById('quoteVideoHours').value=quoteSettings.defaultVideoHours||2;document.getElementById('quotePhotoHours').value=quoteSettings.defaultPhotoHours||2;quoteVideoUnitPrice.value=quoteSettings.defaultVideoPrice||600;quotePhotoUnitPrice.value=quoteSettings.defaultPhotoPrice||350;quoteDiscountExplanation.value=quoteSettings.discountExplanation||'';quoteValidity.value='';quoteCaptureDate.value='';quoteCaptureTime.value='';quoteExtras.innerHTML='';quotePayPix.checked=true;quotePayCard.checked=true;quoteCardFeeCustomer.checked=true;quoteNoDeposit.checked=true;quoteCardFeeBox.classList.remove('hidden');setQuoteService('Vídeo');quoteModal.classList.add('active')}
window.editQuote=function(id){const q=quotes.find(x=>x.id===id);if(!q)return;editingQuote=id;quoteModalTitle.textContent='Editar orçamento';quoteProspectName.value=q.prospectName||'';quoteEmail.value=q.email||'';quoteWhatsapp.value=q.whatsapp||'';quoteSegment.value=q.segment||'';quoteObjective.value=q.objective||'';quoteMacro.value=q.macro||'';quoteVideoQuantity.value=q.videoQuantity||0;quoteVideoUnitPrice.value=q.videoUnitPrice||600;document.getElementById('quoteVideoHours').value=q.videoHours||2;quotePhotoQuantity.value=q.photoQuantity||0;quotePhotoUnitPrice.value=q.photoUnitPrice||350;document.getElementById('quotePhotoHours').value=q.photoHours||2;quoteDeliverables.value=q.deliverables||'';quoteManualDiscount.value=q.manualDiscount??'';quoteDiscountExplanation.value=q.discountExplanation||'';quoteValidity.value=q.validity||'';quoteCaptureDate.value=q.captureDate||'';quoteCaptureTime.value=q.captureTime||'';quoteNotes.value=q.notes||'';document.getElementById('quotePayment').value=q.payment||'';quotePayPix.checked=Array.isArray(q.paymentMethods)?q.paymentMethods.includes('pix'):true;quotePayCard.checked=Array.isArray(q.paymentMethods)?q.paymentMethods.includes('card'):true;quoteCardFeeCustomer.checked=q.cardFeeCustomer!==false;quoteNoDeposit.checked=q.noDeposit!==false;quoteCardFeeBox.classList.toggle('hidden',!quotePayCard.checked);quoteExtras.innerHTML='';(q.extras||[]).forEach(x=>addQuoteExtra(x.name,x.value));quoteManualFinalEnabled.checked=!!q.manualFinalEnabled;quoteManualFinal.value=q.manualFinal??'';toggleManualQuoteFinal();setQuoteService(q.service||'Vídeo');quoteModal.classList.add('active')}
function publicPayload(p){return{prospectName:p.prospectName,segment:p.segment,objective:p.objective,macro:p.macro,service:p.service,videoQuantity:p.videoQuantity,videoHours:p.videoHours,photoQuantity:p.photoQuantity,photoHours:p.photoHours,deliverables:p.deliverables,subtotal:p.subtotal,discountPct:p.discountPct,comboDiscountPct:p.comboDiscountPct,discountAmount:p.discountAmount,automaticTotal:p.automaticTotal,manualFinalEnabled:p.manualFinalEnabled,total:p.total,discountExplanation:p.discountExplanation,validity:p.validity,notes:p.notes,payment:p.payment,paymentMethods:p.paymentMethods||[],cardFeeCustomer:!!p.cardFeeCustomer,noDeposit:!!p.noDeposit,businessName:quoteSettings.businessName||'Agência Humaniza',status:p.status||'sent',updatedAt:serverTimestamp()}}
window.saveQuote=async function(){
  if(!isAdmin)return alert('Somente o administrador pode salvar orçamentos.');
  const c=recalcQuote(),prospect=quoteProspectName.value.trim();
  if(!prospect)return alert('Informe a empresa ou cliente.');
  const old=editingQuote?quotes.find(x=>x.id===editingQuote):null;
  const token=old?.publicToken||randomQuoteToken();
  const p={prospectName:prospect,email:quoteEmail.value.trim(),whatsapp:quoteWhatsapp.value.trim(),segment:quoteSegment.value.trim(),objective:quoteObjective.value.trim(),macro:quoteMacro.value.trim(),service:c.service,videoQuantity:c.videoQuantity,videoUnitPrice:c.videoUnitPrice,videoHours:c.videoHours,photoQuantity:c.photoQuantity,photoUnitPrice:c.photoUnitPrice,photoHours:c.photoHours,extras:c.extras,autoDiscountPct:c.autoDiscountPct,manualDiscount:quoteManualDiscount.value===''?null:Number(quoteManualDiscount.value),discountPct:c.discountPct,comboDiscountPct:c.comboDiscountPct,subtotal:c.subtotal,discountAmount:c.discountAmount,automaticTotal:c.automaticTotal,manualFinalEnabled:c.manualFinalEnabled,manualFinal:c.manualFinal,total:c.total,discountExplanation:quoteDiscountExplanation.value.trim(),validity:quoteValidity.value,captureDate:quoteCaptureDate.value,captureTime:quoteCaptureTime.value,deliverables:quoteDeliverables.value.trim(),notes:quoteNotes.value.trim(),payment:document.getElementById('quotePayment').value.trim(),paymentMethods:[quotePayPix.checked?'pix':null,quotePayCard.checked?'card':null].filter(Boolean),cardFeeCustomer:quoteCardFeeCustomer.checked,noDeposit:quoteNoDeposit.checked,publicToken:token,status:old?.status||'sent',updatedAt:serverTimestamp()};
  let savedId=editingQuote;
  try{
    if(editingQuote){
      await setDoc(doc(db,'quotes',editingQuote),p,{merge:true});
    }else{
      p.createdAt=serverTimestamp();
      const ref=await addDoc(collection(db,'quotes'),p);
      savedId=ref.id;
    }
  }catch(e){
    console.error('Erro ao salvar orçamento:',e);
    return alert('O orçamento NÃO foi salvo no Firebase. Erro: '+(e?.code||e?.message||'desconhecido'));
  }
  const localCopy={id:savedId,...p,createdAt:old?.createdAt||{seconds:Math.floor(Date.now()/1000)}};
  const pos=quotes.findIndex(x=>x.id===savedId);
  if(pos>=0)quotes[pos]=localCopy;else quotes.unshift(localCopy);
  renderQuotes();
  closeModals();
  let publicOk=true;
  try{
    await setDoc(doc(db,'publicQuotes',publicQuoteId(token)),publicPayload(p),{merge:true});
  }catch(e){
    publicOk=false;
    console.error('Link público:',e);
  }
  await loadQuotes();
  // Se o orçamento já estiver aprovado e a data de captação for definida/alterada depois,
  // mantém automaticamente o Calendário da Equipe sincronizado.
  const savedQuoteForAgenda=quotes.find(x=>x.id===savedId)||localCopy;
  if(savedQuoteForAgenda?.status==='approved' && savedQuoteForAgenda?.captureDate){
    await ensureApprovedQuoteInTeamCalendar(savedQuoteForAgenda);
  }
  if(publicOk){
    navigator.clipboard?.writeText(makeQuoteLink(token)).catch(()=>{});
    alert('Orçamento salvo com sucesso. Link público gerado.');
  }else{
    alert('Orçamento salvo no painel. O link público não pôde ser atualizado.');
  }
}
function makeQuoteLink(token){const u=new URL(location.href);u.search='';u.hash='';u.searchParams.set('orcamento',token);return u.toString()}
window.copyQuoteLink=async function(token){
  const link=makeQuoteLink(token);
  const q=quotes.find(x=>x.publicToken===token);
  const nome=(q?.prospectName||'Cliente').trim();
  const mensagem=`Orçamento ${nome}\n\nAcesse sua proposta comercial pelo link abaixo:\n${link}`;
  try{
    await navigator.clipboard.writeText(mensagem);
    alert(`Orçamento ${nome} copiado para enviar no WhatsApp.`);
  }catch{
    prompt(`Copie a mensagem do orçamento de ${nome}:`,mensagem);
  }
}
function quoteStatusLabel(s){return({sent:'Aguardando resposta',approved:'Aprovado',declined:'Recusado',expired:'Expirado'})[s]||s||'Aguardando resposta'}
window.changeQuoteStatus=async function(id,newStatus){
  if(!isAdmin)return alert('Somente o administrador pode alterar o status do orçamento.');
  const q=quotes.find(x=>x.id===id); if(!q)return;
  const previous=q.status||'sent';
  if(newStatus===previous)return;
  q.status=newStatus; renderQuotes();
  try{
    await setDoc(doc(db,'quotes',id),{status:newStatus,statusChangedBy:'admin',statusChangedAt:serverTimestamp(),updatedAt:serverTimestamp()},{merge:true});
    if(q.publicToken){
      await setDoc(doc(db,'publicQuotes',publicQuoteId(q.publicToken)),{status:newStatus,statusChangedBy:'admin',statusChangedAt:serverTimestamp(),updatedAt:serverTimestamp()},{merge:true});
    }
    if(newStatus==='approved') await ensureApprovedQuoteInTeamCalendar(q);
  }catch(e){
    q.status=previous; renderQuotes();
    console.error('Erro ao alterar status do orçamento:',e);
    alert('Não foi possível alterar o status. Erro: '+(e?.code||e?.message||'desconhecido'));
  }
}
let publicQuoteStatusUnsubs=[];
function stopPublicQuoteStatusListeners(){
  publicQuoteStatusUnsubs.forEach(fn=>{try{fn()}catch(_){}});
  publicQuoteStatusUnsubs=[];
}
async function ensureApprovedQuoteInTeamCalendar(q){
  if(!isAdmin||!q||q.status!=='approved'||!q.captureDate)return;
  const calendarId=`quote_capture_${q.id}`;
  const endTime=q.captureTime?(()=>{const [hh,mm]=q.captureTime.split(':').map(Number);const d=new Date(2000,0,1,hh,mm);d.setHours(d.getHours()+Math.max(Number(q.videoHours||q.photoHours||2),1));return `${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;})():'';
  const data={
    teamCalendar:true,
    sourceType:'approvedQuote',
    sourceId:q.id,
    quoteId:q.id,
    clientId:'',
    clientName:'',
    clientProspect:q.prospectName||'',
    date:q.captureDate,
    month:monthFromDate(q.captureDate),
    startTime:q.captureTime||'',
    endTime,
    eventType:'Captação',
    format:'Captação',
    theme:`Captação • ${q.prospectName||'Cliente'}`,
    location:'',
    status:'Agendado',
    visibility:'Somente equipe',
    responsibleEmail:'',
    participants:[],
    teamNote:`Gerado automaticamente pelo orçamento aprovado. Serviço: ${q.service||''}`,
    clientNote:'',
    updatedAt:serverTimestamp()
  };
  try{
    await setDoc(doc(db,'calendarItems',calendarId),data,{merge:true});
    const local={id:calendarId,...data};
    const i=calendarItems.findIndex(x=>x.id===calendarId);
    if(i>=0) calendarItems[i]=local; else calendarItems.push(local);
    renderAgencyAgenda();
  }catch(e){
    console.error('Erro ao enviar captação para o Calendário da Equipe:',e);
    alert('O orçamento foi salvo, mas a captação não conseguiu entrar no Calendário da Equipe. Erro: '+(e?.code||e?.message||'desconhecido'));
  }
}
async function applyPublicQuoteStatus(q,data){
  if(!isAdmin || !q || !data) return;
  const ps=data.status;
  if(!['approved','declined','sent'].includes(ps) || ps===q.status) return;
  q.status=ps;
  if(data.respondedAt) q.respondedAt=data.respondedAt;
  renderQuotes();
  try{
    await setDoc(doc(db,'quotes',q.id),{
      status:ps,
      respondedAt:data.respondedAt||serverTimestamp(),
      updatedAt:serverTimestamp()
    },{merge:true});
    if(ps==='approved') await ensureApprovedQuoteInTeamCalendar(q);
  }catch(e){
    console.warn('Não foi possível sincronizar o status no orçamento interno:',q.id,e);
  }
}
function watchPublicQuoteStatuses(){
  stopPublicQuoteStatusListeners();
  if(!isAdmin || !quotes.length) return;
  quotes.forEach(q=>{
    if(!q.publicToken) return;
    try{
      const ref=doc(db,'publicQuotes',publicQuoteId(q.publicToken));
      const unsub=onSnapshot(ref,snap=>{
        if(!snap.exists()) return;
        applyPublicQuoteStatus(q,snap.data()||{});
      },e=>console.warn('Status público em tempo real:',q.id,e));
      publicQuoteStatusUnsubs.push(unsub);
    }catch(e){console.warn('Listener público do orçamento:',q.id,e)}
  });
}
async function syncQuotePublicStatuses(){
  watchPublicQuoteStatuses();
}
window.renderQuotes=function(){if(!quotesList||!isAdmin)return;const approved=quotes.filter(q=>q.status==='approved').length,open=quotes.filter(q=>!['approved','declined','expired'].includes(q.status)).length,value=quotes.filter(q=>q.status==='approved').reduce((a,q)=>a+Number(q.total||0),0);quoteSummary.innerHTML=`<div class="quote-box"><small>Total</small><h2>${quotes.length}</h2></div><div class="quote-box"><small>Em aberto</small><h2>${open}</h2></div><div class="quote-box"><small>Aprovados</small><h2>${approved}</h2></div><div class="quote-box"><small>Valor aprovado</small><h2>${quoteMoney(value)}</h2></div>`;quotesList.innerHTML=quotes.length?quotes.map(q=>`<div class="quote-card"><div class="top"><div><h3>${quoteEsc(q.prospectName)}</h3><div class="meta"><span class="pill">${quoteEsc(q.service)}</span><span class="pill">${quoteStatusLabel(q.status)}</span></div></div><strong>${quoteMoney(q.total)}</strong></div><div style="margin-top:14px"><label style="display:block;font-size:12px;opacity:.72;margin-bottom:6px">Status do orçamento</label><select onchange="changeQuoteStatus('${q.id}',this.value)" style="width:100%;max-width:260px"><option value="sent" ${(q.status||'sent')==='sent'?'selected':''}>Aguardando resposta</option><option value="approved" ${q.status==='approved'?'selected':''}>Aprovado</option><option value="declined" ${q.status==='declined'?'selected':''}>Recusado</option><option value="expired" ${q.status==='expired'?'selected':''}>Expirado</option></select></div><div class="actions"><button class="btn-dark" onclick="copyQuoteLink('${q.publicToken}')">Copiar link</button><button onclick="editQuote('${q.id}')">Editar</button></div></div>`).join(''):'<div class="empty">Nenhum orçamento criado.</div>'}
async function loadQuotes(){
  if(!isAdmin || !currentUser)return;
  try{
    if(unsubQuotes){ try{unsubQuotes()}catch(_){} unsubQuotes=null; }
    unsubQuotes=onSnapshot(collection(db,'quotes'), snap=>{
      quotes=snap.docs.map(x=>({id:x.id,...x.data()})).sort((a,b)=>{
        const bt=b.createdAt?.seconds||b.updatedAt?.seconds||0;
        const at=a.createdAt?.seconds||a.updatedAt?.seconds||0;
        return bt-at;
      });
      renderQuotes();
      syncQuotePublicStatuses();
      quotes.filter(q=>q.status==='approved'&&q.captureDate).forEach(q=>ensureApprovedQuoteInTeamCalendar(q));
    }, e=>{
      console.error('Erro ao acompanhar quotes:',e);
      const box=document.getElementById('quotesList');
      if(box)box.innerHTML=`<div class="notice">Os orçamentos existem no Firebase, mas o painel não conseguiu lê-los. Erro: ${quoteEsc(e?.code||e?.message||'desconhecido')}</div>`;
    });
  }catch(e){
    console.error('Erro ao iniciar quotes:',e);
  }
  try{
    const ss=await getDoc(doc(db,'quoteSettings','main'));
    if(ss.exists())quoteSettings={...quoteSettings,...ss.data()};
  }catch(e){console.error('Tabela comercial:',e)}
}
window.openQuoteSettings=function(){if(!isAdmin)return;quoteBusinessName.value=quoteSettings.businessName||'Agência Humaniza';quoteDefaultVideoPrice.value=quoteSettings.defaultVideoPrice||600;quoteDefaultPhotoPrice.value=quoteSettings.defaultPhotoPrice||350;document.getElementById('quoteDefaultVideoHours').value=quoteSettings.defaultVideoHours||2;document.getElementById('quoteDefaultPhotoHours').value=quoteSettings.defaultPhotoHours||2;quoteComboDiscount.value=quoteSettings.comboDiscount||'';quoteDefaultExplanation.value=quoteSettings.discountExplanation||'';quoteTiers.innerHTML='';(quoteSettings.tiers||[]).forEach(t=>addQuoteTier(t.qty,t.pct));if(!(quoteSettings.tiers||[]).length)[4,5,6].forEach(q=>addQuoteTier(q,0));quoteSettingsModal.classList.add('active')}
window.saveQuoteSettings=async function(){if(!isAdmin)return;const tiers=[...document.querySelectorAll('#quoteTiers .quote-tier-row')].map(r=>({qty:Number(r.querySelector('.quote-tier-qty').value||0),pct:Math.min(100,Math.max(0,Number(r.querySelector('.quote-tier-pct').value||0)))})).filter(t=>t.qty>0),s={businessName:quoteBusinessName.value.trim()||'Agência Humaniza',defaultVideoPrice:Number(quoteDefaultVideoPrice.value||600),defaultVideoHours:Number(document.getElementById('quoteDefaultVideoHours').value||2),defaultPhotoPrice:Number(quoteDefaultPhotoPrice.value||350),defaultPhotoHours:Number(document.getElementById('quoteDefaultPhotoHours').value||2),comboDiscount:Math.min(100,Math.max(0,Number(quoteComboDiscount.value||0))),discountExplanation:quoteDefaultExplanation.value.trim(),tiers,updatedAt:serverTimestamp()};try{await setDoc(doc(db,'quoteSettings','main'),s,{merge:true});quoteSettings={...quoteSettings,...s};closeModals();alert('Tabela comercial salva.')}catch(e){alert(e?.message||'Não foi possível salvar a tabela.')}}
function decodeFirestoreValue(v){
  if(!v || typeof v!=='object') return null;
  if('stringValue' in v) return v.stringValue;
  if('integerValue' in v) return Number(v.integerValue);
  if('doubleValue' in v) return Number(v.doubleValue);
  if('booleanValue' in v) return !!v.booleanValue;
  if('timestampValue' in v) return v.timestampValue;
  if('nullValue' in v) return null;
  if('arrayValue' in v) return (v.arrayValue.values||[]).map(decodeFirestoreValue);
  if('mapValue' in v){const o={};for(const [k,val] of Object.entries(v.mapValue.fields||{}))o[k]=decodeFirestoreValue(val);return o;}
  return null;
}
function decodeFirestoreDocument(json){
  const o={};
  for(const [k,v] of Object.entries(json?.fields||{}))o[k]=decodeFirestoreValue(v);
  return o;
}
async function getPublicQuoteData(documentId){
  // 1) leitura normal pelo SDK
  try{
    const snap=await getDoc(doc(db,'publicQuotes',documentId));
    if(snap.exists()) return snap.data()||{};
  }catch(e){
    console.warn('Leitura pública via SDK falhou; tentando REST.',e);
  }
  // 2) fallback independente de sessão/login do painel
  const endpoint=`https://firestore.googleapis.com/v1/projects/${encodeURIComponent(firebaseConfig.projectId)}/databases/(default)/documents/publicQuotes/${encodeURIComponent(documentId)}?key=${encodeURIComponent(firebaseConfig.apiKey)}`;
  const response=await fetch(endpoint,{method:'GET',cache:'no-store'});
  if(response.status===404) return null;
  if(!response.ok){
    let detail='';
    try{const j=await response.json();detail=j?.error?.message||''}catch(_){ }
    const err=new Error(detail||`HTTP ${response.status}`);
    err.code=`http-${response.status}`;
    throw err;
  }
  return decodeFirestoreDocument(await response.json());
}
async function loadPublicQuote(){
  // MODO PÚBLICO: não depende de login, equipe, clientes ou painel administrativo.
  document.getElementById('loginPage')?.classList.add('hidden');
  document.getElementById('appPage')?.classList.add('hidden');
  document.getElementById('publicQuotePage')?.classList.remove('hidden');
  const content=document.getElementById('publicQuoteContent');

  if(!publicQuoteToken){
    if(content)content.innerHTML='<div class="public-quote-card"><h2>Link inválido</h2><p>O código da proposta não foi encontrado neste link.</p></div>';
    return;
  }

  const documentId=publicQuoteId(publicQuoteToken.trim());
  try{
    const q=await getPublicQuoteData(documentId);
    if(!q){
      content.innerHTML='<div class="public-quote-card"><h2>Proposta não encontrada</h2><p>Este link não corresponde a uma proposta disponível.</p></div>';
      return;
    }
    const prospect=quoteEsc(q.prospectName||'Proposta comercial');
    const business=quoteEsc(q.businessName||'Agência Humaniza');
    const segment=quoteEsc(q.segment||'');
    const service=quoteEsc(q.service||'Produção de conteúdo');
    const macro=q.macro?quoteEsc(q.macro).replace(/\n/g,'<br>'):'';
    const objective=q.objective?quoteEsc(q.objective).replace(/\n/g,'<br>'):'';
    const deliverableItems=String(q.deliverables||'').split(/\n+/).map(x=>x.trim()).filter(Boolean);
    const deliverables=deliverableItems.length?`<div class="public-deliverables">${deliverableItems.map(x=>`<div class="public-deliverable">${quoteEsc(x)}</div>`).join('')}</div>`:'';
    const paymentLines=[];
    if(Array.isArray(q.paymentMethods)){
      if(q.paymentMethods.includes('pix')) paymentLines.push('Pix');
      if(q.paymentMethods.includes('card')) paymentLines.push(q.cardFeeCustomer?'Cartão de crédito: parcelamento disponível, com os juros da maquininha':'Cartão de crédito');
      if(q.noDeposit) paymentLines.push('Sem necessidade de entrada para reserva da data');
    }
    if(q.payment) paymentLines.push(quoteEsc(q.payment).replace(/\n/g,'<br>'));
    const payment=paymentLines.length?paymentLines.map(x=>`<div class="public-deliverable">${x}</div>`).join(''):'';
    const notes=q.notes?quoteEsc(q.notes).replace(/\n/g,'<br>'):'';
    const videoText=Number(q.videoQuantity||0)>0?`${Number(q.videoQuantity)} ${Number(q.videoQuantity)===1?'vídeo':'vídeos'}${q.videoHours?` • ${Number(q.videoHours)}h de captação`:''}`:'';
    const photoText=Number(q.photoQuantity||0)>0?`${Number(q.photoQuantity)} ${Number(q.photoQuantity)===1?'ensaio fotográfico':'ensaios fotográficos'}${q.photoHours?` • ${Number(q.photoHours)}h`:''}`:'';
    const production=[videoText,photoText].filter(Boolean).join(' + ');
    const validity=q.validity?(()=>{const m=String(q.validity).match(/^(\d{4})-(\d{2})-(\d{2})$/);return m?`${m[3]}/${m[2]}/${m[1]}`:quoteEsc(q.validity)})():'';
    const hasDiscount=Number(q.discountAmount||0)>0;
    content.innerHTML=`
      <div class="public-quote-card"><div class="public-quote-kicker">Proposta comercial • ${business}</div><h1>${prospect}</h1>${segment?`<p>${segment}</p>`:''}</div>
      ${objective?`<div class="public-quote-card"><h2>Objetivo do projeto</h2><p>${objective}</p></div>`:''}
      ${macro?`<div class="public-quote-card"><h2>Visão estratégica</h2><p>${macro}</p></div>`:''}
      <div class="public-quote-card"><div class="public-quote-kicker">Produção proposta</div><h2>${service}</h2>${production?`<div class="public-quote-production">${production}</div>`:''}${deliverables}<div class="public-price-grid"><div class="public-price-box"><span>Valor da produção</span><strong>${quoteMoney(q.subtotal||0)}</strong></div>${hasDiscount?`<div class="public-price-box"><span>Desconto${Number(q.discountPct||0)>0?` (${Number(q.discountPct).toLocaleString('pt-BR',{maximumFractionDigits:2})}%)`:''}</span><strong>− ${quoteMoney(q.discountAmount||0)}</strong></div>`:''}<div class="public-price-box highlight"><span>Investimento</span><strong>${quoteMoney(q.total||0)}</strong></div></div></div>
      ${q.discountExplanation?`<div class="public-quote-card"><h2>Condição comercial</h2><p>${quoteEsc(q.discountExplanation).replace(/\n/g,'<br>')}</p></div>`:''}
      ${payment?`<div class="public-quote-card"><h2>Forma de pagamento</h2><div class="public-deliverables">${payment}</div></div>`:''}
      ${validity?`<div class="public-quote-card"><h2>Validade da proposta</h2><p class="public-validity">${validity}</p></div>`:''}
      ${notes?`<div class="public-quote-card"><h2>Observações</h2><p>${notes}</p></div>`:''}
      <div class="public-quote-card"><h2>Como deseja seguir?</h2><div class="public-actions"><button class="btn-green" onclick="publicQuoteResponse('approved')">Aprovar proposta</button><button class="btn-dark" onclick="publicQuoteResponse('declined')">Não seguir agora</button></div><div id="publicResponseMsg" class="public-response"></div></div><div class="public-quote-footer">Agência Humaniza • Proposta comercial</div>`;
  }catch(e){
    console.error('Erro ao abrir proposta pública:',e);
    const code=quoteEsc(e?.code||e?.message||'erro-de-leitura');
    content.innerHTML=`<div class="public-quote-card"><h2>Não foi possível abrir esta proposta.</h2><p>A proposta existe, mas a leitura pública foi bloqueada. Código: <strong>${code}</strong>.</p></div>`;
  }
}
window.publicQuoteResponse=async function(action){if(!confirm(action==='approved'?'Aprovar esta proposta?':'Registrar que não deseja seguir agora?'))return;try{await setDoc(doc(db,'publicQuotes',publicQuoteId(publicQuoteToken)),{status:action,respondedAt:serverTimestamp()},{merge:true});publicResponseMsg.innerHTML='<div class="notice">Resposta registrada com sucesso.</div>'}catch(e){alert('Não foi possível registrar a resposta.')}}
if(publicQuoteToken)loadPublicQuote();


function h(v){return String(v??'').replace(/[&<>\"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;',"'":'&#39;'}[c]))}
function agendaTeamName(email){return teamMembers.find(x=>ne(x.email)===ne(email))?.name||email||'A definir'}
function agendaDateTime(item,which='start'){const t=which==='end'?(item.endTime||item.startTime||'23:59'):(item.startTime||'00:00');return `${item.date}T${t}:00`; }
function googleEventPayload(item){const desc=[item.clientProspect&&`Cliente/Prospect: ${item.clientProspect}`,item.responsibleEmail&&`Responsável: ${agendaTeamName(item.responsibleEmail)}`,item.participantEmails?.length&&`Participantes: ${item.participantEmails.map(agendaTeamName).join(', ')}`,item.notes].filter(Boolean).join('\n');return {summary:`[Humaniza] ${item.title}`,location:item.location||'',description:desc,start:{dateTime:agendaDateTime(item,'start'),timeZone:'America/Sao_Paulo'},end:{dateTime:agendaDateTime(item,'end'),timeZone:'America/Sao_Paulo'},extendedProperties:{private:{humanizaAgendaId:item.id||''}}};}
async function googleApi(path,options={}){if(!googleAgendaToken)throw new Error('Google Agenda não conectado');const r=await fetch(`https://www.googleapis.com/calendar/v3${path}`,{...options,headers:{Authorization:`Bearer ${googleAgendaToken}`,'Content-Type':'application/json',...(options.headers||{})}});if(r.status===204)return null;if(!r.ok){if(r.status===401){googleAgendaToken=null;updateGoogleAgendaUI();}throw new Error(await r.text())}return r.json()}
function updateGoogleAgendaUI(){const st=document.getElementById('googleAgendaStatus'),btn=document.getElementById('googleConnectBtn'),imp=document.getElementById('googleImportBtn');if(!st)return;const ok=!!googleAgendaToken;st.textContent=ok?'Google Agenda conectado':'Google Agenda desconectado';st.classList.toggle('ok',ok);if(btn)btn.textContent=ok?'Reconectar Google':'Conectar Google Agenda';if(imp)imp.style.display=ok&&isAdmin?'inline-block':'none';}
window.connectGoogleAgenda=function(){if(!isAdmin){alert('Somente o administrador conecta a conta Google da agência.');return}if(!window.google?.accounts?.oauth2){alert('O Google ainda está carregando. Aguarde alguns segundos e tente novamente.');return}if(!googleTokenClient)googleTokenClient=google.accounts.oauth2.initTokenClient({client_id:GOOGLE_CALENDAR_CLIENT_ID,scope:GOOGLE_CALENDAR_SCOPE,callback:(resp)=>{if(resp.error){alert('Não foi possível conectar ao Google Agenda.');return}googleAgendaToken=resp.access_token;updateGoogleAgendaUI();}});googleTokenClient.requestAccessToken({prompt:googleAgendaToken?'':'consent'});}
function agencyMonthValue(){const month=document.getElementById('agencyAgendaMonth');if(month&&!month.value){const n=new Date();month.value=`${n.getFullYear()}-${String(n.getMonth()+1).padStart(2,'0')}`;}return month?.value||'';}
window.shiftAgencyAgendaMonth=function(delta){const el=document.getElementById('agencyAgendaMonth');const v=agencyMonthValue();const [y,m]=v.split('-').map(Number);const d=new Date(y,m-1+delta,1);el.value=`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;renderAgencyAgenda();}
function renderAgencyAgenda(){const box=document.getElementById('agencyAgendaList');if(!box)return;updateGoogleAgendaUI();const pf=document.getElementById('agencyAgendaProjectFilter');if(pf){const keep=pf.value,ps=humanizaUnifiedProjects();pf.innerHTML='<option value="">Todos os clientes / projetos</option>'+ps.map(p=>`<option value="${h(normalizeProjectName(p.name))}">${h(p.name)}</option>`).join('');pf.value=[...pf.options].some(o=>o.value===keep)?keep:'';}const projectFilter=pf?.value||'';const rf=document.getElementById('agencyAgendaResponsibleFilter');if(rf){const keep=rf.value;rf.innerHTML='<option value="">Toda a equipe</option>'+teamMembers.map(m=>`<option value="${h(m.email)}">${h(m.name||m.email)}</option>`).join('');rf.value=teamMembers.some(m=>m.email===keep)?keep:'';}const mv=agencyMonthValue(),tf=document.getElementById('agencyAgendaTypeFilter')?.value||'',responsibleFilter=rf?.value||'',audienceFilter=document.getElementById('agencyAgendaAudienceFilter')?.value||'';const automaticTeamItems=calendarItems.filter(x=>x.teamCalendar===true).map(x=>({id:x.id,type:x.eventType||'Captação',title:x.theme||'Compromisso',date:x.date||'',startTime:x.startTime||'',endTime:x.endTime||'',clientProspect:x.clientProspect||'',responsibleEmail:x.responsibleEmail||'',participantEmails:x.participants||[],location:x.location||'',notes:x.teamNote||'',audience:x.audience||'capture',_automaticTeam:true}));const mergedTeamItems=[...agencyAgendaItems,...automaticTeamItems.filter(a=>!agencyAgendaItems.some(b=>b.quoteId&&b.quoteId===a.quoteId))];const normType=v=>String(v||'').trim().toLocaleLowerCase('pt-BR');const list=mergedTeamItems.filter(x=>(!mv||String(x.date||'').startsWith(mv))&&(!projectFilter||normalizeProjectName(x.clientProspect||x.clientName||x.client||x.prospect||'')===projectFilter)&&(!tf||normType(x.type)===normType(tf))&&(!responsibleFilter||x.responsibleEmail===responsibleFilter||(x.participantEmails||[]).includes(responsibleFilter))&&(!audienceFilter||(x.audience||'all')===audienceFilter)).sort((a,b)=>`${a.date||''} ${a.startTime||''}`.localeCompare(`${b.date||''} ${b.startTime||''}`));const [yy,mm]=mv.split('-').map(Number);const first=new Date(yy,mm-1,1),last=new Date(yy,mm,0),start=new Date(first);start.setDate(first.getDate()-first.getDay());const today=new Date(),todayKey=`${today.getFullYear()}-${String(today.getMonth()+1).padStart(2,'0')}-${String(today.getDate()).padStart(2,'0')}`;let days='';for(let i=0;i<42;i++){const d=new Date(start);d.setDate(start.getDate()+i);const key=`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;const ev=list.filter(x=>x.date===key);days+=`<div class="team-day ${d.getMonth()!==mm-1?'muted':''} ${key===todayKey?'today':''}"><div class="team-day-num">${d.getDate()}</div>${ev.map(x=>`<button class="team-event" onclick="${x._automaticTeam?`editCalendarItem('${x.id}')`:`openAgencyAgendaModal('${x.id}')`}"><strong>${h(x.startTime?x.startTime+' • ':'')}${h(x.title||'Compromisso')}</strong><small>${h(x.clientProspect||x.type||'')}</small></button>`).join('')}</div>`;}const mobile=list.length?list.map(x=>`<div class="agenda-card"><div><span class="agenda-badge">${h(x.type||'Outro')}</span><h3>${h(x.title||'Compromisso')}</h3><div class="agenda-meta"><strong>${h(formatDate(x.date))}</strong> ${h(x.startTime||'')} ${x.endTime?'– '+h(x.endTime):''}<br>${x.clientProspect?'Cliente/Prospect: '+h(x.clientProspect)+'<br>':''}Responsável: ${h(agendaTeamName(x.responsibleEmail))}</div></div><div class="agenda-actions"><button class="btn-dark" onclick="${x._automaticTeam?`editCalendarItem('${x.id}')`:`openAgencyAgendaModal('${x.id}')`}">Editar</button></div></div>`).join(''):'<div class="agenda-empty">Nenhum compromisso neste período.</div>';box.innerHTML=`<div class="team-calendar"><div class="team-calendar-head"><div>Dom</div><div>Seg</div><div>Ter</div><div>Qua</div><div>Qui</div><div>Sex</div><div>Sáb</div></div><div class="team-calendar-grid">${days}</div></div><div class="team-calendar-mobile-list">${mobile}</div>`;}
window.openAgencyAgendaModal=function(id=null){editingAgencyAgenda=id?agencyAgendaItems.find(x=>x.id===id)||null:null;agencyAgendaModalTitle.textContent=editingAgencyAgenda?'Editar compromisso':'Novo compromisso';deleteAgencyAgendaBtn.style.display=editingAgencyAgenda?'inline-block':'none';const r=agencyAgendaResponsible;r.innerHTML='<option value="">A definir</option>'+teamMembers.map(m=>`<option value="${h(m.email)}">${h(m.name||m.email)}</option>`).join('');const dl=document.getElementById('agencyAgendaClientList');if(dl)dl.innerHTML=humanizaUnifiedProjects().map(p=>`<option value="${h(p.name||'')}"></option>`).join('');agencyAgendaParticipants.innerHTML=teamMembers.map(m=>`<label><input type="checkbox" value="${h(m.email)}"> ${h(m.name||m.email)}</label>`).join('');const x=editingAgencyAgenda||{};agencyAgendaType.value=x.type||'Captação';agencyAgendaTitle.value=x.title||'';agencyAgendaDate.value=x.date||'';agencyAgendaStart.value=x.startTime||'';agencyAgendaEnd.value=x.endTime||'';agencyAgendaClient.value=x.clientProspect||'';agencyAgendaAudience.value=x.audience||'all';agencyAgendaResponsible.value=x.responsibleEmail||'';agencyAgendaLocation.value=x.location||'';agencyAgendaNotes.value=x.notes||'';[...agencyAgendaParticipants.querySelectorAll('input')].forEach(c=>c.checked=(x.participantEmails||[]).includes(c.value));agencyAgendaModal.classList.add('active');}
async function syncAgencyItemToGoogle(id,item){if(!googleAgendaToken||!isAdmin)return null;const payload=googleEventPayload({...item,id});let g;if(item.googleEventId)g=await googleApi(`/calendars/primary/events/${encodeURIComponent(item.googleEventId)}`,{method:'PUT',body:JSON.stringify(payload)});else g=await googleApi('/calendars/primary/events',{method:'POST',body:JSON.stringify(payload)});await setDoc(doc(db,'agencyAgenda',id),{googleEventId:g.id,googleHtmlLink:g.htmlLink||'',googleSyncStatus:'synced',googleSyncedAt:serverTimestamp()},{merge:true});return g;}
window.saveAgencyAgendaItem=async function(){const title=agencyAgendaTitle.value.trim(),date=agencyAgendaDate.value;if(!title||!date){alert('Preencha o título e a data.');return}const data={type:agencyAgendaType.value,audience:agencyAgendaAudience.value||'all',title,date,startTime:agencyAgendaStart.value,endTime:agencyAgendaEnd.value,clientProspect:agencyAgendaClient.value.trim(),responsibleEmail:agencyAgendaResponsible.value,participantEmails:[...agencyAgendaParticipants.querySelectorAll('input:checked')].map(x=>x.value),location:agencyAgendaLocation.value.trim(),notes:agencyAgendaNotes.value.trim(),updatedAt:serverTimestamp(),updatedBy:currentUser?.email||''};try{let id;if(editingAgencyAgenda){id=editingAgencyAgenda.id;await setDoc(doc(db,'agencyAgenda',id),{...data,googleEventId:editingAgencyAgenda.googleEventId||'',googleHtmlLink:editingAgencyAgenda.googleHtmlLink||''},{merge:true});data.googleEventId=editingAgencyAgenda.googleEventId||'';}else{const ref=await addDoc(collection(db,'agencyAgenda'),{...data,createdAt:serverTimestamp(),createdBy:currentUser?.email||''});id=ref.id;}if(googleAgendaToken&&isAdmin){try{await syncAgencyItemToGoogle(id,data)}catch(e){console.error(e);alert('Compromisso salvo na Humaniza, mas não foi possível sincronizar com o Google agora.');}}closeModals();}catch(e){console.error(e);alert('Não foi possível salvar. Verifique a permissão da coleção agencyAgenda no Firebase.');}}
window.deleteAgencyAgendaItem=async function(){if(!editingAgencyAgenda||!confirm('Excluir este compromisso da Agenda Humaniza?'))return;try{if(editingAgencyAgenda.googleEventId&&googleAgendaToken&&isAdmin){try{await googleApi(`/calendars/primary/events/${encodeURIComponent(editingAgencyAgenda.googleEventId)}`,{method:'DELETE'})}catch(e){console.warn(e)}}await deleteDoc(doc(db,'agencyAgenda',editingAgencyAgenda.id));closeModals();}catch(e){alert('Não foi possível excluir o compromisso.');}}
window.importGoogleAgenda=async function(){if(!googleAgendaToken)return connectGoogleAgenda();try{const now=new Date(),start=new Date(now.getFullYear(),now.getMonth()-1,1).toISOString(),end=new Date(now.getFullYear(),now.getMonth()+4,1).toISOString();const data=await googleApi(`/calendars/primary/events?singleEvents=true&orderBy=startTime&timeMin=${encodeURIComponent(start)}&timeMax=${encodeURIComponent(end)}&maxResults=250`);let imported=0;for(const g of data.items||[]){if(g.status==='cancelled'||!g.start?.dateTime)continue;const hid=g.extendedProperties?.private?.humanizaAgendaId;if(hid)continue;if(agencyAgendaItems.some(x=>x.googleEventId===g.id))continue;const st=new Date(g.start.dateTime),en=new Date(g.end?.dateTime||g.start.dateTime);await addDoc(collection(db,'agencyAgenda'),{type:'Outro',title:(g.summary||'Compromisso').replace(/^\[Humaniza\]\s*/,''),date:`${st.getFullYear()}-${String(st.getMonth()+1).padStart(2,'0')}-${String(st.getDate()).padStart(2,'0')}`,startTime:`${String(st.getHours()).padStart(2,'0')}:${String(st.getMinutes()).padStart(2,'0')}`,endTime:`${String(en.getHours()).padStart(2,'0')}:${String(en.getMinutes()).padStart(2,'0')}`,clientProspect:'',responsibleEmail:'',participantEmails:[],location:g.location||'',notes:g.description||'',googleEventId:g.id,googleHtmlLink:g.htmlLink||'',googleSyncStatus:'imported',createdAt:serverTimestamp(),createdBy:currentUser?.email||''});imported++;}alert(imported?`${imported} compromisso(s) importado(s) do Google.`:'Agenda já está atualizada.');}catch(e){console.error(e);alert('Não foi possível atualizar a partir do Google Agenda.');}}

window.closeModals = function(){ document.querySelectorAll('.modal').forEach(m => m.classList.remove('active')); }
function refreshAll(){
  renderAccessBadge(); if(isAdmin){ renderDashboard(); renderMacro(); renderCalendar(); renderScripts(); renderCaptures(); renderLibrary(); renderInternal(); renderTeam(); renderClients(); renderDemands(); renderAgencyAgenda(); } if(isTeamMember && !isAdmin){ renderCalendar(); renderScripts(); renderCaptures(); renderLibrary(); renderInternal(); renderDemands(); renderAgencyAgenda(); } if(!isAdmin && !isTeamMember){ renderMacro(); renderCalendar(); renderScripts(); renderCaptures(); renderLibrary(); } renderClientPanel(selectedClientId); 
  renderTrash();
}
document.addEventListener('keydown', e => { if(e.key === 'Escape') closeModals(); });


function renderMobileMenuItems(){
  const box = document.getElementById('mobileMenuItems');
  if(!box) return;

  let items = [];

  if(isAdmin){
    items = [
      {label:'📊 Visão geral', action:"mobileGo('dashboard')"},
      {label:'📈 Macro', action:"mobileGo('macro')"},
      {label:'🗓️ Calendário', action:"mobileGo('calendar')"},
      {label:'🎬 Roteiros', action:"mobileGo('scripts')"},
      {label:'📹 Captação', action:"mobileGo('captures')"},
      {label:'📚 Biblioteca', action:"mobileGo('library')"},
      {label:'📋 Agência', action:"mobileGo('internal')"},
      {label:'👨‍💻 Equipe', action:"mobileGo('team')"},
      {label:'👥 Clientes', action:"mobileGo('clients')"},
      {label:'🗂️ Demandas clientes', action:"mobileGo('demands')"},
      {label:'🗑️ Lixeira', action:"closeMobileMenu(); openTrash()"},
      {label:'🖥️ Tela do cliente', action:"mobileGo('clientPanel')"},
      {label:'📅 Calendário da Equipe', action:"mobileGo('agencyAgenda')"},
      {divider:true},
      {label:'⚙️ Configurações', action:"openSettingsModal(); closeMobileMenu()"},
      {label:'🚪 Sair', action:"logout()", extra:'mobile-logout'}
    ];
  } else if(isTeamMember){
    items = [
      {label:'🗓️ Calendário', action:"mobileGo('calendar')"},
      {label:'🎬 Roteiros', action:"mobileGo('scripts')"},
      {label:'📹 Captação', action:"mobileGo('captures')"},
      {label:'📚 Biblioteca', action:"mobileGo('library')"},
      {label:'📋 Minhas tarefas', action:"mobileGo('internal')"},
      {label:'🗂️ Minhas demandas', action:"mobileGo('demands')"},
      {label:'📅 Calendário da Equipe', action:"mobileGo('agencyAgenda')"},
      {divider:true},
      {label:'🚪 Sair', action:"logout()", extra:'mobile-logout'}
    ];
  } else {
    items = [
      {label:'📈 Macro', action:"mobileGo('macro')"},
      {label:'🗓️ Calendário', action:"mobileGo('calendar')"},
      {label:'🎬 Roteiros', action:"mobileGo('scripts')"},
      {label:'📹 Captação', action:"mobileGo('captures')"},
      {label:'📚 Biblioteca', action:"mobileGo('library')"},
      {label:'🖥️ Minha área', action:"mobileGo('clientPanel')"},
      {divider:true},
      {label:'🚪 Sair', action:"logout()", extra:'mobile-logout'}
    ];
  }

  box.innerHTML = items.map(item => {
    if(item.divider) return '<hr>';
    return `<button class="${item.extra || ''}" onclick="${item.action}">${item.label}</button>`;
  }).join('');
}

function updateMobileMenuByRole(){
  renderMobileMenuItems();
}

window.toggleMobileMenu = function(){
  updateMobileMenuByRole();
  document.getElementById('mobileSidebar')?.classList.toggle('active');
  document.getElementById('mobileOverlay')?.classList.toggle('active');
}

window.closeMobileMenu = function(){
  document.getElementById('mobileSidebar')?.classList.remove('active');
  document.getElementById('mobileOverlay')?.classList.remove('active');
}

window.mobileGo = function(view){
  if(!isAdmin && !isTeamMember && !['macro','calendar','scripts','captures','library','clientPanel','agencyAgenda'].includes(view)) return;
  if(isTeamMember && !isAdmin && !['calendar','scripts','captures','library','internal','demands','agencyAgenda'].includes(view)) return;
  closeMobileMenu();

  const tabMap = {
    dashboard: 0,
    macro: 1,
    calendar: 2,
    scripts: 3,
    captures: 4,
    library: 5,
    internal: 6,
    team: 7,
    clients: 8,
    demands: 9,
    clientPanel: 10,
    agencyAgenda: 11,
    quotes: 12
  };

  const tabs = document.querySelectorAll('.tab');
  const tab = tabs[tabMap[view]] || null;
  showView(view, tab);
}


function hzRefreshTeamActivityPanels(){
 const members=window.team||window.teamMembers||window.equipe||[];
 if(!Array.isArray(members)||!members.length)return;
 members.forEach(member=>{
   const email=String(member.email||'').trim(), name=String(member.name||member.nome||'').trim();
   const candidates=[...document.querySelectorAll('[class*="team" i],[class*="equipe" i],[data-team-id],[data-member-id]')];
   const card=candidates.find(el=>{
     const t=(el.textContent||'').toLowerCase();
     return (email&&t.includes(email.toLowerCase()))||(name&&t.includes(name.toLowerCase()));
   });
   if(card && !card.querySelector('.hz-team-activities')){
     const host=document.createElement('div'); host.className='hz-member-activities-host';
     card.appendChild(host); hzRenderMemberActivities(member,host);
   }
 });
}
const hzTeamObserver=new MutationObserver(()=>requestAnimationFrame(hzRefreshTeamActivityPanels));
window.addEventListener('DOMContentLoaded',()=>{
 hzTeamObserver.observe(document.body,{childList:true,subtree:true});
 setInterval(hzRefreshTeamActivityPanels,1500);
});
