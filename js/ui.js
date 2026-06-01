// ══ THEME ══
let isDark = localStorage.getItem('dct-theme') !== 'light';

function applyTheme(){
  document.documentElement.classList.toggle('light',!isDark);
  const html = isDark
    ? '<path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>'
    : '<circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>';
  document.querySelectorAll('.theme-icon').forEach(ic => { ic.innerHTML = html; });
}
function toggleTheme(){ isDark=!isDark; localStorage.setItem('dct-theme',isDark?'dark':'light'); applyTheme(); }
applyTheme();

// ══ NAV ══
function showScreen(id){
  document.querySelectorAll('.screen').forEach(s=>s.classList.remove('active'));
  document.getElementById(id).classList.add('active');
}

// ══ ESTADO DE VENCIMIENTO ══
const WARN_DAYS = 30; // umbral "próximo a vencer"

// Parseo date-only en hora LOCAL. new Date('YYYY-MM-DD') parsea en UTC y, combinado
// con setHours local, corre la fecha un día en zonas con offset negativo (AR = UTC-3).
function _hoy0(){ const t=new Date(); t.setHours(0,0,0,0); return t; }
function _parseVto(s){
  if(!s) return null;
  const p = String(s).split('-').map(Number);
  if(p.length < 3 || !p[0]) return null;
  return new Date(p[0], p[1]-1, p[2]); // medianoche local
}
function _diasHasta(vto){
  const exp = _parseVto(vto);
  if(!exp) return null;
  return Math.round((exp - _hoy0()) / 86400000);
}

function isVencido(vto, docId){
  if(!vto) return true;
  if(docId && NEVER_EXPIRE_DOCS.has(docId)) return false;
  const dias = _diasHasta(vto);
  return dias === null ? true : dias < 0;
}

// docState: 'sin-cargar' | 'vencido' | 'pronto' | 'ok'
function docState(data, docId){
  if(!data) return 'sin-cargar';
  if(docId && NEVER_EXPIRE_DOCS.has(docId)) return 'ok';
  if(!data.vto) return 'vencido';
  const dias = _diasHasta(data.vto);
  if(dias === null || dias < 0) return 'vencido';
  if(dias <= WARN_DAYS)         return 'pronto';
  return 'ok';
}
function diasParaVencer(vto){ return _diasHasta(vto); }

// Estado de la entidad mirando solo los documentos obligatorios: 'ok' | 'pronto' | 'bad'
function entityStatus(e,sec){
  const estados = DOCS[sec].filter(d=>d.required).map(d=>docState(e.docs[d.id], d.id));
  if(estados.some(s=>s==='vencido'||s==='sin-cargar')) return 'bad';
  if(estados.some(s=>s==='pronto')) return 'pronto';
  return 'ok';
}
function statusRank(st){ return st==='bad'?0 : st==='pronto'?1 : 2; }

function updateCounts(){
  ['chofer','tractor','semi','transporte'].forEach(s=>{
    const arr = db[s] || [];
    const n   = arr.length;
    const el  = document.getElementById('cnt-'+s);
    if(el) el.textContent = n+' '+(n===1?'registro':'registros');
    // sub-línea con vencidos / por vencer (#12)
    let vencidos=0, pronto=0;
    arr.forEach(e=>{ const st=entityStatus(e,s); if(st==='bad') vencidos++; else if(st==='pronto') pronto++; });
    if(el){
      let sub = document.getElementById('vto-'+s);
      if(!sub){ sub=document.createElement('div'); sub.id='vto-'+s; sub.className='sec-vto-line'; el.parentElement.appendChild(sub); }
      if(n===0){ sub.innerHTML=''; }
      else if(vencidos||pronto){
        let parts=[];
        if(vencidos) parts.push('<span class="vto-bad">'+vencidos+' vencido'+(vencidos!==1?'s':'')+'</span>');
        if(pronto)   parts.push('<span class="vto-warn">'+pronto+' por vencer</span>');
        sub.innerHTML = parts.join('<span class="vto-sep">·</span>');
      } else {
        sub.innerHTML = '<span class="vto-ok">✓ al día</span>';
      }
    }
  });
  renderVencBanner();
}

// Banner resumen en el home (#6)
function renderVencBanner(){
  const home = document.getElementById('s-home');
  if(!home) return;
  let vencidos=0, pronto=0, faltan=0;
  ['chofer','tractor','semi','transporte'].forEach(s=>{
    (db[s]||[]).forEach(e=>{
      DOCS[s].forEach(d=>{
        const st = docState(e.docs[d.id], d.id);
        if(st==='sin-cargar'){ if(d.required) faltan++; }
        else if(st==='vencido') vencidos++;
        else if(st==='pronto')  pronto++;
      });
    });
  });
  let banner = document.getElementById('venc-banner');
  const anchor = home.querySelector('.section-cards');
  if(!banner){
    banner = document.createElement('div');
    banner.id = 'venc-banner';
    if(anchor) anchor.parentElement.insertBefore(banner, anchor);
    else home.appendChild(banner);
  }
  if(!vencidos && !pronto && !faltan){
    banner.className = 'venc-banner venc-banner-ok';
    banner.innerHTML = '<span class="vb-ico">✓</span><span>Toda la documentación está al día</span>';
    return;
  }
  banner.className = 'venc-banner venc-banner-alert';
  let parts=[];
  if(vencidos) parts.push('<strong>'+vencidos+'</strong> vencido'+(vencidos!==1?'s':''));
  if(pronto)   parts.push('<strong>'+pronto+'</strong> por vencer');
  if(faltan)   parts.push('<strong>'+faltan+'</strong> sin cargar');
  banner.innerHTML = '<span class="vb-ico">⚠️</span><span>'+parts.join(' · ')+'</span>';
}

// ══ SYNC ══
async function syncFromDrive(){
  showToast('Actualizando…');
  await loadStateFromDrive();
  renderDetail();
}

// ══ SECTION LIST ══
function openSection(sec){
  currentSection=sec;
  _listQuery='';
  _listFilter='todos';
  document.getElementById('list-title').textContent=SECTION_LABELS[sec];
  document.getElementById('list-sub-header').textContent=
    sec==='chofer'?'Buscar por nombre o DNI':sec==='transporte'?'Buscar por empresa':'Buscar por patente';
  const si=document.getElementById('list-search'); if(si) si.value='';
  updateFilterChipsUI();
  applyListView();
  showScreen('s-list');
}

function getAvClass(sec,st){
  if(st==='bad') return 'av-bad';
  return {chofer:'av-blue',tractor:'av-green',semi:'av-amber',transporte:'av-purple'}[sec];
}
function getInitials(e,sec){
  if(sec==='chofer'){ const p=e.label.split(/[\s,]+/).filter(Boolean); return (p[0]?.[0]||'')+(p[1]?.[0]||''); }
  if(sec==='transporte') return e.label.substring(0,2);
  return e.label.substring(0,4);
}

function renderEntityList(list){
  const el=document.getElementById('entity-list');
  const empty=document.getElementById('empty-list');
  if(!list.length){ el.innerHTML=''; empty.style.display='flex'; return; }
  empty.style.display='none';
  const sorted=list.slice().sort((a,b)=>{
    const ra=statusRank(entityStatus(a,currentSection)), rb=statusRank(entityStatus(b,currentSection));
    if(ra!==rb) return ra-rb;
    return (a.label||'').localeCompare(b.label||'');
  });
  el.innerHTML=sorted.map(e=>{
    const st=entityStatus(e,currentSection);
    const badge=st==='ok'?'<span class="badge badge-ok">Vigente</span>'
               :st==='pronto'?'<span class="badge badge-warn">Por vencer</span>'
               :'<span class="badge badge-bad">Vencido</span>';
    const isVehiculo = currentSection==='tractor'||currentSection==='semi';
    const catBadge = isVehiculo && e.categoria
      ? `<span style="font-size:10px;font-family:var(--mono);font-weight:700;padding:2px 7px;border-radius:6px;background:rgba(245,158,11,0.15);color:#f59e0b;margin-left:6px;letter-spacing:1px;">CAT ${e.categoria}</span>`
      : '';
    const subLine = isVehiculo
      ? `<div style="display:flex;align-items:center;flex-wrap:wrap;">${e.sub||''}${catBadge}</div>`
      : `<div>${e.sub||''}</div>`;
    return `<div class="entity-row" onclick="openEntity('${e.id}')">
      <div class="avatar ${getAvClass(currentSection,st)}">${getInitials(e,currentSection)}</div>
      <div class="row-info"><div class="row-name">${e.label}</div><div class="row-sub">${subLine}</div></div>
      ${badge}
    </div>`;
  }).join('');
}

function normalizeSearch(s){ return (s||'').toLowerCase().replace(/\./g,'').trim(); }
let _listQuery='';
let _listFilter='todos'; // 'todos' | 'pronto' | 'vencidos'
function filterEntities(q){ _listQuery=q; applyListView(); }
function setListFilter(f){ _listFilter=f; updateFilterChipsUI(); applyListView(); }
function updateFilterChipsUI(){
  ['todos','pronto','vencidos'].forEach(f=>{
    const b=document.getElementById('lf-'+f);
    if(b) b.classList.toggle('active', f===_listFilter);
  });
}
function applyListView(){
  const nq = normalizeSearch(_listQuery);
  let list = (db[currentSection]||[]).filter(e=>!nq||normalizeSearch(e.label).includes(nq)||normalizeSearch(e.sub||'').includes(nq));
  if(_listFilter==='vencidos')    list = list.filter(e=>entityStatus(e,currentSection)==='bad');
  else if(_listFilter==='pronto') list = list.filter(e=>entityStatus(e,currentSection)==='pronto');
  renderEntityList(list);
}

// ══ DETAIL ══
function openEntity(id){
  currentEntityId=id;
  const e=(db[currentSection]||[]).find(x=>x.id===id);
  document.getElementById('detail-name').textContent=e.label;
  const isVehiculo = currentSection==='tractor'||currentSection==='semi';
  if(isVehiculo && e.categoria){
    document.getElementById('detail-sub').innerHTML =
      `<span>${e.sub||''}</span><span style="margin-left:8px;font-size:10px;font-family:var(--mono);font-weight:700;padding:2px 8px;border-radius:6px;background:rgba(245,158,11,0.18);color:#f59e0b;letter-spacing:1px;vertical-align:middle;">CAT ${e.categoria}</span>` +
      (e.pbtc ? `<span style="margin-left:6px;font-size:10px;font-family:var(--mono);color:var(--text3);">${e.pbtc}t</span>` : '');
  } else {
    document.getElementById('detail-sub').textContent=e.sub||'';
  }
  renderDetail();
  showScreen('s-detail');
}

function formatVto(vto){
  if(!vto) return '—';
  const [y,m,d]=vto.split('-');
  return `${d}/${m}/${y}`;
}

// ══ CUSTOM CONFIRM ══
function showConfirm(msg, onOk){
  let modal = document.getElementById('confirm-modal');
  if(!modal){
    modal = document.createElement('div');
    modal.id = 'confirm-modal';
    modal.style.cssText='position:fixed;inset:0;background:rgba(0,0,0,0.6);z-index:200;display:flex;align-items:center;justify-content:center;padding:24px;';
    document.body.appendChild(modal);
  }
  modal.innerHTML=`<div style="background:var(--bg2);border:1px solid var(--border2);border-radius:var(--radius);padding:24px;max-width:320px;width:100%;">
    <p style="font-size:14px;color:var(--text);line-height:1.6;margin-bottom:20px;">${msg}</p>
    <div style="display:flex;gap:10px;">
      <button onclick="document.getElementById('confirm-modal').style.display='none'" style="flex:1;padding:10px;border-radius:var(--radius-sm);border:1px solid var(--border2);background:var(--bg3);color:var(--text2);font-size:13px;cursor:pointer;font-family:var(--font);">Cancelar</button>
      <button id="confirm-ok" style="flex:1;padding:10px;border-radius:var(--radius-sm);border:none;background:var(--bad);color:#fff;font-size:13px;font-weight:600;cursor:pointer;font-family:var(--font);">Eliminar</button>
    </div>
  </div>`;
  modal.style.display='flex';
  document.getElementById('confirm-ok').onclick=()=>{ modal.style.display='none'; onOk(); };
}

async function deleteEntity(){
  const e = (db[currentSection]||[]).find(x=>x.id===currentEntityId);
  if(!e) return;
  showConfirm(`¿Eliminar <strong>${e.label}</strong> y toda su documentación?`, async ()=>{
    showToast('Eliminando…');
    // 1. Eliminar en Supabase PRIMERO (cascade borra documentos). Si falla (p.ej. RLS), abortar.
    try {
      await sbDeleteEntidad(e.id);
    } catch(err){
      console.warn('Error al eliminar en Supabase', err);
      showToast('No se pudo eliminar: ' + (err.message || 'sin permisos'));
      return; // no tocar el estado local si el server rechazó
    }
    // 2. Borrar los archivos del Storage (best-effort) — si no, quedan huérfanos en el bucket
    const paths = Object.values(e.docs || {}).map(d => d && d.storage_path).filter(Boolean);
    if(paths.length){
      try { await sbDeleteFiles(paths); }
      catch(ex){ console.warn('No se pudieron borrar todos los archivos del bucket', ex); }
    }
    // 3. Registrar en el log (best-effort) recién después del borrado OK
    sbWriteAuditLog({ accion: 'entidad_eliminada', entidad_id: e.id, entidad_label: e.label, entidad_tipo: currentSection }).catch(()=>{});
    // 3. Quitar localmente
    db[currentSection] = (db[currentSection]||[]).filter(x=>x.id!==currentEntityId);
    localStorage.setItem('dct-db', JSON.stringify(db));
    currentEntityId = null;
    updateCounts();
    showToast('✓ Eliminado correctamente');
    showScreen('s-list');
    applyListView();
  });
}

function getResumeUrl(sec, id){
  return `${window.location.origin}${window.location.pathname}?ver=${sec}&id=${id}`;
}

function copyResumeUrl(){
  const url = getResumeUrl(currentSection, currentEntityId);
  navigator.clipboard.writeText(url).then(()=>showToast('✓ URL copiada al portapapeles'));
}

function renderDetail(){
  const e=(db[currentSection]||[]).find(x=>x.id===currentEntityId);
  if(!e) return;
  const docs=DOCS[currentSection];
  const req=docs.filter(d=>d.required);
  const opt=docs.filter(d=>!d.required);
  const loaded_opt=opt.filter(d=>e.docs[d.id]);
  const pending_opt=opt.filter(d=>!e.docs[d.id]);

  const resumeUrl = getResumeUrl(currentSection, currentEntityId);
  let html=`<div style="margin:12px 16px;padding:12px 14px;background:var(--bg2);border:1px solid var(--border2);border-radius:var(--radius);">
    <div style="font-size:10px;color:var(--text3);font-family:var(--mono);text-transform:uppercase;letter-spacing:1px;margin-bottom:8px;">URL Resumen para ALET</div>
    <div style="font-size:11px;color:var(--text2);font-family:var(--mono);word-break:break-all;margin-bottom:10px;">${resumeUrl}</div>
    <div style="display:flex;gap:8px;">
      <button onclick="copyResumeUrl()" style="flex:1;padding:8px;background:var(--accent);color:#fff;border:none;border-radius:var(--radius-sm);font-size:12px;font-weight:600;cursor:pointer;font-family:var(--font);">Copiar URL</button>
      <a href="${resumeUrl}" target="_blank" style="flex:1;padding:8px;background:var(--bg3);color:var(--text2);border:1px solid var(--border2);border-radius:var(--radius-sm);font-size:12px;font-weight:600;cursor:pointer;font-family:var(--font);text-decoration:none;display:flex;align-items:center;justify-content:center;gap:5px;">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
        Ir al enlace
      </a>
      <button onclick="downloadEntidadZip()" style="padding:8px 10px;background:var(--bg3);color:var(--text2);border:1px solid var(--border2);border-radius:var(--radius-sm);font-size:12px;font-weight:600;cursor:pointer;font-family:var(--font);display:flex;align-items:center;gap:5px;">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
        ZIP
      </button>
    </div>
  </div>`;

  html+='<div class="doc-section-title">Obligatorios</div>';
  req.forEach(doc=>{ html+=renderDocCard(doc,e.docs[doc.id]); });
  if(loaded_opt.length){ html+='<div class="doc-section-title">Opcionales</div>'; loaded_opt.forEach(doc=>{ html+=renderDocCard(doc,e.docs[doc.id]); }); }
  pending_opt.forEach(doc=>{
    html+=`<button class="btn-optional" onclick="openRenew('${doc.id}','${doc.name}')">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
      Agregar: ${doc.name}</button>`;
  });
  document.getElementById('detail-content').innerHTML=html;
}

function renderDocCard(doc,data){
  const st = docState(data, doc.id);
  const neverExpires = NEVER_EXPIRE_DOCS.has(doc.id);
  const dot = st==='ok'?'dot-ok':st==='pronto'?'dot-warn':'dot-bad';
  let badge;
  if(st==='sin-cargar')   badge = `<span class="badge badge-bad">Sin cargar</span>`;
  else if(neverExpires)   badge = `<span class="badge badge-ok">Sin vencimiento</span>`;
  else if(st==='vencido') badge = `<span class="badge badge-bad">Venció ${formatVto(data.vto)}</span>`;
  else if(st==='pronto') badge = `<span class="badge badge-warn">Vence ${formatVto(data.vto)}</span>`;
  else                    badge = `<span class="badge badge-ok">Vence ${formatVto(data.vto)}</span>`;
  const driveBtn = data && data.storage_path
    ? `<button class="btn-sm btn-sm-accent" onclick="openPdf('${data.storage_path}')">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
        Ver PDF</button>` : '';
  const editVtoBtn = (data && !neverExpires)
    ? `<button class="btn-sm" onclick="editDocVto('${doc.id}','${doc.name}')">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
        Editar fecha</button>` : '';
  return `<div class="doc-card">
    <div class="doc-top"><div class="doc-left"><div class="status-dot ${dot}"></div><div class="doc-name">${doc.name}</div></div>${badge}</div>
    ${data?`<div class="doc-file">${data.file}</div>`:''}
    <div class="doc-actions">
      <button class="btn-sm" onclick="openRenew('${doc.id}','${doc.name}')">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>
        ${data?'Renovar':'Cargar'}</button>
      ${driveBtn}
      ${editVtoBtn}
    </div></div>`;
}

// ══ EDITAR VENCIMIENTO (solo metadata, sin re-subir archivo) — #2 ══
function editDocVto(docId, docName){
  const e = (db[currentSection]||[]).find(x=>x.id===currentEntityId);
  if(!e || !e.docs[docId]) return;
  const cur = e.docs[docId].vto || '';
  let modal = document.getElementById('editvto-modal');
  if(!modal){
    modal = document.createElement('div');
    modal.id = 'editvto-modal';
    modal.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.6);z-index:200;display:flex;align-items:center;justify-content:center;padding:24px;';
    document.body.appendChild(modal);
  }
  modal.innerHTML = `<div style="background:var(--bg2);border:1px solid var(--border2);border-radius:var(--radius);padding:24px;max-width:340px;width:100%;">
    <div style="font-size:10px;color:var(--text3);font-family:var(--mono);text-transform:uppercase;letter-spacing:1px;margin-bottom:6px;">Editar vencimiento</div>
    <div style="font-size:15px;font-weight:600;color:var(--text);margin-bottom:16px;">${docName}</div>
    <label style="font-size:12px;color:var(--text2);display:block;margin-bottom:6px;">Nueva fecha de vencimiento</label>
    <input type="date" id="editvto-input" value="${cur}" class="form-input" style="margin-bottom:18px;">
    <div style="display:flex;gap:10px;">
      <button onclick="document.getElementById('editvto-modal').style.display='none'" style="flex:1;padding:10px;border-radius:var(--radius-sm);border:1px solid var(--border2);background:var(--bg3);color:var(--text2);font-size:13px;cursor:pointer;font-family:var(--font);">Cancelar</button>
      <button id="editvto-ok" style="flex:1;padding:10px;border-radius:var(--radius-sm);border:none;background:var(--accent);color:#fff;font-size:13px;font-weight:600;cursor:pointer;font-family:var(--font);">Guardar</button>
    </div>
  </div>`;
  modal.style.display = 'flex';
  document.getElementById('editvto-ok').onclick = async ()=>{
    const nv = document.getElementById('editvto-input').value;
    if(!nv){ showToast('⚠️ Ingresá una fecha'); return; }
    modal.style.display = 'none';
    const docData = Object.assign({}, e.docs[docId], { vto: nv });
    e.docs[docId] = docData;
    updateCounts();
    renderDetail();
    try {
      const newId = await sbSaveDocumento(e.id, docId, docData); // update por UUID
      e.docs[docId].id = newId;
      sbWriteAuditLog({ accion: 'documento_editado', entidad_id: e.id, entidad_label: e.label, entidad_tipo: currentSection, documento_nombre: docName, filename: docData.file }).catch(()=>{});
      showToast('✓ Vencimiento actualizado');
    } catch(err){
      showToast('Error al guardar: ' + err.message);
    }
  };
}

// ══ TOAST ══
function showToast(msg){
  const t=document.getElementById('toast');
  t.textContent=msg; t.classList.add('show');
  setTimeout(()=>t.classList.remove('show'),2800);
}

function openLightbox(url){
  document.getElementById('lightbox-img').src = url;
  document.getElementById('lightbox').classList.add('open');
}
function closeLightbox(){
  document.getElementById('lightbox').classList.remove('open');
  document.getElementById('lightbox-img').src='';
}

function renderVerScreen(sec, entityId){
  applyTheme();
  const secData = db[sec] || [];
  const e = secData.find(x=>x.id===entityId);
  const content = document.getElementById('ver-content');
  if(!e){
    content.innerHTML=`<div style="padding:60px 20px;text-align:center;color:var(--text3);">
      <div style="font-size:40px;margin-bottom:16px;">🔍</div>
      <p style="font-size:16px;">No se encontró la entidad.<br>Verificá la URL.</p>
    </div>`;
    return;
  }
  const docs = DOCS[sec] || [];
  const allDocs = docs.filter(d=>d.required);
  const optDocs = docs.filter(d=>!d.required && e.docs[d.id]);
  const allVisible = [...allDocs, ...optDocs];
  const estadosVer = allVisible.map(d=>docState(e.docs[d.id], d.id));
  const anyBad = estadosVer.some(s=>s==='vencido'||s==='sin-cargar');
  const anyPronto = estadosVer.some(s=>s==='pronto');
  const statusHtml = anyBad
    ? `<div class="ver-status ver-status-bad">🔴 Documentación vencida o incompleta</div>`
    : anyPronto
      ? `<div class="ver-status ver-status-warn">🟡 Documentación próxima a vencer</div>`
      : `<div class="ver-status ver-status-ok">🟢 Documentación al día</div>`;

  const secLabel = {chofer:'Transportista',tractor:'Tractor',semi:'Semirremolque',transporte:'Empresa de transporte'}[sec]||sec;

  let html = `<div class="ver-header">
    <div style="font-size:10px;color:var(--text3);font-family:var(--mono);text-transform:uppercase;letter-spacing:1px;margin-bottom:4px;">${secLabel}</div>
    <div class="ver-entity-name">${e.label}</div>
    <div class="ver-entity-sub">${e.sub||''}</div>
    ${statusHtml}
  </div>`;

  const previewTasks = [];
  allVisible.forEach(doc=>{
    const data = e.docs[doc.id];
    const stv = docState(data, doc.id);
    const neverExpires = NEVER_EXPIRE_DOCS.has(doc.id);
    const dot = stv==='ok'?'dot-ok':stv==='pronto'?'dot-warn':'dot-bad';
    const badge = stv==='sin-cargar'
      ? `<span class="badge badge-bad">Sin cargar</span>`
      : neverExpires
        ? `<span class="badge badge-ok">Sin vencimiento</span>`
        : stv==='vencido'
          ? `<span class="badge badge-bad">Venció ${formatVto(data.vto)}</span>`
          : stv==='pronto'
            ? `<span class="badge badge-warn">Vence ${formatVto(data.vto)}</span>`
            : `<span class="badge badge-ok">Vence ${formatVto(data.vto)}</span>`;
    const driveBtn = data && data.storage_path
      ? `<button onclick="openPdf('${data.storage_path}')" class="ver-btn ver-btn-accent">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
          Ver PDF</button>` : '';
    const prevId = 'verprev-' + doc.id;
    const previewHtml = (data && data.storage_path)
      ? `<div class="ver-img-wrap" id="${prevId}"><div style="padding:24px;text-align:center;color:var(--text3);font-size:12px;">Cargando vista…</div></div>`
      : data ? `<div style="padding:16px;text-align:center;background:var(--bg2);color:var(--text3);font-size:12px;">Sin vista previa${data.file?' · '+data.file:''}</div>` : '';
    if(data && data.storage_path) previewTasks.push({ id: prevId, path: data.storage_path });

    html += `<div class="ver-doc">
      <div class="ver-doc-header">
        <div class="ver-doc-name"><div class="status-dot ${dot}"></div>${doc.name}</div>
        ${badge}
      </div>
      ${previewHtml}
      ${data ? `<div class="ver-doc-actions">${driveBtn}</div>` : `<div class="ver-no-doc">Sin documento cargado</div>`}
    </div>`;
  });

  html += `<div style="padding:20px;text-align:center;font-size:11px;color:var(--text3);">DocuTransporte · Pregate<br>Última actualización: ${new Date().toLocaleDateString('es-AR')}</div>`;
  content.innerHTML = html;
  // Renderizar TODAS las páginas de cada PDF, al vuelo desde el archivo (sin base64 en la base)
  previewTasks.forEach(t => renderDocPreview(t.id, t.path));
}

// Renderiza en `containerId` todas las páginas del PDF en `storagePath`.
// Si el archivo es viejo (imagen con nombre .pdf), cae a mostrarlo como imagen.
async function renderDocPreview(containerId, storagePath){
  const cont = document.getElementById(containerId);
  if(!cont) return;
  let url;
  try { url = await sbGetSignedUrl(storagePath); }
  catch(e){ cont.innerHTML = '<div style="padding:16px;text-align:center;color:var(--text3);font-size:12px;">No se pudo cargar la vista</div>'; return; }
  try {
    const pdfjsLib = window['pdfjs-dist/build/pdf'] || window.pdfjsLib;
    if(!pdfjsLib) throw new Error('pdfjs no disponible');
    const pdf = await pdfjsLib.getDocument({ url }).promise;
    const frag = document.createDocumentFragment();
    for(let i=1; i<=pdf.numPages; i++){
      const page = await pdf.getPage(i);
      const viewport = page.getViewport({ scale: 1.5 });
      const canvas = document.createElement('canvas');
      canvas.width = viewport.width;
      canvas.height = viewport.height;
      canvas.className = 'ver-preview';
      canvas.style.cssText = 'width:100%;height:auto;display:block;margin-bottom:8px;cursor:pointer;border-radius:8px;';
      canvas.title = 'Página ' + i + ' de ' + pdf.numPages + ' — tocá para abrir el PDF';
      canvas.addEventListener('click', () => openPdf(storagePath));
      await page.render({ canvasContext: canvas.getContext('2d'), viewport }).promise;
      frag.appendChild(canvas);
    }
    cont.innerHTML = '';
    cont.appendChild(frag);
    if(pdf.numPages > 1){
      const tag = document.createElement('div');
      tag.style.cssText = 'text-align:center;font-size:11px;color:var(--text3);margin-top:-2px;';
      tag.textContent = pdf.numPages + ' páginas';
      cont.appendChild(tag);
    }
  } catch(e){
    // Documento viejo: probablemente una imagen con nombre .pdf → mostrar como imagen
    cont.innerHTML = `<img class="ver-preview" src="${url}" style="width:100%;height:auto;display:block;cursor:pointer;border-radius:8px;" onclick="openPdf('${storagePath}')" onerror="this.parentElement.innerHTML='<div style=padding:16px;text-align:center;color:var(--text3);font-size:12px;>No se pudo cargar la vista</div>'">`;
  }
}

// ══ ABRIR PDF (signed URL) ══
async function openPdf(storagePath) {
  if (!storagePath) return;
  try {
    showToast('Generando enlace…');
    const url = await sbGetSignedUrl(storagePath);
    window.open(url, '_blank');
  } catch (e) {
    showToast('Error al abrir PDF: ' + e.message);
  }
}

// ══ DESCARGAR TODO COMO ZIP ══
async function downloadEntidadZip() {
  const e = (db[currentSection] || []).find(x => x.id === currentEntityId);
  if (!e) return;
  if (typeof JSZip === 'undefined') { showToast('JSZip no disponible'); return; }

  const paths = Object.entries(e.docs || {}).filter(([, d]) => d.storage_path);
  if (!paths.length) { showToast('No hay archivos subidos'); return; }

  showToast('Preparando ZIP…');
  const zip = new JSZip();
  let done = 0, failed = 0;
  for (const [docId, docData] of paths) {
    done++;
    showToast(`Descargando ${done}/${paths.length}…`);
    try {
      const url = await sbGetSignedUrl(docData.storage_path);
      const res = await fetch(url);
      const blob = await res.blob();
      zip.file(docData.file || `${docId}.pdf`, blob);
    } catch (err) { failed++; console.warn('No se pudo incluir', docId, err); }
  }
  showToast('Comprimiendo…');
  const content = await zip.generateAsync({ type: 'blob' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(content);
  a.download = `${e.label.replace(/[^a-zA-Z0-9]/g, '_')}_${currentSection}.zip`;
  a.click();
  URL.revokeObjectURL(a.href);
  showToast(failed ? `✓ ZIP descargado (${failed} omitido${failed!==1?'s':''})` : '✓ ZIP descargado');
}

// ══ PANEL ADMIN ══
async function openUsers() {
  showScreen('s-users');
  switchAdminTab('usuarios');
}

function switchAdminTab(tab) {
  ['usuarios', 'dashboard', 'auditoria'].forEach(t => {
    const btn = document.getElementById('tab-' + t);
    if (!btn) return;
    const active = t === tab;
    btn.style.color       = active ? 'var(--accent)' : 'var(--text2)';
    btn.style.borderBottom = active ? '2px solid var(--accent)' : '2px solid transparent';
    btn.style.fontWeight  = active ? '600' : '400';
  });
  const panel = document.getElementById('admin-panel');
  panel.innerHTML = '<div style="padding:20px;text-align:center;color:var(--text3);">Cargando…</div>';
  if (tab === 'usuarios')   renderUserList();
  else if (tab === 'dashboard') renderDashboard();
  else renderAuditLog();
}

function _userRowHtml(u) {
  return `<div class="entity-row" style="justify-content:space-between;">
    <div>
      <div class="row-name">${u.email}</div>
      <div class="row-sub" style="margin-top:2px;">${u.rol === 'admin' ? '● Admin' : '● Auditor'}</div>
    </div>
    ${u.id !== currentUser?.id
      ? `<button onclick="removeUser('${u.id}')" style="padding:6px 10px;border:1px solid var(--border2);background:var(--bad-bg);color:var(--bad);border-radius:var(--radius-sm);font-size:11px;cursor:pointer;font-family:var(--font);">Eliminar</button>`
      : '<span style="font-size:11px;color:var(--text3);">(yo)</span>'}
  </div>`;
}

async function renderUserList() {
  const panel = document.getElementById('admin-panel');
  panel.innerHTML = `
    <div style="margin:16px;padding:16px;background:var(--bg2);border:1px solid var(--border2);border-radius:var(--radius);">
      <div style="font-size:11px;color:var(--text3);font-family:var(--mono);text-transform:uppercase;letter-spacing:1px;margin-bottom:12px;">Crear usuario</div>
      <input class="form-input" id="new-user-email" placeholder="Email" type="email" style="margin-bottom:8px;">
      <input class="form-input" id="new-user-pass" placeholder="Contraseña (mín. 6 caracteres)" type="password" style="margin-bottom:8px;">
      <select id="new-user-rol" style="width:100%;padding:10px 12px;border:1px solid var(--border2);border-radius:var(--radius-sm);background:var(--bg3);color:var(--text);font-size:13px;font-family:var(--font);margin-bottom:12px;">
        <option value="auditor">Auditor</option>
        <option value="admin">Admin</option>
      </select>
      <button onclick="createUser()" style="width:100%;padding:10px;background:var(--accent);color:#fff;border:none;border-radius:var(--radius-sm);font-size:13px;font-weight:600;cursor:pointer;font-family:var(--font);">Crear usuario</button>
      <div id="create-user-status" style="margin-top:8px;font-size:12px;min-height:16px;"></div>
    </div>
    <div id="users-list"><div style="padding:20px;text-align:center;color:var(--text3);">Cargando usuarios…</div></div>`;

  try {
    const users = await sbGetUsuarios();
    document.getElementById('users-list').innerHTML = users.length
      ? users.map(_userRowHtml).join('')
      : '<div style="padding:20px;text-align:center;color:var(--text3);">Sin usuarios registrados.</div>';
  } catch (e) {
    document.getElementById('users-list').innerHTML = `<div style="padding:20px;color:var(--bad);">${e.message}</div>`;
  }
}

async function createUser() {
  const email    = (document.getElementById('new-user-email').value || '').trim();
  const password = document.getElementById('new-user-pass').value || '';
  const rol      = document.getElementById('new-user-rol').value;
  const status   = document.getElementById('create-user-status');

  if (!email || !password) { showToast('⚠️ Email y contraseña requeridos'); return; }
  if (password.length < 6) { showToast('⚠️ La contraseña debe tener al menos 6 caracteres'); return; }

  status.style.color = 'var(--text3)';
  status.textContent = 'Creando usuario…';
  try {
    await sbCreateUser(email, password, rol);
    status.style.color = 'var(--ok)';
    status.textContent = '✓ Usuario creado correctamente';
    document.getElementById('new-user-email').value = '';
    document.getElementById('new-user-pass').value  = '';
    const users = await sbGetUsuarios();
    document.getElementById('users-list').innerHTML = users.map(_userRowHtml).join('');
  } catch (e) {
    status.style.color = 'var(--bad)';
    status.textContent = '✗ ' + e.message;
  }
}

async function removeUser(id) {
  showConfirm('¿Eliminar este usuario? Se eliminará su cuenta y acceso a la app.', async () => {
    try {
      await sbDeleteUserAuth(id);
      showToast('✓ Usuario eliminado');
      renderUserList();
    } catch (e) {
      showToast('Error: ' + e.message);
    }
  });
}

async function cleanupExpiredNow(btn){
  if(!confirm('¿Limpiar ahora los archivos de documentos vencidos? La fecha de vencimiento se conserva; solo se borra el archivo del almacenamiento.')) return;
  if(btn){ btn.disabled = true; btn.textContent = 'Limpiando…'; }
  try {
    const r = await sbCleanupExpired();
    showToast(`✓ ${r.cleaned} documento(s) limpiados (${r.filesDeleted} archivo/s)`);
    // refrescar estado local desde la nube para reflejar los cambios
    const fresh = await loadStateFromSupabase();
    Object.assign(db, fresh);
    localStorage.setItem('dct-db', JSON.stringify(db));
    updateCounts();
  } catch(e){
    showToast('Error: ' + e.message);
  }
  if(btn){ btn.disabled = false; btn.textContent = 'Limpiar ahora'; }
}

async function renderDashboard() {
  const panel = document.getElementById('admin-panel');
  const secLabels = { chofer: 'Transportistas', tractor: 'Tractores', semi: 'Semirremolques', transporte: 'Transportes' };
  const total = Object.values(db).reduce((s, arr) => s + arr.length, 0);

  const countsHtml = Object.entries(secLabels).map(([k, label]) => `
    <div style="flex:1;min-width:120px;padding:16px;background:var(--bg2);border:1px solid var(--border2);border-radius:var(--radius);text-align:center;">
      <div style="font-size:28px;font-weight:700;color:var(--accent);">${(db[k] || []).length}</div>
      <div style="font-size:11px;color:var(--text3);margin-top:4px;">${label}</div>
    </div>`).join('');

  panel.innerHTML = `
    <div style="padding:16px;">
      <div style="font-size:11px;color:var(--text3);font-family:var(--mono);text-transform:uppercase;letter-spacing:1px;margin-bottom:8px;">Total en base: ${total} registros</div>
      <div style="display:flex;gap:10px;flex-wrap:wrap;margin-bottom:20px;">${countsHtml}</div>
      <div style="margin-bottom:20px;padding:14px;background:var(--bg2);border:1px solid var(--border2);border-radius:var(--radius);">
        <div style="font-size:13px;font-weight:600;margin-bottom:4px;">🧹 Limpiar documentos vencidos</div>
        <div style="font-size:12px;color:var(--text3);margin-bottom:10px;">Borra del almacenamiento los archivos de documentos ya vencidos (se hace solo cada día; este botón lo fuerza ahora). La fecha de vencimiento se conserva.</div>
        <button id="btn-cleanup" class="btn-sm btn-sm-accent" onclick="cleanupExpiredNow(this)">Limpiar ahora</button>
      </div>
      <div style="font-size:11px;color:var(--text3);font-family:var(--mono);text-transform:uppercase;letter-spacing:1px;margin-bottom:8px;">Actividad por usuario</div>
      <div id="dash-users"><div style="color:var(--text3);font-size:13px;">Cargando…</div></div>
    </div>`;

  try {
    const log = await sbGetAuditLog(500);
    if (!log.length) {
      document.getElementById('dash-users').innerHTML = '<div style="color:var(--text3);font-size:13px;">Sin actividad registrada aún. Los registros aparecerán a medida que se carguen datos.</div>';
      return;
    }
    const byUser = {};
    log.forEach(row => {
      const email = row.usuario_email || 'desconocido';
      if (!byUser[email]) byUser[email] = { entidades: 0, documentos: 0, eliminadas: 0 };
      if (row.accion === 'entidad_creada')   byUser[email].entidades++;
      if (row.accion === 'entidad_eliminada') byUser[email].eliminadas++;
      if (row.accion === 'documento_subido') byUser[email].documentos++;
    });
    document.getElementById('dash-users').innerHTML = Object.entries(byUser)
      .sort((a, b) => (b[1].entidades + b[1].documentos) - (a[1].entidades + a[1].documentos))
      .map(([email, s]) => `
        <div class="entity-row" style="justify-content:space-between;">
          <div class="row-name">${email}</div>
          <div style="display:flex;gap:12px;font-size:11px;color:var(--text3);">
            <span>${s.entidades} entidades</span>
            <span>${s.documentos} docs</span>
            ${s.eliminadas ? `<span style="color:var(--bad);">${s.eliminadas} eliminadas</span>` : ''}
          </div>
        </div>`).join('');
  } catch (e) {
    document.getElementById('dash-users').innerHTML = `<div style="color:var(--bad);">${e.message}</div>`;
  }
}

async function renderAuditLog() {
  const panel = document.getElementById('admin-panel');
  panel.innerHTML = '<div style="padding:20px;text-align:center;color:var(--text3);">Cargando…</div>';
  try {
    const log = await sbGetAuditLog(200);
    if (!log.length) {
      panel.innerHTML = '<div style="padding:40px;text-align:center;color:var(--text3);">Sin actividad registrada aún.</div>';
      return;
    }
    const accionLabel = {
      entidad_creada:   'Entidad creada',
      entidad_editada:  'Entidad editada',
      entidad_eliminada:'Entidad eliminada',
      documento_subido: 'Doc subido',
      documento_editado:'Vto. editado',
    };
    const accionColor = {
      entidad_creada:   'var(--ok)',
      entidad_editada:  'var(--accent)',
      entidad_eliminada:'var(--bad)',
      documento_subido: 'var(--text2)',
      documento_editado:'var(--accent)',
    };
    const rows = log.map(row => {
      const fecha = new Date(row.created_at).toLocaleString('es-AR', { day:'2-digit', month:'2-digit', year:'2-digit', hour:'2-digit', minute:'2-digit' });
      const user  = (row.usuario_email || '—').split('@')[0];
      const label = accionLabel[row.accion] || row.accion;
      const color = accionColor[row.accion] || 'var(--text2)';
      const doc   = [row.documento_nombre, row.filename].filter(Boolean).join(' · ');
      return `<div style="padding:10px 16px;border-bottom:1px solid var(--border);display:grid;grid-template-columns:100px 80px 120px 1fr;gap:8px;align-items:start;font-size:11px;">
        <div style="color:var(--text3);font-family:var(--mono);">${fecha}</div>
        <div style="color:var(--text2);font-weight:500;">${user}</div>
        <div style="color:${color};font-weight:600;">${label}</div>
        <div style="color:var(--text);">${row.entidad_label || '—'}${doc ? `<div style="color:var(--text3);margin-top:2px;">${doc}</div>` : ''}</div>
      </div>`;
    }).join('');
    panel.innerHTML = `
      <div style="padding:10px 16px;background:var(--bg2);border-bottom:1px solid var(--border);display:grid;grid-template-columns:100px 80px 120px 1fr;gap:8px;font-size:10px;color:var(--text3);font-family:var(--mono);text-transform:uppercase;letter-spacing:1px;">
        <div>Fecha</div><div>Usuario</div><div>Acción</div><div>Entidad / Archivo</div>
      </div>
      ${rows}
      <div style="padding:12px 16px;font-size:11px;color:var(--text3);text-align:center;">Últimas ${log.length} acciones</div>`;
  } catch (e) {
    panel.innerHTML = `<div style="padding:20px;color:var(--bad);">${e.message}</div>`;
  }
}
