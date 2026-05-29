// ══ THEME ══
let isDark = localStorage.getItem('dct-theme') !== 'light';

function applyTheme(){
  document.documentElement.classList.toggle('light',!isDark);
  const ic = document.getElementById('theme-icon');
  ic.innerHTML = isDark
    ? '<path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>'
    : '<circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>';
}
function toggleTheme(){ isDark=!isDark; localStorage.setItem('dct-theme',isDark?'dark':'light'); applyTheme(); }
applyTheme();

// ══ NAV ══
function showScreen(id){
  document.querySelectorAll('.screen').forEach(s=>s.classList.remove('active'));
  document.getElementById(id).classList.add('active');
}

// ══ COUNTS ══
function isVencido(vto, docId){
  if(!vto) return true;
  if(docId && NEVER_EXPIRE_DOCS.has(docId)) return false;
  // Compare date-only (strip time) so same day = NOT vencido
  const today = new Date(); today.setHours(0,0,0,0);
  const exp   = new Date(vto); exp.setHours(0,0,0,0);
  return exp < today;
}
function entityStatus(e,sec){
  return DOCS[sec].filter(d=>d.required).some(d=>!e.docs[d.id]||isVencido(e.docs[d.id].vto, d.id))?'bad':'ok';
}
function updateCounts(){
  ['chofer','tractor','semi','transporte'].forEach(s=>{
    const n=db[s]?db[s].length:0;
    const el=document.getElementById('cnt-'+s);
    if(el) el.textContent=n+' '+(n===1?'registro':'registros');
  });
}

// ══ SYNC ══
async function syncFromDrive(){
  if(!accessToken){ showToast('Conectá Drive primero'); return; }
  showToast('Actualizando desde Drive…');
  await loadStateFromDrive();
  renderDetail();
}

// ══ SECTION LIST ══
function openSection(sec){
  currentSection=sec;
  document.getElementById('list-title').textContent=SECTION_LABELS[sec];
  document.getElementById('list-sub-header').textContent=
    sec==='chofer'?'Buscar por nombre o DNI':sec==='transporte'?'Buscar por empresa':'Buscar por patente';
  document.getElementById('list-search').value='';
  renderEntityList(db[sec]||[]);
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
  el.innerHTML=list.map(e=>{
    const st=entityStatus(e,currentSection);
    const badge=st==='ok'?'<span class="badge badge-ok">Vigente</span>':'<span class="badge badge-bad">Vencido</span>';
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
function filterEntities(q){
  const nq = normalizeSearch(q);
  const filtered=(db[currentSection]||[]).filter(e=>!nq||normalizeSearch(e.label).includes(nq)||normalizeSearch(e.sub||'').includes(nq));
  renderEntityList(filtered);
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
    // 1. Remove from db first
    db[currentSection] = (db[currentSection]||[]).filter(x=>x.id!==currentEntityId);
    localStorage.setItem('dct-db', JSON.stringify(db));
    currentEntityId = null;
    updateCounts();

    // 2. Save updated estado.json to Drive (critical step)
    if(accessToken && stateFileId){
      try {
        await saveStateToDrive();
      } catch(err){ console.warn('Error saving state after delete', err); }
    }

    // 3. Delete folder from Drive (best effort)
    if(accessToken && subFolderIds[currentSection] && e){
      try {
        const safeName = e.label.replace(/[^a-zA-Z0-9_\-\.]/g,'_');
        const res = await driveRequest(
          `https://www.googleapis.com/drive/v3/files?q=name='${safeName}' and '${subFolderIds[currentSection]}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false&fields=files(id)`
        );
        const data = await res.json();
        if(data.files && data.files.length > 0){
          await driveRequest(`https://www.googleapis.com/drive/v3/files/${data.files[0].id}`, {method:'DELETE'});
        }
      } catch(err){ console.warn('Drive folder delete failed', err); }
    }

    showToast('✓ Eliminado correctamente');
    showScreen('s-list');
    renderEntityList(db[currentSection]||[]);
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
  const neverExpires = NEVER_EXPIRE_DOCS.has(doc.id);
  const vencido=!data||(neverExpires ? false : isVencido(data.vto, doc.id));
  const dot=vencido?'dot-bad':'dot-ok';
  const badge = neverExpires && data
    ? `<span class="badge badge-ok">Sin vencimiento</span>`
    : vencido
      ? `<span class="badge badge-bad">${data?'Venció '+formatVto(data.vto):'Sin cargar'}</span>`
      : `<span class="badge badge-ok">Vence ${formatVto(data.vto)}</span>`;
  const driveBtn=data&&data.driveUrl&&data.driveUrl!=='#'
    ?`<button class="btn-sm btn-sm-accent" onclick="window.open('${data.driveUrl}','_blank')">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
        Ver en Drive</button>` : '';
  return `<div class="doc-card">
    <div class="doc-top"><div class="doc-left"><div class="status-dot ${dot}"></div><div class="doc-name">${doc.name}</div></div>${badge}</div>
    ${data?`<div class="doc-file">${data.file}</div>`:''}
    <div class="doc-actions">
      <button class="btn-sm" onclick="openRenew('${doc.id}','${doc.name}')">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>
        ${data?'Renovar':'Cargar'}</button>
      ${driveBtn}
    </div></div>`;
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
  const anyBad = allVisible.some(d=>!e.docs[d.id]||isVencido(e.docs[d.id].vto, d.id));
  const statusHtml = anyBad
    ? `<div class="ver-status ver-status-bad">🔴 Documentación vencida o incompleta</div>`
    : `<div class="ver-status ver-status-ok">🟢 Documentación al día</div>`;

  const secLabel = {chofer:'Transportista',tractor:'Tractor',semi:'Semirremolque',transporte:'Empresa de transporte'}[sec]||sec;

  let html = `<div class="ver-header">
    <div style="font-size:10px;color:var(--text3);font-family:var(--mono);text-transform:uppercase;letter-spacing:1px;margin-bottom:4px;">${secLabel}</div>
    <div class="ver-entity-name">${e.label}</div>
    <div class="ver-entity-sub">${e.sub||''}</div>
    ${statusHtml}
  </div>`;

  allVisible.forEach(doc=>{
    const data = e.docs[doc.id];
    const neverExpires = NEVER_EXPIRE_DOCS.has(doc.id);
    const vencido = !data || (neverExpires ? false : isVencido(data.vto, doc.id));
    const dot = vencido ? 'dot-bad':'dot-ok';
    const badge = neverExpires && data
      ? `<span class="badge badge-ok">Sin vencimiento</span>`
      : vencido
        ? `<span class="badge badge-bad">${data?'Venció '+formatVto(data.vto):'Sin cargar'}</span>`
        : `<span class="badge badge-ok">Vence ${formatVto(data.vto)}</span>`;
    const driveBtn = data && data.driveUrl && data.driveUrl!=='#'
      ? `<a href="${data.driveUrl}" target="_blank" class="ver-btn ver-btn-accent">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
          Ver PDF en Drive</a>` : '';
    const previewHtml = data && data.previewUrl
      ? `<div class="ver-img-wrap" onclick="openLightbox('${data.previewUrl}')">
          <img class="ver-preview" src="${data.previewUrl}" alt="${doc.name}" loading="lazy" onerror="this.parentElement.innerHTML='<div style=padding:20px;text-align:center;background:var(--bg2);color:var(--text3);font-size:12px;>No se pudo cargar la imagen</div>'">
          <div class="ver-zoom-icon">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2.5"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/><line x1="11" y1="8" x2="11" y2="14"/><line x1="8" y1="11" x2="14" y2="11"/></svg>
          </div>
        </div>`
      : data ? `<div style="padding:16px;text-align:center;background:var(--bg2);color:var(--text3);font-size:12px;">Preview no disponible · ${data.file||''}</div>` : '';

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
}
