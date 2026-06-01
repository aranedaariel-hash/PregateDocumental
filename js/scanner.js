// ══ RENEW ══
function openRenew(docId,docName){
  currentDoc={docId,docName};
  capturedPages=[];
  inputMode='cam';
  const e=(db[currentSection]||[]).find(x=>x.id===currentEntityId);
  document.getElementById('renew-title').textContent=docName;
  document.getElementById('renew-sub').textContent=e.label;
  document.getElementById('ocr-date').value='';
  document.getElementById('ocr-filename').textContent='—';
  document.getElementById('upload-status').textContent='Se guardará en Google Drive automáticamente';
  document.getElementById('btn-upload').disabled=false;
  document.getElementById('opt-cam').classList.add('selected');
  document.getElementById('opt-file').classList.remove('selected');
  document.getElementById('cam-hint').textContent='Tocá para fotografiar';
  renderPages();
  showScreen('s-renew');
}

function selectMode(mode){
  inputMode=mode;
  document.getElementById('opt-cam').classList.toggle('selected',mode==='cam');
  document.getElementById('opt-file').classList.toggle('selected',mode==='file');
  document.getElementById('cam-hint').textContent=mode==='cam'?'Tocá para fotografiar':'Tocá para seleccionar archivo';
}
document.getElementById('cam-placeholder').onclick=triggerCapture;
function triggerCapture(){ document.getElementById(inputMode==='cam'?'file-cam':'file-local').click(); }

function handleFile(input){
  const f=input.files[0]; if(!f) return;
  input.value='';
  if(f.type.startsWith('image/')){
    // Open editor for images
    openEditor(f, (editedFile)=>{
      capturedPages=[editedFile];
      renderPages();
    });
  } else {
    // PDF - add directly without editor
    capturedPages=[f]; renderPages();
    showToast('PDF cargado · ingresá fecha manualmente');
  }
}
function handlePage(input){
  const f=input.files[0]; if(!f) return;
  input.value='';
  if(f.type.startsWith('image/')){
    openEditor(f, (editedFile)=>{
      capturedPages.push(editedFile); renderPages();
    });
  } else {
    capturedPages.push(f); renderPages();
  }
}
function renderPages(){
  const strip=document.getElementById('pages-strip');
  let html=capturedPages.map(f=>`<div class="page-thumb"><img src="${URL.createObjectURL(f)}"></div>`).join('');
  html+=`<div class="page-add" onclick="document.getElementById('file-page').click()">+</div>`;
  if(capturedPages.length) html+=`<span style="font-size:11px;color:var(--text2);">${capturedPages.length} pág.</span>`;
  strip.innerHTML=html;
}

function updateFilename(){
  const e=(db[currentSection]||[]).find(x=>x.id===currentEntityId);
  const dv=document.getElementById('ocr-date').value;
  if(!dv||!e||!currentDoc){ document.getElementById('ocr-filename').textContent='—'; return; }
  const [y,m,d]=dv.split('-');
  const prefix=currentSection==='chofer'
    ?e.label.replace(/,\s*/g,'_').replace(/\s+/g,'-').toUpperCase()
    :e.label.replace(/\s+/g,'-').toUpperCase();
  document.getElementById('ocr-filename').textContent=`${prefix}_${currentDoc.docId.toUpperCase()}_vto-${d}-${m}-${y}.pdf`;
}

// Arma un único PDF con TODAS las páginas capturadas (fotos y/o PDFs).
// Cada imagen entra como una página a su tamaño; los PDFs se fusionan página por página.
async function buildPdfFromPages(pages){
  if(typeof PDFLib === 'undefined') throw new Error('Librería PDF no disponible');
  const { PDFDocument } = PDFLib;
  const out = await PDFDocument.create();
  for(const f of pages){
    try{
      const buf = await f.arrayBuffer();
      if(f.type === 'application/pdf'){
        const src = await PDFDocument.load(buf);
        const copied = await out.copyPages(src, src.getPageIndices());
        copied.forEach(p => out.addPage(p));
      } else {
        const img = (f.type === 'image/png') ? await out.embedPng(buf) : await out.embedJpg(buf);
        const page = out.addPage([img.width, img.height]);
        page.drawImage(img, { x:0, y:0, width: img.width, height: img.height });
      }
    } catch(pageErr){
      console.warn('Página omitida al armar PDF:', pageErr);
    }
  }
  if(out.getPageCount() === 0) throw new Error('No se pudo procesar ninguna página del documento');
  const bytes = await out.save();
  return new Blob([bytes], { type: 'application/pdf' });
}

async function confirmUpload(){
  if(!capturedPages.length){ showToast('⚠️ Primero cargá el documento'); return; }
  const dv=document.getElementById('ocr-date').value;
  if(!dv){ showToast('⚠️ Ingresá la fecha de vencimiento'); return; }
  const filename=document.getElementById('ocr-filename').textContent;
  const btn=document.getElementById('btn-upload');
  const statusEl=document.getElementById('upload-status');

  btn.disabled=true;
  btn.innerHTML='<div class="spinner"></div> Subiendo…';

  try {
    const e=(db[currentSection]||[]).find(x=>x.id===currentEntityId);

    // Eliminar archivo anterior de Storage si existe
    const oldDoc = e.docs[currentDoc.docId];
    if(oldDoc && oldDoc.storage_path){
      try {
        statusEl.textContent='Reemplazando documento anterior…';
        await sbDeleteFile(oldDoc.storage_path);
      } catch(ex){ console.warn('No se pudo eliminar archivo anterior', ex); }
    }

    // Armar el archivo a subir: un PDF real con TODAS las páginas.
    // Si es un único PDF ya cargado, se sube tal cual (sin re-procesar).
    let fileToUpload;
    if(capturedPages.length === 1 && capturedPages[0].type === 'application/pdf'){
      fileToUpload = new File([capturedPages[0]], filename, { type: 'application/pdf' });
    } else {
      statusEl.textContent = capturedPages.length > 1 ? 'Armando PDF ('+capturedPages.length+' págs.)…' : 'Armando PDF…';
      const pdfBlob = await buildPdfFromPages(capturedPages);
      fileToUpload = new File([pdfBlob], filename, { type: 'application/pdf' });
    }

    // Subir a Supabase Storage
    statusEl.textContent='Subiendo archivo…';
    const storagePath = `${currentSection}/${e.id}/${filename}`;
    const uploadedPath = await sbUploadFile(fileToUpload, storagePath);

    // Ya no guardamos preview base64: la vista de Alet renderiza el PDF completo al vuelo.
    const docData = { vto: dv, file: filename, storage_path: uploadedPath, previewUrl: '', driveUrl: '#storage' };
    e.docs[currentDoc.docId] = docData;
    updateCounts();

    // Persistir en Supabase
    statusEl.textContent='Guardando en base de datos…';
    const docId = await sbSaveDocumento(e.id, currentDoc.docId, docData);
    e.docs[currentDoc.docId].id = docId;

    showToast('✓ Subido correctamente');
    sbWriteAuditLog({ accion: 'documento_subido', entidad_id: e.id, entidad_label: e.label, entidad_tipo: currentSection, documento_nombre: currentDoc.docName, filename }).catch(() => {});
    btn.disabled=false;
    btn.innerHTML='<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg> Confirmar y subir';
    statusEl.textContent='';
    setTimeout(()=>{ showScreen('s-detail'); renderDetail(); },1000);
  } catch(err){
    btn.disabled=false;
    btn.innerHTML='<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg> Confirmar y subir';
    statusEl.textContent='';
    showToast('Error al subir: '+err.message);
  }
}

// ══ IMAGE EDITOR ══
let editorImg = null;
let editorRotation = 0;
let editorFilter = 'original';
let cropPoints = []; // [{x,y}] in display %
let draggingCorner = -1;
let editorCallback = null;

function openEditor(file, callback){
  editorCallback = callback;
  editorRotation = 0;
  editorFilter = 'original';
  const reader = new FileReader();
  reader.onload = (e)=>{
    const img = new Image();
    img.onload = ()=>{
      editorImg = img;
      cropPoints = [{x:5,y:5},{x:95,y:5},{x:95,y:95},{x:5,y:95}];
      document.querySelectorAll('.filter-btn').forEach(b=>b.classList.remove('selected'));
      document.getElementById('f-original').classList.add('selected');
      showScreen('s-editor');
      // Wait for screen to render before drawing
      requestAnimationFrame(()=>{ requestAnimationFrame(renderEditor); });
    };
    img.src = e.target.result;
  };
  reader.readAsDataURL(file);
}

function renderEditor(){
  if(!editorImg) return;
  const wrap = document.getElementById('editor-wrap');
  const canvas = document.getElementById('canvas-display');
  const ww = wrap.clientWidth  || window.innerWidth;
  const wh = wrap.clientHeight || window.innerHeight - 120;

  let iw = editorImg.naturalWidth;
  let ih = editorImg.naturalHeight;

  // Apply rotation
  const rot = editorRotation;
  const swapped = rot % 180 !== 0;
  const canvasW = swapped ? ih : iw;
  const canvasH = swapped ? iw : ih;

  // Scale to fit wrap
  const scale = Math.min(ww / canvasW, wh / canvasH);
  const displayW = canvasW * scale;
  const displayH = canvasH * scale;

  canvas.width  = canvasW;
  canvas.height = canvasH;
  canvas.style.width  = displayW + 'px';
  canvas.style.height = displayH + 'px';
  canvas.style.position = 'absolute';
  canvas.style.left = ((ww - displayW) / 2) + 'px';
  canvas.style.top  = ((wh - displayH) / 2) + 'px';

  // Also size the overlay and handles container
  const overlay = document.getElementById('crop-overlay');
  overlay.style.left   = canvas.style.left;
  overlay.style.top    = canvas.style.top;
  overlay.style.width  = displayW + 'px';
  overlay.style.height = displayH + 'px';
  ['cp-tl','cp-tr','cp-br','cp-bl'].forEach(id=>{
    const el = document.getElementById(id);
    if(el){ el.style.setProperty('--dw', displayW+'px'); el.style.setProperty('--dh', displayH+'px'); }
  });
  // Store display rect for drag calculation
  wrap._displayW = displayW;
  wrap._displayH = displayH;
  wrap._offsetX  = (ww - displayW) / 2;
  wrap._offsetY  = (wh - displayH) / 2;

  const ctx = canvas.getContext('2d');
  ctx.save();
  ctx.translate(canvasW/2, canvasH/2);
  ctx.rotate(rot * Math.PI/180);
  ctx.drawImage(editorImg, -iw/2, -ih/2);
  ctx.restore();
  applyFilterToCanvas(ctx, canvasW, canvasH);
  requestAnimationFrame(()=>updateCropOverlay());
}

function applyFilterToCanvas(ctx, w, h){
  if(editorFilter==='original') return;
  const id = ctx.getImageData(0,0,w,h);
  const d = id.data;
  for(let i=0;i<d.length;i+=4){
    let r=d[i],g=d[i+1],b=d[i+2];
    if(editorFilter==='bw'){
      const gray=0.299*r+0.587*g+0.114*b;
      d[i]=d[i+1]=d[i+2]=gray;
    } else if(editorFilter==='doc'){
      // High contrast B&W
      const gray=0.299*r+0.587*g+0.114*b;
      const v = gray > 128 ? Math.min(255,gray*1.3) : Math.max(0,gray*0.6);
      d[i]=d[i+1]=d[i+2]=v;
    } else if(editorFilter==='bright'){
      d[i]=Math.min(255,r*1.2+20);
      d[i+1]=Math.min(255,g*1.2+20);
      d[i+2]=Math.min(255,b*1.2+20);
    }
  }
  ctx.putImageData(id,0,0);
}

function updateCropOverlay(){
  const wrap = document.getElementById('editor-wrap');
  const dw = wrap._displayW || wrap.clientWidth;
  const dh = wrap._displayH || wrap.clientHeight;
  const svg = document.getElementById('crop-overlay');
  const ids = ['cp-tl','cp-tr','cp-br','cp-bl'];

  const pts = cropPoints.map(p=>({
    x: p.x/100 * dw,
    y: p.y/100 * dh
  }));

  svg.setAttribute('viewBox',`0 0 ${dw} ${dh}`);
  svg.innerHTML = `<polygon points="${pts.map(p=>`${p.x},${p.y}`).join(' ')}" fill="rgba(59,130,246,0.12)" stroke="#3b82f6" stroke-width="2.5"/>`;

  cropPoints.forEach((p,i)=>{
    const el = document.getElementById(ids[i]);
    if(!el) return;
    const ox = wrap._offsetX || 0;
    const oy = wrap._offsetY || 0;
    el.style.left = (ox + p.x/100*dw) + 'px';
    el.style.top  = (oy + p.y/100*dh) + 'px';
  });
}

function rotateImage(){
  editorRotation = (editorRotation + 90) % 360;
  renderEditor();
}

function applyFilter(f){
  editorFilter = f;
  document.querySelectorAll('.filter-btn').forEach(b=>b.classList.remove('selected'));
  document.getElementById('f-'+f).classList.add('selected');
  renderEditor();
}

// Drag crop points
['cp-tl','cp-tr','cp-br','cp-bl'].forEach((id,i)=>{
  const el = document.getElementById(id);
  if(!el) return;
  const onStart = (e)=>{
    draggingCorner = i;
    e.preventDefault();
  };
  el.addEventListener('mousedown', onStart);
  el.addEventListener('touchstart', onStart, {passive:false});
});

document.addEventListener('mousemove', onDragMove);
document.addEventListener('touchmove', onDragMove, {passive:false});
document.addEventListener('mouseup', ()=>{ draggingCorner=-1; });
document.addEventListener('touchend', ()=>{ draggingCorner=-1; });

function onDragMove(e){
  if(draggingCorner<0) return;
  e.preventDefault();
  const wrap = document.getElementById('editor-wrap');
  const wRect = wrap.getBoundingClientRect();
  const clientX = e.touches ? e.touches[0].clientX : e.clientX;
  const clientY = e.touches ? e.touches[0].clientY : e.clientY;
  const ox = wrap._offsetX || 0;
  const oy = wrap._offsetY || 0;
  const dw = wrap._displayW || wrap.clientWidth;
  const dh = wrap._displayH || wrap.clientHeight;
  const relX = clientX - wRect.left - ox;
  const relY = clientY - wRect.top  - oy;
  const x = Math.max(2, Math.min(98, relX / dw * 100));
  const y = Math.max(2, Math.min(98, relY / dh * 100));
  cropPoints[draggingCorner] = {x, y};
  updateCropOverlay();
}

function confirmEditor(){
  const src = document.getElementById('canvas-display');
  const dst = document.getElementById('canvas-hidden');
  const cw = src.width;   // canvas resolution
  const ch = src.height;

  // cropPoints are in % of display → map to canvas resolution
  const xs = cropPoints.map(p => p.x/100 * cw);
  const ys = cropPoints.map(p => p.y/100 * ch);
  const x0 = Math.round(Math.min(...xs));
  const y0 = Math.round(Math.min(...ys));
  const x1 = Math.round(Math.max(...xs));
  const y1 = Math.round(Math.max(...ys));
  const rw = Math.max(10, x1 - x0);
  const rh = Math.max(10, y1 - y0);

  dst.width  = rw;
  dst.height = rh;
  const ctx = dst.getContext('2d');
  ctx.drawImage(src, x0, y0, rw, rh, 0, 0, rw, rh);

  dst.toBlob((blob) => {
    if(!blob){ showToast('⚠️ Error al procesar la imagen'); return; }
    const file = new File([blob], 'scan.jpg', {type:'image/jpeg'});
    if(editorCallback) editorCallback(file);
    showScreen('s-renew');
  }, 'image/jpeg', 0.92);
}

function cancelEditor(){
  showScreen('s-renew');
}

// ══ INIT ══
(function(){
  const params = new URLSearchParams(window.location.search);
  const ver = params.get('ver');
  const id  = params.get('id');

  if(ver && id){
    sbGetSession().then(session => {
      if(session){
        // Sesión activa — mostrar vista de entidad
        document.getElementById('login-wall').classList.add('hidden');
        showScreen('s-ver');
        document.getElementById('ver-content').innerHTML =
          '<div style="padding:60px 20px;text-align:center;color:var(--text3);">Cargando documentación…</div>';

        sbLoadPublicEntity(ver, id)
          .then(ent => {
            if(!ent){ renderVerScreen(ver, id); return; }
            // Reconstruir estructura en db para reutilizar renderVerScreen
            const docs = {};
            for(const doc of (ent.documentos || [])){
              docs[doc.nombre] = { id: doc.id, vto: doc.vto, file: doc.filename||'',
                storage_path: doc.storage_path||null, previewUrl: doc.preview_url||'', driveUrl: '' };
            }
            if(!db[ver]) db[ver] = [];
            db[ver] = db[ver].filter(x => x.id !== ent.id);
            db[ver].push({ id: ent.id, label: ent.label, sub: ent.sub||'',
              categoria: ent.categoria||'', pbtc: ent.pbtc||'', ejes: ent.ejes||'', docs });
            renderVerScreen(ver, id);
          })
          .catch(() => {
            document.getElementById('ver-content').innerHTML =
              '<div style="padding:60px 20px;text-align:center;color:var(--text3);"><div style="font-size:40px;margin-bottom:16px;">⚠️</div><p style="font-size:15px;line-height:1.6;">No se pudo cargar la documentación.</p></div>';
          });
      } else {
        // Sin sesión — mostrar login wall normal
        initApp();
      }
    });
  } else {
    // App normal — verificar sesión Supabase
    initApp();
  }
})();
