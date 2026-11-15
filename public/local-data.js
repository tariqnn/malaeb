/* Persistent local SQLite data layer. All demo actions stay on 127.0.0.1. */
const legacyOpenModal = openModal;
const legacyRender = render;
const legacyBindPageEvents = bindPageEvents;
let databaseReady = false;
let databaseError = '';
let applicationDraft = {};
try { applicationDraft = JSON.parse(sessionStorage.getItem('malaeb-family-draft') || '{}'); } catch {}
en.join='Family registration';
ar.join='تسجيل العائلة';
if(location.hash==='#join') state.page='join';

async function localApi(path, method = 'GET', payload = undefined) {
  const options = { method, headers: { 'Accept': 'application/json' } };
  if (payload !== undefined) {
    options.headers['Content-Type'] = 'application/json';
    options.body = JSON.stringify(payload);
  }
  const response = await fetch(path, options);
  const result = await response.json();
  if (!response.ok) throw new Error(result.error || `Request failed (${response.status})`);
  return result;
}

function applySnapshot(snapshot) {
  demo.members = snapshot.members || [];
  demo.teams = snapshot.teams || [];
  demo.registrationsList = snapshot.registrations || [];
  demo.registrations = demo.registrationsList.filter(r => r.status === 'Needs review').length;
  demo.payments = snapshot.payments || [];
  demo.events = snapshot.events || [];
  demo.threads = snapshot.threads || [];
  demo.messages = demo.threads.map((thread, i) => ({
    id: thread.id, name: thread.name, time: thread.updated_at, preview: thread.preview,
    initial: thread.name.split(/\s+/).map(s => s[0]).join('').slice(0, 2).toUpperCase(), active: i === 0,
    messages: thread.messages || []
  }));
  demo.facilities = snapshot.facilities || [];
  demo.facilityBookings = snapshot.facility_bookings || [];
  demo.programs = snapshot.programs || [];
  demo.profile = snapshot.profile || {};
  demo.summary = snapshot.summary || {};
  demo.attendance = snapshot.attendance || {};
  const peopleCount=document.querySelector('[data-page="members"] .nav-count');
  const pendingCount=document.querySelector('[data-page="registration"] .nav-badge');
  const messageCount=document.querySelector('[data-page="messages"] .nav-count');
  if(peopleCount) peopleCount.textContent=String(demo.members.length);
  if(pendingCount){pendingCount.textContent=String(demo.registrations);pendingCount.hidden=demo.registrations===0;}
  if(messageCount) messageCount.hidden=true;
}

async function reloadSnapshot() {
  const snapshot = await localApi('/api/bootstrap');
  applySnapshot(snapshot);
  databaseReady = true;
  databaseError = '';
  const badge = document.getElementById('dbState');
  if (badge) { badge.className = 'db-state connected'; badge.textContent = isAr() ? 'قاعدة محلية متصلة' : 'Local database connected'; }
  return snapshot;
}

function escapeLocal(value) {
  return String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}
function localOptions(options, placeholder) {
  return `<option value="" selected disabled>${placeholder}</option>${options.map(o=>`<option value="${escapeLocal(o.value)}">${escapeLocal(o.label)}</option>`).join('')}`;
}
function localField(label,name,type='text',options=null,required=true,full=false,value='') {
  const requiredAttr=required?'required':'';
  const numericAttrs=type==='number'?(name==='age'?' min="4" max="19" step="1"':name==='capacity'?' min="1" max="500" step="1"':' min="0" step="0.001"'):'';
  const element=options
    ? `<select name="${name}" ${requiredAttr}>${localOptions(options,isAr()?'اختر':'Choose')}</select>`
    : type==='textarea'?`<textarea name="${name}" ${requiredAttr}>${escapeLocal(value)}</textarea>`:`<input name="${name}" type="${type}" value="${escapeLocal(value)}"${numericAttrs} ${requiredAttr}>`;
  return `<div class="field ${full?'full':''}"><label>${label}${required?' *':''}</label>${element}</div>`;
}
function formActions(submitLabel) {
  return `<div class="modal-actions"><button type="button" class="button" data-action="close-modal">${T().cancel}</button><button class="button primary" type="submit">${submitLabel}</button></div>`;
}
function showLocalModal(type,title,content,eyebrow='CLUB HQ') {
  state.modal=type;
  document.getElementById('modalEyebrow').textContent=eyebrow;
  document.getElementById('modalTitle').textContent=title;
  document.getElementById('modalBody').innerHTML=content;
  document.getElementById('modalBackdrop').hidden=false;
  document.body.style.overflow='hidden';
  repairRenderedArabic();
  const form=document.getElementById('actionForm');
  if(form) form.addEventListener('submit',submitForm);
  document.querySelectorAll('#modalBody [data-action="close-modal"]').forEach(button=>button.addEventListener('click',closeModal));
  document.querySelectorAll('#modalBody [data-action="roster"]').forEach(button=>button.addEventListener('click',()=>{state.selectedTeamName=button.dataset.name;openModal('roster');}));
  document.querySelectorAll('#modalBody [data-action="change-language"]').forEach(button=>button.addEventListener('click',()=>{closeModal();document.getElementById('langBtn')?.click();}));
  document.querySelectorAll('#modalBody [data-action="copy-link"]').forEach(button=>button.addEventListener('click',async()=>{try{await navigator.clipboard.writeText(`${location.origin}/#join`);toast(T().registrationSent);closeModal();}catch{toast(isAr()?'تعذر نسخ الرابط':'Could not copy the link',true);}}));
  document.querySelectorAll('#modalBody [data-review-status]').forEach(button=>button.addEventListener('click',async()=>{
    button.disabled=true;button.setAttribute('aria-busy','true');
    try{const result=await localApi(`/api/registrations/${state.reviewId}`,'PATCH',{status:button.dataset.reviewStatus});applySnapshot(result.data);closeModal();render();toast(isAr()?'تم حفظ قرار المراجعة':'Review decision saved');}
    catch(error){button.disabled=false;button.removeAttribute('aria-busy');toast(error.message,true);}
  }));
  document.querySelector('#modalBody input, #modalBody select, #modalBody textarea, #modalBody button')?.focus();
}

window.openModal = function(type) {
  if(type==='add-athlete'){
    const form=`<form id="actionForm"><div class="form-grid">${localField(T().athleteName,'athlete')}${localField(T().age,'age','number',null,true,false,'12')}${localField(T().guardianName,'guardian')}${localField(T().mobile,'mobile','tel')}${localField(T().programLabel,'program','text',demo.programs.map(p=>({value:p.name,label:p.name})),true,true)}</div><div class="form-note">${T().addAthleteNote}</div>${formActions(T().save)}</form>`;
    showLocalModal(type,T().addAthleteTitle,form,'NEW FAMILY');return;
  }
  if(type==='record-payment'){
    const people=demo.members.map(m=>{const surname=m.guardian.split(/\s+/).at(-1);return {value:`${surname} family · ${m.name}`,label:`${surname} family · ${m.name}`};});
    const methods=[{value:'Cash',label:T().cash},{value:'CliQ',label:T().cliq}];
    const today=new Date().toISOString().slice(0,10);
    const form=`<form id="actionForm"><div class="form-grid">${localField(T().paymentFor,'family','text',people)}${localField(T().amountJod,'amount','number',null,true,false)}${localField(T().paymentMethod,'method','text',methods,true,true)}${localField(isAr()?'تاريخ الدفع':'Payment date','date','date',null,true,false,today)}${localField(T().note,'note','text',null,false,true)}</div><div class="form-note">${T().soon}</div>${formActions(T().savePayment)}</form>`;
    showLocalModal(type,T().recordPaymentTitle,form,'PAYMENTS');return;
  }
  if(type==='add-event'){
    const kinds=[{value:'Practice',label:T().practice},{value:'Match',label:T().match},{value:'Other',label:T().other}];
    const form=`<form id="actionForm"><div class="form-grid">${localField(T().eventName,'event')}${localField(T().eventDate,'date','date')}${localField(T().eventTime,'time','time')}${localField(T().eventTeam,'team','text',demo.teams.map(t=>({value:t.name,label:t.name})))}${localField(T().facilityName,'facility','text',demo.facilities.map(f=>({value:f.name,label:f.name})),false)}${localField(T().eventType,'type','text',kinds)}</div>${formActions(T().saveEvent)}</form>`;
    showLocalModal(type,T().newEventTitle,form,'CLUB CALENDAR');return;
  }
  if(type==='new-message'){
    const audiences=[{value:'All club families',label:T().allFamilies},...demo.teams.map(t=>({value:`${T().teamParents} · ${t.name}`,label:`${T().teamParents} · ${t.name}`}))];
    const form=`<form id="actionForm"><div class="form-grid">${localField(T().audience,'audience','text',audiences)}${localField(T().messageBody,'message','textarea',null,true,true)}</div><div class="form-note">External delivery is off; this stays in the local database.</div>${formActions(T().sendNow)}</form>`;
    showLocalModal(type,T().messageTitle,form,'FAMILY COMMUNICATION');return;
  }
  if(type==='book-facility'){
    const form=`<form id="actionForm"><div class="form-grid">${localField(T().facilityName,'facility','text',demo.facilities.map(f=>({value:f.name,label:f.name})))}${localField(T().eventTeam,'team','text',demo.teams.map(t=>({value:t.name,label:t.name})))}${localField(T().eventDate,'date','date')}${localField(T().eventTime,'time','time')}</div><div class="form-note">The local app checks for an existing facility request at that time.</div>${formActions(T().bookFacility)}</form>`;
    showLocalModal(type,T().bookFacility,form,'FACILITIES');return;
  }
  if(type==='roster'){
    const team=demo.teams.find(t=>t.name===state.selectedTeamName)||demo.teams[0];if(!team)return toast('Create a team first',true);state.selectedTeamId=team.id;
    const selected=new Set((team.roster||[]).map(m=>m.id));
    const rows=demo.members.filter(m=>m.program===team.program).map(m=>`<label class="roster-choice"><input type="checkbox" name="member_ids" value="${m.id}" ${selected.has(m.id)?'checked':''}><span><b>${escapeLocal(m.name)}</b><small>${escapeLocal(m.guardian)} · ${m.age} ${isAr()?'سنة':'years'}</small></span></label>`).join('');
    const form=`<form id="actionForm"><div class="roster-list">${rows||`<div class="empty-state">No athletes are enrolled in this program yet.</div>`}</div><div class="form-note">${escapeLocal(team.name)} · ${escapeLocal(team.program)}</div>${formActions(isAr()?'حفظ القائمة':'Save roster')}</form>`;
    showLocalModal(type,isAr()?'قائمة الفريق':'Team roster',form,'TEAM ROSTER');return;
  }
  if (type === 'new-team') {
    const form=`<form id="actionForm"><div class="form-grid">
      ${localField(isAr()?'اسم الفريق':'Team name','team')}
      ${localField(isAr()?'اسم المدرب':'Coach name','coach')}
      ${localField(isAr()?'البرنامج':'Program','program','text',demo.programs.map(p=>({value:p.name,label:p.name})))}
      ${localField(isAr()?'المرفق':'Facility','facility','text',demo.facilities.map(f=>({value:f.name,label:f.name})),false,true)}
      </div>${formActions(isAr()?'إنشاء الفريق':'Create team')}</form>`;
    showLocalModal(type,isAr()?'إنشاء فريق':'Create a team',form,'TEAM SETUP'); return;
  }
  if (type === 'registration-link') {
    const form=`<form id="actionForm"><div class="form-grid">
      ${localField(isAr()?'اسم البرنامج':'Program name','name')}
      ${localField(isAr()?'نوع الرياضة':'Sport','sport','text',["Football","Basketball","Swimming","Volleyball"].map(v=>({value:v,label:v}))) }
      ${localField(isAr()?'الفئة العمرية':'Age group','age_group','text',["U8","U10","U12","U14","U16","U18"].map(v=>({value:v,label:v}))) }
      ${localField(isAr()?'الرسوم بالدينار':'Fee (JOD)','fee','number',null,true,false)}
      ${localField(isAr()?'عدد المقاعد':'Capacity','capacity','number',null,true,false,'30')}
      </div><div class="form-note">${isAr()?'سيظهر البرنامج ضمن بيانات النادي المحلية.':'The program is saved to this club’s local database.'}</div>${formActions(isAr()?'حفظ البرنامج':'Save program')}</form>`;
    showLocalModal(type,isAr()?'إعداد التسجيل':'Set up a program',form,'REGISTRATION'); return;
  }
  if (type === 'edit-website') {
    const p=demo.profile||{};
    const form=`<form id="actionForm"><div class="form-grid">
      ${localField(isAr()?'اسم النادي':'Club name','display_name','text',null,true,true,p.display_name||'')}
      ${localField(isAr()?'عبارة تعريفية':'Tagline','tagline','text',null,false,true,p.tagline||'')}
      ${localField(isAr()?'الهاتف':'Phone','phone','tel',null,false,false,p.phone||'')}
      ${localField(isAr()?'العنوان':'Address','address','text',null,false,false,p.address||'')}
      <div class="field full"><label><input type="checkbox" name="published" ${p.published?'checked':''}> ${isAr()?'إظهار ملف النادي للعائلات':'Publish the club profile'}</label></div>
      </div>${formActions(isAr()?'حفظ الملف':'Save profile')}</form>`;
    showLocalModal(type,isAr()?'ملف النادي':'Club profile',form,'PUBLIC PROFILE'); return;
  }
  if (type === 'profile' && state.selectedMemberId && !state.selectedTeamId) {
    const m=demo.members.find(x=>Number(x.id)===Number(state.selectedMemberId));
    if(m){const content=`<div class="review-summary"><div class="review-avatar">${escapeLocal(m.initials||m.name.split(/\s+/).map(x=>x[0]).join('').slice(0,2))}</div><div><b>${escapeLocal(m.name)}</b><small>${escapeLocal(m.program)} ? ${escapeLocal(m.age)} ${isAr()?'???':'years'}</small></div></div><div class="review-details"><div><span>${T().GUARDIAN}</span><b>${escapeLocal(m.guardian)}</b></div><div><span>${isAr()?'??????':'Phone'}</span><b>${escapeLocal(m.phone||'?')}</b></div><div><span>${T().feeStatus}</span><b>${escapeLocal(m.status)} ? ${escapeLocal(m.fee||'?')}</b></div></div><div class="modal-actions"><button class="button" data-action="close-modal">${T().cancel}</button></div>`;showLocalModal(type,isAr()?'??? ??????':'Athlete profile',content,'FAMILY RECORD');return;}
  }
  if(type==='profile'&&state.selectedTeamId){const team=demo.teams.find(t=>Number(t.id)===Number(state.selectedTeamId));if(team){const roster=(team.roster||[]).map(m=>`<div class="activity-row"><span class="activity-avatar green">${escapeLocal(m.initials||'•')}</span><div class="activity-copy"><p><b>${escapeLocal(m.name)}</b></p><small>${escapeLocal(m.guardian||'')}</small></div></div>`).join('')||'<div class="empty-state">No roster assigned yet.</div>';const content=`<div class="review-summary"><div class="review-avatar">${escapeLocal((team.name||'').slice(0,2))}</div><div><b>${escapeLocal(team.name)}</b><small>${escapeLocal(team.program)} · ${escapeLocal(team.sport)}</small></div></div><div class="review-details"><div><span>Coach</span><b>${escapeLocal(team.coach||'—')}</b></div><div><span>Facility</span><b>${escapeLocal(team.facility||'—')}</b></div></div><div>${roster}</div><div class="modal-actions"><button class="button" data-action="close-modal">${T().cancel}</button><button class="button primary" data-action="roster" data-name="${escapeLocal(team.name)}">${T().viewRoster}</button></div>`;showLocalModal(type,'Team details',content,'TEAM');return;}}
  if(type==='profile'){
    const content=`<div class="review-summary"><div class="review-avatar">LA</div><div><b>Local administrator</b><small>${isAr()?'مسؤولة النادي':'Club administrator'} · ${isAr()?'معاينة محلية':'Local preview'}</small></div></div><div class="form-note">${isAr()?'لا يوجد تسجيل دخول متصل في هذه النسخة المحلية.':'This local preview does not connect to an account service.'}</div><div class="modal-actions"><button class="button" data-action="close-modal">${T().cancel}</button><button class="button primary" data-action="change-language">${isAr()?'English':'العربية'}</button></div>`;
    showLocalModal(type,isAr()?'مساحة المسؤول':'Workspace profile',content,'CLUB HQ');return;
  }
  if(type==='help'){
    const content=`<div class="review-details"><div><span>01</span><b>Review family applications in Registration.</b></div><div><span>02</span><b>Manage athletes and teams in their workspace pages.</b></div><div><span>03</span><b>Use the local attendance, fees and facility request flows.</b></div></div><div class="form-note">The workspace runs on this club computer. Payments and messages are local records only.</div><div class="modal-actions"><button class="button primary" data-action="close-modal">${T().cancel}</button></div>`;
    showLocalModal(type,isAr()?'مركز المساعدة':'Workspace help',content,'GETTING STARTED');return;
  }
  if (type === 'review') {
    const registration=demo.registrationsList.find(r=>r.id===state.reviewId&&r.status==='Needs review')||demo.registrationsList.find(r=>r.status==='Needs review')||demo.registrationsList[0];
    if(!registration){toast(isAr()?'لا توجد طلبات للمراجعة':'There are no applications to review');return;}
    state.reviewId=registration.id;
    if(!['Needs review','Waitlist'].includes(registration.status)){
      const closed=`<div class="review-summary"><div class="review-avatar">${escapeLocal(registration.name.split(/\s+/).map(s=>s[0]).join('').slice(0,2))}</div><div><b>${escapeLocal(registration.name)}</b><small>${escapeLocal(registration.program)} · ${escapeLocal(registration.status)}</small></div></div><div class="form-note">This application has already been closed. Its decision remains in the local audit history.</div><div class="modal-actions"><button type="button" class="button primary" data-action="close-modal">${T().cancel}</button></div>`;
      showLocalModal(type,isAr()?'تفاصيل الطلب':'Application details',closed,'APPLICATION');return;
    }
    const body=`<div class="review-summary"><div class="review-avatar">${escapeLocal(registration.name.split(/\s+/).map(s=>s[0]).join('').slice(0,2))}</div><div><b>${escapeLocal(registration.name)}</b><small>${escapeLocal(registration.program)} · ${registration.age} ${isAr()?'سنة':'years'}</small></div></div><div class="review-details"><div><span>${T().GUARDIAN}</span><b>${escapeLocal(registration.guardian)}</b></div><div><span>${isAr()?'رقم الهاتف':'Phone'}</span><b>${escapeLocal(registration.phone)}</b></div><div><span>${T().submitted}</span><b>${escapeLocal(registration.submitted)}</b></div></div><div class="form-note">${isAr()?'اختر حالة المراجعة لحفظها في قاعدة البيانات.':'Choose a review decision to save it in the local database.'}</div><div class="modal-actions"><button type="button" class="button" data-action="close-modal">${T().cancel}</button><button type="button" class="button" data-review-status="Waitlist">${T().waitlist}</button><button type="button" class="button" data-review-status="Declined">Decline</button><button type="button" class="button primary" data-review-status="Approved">${T().approved}</button></div>`;
    showLocalModal(type,isAr()?'مراجعة طلب التسجيل':'Review application',body,'APPLICATION REVIEW'); return;
  }
  legacyOpenModal(type);
};

window.submitForm = async function(e) {
  e.preventDefault();
  const data=Object.fromEntries(new FormData(e.currentTarget));
  if(Object.values(data).some(v=>v==='__choose')){toast(T().required,true);return;}
  let endpoint='',method='POST',payload=data,success='Saved to the local database';
  if(state.modal==='add-athlete'){endpoint='/api/members';success=T().athleteAdded;}
  else if(state.modal==='record-payment'){
    endpoint='/api/payments';success=T().paymentSaved;
    const methodMap={[T().cash]:'Cash',[T().bank]:'Bank transfer',[T().cliq]:'CliQ',[T().card]:'Card terminal'};
    payload={...data,method:methodMap[data.method]||data.method};
  }
  else if(state.modal==='add-event'){
    endpoint='/api/events'; success=T().eventAdded;
    const typeMap={[T().practice]:'Practice',[T().match]:'Match',[T().other]:'Other'};
    payload={...data,type:typeMap[data.type]||data.type,team:data.team,starts_at:`${data.date}T${data.time}`,facility:data.facility||'Main pitch'};
  }
  else if(state.modal==='new-message'){endpoint='/api/messages';success=T().messageSent;payload={audience:data.audience,message:data.message};}
  else if(state.modal==='book-facility'){endpoint='/api/facility-bookings';payload={facility:data.facility,team:data.team,date:data.date,time:data.time};success=T().requestSent;}
  else if(state.modal==='new-team'){endpoint='/api/teams';success=isAr()?'تم حفظ الفريق':'Team saved';}
  else if(state.modal==='roster'){
    endpoint='/api/team-memberships';
    payload={team_id:state.selectedTeamId,member_ids:[...e.currentTarget.querySelectorAll('[name="member_ids"]:checked')].map(input=>Number(input.value))};
    success=isAr()?'تم حفظ قائمة الفريق':'Team roster saved';
  }
  else if(state.modal==='registration-link'){endpoint='/api/programs';success=isAr()?'تم حفظ البرنامج':'Program saved';}
  else if(state.modal==='edit-website'){endpoint='/api/profile';method='PUT';payload={...data,published:e.currentTarget.elements.published.checked};success=isAr()?'تم حفظ ملف النادي':'Club profile saved';}
  else {toast(T().required,true);return;}
  try{
    const result=await localApi(endpoint,method,payload);
    if(result.data)applySnapshot(result.data);
    closeModal();render();toast(success);
  }catch(err){toast(err.message,true);}
};

function localStats(){
  const s=demo.summary||{};const money=(fils)=>`${(Number(fils||0)/1000).toLocaleString(isAr()?'ar-JO':'en-US',{minimumFractionDigits:0,maximumFractionDigits:3})} <small style="font:500 10px 'DM Sans';color:#9eb0a4">JOD</small>`;
  const cards=[
    [T().peopleCount,s.members||0,'♙',`${demo.teams.length} ${isAr()?'فرق':'teams'}`,''],
    [T().openRegistrations,s.pending||0,'▤',`${s.pending||0} ${T().needAttention}`,'amber'],
    [T().feeCollection,money(s.fees_fils),'◉',`${demo.payments.length} ${isAr()?'دفعة مسجلة':'recorded payments'}`,'blue'],
    [T().attendanceToday,`${s.attendance_percent||0}%`,'✓',`${s.attendance_present||0} ${T().attended}`,'lilac']
  ];
  return `<div class="stats-grid">${cards.map((c,i)=>`<div class="stat-card"><div class="stat-top"><span>${c[0]}</span><span class="stat-icon ${c[4]}">${c[2]}</span></div><div class="stat-value">${c[1]}</div><div class="stat-foot">${i===1?`<span class="trend warn">${c[3]}</span>`:`<span>${c[3]}</span>`}</div></div>`).join('')}</div>`;
}
window.stats=localStats;

window.overviewPage=function(){
 const collected=Number(demo.summary?.fees_fils||0),outstanding=Number(demo.summary?.outstanding_fils||0),target=collected+outstanding;
 const percent=target?Math.round(collected/target*100):0;
 const fmt=f=>`${(Number(f||0)/1000).toLocaleString(isAr()?'ar-JO':'en-US',{minimumFractionDigits:0,maximumFractionDigits:3})} JOD`;
 const when=v=>{const d=new Date(String(v||'').replace(' ','T'));return Number.isNaN(d.getTime())?String(v||''):d.toLocaleDateString(isAr()?'ar-JO':'en-US',{timeZone:'Asia/Amman',month:'short',day:'numeric'});};
 const activities=[
  ...demo.payments.slice(0,5).map(p=>({date:p.date,title:`${isAr()?'تم تسجيل دفعة':'Payment recorded'} · ${p.athlete}`,meta:`${p.method} · ${p.amount}`,when:p.date,icon:'◉',tone:'blue'})),
  ...demo.registrationsList.slice(0,5).map(r=>({date:r.submitted,title:`${isAr()?'طلب تسجيل':'Registration'} · ${r.name}`,meta:`${r.program} · ${r.status}`,when:r.submitted,icon:'＋',tone:'green'}))
 ].sort((a,b)=>new Date(String(b.date||'').replace(' ','T'))-new Date(String(a.date||'').replace(' ','T'))).slice(0,5);
 const activityRows=activities.map(a=>`<div class="activity-row"><span class="activity-avatar ${a.tone}">${a.icon}</span><span class="activity-copy"><b>${escapeLocal(a.title)}</b><small>${escapeLocal(a.meta)} · ${escapeLocal(when(a.when))}</small></span></div>`).join('');
 const upcoming=demo.events.filter(e=>new Date(String(e.starts_at||'').replace(' ','T'))>=new Date(Date.now()-86400000)).slice(0,4);
 const eventRows=upcoming.map(e=>{const d=new Date(String(e.starts_at||'').replace(' ','T'));return `<div class="event-row"><span class="event-date"><b>${Number.isNaN(d.getTime())?'—':d.toLocaleDateString(isAr()?'ar-JO':'en-US',{timeZone:'Asia/Amman',day:'numeric'})}</b><small>${Number.isNaN(d.getTime())?'':d.toLocaleDateString(isAr()?'ar-JO':'en-US',{timeZone:'Asia/Amman',month:'short'})}</small></span><span class="event-info"><b>${escapeLocal(e.title)}</b><small>${escapeLocal(e.team||'Club session')} · ${escapeLocal(e.facility||'')}</small></span><span class="event-tag">${Number.isNaN(d.getTime())?'':d.toLocaleTimeString(isAr()?'ar-JO':'en-US',{timeZone:'Asia/Amman',hour:'numeric',minute:'2-digit'})}</span></div>`}).join('');
 const programs=demo.programs.filter(p=>p.active!==0);
 const totalCapacity=programs.reduce((n,p)=>n+Number(p.capacity||0),0),occupied=demo.members.length;
 const programRows=programs.slice(0,5).map(p=>{const enrolled=demo.members.filter(m=>m.program===p.name).length;return `<div class="program-row"><span class="program-ball">${escapeLocal((p.sport||p.name).slice(0,1))}</span><span class="program-copy"><b>${escapeLocal(p.name)}</b><small>${enrolled} ${isAr()?'مسجل':'enrolled'} · ${Number(p.capacity||0)} ${isAr()?'مقعد':'places'}</small></span><span class="program-count"><b>${enrolled}/${Number(p.capacity||0)}</b></span></div>`}).join('');
 return `${pageHeading(T().season,isAr()?'نظرة عامة':'Club overview',isAr()?'ملخص مباشر من سجلات النادي المحلية.':'Live operations and finances from your club records.',`${btn('↗ '+T().export,'local-export')}${btn('<span class="plus">＋</span> '+T().newRegistration,'registration',true)}`)}<section class="welcome-banner"><div class="banner-content"><div class="banner-label">✳ ${isAr()?'ملخص النادي':'YOUR CLUB, AT A GLANCE'}</div><h2>${isAr()?'مساحة ناديك في مكان واحد':'Your club, in one clear view'}</h2><p>${isAr()?'تتحدث الأرقام من سجلات النادي المحلية.':'Live totals from your club’s local records.'}</p></div><button class="button" data-action="registration">${T().viewSeason} <span>→</span></button><div class="banner-art" aria-hidden="true"><svg viewBox="0 0 260 210" fill="none"><circle cx="130" cy="105" r="76" stroke="#779be3" stroke-opacity=".4"/><circle cx="130" cy="105" r="52" stroke="#779be3" stroke-opacity=".3"/><path d="M54 105h152M130 29v152M76 51c27 29 81 78 108 108M184 51C157 80 103 129 76 159" stroke="#779be3" stroke-opacity=".25"/><path d="M130 84l15 10v22l-15 10-15-10V94l15-10Z" stroke="#779be3" stroke-width="2"/><circle cx="130" cy="105" r="8" fill="#779be3" fill-opacity=".8"/></svg></div></section>${localStats()}<div class="overview-grid"><div><section class="panel dashboard-collection"><div class="panel-head"><div><div class="panel-title">${isAr()?'ملخص الرسوم':'Fee collection'}</div><div class="panel-subtitle">${isAr()?'الإجمالي المسجل والمتبقي':'Recorded payments and remaining balances'}</div></div><button class="text-link" data-page="payments">${isAr()?'عرض الدفعات':'View payments'} →</button></div><div class="collection-values"><div><small>${isAr()?'تم تحصيله':'Collected'}</small><strong>${fmt(collected)}</strong></div><div><small>${isAr()?'متبقٍ':'Outstanding'}</small><strong>${fmt(outstanding)}</strong></div></div><div class="progress-track"><span class="progress-fill" style="width:${percent}%"></span></div><div class="progress-meta"><span>${percent}% ${isAr()?'من المستحقات المحصلة':'of recorded fees collected'}</span><span>${demo.payments.length} ${isAr()?'دفعة':'payments'}</span></div></section><section class="panel"><div class="panel-head"><div><div class="panel-title">${isAr()?'المواعيد القادمة':'Upcoming sessions'}</div><div class="panel-subtitle">${isAr()?'التوقيت المحلي · عمّان':'Local time · Amman'}</div></div><button class="text-link" data-page="schedule">${isAr()?'عرض الجدول':'View schedule'} →</button></div>${eventRows||`<div class="empty-state"><strong>${isAr()?'لا توجد مواعيد قادمة':'No upcoming sessions'}</strong><button class="text-link" data-action="add-event">${isAr()?'إضافة موعد':'Add a session'}</button></div>`}</section></div><div><section class="panel"><div class="panel-head"><div><div class="panel-title">${isAr()?'آخر التحديثات':'Recent activity'}</div><div class="panel-subtitle">${isAr()?'من سجل النادي':'From saved club records'}</div></div><button class="text-link" data-page="registration">${isAr()?'الطلبات':'Applications'} →</button></div>${activityRows||`<div class="empty-state"><strong>${isAr()?'لا توجد تحديثات بعد':'No recorded activity yet'}</strong></div>`}</section><section class="panel"><div class="panel-head"><div><div class="panel-title">${isAr()?'البرامج':'Programs'}</div><div class="panel-subtitle">${occupied} ${isAr()?'لاعب':'athletes'} · ${totalCapacity} ${isAr()?'مقعداً':'places'}</div></div><button class="text-link" data-page="teams">${isAr()?'الفرق':'Teams'} →</button></div>${programRows||`<div class="empty-state"><strong>${isAr()?'لا توجد برامج نشطة':'No active programs'}</strong></div>`}</section></div></div>`;
};

window.registrationPage=function(){
 const pending=demo.registrationsList.filter(r=>r.status==='Needs review').length;
 const rows=demo.registrationsList.map(r=>`<tr><td><div class="table-person"><span class="tiny-avatar">${escapeLocal(r.name.split(/\s+/).map(s=>s[0]).join('').slice(0,2))}</span><span><b>${escapeLocal(r.name)}</b><small>${r.age} ${isAr()?'سنة':'years'}</small></span></div></td><td>${escapeLocal(r.program)}</td><td>${escapeLocal(r.guardian)}</td><td>${escapeLocal(r.submitted)}</td><td><span class="status-pill ${r.status==='Approved'?'active':r.status==='Waitlist'?'inactive':'pending'}">${escapeLocal(r.status)}</span></td><td><button class="button small" data-action="review" data-registration-id="${r.id}">${T().view}</button></td></tr>`).join('');
 return `${pageHeading('AUTUMN 2026',T().registrationTitle,T().registrationSub,`${btn('<span class="plus">＋</span> '+T().createProgram,'registration-link',true)}`)}<div class="tabs"><button class="tab active">${T().all} <span class="nav-count">${demo.registrationsList.length}</span></button><button class="tab">${T().needsReview} <span class="nav-count">${pending}</span></button><button class="tab">${T().approved}</button><button class="tab">${T().waitlist}</button><button class="tab">${isAr()?'مرفوضة':'Declined'}</button></div><section class="panel table-panel"><div class="table-toolbar"><div><div class="panel-title">${isAr()?'طلبات الموسم':'Season applications'}</div><div class="panel-subtitle">${databaseReady?(isAr()?'محفوظة محلياً في قاعدة البيانات':'Saved in local SQLite'):'Loading local records'}</div></div><button class="button small" data-action="refresh">↻ ${isAr()?'تحديث':'Refresh'}</button></div><table class="data-table"><thead><tr><th>${T().applicant}</th><th>${T().program}</th><th>${T().GUARDIAN}</th><th>${T().submitted}</th><th>${T().review}</th><th></th></tr></thead><tbody>${rows||`<tr><td colspan="6"><div class="empty-state"><strong>${isAr()?'لا توجد طلبات بعد':'No applications yet'}</strong></div></td></tr>`}</tbody></table><div class="table-bottom"><span>${demo.registrationsList.length} ${isAr()?'طلباً':'applications'} · ${databaseReady?(isAr()?'محفوظة محلياً':'saved locally'):T().statusMock}</span></div></section>`;
};

window.paymentsPage=function(){
 const s=demo.summary||{};const total=(s.fees_fils||0)/1000;const outstanding=(s.outstanding_fils||0)/1000;
 const rows=demo.payments.map(p=>`<tr><td><b>${escapeLocal(p.family)}</b></td><td>${escapeLocal(p.athlete)}</td><td>${escapeLocal(p.method)}</td><td><b>${escapeLocal(p.amount)}</b></td><td>${escapeLocal(p.date)}</td><td><button class="text-link" data-action="view-receipt">${escapeLocal(p.receipt)}</button></td></tr>`).join('');
 return `${pageHeading('AUTUMN 2026',T().paymentsTitle,T().paymentsSub,btn('<span class="plus">＋</span> '+T().recordPayment,'record-payment',true))}<div class="stats-grid"><div class="stat-card"><div class="stat-top"><span>${T().collected}</span><span class="stat-icon">◉</span></div><div class="stat-value">${total.toLocaleString(isAr()?'ar-JO':'en-US',{minimumFractionDigits:0,maximumFractionDigits:3})} <small style="font:500 10px 'DM Sans';color:#9eb0a4">JOD</small></div><div class="stat-foot">Recorded locally</div></div><div class="stat-card"><div class="stat-top"><span>${T().outstanding}</span><span class="stat-icon amber">◷</span></div><div class="stat-value">${outstanding.toLocaleString(isAr()?'ar-JO':'en-US',{minimumFractionDigits:0,maximumFractionDigits:3})} <small style="font:500 10px 'DM Sans';color:#9eb0a4">JOD</small></div><div class="stat-foot">${demo.members.filter(m=>['Pending','Overdue'].includes(m.status)).length} families</div></div><div class="stat-card"><div class="stat-top"><span>${T().overdueFees}</span><span class="stat-icon lilac">!</span></div><div class="stat-value">${demo.members.filter(m=>m.status==='Overdue').length}</div><div class="stat-foot">Local follow-up list</div></div><div class="stat-card"><div class="stat-top"><span>${isAr()?'الدفعات المسجلة':'Recorded payments'}</span><span class="stat-icon blue">↗</span></div><div class="stat-value">${demo.payments.length}</div><div class="stat-foot">Stored in SQLite</div></div></div><section class="panel table-panel"><div class="table-toolbar"><div><div class="panel-title">${T().recentPayments}</div><div class="panel-subtitle">Local ledger · JOD</div></div><button class="button small" data-action="local-export">${T().csv}</button></div><table class="data-table"><thead><tr><th>${T().family}</th><th>${T().athlete}</th><th>${T().method}</th><th>${T().amount}</th><th>${T().date}</th><th>${T().receipt}</th></tr></thead><tbody>${rows||`<tr><td colspan="6"><div class="empty-state"><strong>${T().empty}</strong></div></td></tr>`}</tbody></table><div class="table-bottom"><span>${demo.payments.length} payments · ${T().statusMock}</span></div></section><div class="form-note">${T().soon}</div>`;
};

window.schedulePage=function(){
 const rows=demo.events.map(ev=>{const dt=new Date(ev.starts_at);const d=Number.isNaN(dt.getTime())?null:dt;const time=d?d.toLocaleTimeString(isAr()?'ar-JO':'en-US',{hour:'2-digit',minute:'2-digit'}):ev.starts_at;const date=d?d.toLocaleDateString(isAr()?'ar-JO':'en-US',{weekday:'short',month:'short',day:'numeric'}):'';return `<div class="event-row"><div class="event-date"><b>${d?d.toLocaleDateString(isAr()?'ar-JO':'en-US',{day:'numeric'}):'—'}</b><small>${d?d.toLocaleDateString(isAr()?'ar-JO':'en-US',{month:'short'}):''}</small></div><div class="event-info"><b>${escapeLocal(ev.title)}</b><small>${escapeLocal(ev.team||'Club event')} · ${escapeLocal(ev.facility)} · ${date}</small></div><span class="event-tag">${escapeLocal(time)}</span></div>`}).join('');
 return `${pageHeading('CLUB CALENDAR',T().scheduleTitle,T().scheduleSub,btn('<span class="plus">＋</span> '+T().addEvent,'add-event',true))}<div class="overview-grid"><section class="panel"><div class="panel-head"><div><div class="panel-title">${isAr()?'الفعاليات القادمة':'Scheduled sessions'}</div><div class="panel-subtitle">Asia/Amman local time</div></div><button class="button small" data-action="refresh">↻ ${isAr()?'تحديث':'Refresh'}</button></div>${rows||`<div class="empty-state"><strong>${T().empty}</strong></div>`}</section><section class="panel"><div class="panel-head"><div><div class="panel-title">${T().upcoming}</div><div class="panel-subtitle">${demo.events.length} ${isAr()?'مواعيد':'events'} in this local season</div></div></div>${demo.teams.slice(0,4).map(t=>`<div class="program-row"><span class="program-ball">◷</span><span class="program-copy"><b>${escapeLocal(t.name)}</b><small>${escapeLocal(t.facility)} · ${escapeLocal(t.next)}</small></span></div>`).join('')}</section></div>`;
};

window.attendancePage=function(){
 const event=demo.events[0];const roster=demo.members.filter(m=>!event||m.program===demo.teams.find(t=>t.id===event.team_id)?.program);
 const list=(roster.length?roster:demo.members.slice(0,6)).map(m=>{const saved=demo.attendance[String(m.id)]||'';return `<tr><td><div class="table-person"><span class="tiny-avatar">${escapeLocal(m.initials)}</span><b>${escapeLocal(m.name)}</b></div></td><td>${escapeLocal(m.guardian)}</td><td><select class="select-filter attendance-select" data-member-id="${m.id}"><option value="Not marked" ${!saved?'selected':''}>${isAr()?'لم يسجل':'Not marked'}</option><option value="Present" ${saved==='Present'?'selected':''}>${T().present}</option><option value="Absent" ${saved==='Absent'?'selected':''}>${T().absent}</option><option value="Excused" ${saved==='Excused'?'selected':''}>${T().excused}</option><option value="Late" ${saved==='Late'?'selected':''}>${isAr()?'متأخر':'Late'}</option></select></td><td><button class="text-link" data-action="note">＋ ${isAr()?'ملاحظة':'Note'}</button></td></tr>`}).join('');
 return `${pageHeading('SESSION ROSTER',T().attendanceTitle,T().attendanceSub,btn(T().saveAttendance,'save-attendance',true))}<div class="metric-strip"><div class="mini-metric"><span>${T().sessionToday}</span><strong>${demo.events.length}</strong><small>Local season schedule</small></div><div class="mini-metric"><span>${T().peopleCount}</span><strong>${roster.length||demo.members.length}</strong><small>Available roster</small></div><div class="mini-metric"><span>${isAr()?'حالة محفوظة':'Saved attendance'}</span><strong>${demo.summary.attendance_present||0}</strong><small>Stored in SQLite</small></div></div><section class="panel"><div class="panel-head"><div><div class="panel-title">${escapeLocal(event?.title||'Choose a session')}</div><div class="panel-subtitle">${escapeLocal(event?.facility||'Club roster')} · Asia/Amman</div></div><select class="select-filter" id="attendanceEvent">${demo.events.map(ev=>`<option value="${ev.id}">${escapeLocal(ev.title)}</option>`).join('')}</select></div><table class="data-table"><thead><tr><th>${T().athlete}</th><th>${T().GUARDIAN}</th><th>${isAr()?'الحضور':'Attendance'}</th><th>${isAr()?'ملاحظات':'Notes'}</th></tr></thead><tbody>${list}</tbody></table><div class="form-note">Attendance is saved locally with a timestamp in the audit log.</div></section>`;
};

window.messagesPage=function(){
 const selected=demo.messages.find(t=>t.active)||demo.messages[0];
 const messages=(selected?.messages||[]).map(m=>`<div class="chat-bubble ${m.sender==='You'?'own':''}">${escapeLocal(m.body)}<small>${escapeLocal(m.sender)} · ${escapeLocal(m.sent_at)}</small></div>`).join('');
 const threads=demo.messages.map((m,i)=>`<div class="message-thread ${m.active?'active':''}" data-thread-index="${i}"><small>${escapeLocal(m.updated_at||'')}</small><b>${escapeLocal(m.name)}</b><p>${escapeLocal(m.preview)}</p></div>`).join('');
 return `${pageHeading('FAMILY COMMUNICATION',T().messagesTitle,T().messagesSub,btn('<span class="plus">＋</span> '+T().newMessage,'new-message',true))}<section class="panel message-layout"><div class="message-list"><div class="message-filter"><span class="text-link">${isAr()?'المحادثات المحفوظة':'Saved conversations'}</span></div>${threads}</div><div class="message-view"><div class="message-view-head"><b id="threadTitle">${escapeLocal(selected?.name||'')}</b><small>${escapeLocal(selected?.audience||'')} · local messages</small></div><div class="chat-body" id="chatBody">${messages||`<div class="empty-state"><strong>${isAr()?'ابدأ المحادثة':'Start the conversation'}</strong></div>`}</div><form class="composer" id="dbComposerForm"><input id="dbComposerInput" placeholder="${T().compose}" aria-label="${T().compose}" /><button class="button primary" type="submit">${T().send} →</button></form></div></section><div class="form-note">Messages are saved locally. External SMS, WhatsApp, email and push delivery are not configured.</div>`;
};

window.facilitiesPage=function(){
 const bookings=demo.facilityBookings||[];
 return `${pageHeading('AMMAN ATHLETIC CLUB',T().facilitiesTitle,T().facilitiesSub,btn('<span class="plus">+</span> '+T().bookFacility,'book-facility',true))}<div class="stats-grid"><div class="stat-card"><div class="stat-top"><span>Active facilities</span><span class="stat-icon">&#9673;</span></div><div class="stat-value">${demo.facilities.length}</div><div class="stat-foot">Amman</div></div><div class="stat-card"><div class="stat-top"><span>Booking requests</span><span class="stat-icon blue">&#9635;</span></div><div class="stat-value">${bookings.length}</div><div class="stat-foot">${bookings.filter(b=>b.status==='Requested').length} awaiting review</div></div></div><div class="team-grid">${demo.facilities.map((f,i)=>`<section class="panel facility-card"><div class="facility-art ${i%3===1?'blue':i%3===2?'amber':''}"><span>SPORT</span><small>AMMAN ? JORDAN</small></div><h3>${escapeLocal(f.name)}</h3><p>${escapeLocal(f.location)}</p><div class="facility-meta"><span>${T().facility}</span><b>${escapeLocal(f.sport)}</b></div><div class="facility-meta"><span>Status</span><b>${escapeLocal(f.status)}</b></div><button class="button light team-button" data-action="book-facility">${T().bookFacility} &rarr;</button></section>`).join('')}</div><section class="panel table-panel"><div class="table-toolbar"><div><div class="panel-title">Facility booking requests</div><div class="panel-subtitle">Review saved requests and record a decision</div></div><button class="button small" data-action="refresh">Refresh</button></div><table class="data-table"><thead><tr><th>Facility</th><th>Team</th><th>Date</th><th>Time</th><th>Status</th><th>Decision</th></tr></thead><tbody>${bookings.map(b=>`<tr><td>${escapeLocal(b.facility||'?')}</td><td>${escapeLocal(b.team||'?')}</td><td>${escapeLocal(b.booking_date)}</td><td>${escapeLocal(b.starts_at)}</td><td><span class="status-pill ${b.status==='Approved'?'active':b.status==='Declined'?'inactive':'pending'}">${escapeLocal(b.status)}</span></td><td>${b.status==='Requested'?`<button class="button small" data-booking-id="${b.id}" data-booking-status="Approved">Approve</button> <button class="button small" data-booking-id="${b.id}" data-booking-status="Declined">Decline</button>`:'?'}</td></tr>`).join('')||'<tr><td colspan="6"><div class="empty-state"><strong>No facility requests yet</strong></div></td></tr>'}</tbody></table></section>`;
};

window.websitePage=function(){
 const p=demo.profile||{};const published=Boolean(p.published);
 return `${pageHeading('PUBLIC CLUB PROFILE',T().websiteTitle,T().websiteSub,btn(T().editWebsite,'edit-website'))}<section class="welcome-banner"><div class="banner-content"><div class="banner-label">✳ ${T().setup}</div><h2>${escapeLocal(p.display_name||'Amman Athletic Club')}</h2><p>${escapeLocal(p.tagline||T().localSub)}</p></div><span class="status-pill ${published?'active':'pending'}">● ${published?T().published:(isAr()?'غير منشور':'Not published')}</span><div class="banner-art" aria-hidden="true"><svg viewBox="0 0 260 210" fill="none"><path d="M48 164V58h164v106H48Z" stroke="#d7ee7b" stroke-width="2"/><path d="M70 139h50V83H70v56Zm72 0h50M142 109h50M70 69l60-38 60 38" stroke="#d7ee7b" stroke-opacity=".7" stroke-width="3"/></svg></div></section><div class="metric-strip"><div class="mini-metric"><span>${isAr()?'الرابط المحلي':'Local preview'}</span><strong>/${escapeLocal(p.slug||'amman-ac')}</strong><small>Preview only · no public domain</small></div><div class="mini-metric"><span>${T().registrationsOpen}</span><strong>${demo.programs.length} programs</strong><small>Registration form available locally</small></div><div class="mini-metric"><span>${isAr()?'اللغات':'Languages'}</span><strong>العربية · English</strong><small>Asia/Amman · JOD</small></div></div><div class="overview-grid"><section class="panel"><div class="panel-head"><div><div class="panel-title">${isAr()?'أقسام الصفحة':'Public page sections'}</div><div class="panel-subtitle">Local club profile fields</div></div><button class="text-link" data-action="edit-website">${T().editWebsite} →</button></div>${[['Club profile',p.display_name||'Amman Athletic Club'],['Programs',`${demo.programs.length} programs`],['Facilities',`${demo.facilities.length} facilities`],['Registration','Family application and guardian consent']].map(r=>`<div class="activity-row"><span class="activity-avatar green">✓</span><div class="activity-copy"><p><b>${escapeLocal(r[0])}</b></p><small>${escapeLocal(r[1])}</small></div><span class="status-pill active">${isAr()?'محلي':'Local'}</span></div>`).join('')}</section><section class="panel"><div class="panel-title">${isAr()?'معلومات النادي':'Club information'}</div><div class="facility-meta"><span>${isAr()?'العنوان':'Address'}</span><b>${escapeLocal(p.address||'Amman, Jordan')}</b></div><div class="facility-meta"><span>${isAr()?'الهاتف':'Phone'}</span><b>${escapeLocal(p.phone||'Not set')}</b></div><div class="facility-meta"><span>${isAr()?'الحالة':'Status'}</span><b>${published?T().published:(isAr()?'غير منشور':'Not published')}</b></div><div class="form-note">${T().soon}</div></section></div>`;
};

window.membersPage=function(){
 const q=(state.query||'').toLowerCase();
 const list=demo.members.filter(m=>[m.name,m.guardian,m.program,m.status].join(' ').toLowerCase().includes(q));
 const rows=list.map(m=>`<tr><td><div class="table-person"><span class="tiny-avatar">${escapeLocal(m.initials||m.name.split(/\s+/).map(x=>x[0]).join('').slice(0,2))}</span><span><b>${escapeLocal(m.name)}</b><small>${escapeLocal(m.age)} years</small></span></div></td><td>${escapeLocal(m.program)}</td><td>${escapeLocal(m.guardian)}<small class="member-phone">${escapeLocal(m.phone||'')}</small></td><td>${escapeLocal(m.fee||`${(Number(m.fee_fils||0)/1000).toFixed(3)} JOD`)}</td><td><span class="status-pill ${m.status==='Active'?'active':m.status==='Overdue'?'overdue':'pending'}">${escapeLocal(m.status)}</span></td><td><button class="button small" data-action="profile" data-member-id="${m.id}">Details</button></td></tr>`).join('');
 const active=demo.members.filter(m=>m.status==='Active').length,pending=demo.members.filter(m=>m.status==='Pending').length,overdue=demo.members.filter(m=>m.status==='Overdue').length;
 return `${pageHeading('CLUB ROSTER',T().membersTitle,T().membersSub,`${btn(T().csv,'export')}${btn('<span class="plus">+</span> '+T().addAthlete,'add-athlete',true)}`)}<div class="metric-strip"><div class="mini-metric"><span>${T().peopleCount}</span><strong>${demo.members.length}</strong><small>${active} ${T().active}</small></div><div class="mini-metric"><span>${T().awaiting}</span><strong>${pending}</strong><small>${demo.registrationsList.filter(r=>r.status==='Needs review').length} ${T().needsReview}</small></div><div class="mini-metric"><span>Fees needing follow-up</span><strong>${overdue}</strong><small>Local ledger status</small></div></div><section class="panel table-panel"><div class="table-toolbar"><div class="search-field"><input id="memberSearch" value="${escapeLocal(state.query||'')}" placeholder="${T().search}" aria-label="${T().search}" /></div><span class="panel-subtitle">${list.length} athletes</span></div><table class="data-table"><thead><tr><th>${T().athlete}</th><th>${T().program}</th><th>${T().GUARDIAN}</th><th>${T().feeStatus}</th><th>${T().status}</th><th></th></tr></thead><tbody>${rows||`<tr><td colspan="6"><div class="empty-state"><strong>${T().empty}</strong></div></td></tr>`}</tbody></table><div class="table-bottom"><span>Local club roster ? SQLite</span></div></section>`;
};
window.teamsPage=function(){
 const coaches=new Set(demo.teams.map(t=>t.coach).filter(Boolean)).size;
 const assigned=demo.teams.reduce((n,t)=>n+Number(t.players||0),0);
 const today=new Date().toISOString().slice(0,10),sessions=demo.events.filter(e=>String(e.starts_at).startsWith(today)).length;
 return `${pageHeading('CLUB TEAMS',T().teamTitle,T().teamSub,btn('<span class="plus">+</span> '+T().newTeam,'new-team',true))}<div class="stats-grid"><div class="stat-card"><div class="stat-top"><span>Total teams</span><span class="stat-icon blue">&#9670;</span></div><div class="stat-value">${demo.teams.length}</div><div class="stat-foot">${[...new Set(demo.teams.map(t=>t.sport))].length} sports</div></div><div class="stat-card"><div class="stat-top"><span>${T().peopleCount}</span><span class="stat-icon">&#9675;</span></div><div class="stat-value">${assigned}</div><div class="stat-foot">Assigned to rosters</div></div><div class="stat-card"><div class="stat-top"><span>${T().coach}</span><span class="stat-icon lilac">&#9675;</span></div><div class="stat-value">${coaches}</div><div class="stat-foot">Coaches on team records</div></div><div class="stat-card"><div class="stat-top"><span>Sessions today</span><span class="stat-icon amber">&#9635;</span></div><div class="stat-value">${sessions}</div><div class="stat-foot">From saved club schedule</div></div></div><div class="team-grid">${demo.teams.map((t,i)=>`<section class="panel team-card"><div class="team-top"><span class="team-sport ${escapeLocal(t.tone||'')}">${['Football','Basketball','Sport','Swimming'][i%4]}</span><button class="text-link" data-action="profile" data-team-id="${t.id}" aria-label="${escapeLocal(t.name)} details">&#8226;&#8226;&#8226;</button></div><h3>${escapeLocal(t.name)}</h3><p>${escapeLocal(t.sport)} ? ${Number(t.players||0)} ${T().players}</p><div class="team-coach"><span class="tiny-avatar">${escapeLocal((t.coach||'').split(/\s+/).map(x=>x[0]).join('').slice(0,2))}</span><span><small>${T().coach}</small><b>${escapeLocal(t.coach||'?')}</b></span></div><div class="team-meta"><span>${T().nextSession}</span><b>${escapeLocal(t.next||'?')}</b></div><button class="button light team-button" data-action="roster" data-team-id="${t.id}" data-name="${escapeLocal(t.name)}">${T().viewRoster} &rarr;</button></section>`).join('')||`<section class="panel empty-state"><strong>No teams yet</strong><p>Create a team to begin assigning athletes.</p></section>`}</div>`;
};
window.bindPageEvents=function(){
  legacyBindPageEvents();
  document.getElementById('memberSearch')?.addEventListener('input',e=>{e.stopImmediatePropagation();const q=e.currentTarget.value.toLowerCase();document.querySelectorAll('.data-table tbody tr').forEach(row=>row.hidden=!row.textContent.toLowerCase().includes(q));},{capture:true});
  document.querySelectorAll('.tabs .tab').forEach((button,index)=>button.addEventListener('click',()=>{
    const filter=['all','Needs review','Approved','Waitlist','Declined'][index]||'all';
    document.querySelectorAll('.tabs .tab').forEach((tab,i)=>{tab.classList.toggle('active',i===index);tab.setAttribute('aria-pressed',String(i===index));});
    document.querySelectorAll('.data-table tbody tr').forEach(row=>{const status=row.querySelector('.status-pill')?.textContent.trim();row.hidden=filter!=='all'&&status!==filter;});
  }));
  document.querySelectorAll('[data-action="view-receipt"]').forEach(button=>button.addEventListener('click',()=>{
    const payment=demo.payments.find(p=>p.receipt===button.textContent.trim());if(!payment)return;
    const receipt=`<div class="review-details"><div><span>${T().receipt}</span><b>${escapeLocal(payment.receipt)}</b></div><div><span>${T().family}</span><b>${escapeLocal(payment.family)}</b></div><div><span>${T().athlete}</span><b>${escapeLocal(payment.athlete)}</b></div><div><span>${T().amount}</span><b>${escapeLocal(payment.amount)} JOD</b></div><div><span>${T().method}</span><b>${escapeLocal(payment.method)}</b></div><div><span>${T().date}</span><b>${escapeLocal(payment.date)}</b></div></div><div class="form-note">Local receipt record. It does not confirm a payment provider transaction.</div><div class="modal-actions"><button type="button" class="button" data-action="close-modal">${T().cancel}</button><button type="button" class="button primary" id="printLocalReceipt">Print receipt</button></div>`;
    showLocalModal('receipt','Payment receipt',receipt,'LOCAL LEDGER');document.getElementById('printLocalReceipt')?.addEventListener('click',()=>window.print());
  }));
  document.querySelectorAll('[data-booking-id][data-booking-status]').forEach(button=>button.addEventListener('click',async()=>{try{const r=await localApi(`/api/facility-bookings/${button.dataset.bookingId}`,'PATCH',{status:button.dataset.bookingStatus});applySnapshot(r.data);render();toast('Facility request updated');}catch(err){toast(err.message,true);}}));
  document.querySelectorAll('[data-review-status]').forEach(button=>button.addEventListener('click',async()=>{
    try{const r=await localApi(`/api/registrations/${state.reviewId}`,'PATCH',{status:button.dataset.reviewStatus});applySnapshot(r.data);closeModal();render();toast(isAr()?'تم حفظ قرار المراجعة':'Review decision saved');}
    catch(err){toast(err.message,true);}
  }));
  document.querySelectorAll('.message-thread[data-thread-index]').forEach(el=>el.addEventListener('click',()=>{
    demo.messages.forEach(t=>t.active=false);const thread=demo.messages[Number(el.dataset.threadIndex)];if(thread)thread.active=true;render();
  }));
  document.getElementById('dbComposerForm')?.addEventListener('submit',async e=>{
    e.preventDefault();const input=document.getElementById('dbComposerInput');if(!input.value.trim()||!demo.messages.length)return;
    try{const r=await localApi('/api/messages','POST',{thread_id:demo.messages.find(t=>t.active)?.id,message:input.value.trim()});applySnapshot(r.data);render();toast(T().messageSent);}
    catch(err){toast(err.message,true);}
  });
  document.querySelectorAll('[data-action="refresh"]').forEach(el=>el.addEventListener('click',async()=>{try{await reloadSnapshot();render();toast(isAr()?'تم التحديث':'Data refreshed');}catch(err){toast(err.message,true);}}));
  document.querySelectorAll('[data-action="local-export"]').forEach(el=>el.addEventListener('click',()=>{
    const rows=state.page==='payments'?[['Family','Athlete','Amount JOD','Method','Date','Receipt'],...demo.payments.map(p=>[p.family,p.athlete,p.amount,p.method,p.date,p.receipt])]:[['Athlete','Guardian','Program','Status','Fee JOD'],...demo.members.map(m=>[m.name,m.guardian,m.program,m.status,(m.fee_fils/1000).toFixed(3)])];
    const csv=rows.map(row=>row.map(v=>`"${String(v??'').replaceAll('"','""')}"`).join(',')).join('\r\n');
  const blob=new Blob(['\ufeff'+csv],{type:'text/csv;charset=utf-8'});const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=state.page==='payments'?'malaeb-payments.csv':'malaeb-athletes.csv';a.click();URL.revokeObjectURL(a.href);
  }));
  document.querySelectorAll('[data-action="open-apply"]').forEach(el=>el.addEventListener('click',()=>navigate('join')));
  document.querySelectorAll('[data-action="help"]').forEach(el=>el.addEventListener('click',()=>openModal('help')));
  document.querySelectorAll('[data-action="change-language"]').forEach(el=>el.addEventListener('click',()=>{closeModal();document.getElementById('langBtn')?.click();}));
};

document.addEventListener('click',e=>{
  const review=e.target.closest('[data-registration-id]');
  if(review) state.reviewId=Number(review.dataset.registrationId);
  const member=e.target.closest('[data-member-id]');if(member){state.selectedMemberId=Number(member.dataset.memberId);state.selectedTeamId=0;}
  const team=e.target.closest('[data-team-id]');if(team){state.selectedTeamId=Number(team.dataset.teamId);state.selectedMemberId=0;}
  const roster=e.target.closest('[data-action="roster"]');
  if(roster) state.selectedTeamName=roster.dataset.name;
},true);

const originalDocumentClick=window.__malaebLocalClickBound;
if(!originalDocumentClick){
  window.__malaebLocalClickBound=true;
  document.addEventListener('click',async e=>{
    const action=e.target.closest('[data-action]')?.dataset.action;
    if(action==='save-attendance'){
      const eventId=document.getElementById('attendanceEvent')?.value||demo.events[0]?.id;
      const attendance=[...document.querySelectorAll('.attendance-select')].filter(select=>select.value!=='Not marked'&&select.value!=='لم يسجل').map(select=>({member_id:Number(select.dataset.memberId),status:select.value}));
      if(!eventId)return toast(isAr()?'أضف موعداً أولاً':'Add a session before recording attendance',true);
      try{const r=await localApi('/api/attendance','POST',{event_id:Number(eventId),attendance});applySnapshot(r.data);render();toast(isAr()?'تم حفظ الحضور':'Attendance saved to SQLite');}
      catch(err){toast(err.message,true);}
    }
  });
}

function familyRegistrationPage(){
 const ar=isAr();
 const tx=(en,arText)=>ar?arText:en;
 const c={
  brand:tx('Malaeb Club','ملعب'), preview:tx('LOCAL PREVIEW','معاينة محلية'),
  eyebrow:tx('YOUTH PROGRAMS · AMMAN','برامج الناشئين · عمّان'),
  title:tx('Find the right team for your child','اختر الفريق المناسب لطفلك'),
  intro:tx('A few details help the club recommend the right program. It takes about a minute.','تساعد هذه المعلومات النادي على اختيار البرنامج المناسب. يستغرق التسجيل نحو دقيقة.'),
  athleteStep:tx('Athlete','اللاعب'), guardianStep:tx('Guardian','ولي الأمر'), reviewStep:tx('Review','مراجعة'),
  step1:tx('Let’s meet the athlete','لنبدأ ببيانات اللاعب'), step1sub:tx('Tell us who you are signing up and which sport they are interested in.','أدخل بيانات اللاعب واختر الرياضة المناسبة.'),
  step2:tx('Who should we contact?','بمن نتواصل؟'), step2sub:tx('A parent or legal guardian should complete this section.','يرجى إدخال بيانات ولي الأمر أو الوصي القانوني.'),
  step3:tx('Check everything before sending','راجع البيانات قبل الإرسال'), step3sub:tx('The club will review this request and follow up with the guardian.','سيراجع النادي الطلب ويتواصل مع ولي الأمر.'),
  athlete:tx('Athlete full name','اسم اللاعب الكامل'), age:tx('Age','العمر'), program:tx('Program','البرنامج'),
  choose:tx('Choose a program','اختر البرنامج'), guardian:tx('Parent or guardian full name','اسم ولي الأمر'), phone:tx('Mobile number','رقم الهاتف المحمول'),
  email:tx('Email address (optional)','البريد الإلكتروني (اختياري)'), phoneHint:tx('Include country code, for example +962 7X XXX XXXX','أدخل رمز الدولة، مثال: +962 7X XXX XXXX'),
  consent:tx('I am the parent or legal guardian of this athlete, and I agree that the club may contact me about this application.','أؤكد أنني ولي أمر اللاعب أو الوصي القانوني، وأوافق على تواصل النادي معي بشأن هذا الطلب.'),
  back:tx('Back','رجوع'), next:tx('Continue','متابعة'), review:tx('Review application','مراجعة الطلب'), submit:tx('Send application','إرسال الطلب'),
  success:tx('Application received','تم استلام الطلب'),
  successSub:tx('The club has saved your request. Keep this reference if you contact them about it.','حفظ النادي طلبك. احتفظ بالرقم المرجعي عند التواصل مع النادي.'),
  ref:tx('Application reference','الرقم المرجعي للطلب'), home:tx('Back to club workspace','العودة إلى مساحة النادي'),
  local:tx('This preview stores the application in the club computer’s local database. No payment is taken here.','تُحفظ بيانات المعاينة في قاعدة بيانات النادي على هذا الكمبيوتر. لا يتم تحصيل أي رسوم هنا.'),
  edit:tx('Edit','تعديل'), minute:tx('1 minute','دقيقة واحدة')
 };;
 const profile=demo.profile||{};
 if(state.applicationSubmitted){
  return `<div class="family-wizard-shell"><header class="family-topline"><a class="family-brand" href="#overview"><span class="brand-mark"><svg viewBox="0 0 36 36"><path d="M18 3.5 31 11v14L18 32.5 5 25V11L18 3.5Z"/><path d="m18 10 7 4v8l-7 4-7-4v-8l7-4Z"/></svg></span><span>${escapeLocal(profile.display_name||c.brand)}</span></a><span class="preview-chip">${c.preview}</span></header><section class="application-card application-success"><span class="success-orbit"><span>?</span></span><div class="family-kicker">${escapeLocal(profile.display_name||c.brand)}</div><h1>${c.success}</h1><p>${c.successSub}</p><div class="application-reference"><small>${c.ref}</small><b>${escapeLocal(state.applicationReference||'')}</b></div><button class="button primary" type="button" data-action="back-admin">${c.home}<span aria-hidden="true">&#8594;</span></button></section></div>`;
 }
 const step=Math.max(1,Math.min(3,Number(state.applicationStep||1)));
 const programs=demo.programs.map(p=>({id:p.id,name:p.name,fee:(Number(p.fee_fils||0)/1000).toFixed(3)}));
 const stages=[c.athleteStep,c.guardianStep,c.reviewStep];
 const progress=`<ol class="application-steps" aria-label="Registration progress">${stages.map((label,i)=>`<li class="${i+1===step?'current':i+1<step?'complete':''}" ${i+1===step?'aria-current="step"':''}><span class="step-number">${i+1<step?'&#10003;':i+1}</span><span>${label}</span></li>`).join('')}</ol><div class="step-progress-track"><span style="width:${step*33.333}%"></span></div>`;
 const formField=(label,name,type='text',value='',extra='',required=true)=>`<div class="field"><label for="${name}">${label}${required?' <span aria-hidden="true">*</span>':''}</label><input id="${name}" name="${name}" type="${type}" value="${escapeLocal(value)}" ${required?'required':''} ${extra}></div>`;
 const currentProgram=programs.find(p=>p.name===applicationDraft.program);
 let body='';
 if(step===1){
  body=`<div class="application-section-head"><span class="section-step">01</span><div><h2>${c.step1}</h2><p>${c.step1sub}</p></div></div><div class="form-grid application-grid">${formField(c.athlete,'athlete','text',applicationDraft.athlete||'','autocomplete="name" minlength="2" maxlength="100"')}${formField(c.age,'age','number',applicationDraft.age||'','min="4" max="19" step="1" inputmode="numeric"')}
   <div class="field full"><label for="program">${c.program} <span aria-hidden="true">*</span></label><select id="program" name="program" required><option value="" disabled ${applicationDraft.program?'':'selected'}>${c.choose}</option>${programs.map(p=>`<option value="${escapeLocal(p.name)}" ${applicationDraft.program===p.name?'selected':''}>${escapeLocal(p.name)} ? ${p.fee} JOD</option>`).join('')}</select></div></div><div class="application-note"><span class="note-icon">i</span><span>${c.local}</span></div><div class="wizard-actions wizard-actions-end"><button class="button primary" type="button" data-wizard-next>${c.next}<span aria-hidden="true">&#8594;</span></button></div>`;
 } else if(step===2){
  body=`<div class="application-section-head"><span class="section-step">02</span><div><h2>${c.step2}</h2><p>${c.step2sub}</p></div></div><div class="selected-athlete"><span class="selected-avatar">${escapeLocal((applicationDraft.athlete||'A').split(/\s+/).map(x=>x[0]).join('').slice(0,2).toUpperCase())}</span><span><small>${c.athleteStep}</small><b>${escapeLocal(applicationDraft.athlete||'')}</b></span><button type="button" class="text-link" data-wizard-back="1">${c.edit}</button></div><div class="form-grid application-grid guardian-grid">${formField(c.guardian,'guardian','text',applicationDraft.guardian||'','autocomplete="name" minlength="2" maxlength="100"')}${formField(c.phone,'mobile','tel',applicationDraft.mobile||'','autocomplete="tel" inputmode="tel" placeholder="+962 7X XXX XXXX" pattern="[+0-9()\\s-]{7,22}" aria-describedby="phoneHelp"')}${formField(c.email,'email','email',applicationDraft.email||'','autocomplete="email" maxlength="160"',false)}<small class="field-hint" id="phoneHelp">${c.phoneHint}</small></div><div class="application-note"><span class="note-icon">i</span><span>${c.local}</span></div><div class="wizard-actions"><button class="button" type="button" data-wizard-back="1">${c.back}</button><button class="button primary" type="button" data-wizard-next>${c.review}<span aria-hidden="true">&#8594;</span></button></div>`;
 } else {
  body=`<div class="application-section-head"><span class="section-step">03</span><div><h2>${c.step3}</h2><p>${c.step3sub}</p></div></div><div class="application-summary"><div class="summary-heading"><span class="selected-avatar">${escapeLocal((applicationDraft.athlete||'A').split(/\s+/).map(x=>x[0]).join('').slice(0,2).toUpperCase())}</span><div><small>${c.athleteStep}</small><b>${escapeLocal(applicationDraft.athlete||'')}</b></div><button type="button" class="text-link" data-wizard-back="1">${c.edit}</button></div><dl><div><dt>${c.age}</dt><dd>${escapeLocal(applicationDraft.age||'')} ${tx('years','سنة')}</dd></div><div><dt>${c.program}</dt><dd>${escapeLocal(currentProgram?.name||applicationDraft.program||'')}</dd></div><div><dt>${c.guardian}</dt><dd>${escapeLocal(applicationDraft.guardian||'')}</dd></div><div><dt>${c.phone}</dt><dd dir="ltr">${escapeLocal(applicationDraft.mobile||'')}</dd></div>${applicationDraft.email?`<div><dt>${c.email}</dt><dd>${escapeLocal(applicationDraft.email)}</dd></div>`:''}</dl><button type="button" class="text-link summary-edit" data-wizard-back="2">${c.edit} ${c.athleteStep} · ${c.guardianStep}</button></div><label class="consent-check"><input type="checkbox" name="consent" value="yes" required><span>${c.consent}</span></label><div class="application-note"><span class="note-icon">i</span><span>${c.local}</span></div><div class="wizard-actions"><button class="button" type="button" data-wizard-back="2">${c.back}</button><button class="button primary" type="submit">${c.submit}<span aria-hidden="true">&#8594;</span></button></div>`;
 }
 return `<div class="family-wizard-shell"><header class="family-topline"><a class="family-brand" href="#overview"><span class="brand-mark"><svg viewBox="0 0 36 36"><path d="M18 3.5 31 11v14L18 32.5 5 25V11L18 3.5Z"/><path d="m18 10 7 4v8l-7 4-7-4v-8l7-4Z"/></svg></span><span>${escapeLocal(profile.display_name||c.brand)}</span></a><span class="preview-chip">${c.preview}</span></header><div class="family-intro"><div class="family-kicker">${c.eyebrow}</div><h1>${c.title}</h1><p>${c.intro}</p><span class="time-chip">&#9719; ${c.minute}</span></div><section class="application-card"><div class="application-progress-head"><span>${tx(`STEP ${step} OF 3`,`الخطوة ${['','١','٢','٣'][step]} من ٣`)}</span><span>${stages[step-1]}</span></div>${progress}<form id="familyWizardForm" novalidate><div class="application-stage" data-step="${step}">${body}</div></form><footer class="application-footer"><span>${escapeLocal(profile.display_name||c.brand)}</span><span>JOD · Amman</span></footer></section><button class="family-back-admin" type="button" data-action="back-admin">${tx('Back to club workspace','العودة إلى مساحة النادي')}</button></div>`;
}

function repairLegacyArabic(value){
  if(!/[ØÙ]/.test(value))return value;
  const cp1252={0x20ac:0x80,0x201a:0x82,0x0192:0x83,0x201e:0x84,0x2026:0x85,0x2020:0x86,0x2021:0x87,0x02c6:0x88,0x2030:0x89,0x0160:0x8a,0x2039:0x8b,0x0152:0x8c,0x017d:0x8e,0x2018:0x91,0x2019:0x92,0x201c:0x93,0x201d:0x94,0x2022:0x95,0x2013:0x96,0x2014:0x97,0x02dc:0x98,0x2122:0x99,0x0161:0x9a,0x203a:0x9b,0x0153:0x9c,0x017e:0x9e,0x0178:0x9f};
  try{const bytes=[];for(const char of value){const cp=char.codePointAt(0);if(cp<=255)bytes.push(cp);else if(cp1252[cp])bytes.push(cp1252[cp]);else return value;}const decoded=new TextDecoder('utf-8',{fatal:true}).decode(new Uint8Array(bytes));return /[\u0600-\u06ff]/.test(decoded)?decoded:value;}catch{return value;}
}
function repairRenderedArabic(){
  const walker=document.createTreeWalker(document.body,NodeFilter.SHOW_TEXT);let node;
  while((node=walker.nextNode()))node.nodeValue=repairLegacyArabic(node.nodeValue);
  document.body.querySelectorAll('*').forEach(el=>{for(const attr of ['placeholder','aria-label','title','data-ar']){const value=el.getAttribute(attr);if(value)el.setAttribute(attr,repairLegacyArabic(value));}});
}

window.render=function(){
  document.body.classList.toggle('family-page',state.page==='join');
  if(state.page==='join'){
    document.documentElement.lang=state.lang;document.documentElement.dir=isAr()?'rtl':'ltr';
    document.getElementById('crumbCurrent').textContent=isAr()?'تسجيل العائلة':'Family registration';
    document.querySelectorAll('.nav-item').forEach(a=>a.classList.remove('active'));
    document.getElementById('pageContent').innerHTML=familyRegistrationPage();
  }else{state.applicationSubmitted=false;legacyRender();}
  const bar=document.querySelector('.top-actions');
  if(bar&&!document.getElementById('dbState')){const b=document.createElement('span');b.id='dbState';bar.insertBefore(b,bar.firstChild);}
  const dbBadge=document.getElementById('dbState');if(dbBadge){dbBadge.className=`db-state ${databaseReady?'connected':databaseError?'offline':''}`;dbBadge.textContent=databaseReady?(isAr()?'قاعدة محلية متصلة':'Local SQLite connected'):databaseError?(isAr()?'قاعدة البيانات غير متصلة':'Database offline'):(isAr()?'جارٍ الاتصال':'Connecting database');}
  if(state.page==='registration'){
    const actions=document.querySelector('.page-heading .heading-actions');
    if(actions&&!actions.querySelector('[data-action="open-apply"]')){const b=document.createElement('button');b.className='button';b.dataset.action='open-apply';b.textContent=isAr()?'معاينة نموذج العائلة':'Preview family form';actions.insertBefore(b,actions.firstChild);b.addEventListener('click',()=>navigate('join'));}
  }
  if(state.page==='website'){
    const actions=document.querySelector('.page-heading .heading-actions');
    if(actions&&!actions.querySelector('[data-action="open-apply"]')){const b=document.createElement('button');b.className='button';b.dataset.action='open-apply';b.textContent=isAr()?'معاينة التسجيل':'Preview registration';actions.appendChild(b);b.addEventListener('click',()=>navigate('join'));}
  }
  repairRenderedArabic();
  document.querySelector('[data-action="back-admin"]')?.addEventListener('click',()=>{state.applicationSubmitted=false;state.applicationStep=1;applicationDraft={};try{sessionStorage.removeItem('malaeb-family-draft');}catch{}navigate('overview');});
  const wizard=document.getElementById('familyWizardForm');
  const saveWizardDraft=()=>{if(!wizard)return;for(const [key,value] of new FormData(wizard))if(key!=='consent')applicationDraft[key]=value;try{sessionStorage.setItem('malaeb-family-draft',JSON.stringify(applicationDraft));}catch{}};
  wizard?.querySelectorAll('[data-wizard-next]').forEach(button=>button.addEventListener('click',()=>{if(!wizard.reportValidity())return;saveWizardDraft();state.applicationStep=Math.min(3,Number(state.applicationStep||1)+1);render();}));
  wizard?.querySelectorAll('[data-wizard-back]').forEach(button=>button.addEventListener('click',()=>{saveWizardDraft();state.applicationStep=Number(button.dataset.wizardBack)||Math.max(1,Number(state.applicationStep||1)-1);render();}));
  wizard?.querySelectorAll('input,select').forEach(input=>input.addEventListener('input',saveWizardDraft));
  wizard?.addEventListener('submit',async e=>{
    e.preventDefault();if(!wizard.reportValidity())return;saveWizardDraft();
    const payload={...applicationDraft,consent:new FormData(wizard).get('consent')};
    const submit=wizard.querySelector('[type="submit"]');if(submit){submit.disabled=true;submit.setAttribute('aria-busy','true');}
    try{const result=await localApi('/api/registrations','POST',payload);applySnapshot(result.data);state.applicationReference=`M-${String(result.id).padStart(6,'0')}`;state.applicationSubmitted=true;state.applicationStep=1;applicationDraft={};try{sessionStorage.removeItem('malaeb-family-draft');}catch{}render();}
    catch(err){toast(err.message,true);if(submit){submit.disabled=false;submit.removeAttribute('aria-busy');}}
  });
};

window.addEventListener('DOMContentLoaded',async()=>{
  try{await reloadSnapshot();render();}
  catch(err){databaseError=err.message;render();toast('Local database unavailable: '+err.message,true);}
});
