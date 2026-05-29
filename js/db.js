// ══ STATE ══
let db = {chofer:[],tractor:[],semi:[],transporte:[]};
let accessToken = null;
let rootFolderId = null;
let subFolderIds = {};
let stateFileId = null;
let currentSection = 'chofer';
let currentEntityId = null;
let currentDoc = null;
let capturedPages = [];
let inputMode = 'cam';

// ══ DRIVE ══
async function driveRequest(url, options={}){
  const res = await fetch(url, {
    ...options,
    headers: {'Authorization': `Bearer ${accessToken}`, ...(options.headers||{})}
  });
  if(res.status===401){
    accessToken = null;
    updateAuthUI(false);
    throw new Error('Token expirado, reconectá');
  }
  if(!res.ok){
    const errText = await res.text().catch(()=>'');
    throw new Error(`Error ${res.status}: ${errText.substring(0,100)}`);
  }
  return res;
}

async function initDrive(){
  try {
    // Get user info - optional, don't fail if it errors
    let email = '';
    try {
      const uRes = await fetch('https://www.googleapis.com/oauth2/v1/userinfo', {
        headers:{'Authorization': `Bearer ${accessToken}`}
      });
      if(uRes.ok){
        const uData = await uRes.json();
        email = uData.email||'';
      }
    } catch(e){}
    updateAuthUI(true, email);

    // Find or create root folder
    const searchRes = await driveRequest(
      `https://www.googleapis.com/drive/v3/files?q=name='${DRIVE_FOLDER_NAME}' and mimeType='application/vnd.google-apps.folder' and trashed=false&fields=files(id,name)`
    );
    const searchData = await searchRes.json();
    if(searchData.files && searchData.files.length > 0){
      rootFolderId = searchData.files[0].id;
    } else {
      rootFolderId = await createFolder(DRIVE_FOLDER_NAME, null);
    }

    // Create subfolders
    for(const [key, sec] of Object.entries(SUBFOLDER)){
      const sfRes = await driveRequest(
        `https://www.googleapis.com/drive/v3/files?q=name='${sec}' and '${rootFolderId}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false&fields=files(id)`
      );
      const sfData = await sfRes.json();
      if(sfData.files && sfData.files.length > 0){
        subFolderIds[key] = sfData.files[0].id;
      } else {
        subFolderIds[key] = await createFolder(sec, rootFolderId);
      }
    }

    // Load state
    await loadStateFromDrive();
    showToast('✓ Drive conectado correctamente');
    // Run cleanup in background (non-blocking)
    setTimeout(()=>cleanupOldDriveFiles(), 3000);
    // One-time dedup of existing data (handles duplicates created before this fix)
    deduplicateAllSections();
  } catch(e){
    showToast('Error conectando con Drive: '+e.message);
    console.error(e);
  }
}

async function createFolder(name, parentId){
  const meta = {name, mimeType:'application/vnd.google-apps.folder'};
  if(parentId) meta.parents = [parentId];
  const res = await driveRequest('https://www.googleapis.com/drive/v3/files', {
    method:'POST',
    headers:{'Content-Type':'application/json'},
    body: JSON.stringify(meta)
  });
  const data = await res.json();
  return data.id;
}

async function loadStateFromDrive(){
  try {
    const res = await driveRequest(
      `https://www.googleapis.com/drive/v3/files?q=name='${STATE_FILE_NAME}' and '${rootFolderId}' in parents and trashed=false&fields=files(id)`
    );
    const data = await res.json();
    if(data.files && data.files.length > 0){
      stateFileId = data.files[0].id;
      localStorage.setItem('dct-meta', JSON.stringify({stateFileId}));
      const contentRes = await driveRequest(
        `https://www.googleapis.com/drive/v3/files/${stateFileId}?alt=media`
      );
      const driveState = await contentRes.json();

      // Smart merge: union by id, prefer entry with more docs
      const sections = ['chofer','tractor','semi','transporte'];
      const localDb = db;

      sections.forEach(sec=>{
        const driveList = (driveState[sec] || []);
        const localList = (localDb[sec]   || []);

        const driveMap = Object.fromEntries(driveList.map(e=>[e.id, e]));
        const localMap = Object.fromEntries(localList.map(e=>[e.id, e]));
        const allIds   = new Set([...Object.keys(driveMap), ...Object.keys(localMap)]);

        const merged = [];
        allIds.forEach(id=>{
          const d = driveMap[id];
          const l = localMap[id];
          if(d && l){
            const dCount = Object.keys(d.docs||{}).length;
            const lCount = Object.keys(l.docs||{}).length;
            merged.push(lCount >= dCount
              ? {...d, docs:{...d.docs, ...l.docs}}
              : {...l, docs:{...l.docs, ...d.docs}});
          } else {
            merged.push(l || d);
          }
        });

        // Secondary dedup: if same label exists twice (race condition created two ids),
        // keep the one with more docs, merge docs into it
        const byLabel = {};
        merged.forEach(e=>{
          const key = (e.label||'').trim().toUpperCase();
          if(!byLabel[key]){
            byLabel[key] = e;
          } else {
            const existing = byLabel[key];
            const existCount = Object.keys(existing.docs||{}).length;
            const newCount   = Object.keys(e.docs||{}).length;
            // Merge docs from both, keep the id with more docs
            if(newCount >= existCount){
              byLabel[key] = {...e, docs:{...existing.docs, ...e.docs}};
            } else {
              byLabel[key] = {...existing, docs:{...e.docs, ...existing.docs}};
            }
          }
        });

        db[sec] = Object.values(byLabel);
      });

      // If dedup changed anything, save back to Drive immediately
      const driveTotal = ['chofer','tractor','semi','transporte'].reduce((s,sec)=>s+(driveState[sec]||[]).length,0);
      const mergedTotal = ['chofer','tractor','semi','transporte'].reduce((s,sec)=>s+db[sec].length,0);
      if(driveTotal !== mergedTotal){
        // Duplicates were found and removed — save clean state
        try{ await saveStateToDrive(); }catch(e){}
      }

    } else {
      stateFileId = null;
      await saveStateToDrive();
    }
    localStorage.setItem('dct-db', JSON.stringify(db));
    updateCounts();
    showToast('✓ Estado actualizado desde Drive');
  } catch(e){
    showToast('Error cargando estado: '+e.message);
  }
}

async function saveStateToDrive(){
  const content = JSON.stringify(db);
  if(stateFileId){
    await driveRequest(`https://www.googleapis.com/upload/drive/v3/files/${stateFileId}?uploadType=media`, {
      method:'PATCH',
      headers:{'Content-Type':'application/json'},
      body: content
    });
    // Re-apply public permission on every update (in case it was revoked)
    try {
      await driveRequest(`https://www.googleapis.com/drive/v3/files/${stateFileId}/permissions`, {
        method:'POST',
        headers:{'Content-Type':'application/json'},
        body: JSON.stringify({role:'reader', type:'anyone'})
      });
    } catch(e){ /* already public or not critical */ }
  } else {
    const boundary = 'boundary123';
    const meta = JSON.stringify({name:STATE_FILE_NAME, parents:[rootFolderId]});
    const body = `--${boundary}\r\nContent-Type: application/json\r\n\r\n${meta}\r\n--${boundary}\r\nContent-Type: application/json\r\n\r\n${content}\r\n--${boundary}--`;
    const res = await driveRequest('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart', {
      method:'POST',
      headers:{'Content-Type':`multipart/related; boundary=${boundary}`},
      body
    });
    const data = await res.json();
    stateFileId = data.id;
    try {
      await driveRequest(`https://www.googleapis.com/drive/v3/files/${stateFileId}/permissions`, {
        method:'POST',
        headers:{'Content-Type':'application/json'},
        body: JSON.stringify({role:'reader', type:'anyone'})
      });
    } catch(e){ console.warn('Could not make state public', e); }
  }
  localStorage.setItem('dct-meta', JSON.stringify({stateFileId}));
  localStorage.setItem('dct-db', JSON.stringify(db));
}

async function getOrCreateEntityFolder(entityLabel, section){
  const parentId = subFolderIds[section];
  const safeName = entityLabel.replace(/[^a-zA-Z0-9_\-\.]/g,'_');
  const res = await driveRequest(
    `https://www.googleapis.com/drive/v3/files?q=name='${safeName}' and '${parentId}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false&fields=files(id)`
  );
  const data = await res.json();
  if(data.files && data.files.length > 0) return data.files[0].id;
  return await createFolder(safeName, parentId);
}

async function uploadFileToDrive(file, filename, folderId){
  const boundary = 'boundary456';
  const meta = JSON.stringify({name:filename, parents:[folderId]});
  const arrBuf = await file.arrayBuffer();
  const enc = new TextEncoder();
  const pre = enc.encode(`--${boundary}\r\nContent-Type: application/json\r\n\r\n${meta}\r\n--${boundary}\r\nContent-Type: ${file.type||'application/octet-stream'}\r\n\r\n`);
  const suf = enc.encode(`\r\n--${boundary}--`);
  const body = new Uint8Array(pre.length + arrBuf.byteLength + suf.length);
  body.set(pre, 0);
  body.set(new Uint8Array(arrBuf), pre.length);
  body.set(suf, pre.length + arrBuf.byteLength);
  const res = await driveRequest('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,webViewLink', {
    method:'POST',
    headers:{'Content-Type':`multipart/related; boundary=${boundary}`},
    body
  });
  return await res.json();
}

// ══ DEDUPLICACIÓN GLOBAL (corre al conectar para limpiar duplicados previos) ══
async function deduplicateAllSections(){
  let changed = false;
  ['chofer','tractor','semi','transporte'].forEach(sec=>{
    const list = db[sec] || [];
    const byLabel = {};
    list.forEach(e=>{
      const key = (e.label||'').trim().toUpperCase();
      if(!byLabel[key]){
        byLabel[key] = {...e};
      } else {
        // Merge docs: keep whichever entry has more, union all docs
        const ex = byLabel[key];
        byLabel[key] = {
          ...ex,
          docs: {...e.docs, ...ex.docs} // ex.docs wins (has more or equal)
        };
        changed = true;
      }
    });
    const deduped = Object.values(byLabel);
    if(deduped.length !== list.length) changed = true;
    db[sec] = deduped;
  });
  if(changed){
    localStorage.setItem('dct-db', JSON.stringify(db));
    updateCounts();
    try{ await saveStateToDrive(); showToast('✓ Duplicados eliminados automáticamente'); }catch(e){}
  }
}

// ══ AUTO-CLEANUP: eliminar archivos de Drive con más de 1 año (excepto cédula verde) ══
async function cleanupOldDriveFiles(){
  if(!accessToken || !rootFolderId) return;
  const oneYearAgo = new Date();
  oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
  const cutoff = oneYearAgo.toISOString();
  let changed = false;
  for(const sec of ['chofer','tractor','semi','transporte']){
    for(const entity of (db[sec]||[])){
      for(const [docId, docData] of Object.entries(entity.docs||{})){
        if(NEVER_EXPIRE_DOCS.has(docId)) continue; // Nunca borrar cédula verde
        if(!docData || !docData.fileId) continue;
        // Check if vencimiento date is over a year old (or no vto)
        if(docData.vto){
          const vtoDate = new Date(docData.vto);
          if(vtoDate >= oneYearAgo) continue; // Still within 1 year
        }
        // Try to delete from Drive
        try {
          await driveRequest(`https://www.googleapis.com/drive/v3/files/${docData.fileId}`, {method:'DELETE'});
          // Clear fileId from db but keep vto/file record
          docData.fileId = null;
          docData.driveUrl = '#';
          docData.previewUrl = '';
          changed = true;
          console.log(`Auto-cleanup: deleted old file for ${entity.label} / ${docId}`);
        } catch(ex){ console.warn('Cleanup failed for', docData.fileId, ex); }
      }
    }
  }
  if(changed){
    try { await saveStateToDrive(); } catch(e){}
    showToast('🗑️ Archivos vencidos (+1 año) eliminados de Drive');
  }
}
