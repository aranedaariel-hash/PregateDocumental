// ══ NUEVO ══
function goNew(){
  document.getElementById('new-title').textContent='Nuevo · '+SECTION_LABELS[currentSection];
  const body=document.getElementById('new-form-body');
  if(currentSection==='chofer'){
    body.innerHTML=`<div class="form-section"><div class="form-label">Datos del chofer</div>
      <input class="form-input" id="nf-apellido" placeholder="Apellido" style="text-transform:uppercase;">
      <input class="form-input" id="nf-nombre" placeholder="Nombre" style="text-transform:uppercase;">
      <input class="form-input" id="nf-dni" placeholder="DNI" type="number">
      <input class="form-input" id="nf-empresa" placeholder="Empresa / Transportista" style="text-transform:uppercase;margin-bottom:0;">
    </div><button class="btn-primary" style="margin-top:8px;" onclick="saveNew()">
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>Guardar</button>`;
  } else if(currentSection==='transporte'){
    body.innerHTML=`<div class="form-section"><div class="form-label">Datos de la empresa</div>
      <input class="form-input" id="nf-empresa" placeholder="Nombre de la empresa" style="text-transform:uppercase;">
      <input class="form-input" id="nf-cuit" placeholder="CUIT" style="margin-bottom:0;">
    </div><button class="btn-primary" style="margin-top:8px;" onclick="saveNew()">
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>Guardar</button>`;
  } else {
    const lbl = currentSection==='tractor' ? 'Tractor' : 'Semirremolque';
    body.innerHTML=`
      <div class="form-section">
        <div class="form-label">Datos del ${lbl}</div>

        <div style="display:flex;gap:8px;align-items:flex-start;margin-bottom:10px;">
          <input class="form-input" id="nf-patente" placeholder="PATENTE"
            style="text-transform:uppercase;margin-bottom:0;flex:1;letter-spacing:2px;font-size:16px;font-weight:600;"
            oninput="this.value=this.value.toUpperCase().replace(/\\s/g,'')"
            onkeydown="if(event.key==='Enter'){event.preventDefault();cnrtAutocompletar();}">
          <button onclick="cnrtAutocompletar()" id="btn-cnrt"
            style="padding:10px 14px;background:var(--bg3);color:var(--text2);border:1px solid var(--border2);border-radius:var(--radius-sm);font-size:12px;font-weight:600;cursor:pointer;font-family:var(--font);white-space:nowrap;flex-shrink:0;">
            Consultar CNRT
          </button>
        </div>

        <div id="cnrt-status" style="display:none;margin-bottom:10px;padding:10px 12px;border-radius:var(--radius-sm);font-size:12px;"></div>

        <div id="cnrt-fields" style="display:none;">
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:8px;">
            <div>
              <div style="font-size:10px;color:var(--text3);font-family:var(--mono);text-transform:uppercase;letter-spacing:1px;margin-bottom:4px;">Marca</div>
              <input class="form-input" id="nf-marca" placeholder="—" style="text-transform:uppercase;margin-bottom:0;">
            </div>
            <div>
              <div style="font-size:10px;color:var(--text3);font-family:var(--mono);text-transform:uppercase;letter-spacing:1px;margin-bottom:4px;">Año modelo</div>
              <input class="form-input" id="nf-anio" placeholder="—" type="number" style="margin-bottom:0;">
            </div>
          </div>
          <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;margin-bottom:8px;">
            <div>
              <div style="font-size:10px;color:var(--text3);font-family:var(--mono);text-transform:uppercase;letter-spacing:1px;margin-bottom:4px;">Conf. ejes</div>
              <input class="form-input" id="nf-ejes" placeholder="—" style="margin-bottom:0;font-family:var(--mono);">
            </div>
            <div>
              <div style="font-size:10px;color:var(--text3);font-family:var(--mono);text-transform:uppercase;letter-spacing:1px;margin-bottom:4px;">Categoría</div>
              <input class="form-input" id="nf-categoria" placeholder="—" style="margin-bottom:0;font-family:var(--mono);font-weight:600;font-size:16px;text-align:center;">
            </div>
            <div>
              <div style="font-size:10px;color:var(--text3);font-family:var(--mono);text-transform:uppercase;letter-spacing:1px;margin-bottom:4px;">PBTC (ton)</div>
              <input class="form-input" id="nf-pbtc" placeholder="—" type="number" style="margin-bottom:0;font-family:var(--mono);">
            </div>
          </div>
          <div style="font-size:10px;color:var(--text3);font-family:var(--mono);text-transform:uppercase;letter-spacing:1px;margin-bottom:4px;">Modelo</div>
          <input class="form-input" id="nf-modelo" placeholder="—" style="text-transform:uppercase;margin-bottom:0;">
        </div>

        <div id="cnrt-manual" style="display:none;">
          <div style="font-size:10px;color:var(--text3);font-family:var(--mono);text-transform:uppercase;letter-spacing:1px;margin-bottom:4px;">Marca / Tipo</div>
          <input class="form-input" id="nf-marca" placeholder="Marca / Tipo" style="text-transform:uppercase;">
          <input class="form-input" id="nf-anio" placeholder="Año" type="number" style="margin-bottom:0;">
        </div>

      </div>
      <button class="btn-primary" id="btn-guardar" style="margin-top:8px;display:none;" onclick="saveNew()">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>
        Confirmar y guardar
      </button>`;
  }
  showScreen('s-new');
}

async function cnrtAutocompletar(){
  const pat = (document.getElementById('nf-patente').value||'').trim().toUpperCase().replace(/\s/g,'');
  if(!pat){ showToast('⚠️ Ingresá una patente'); return; }

  const statusEl = document.getElementById('cnrt-status');
  const fieldsEl = document.getElementById('cnrt-fields');
  const manualEl = document.getElementById('cnrt-manual');
  const btnGuardar = document.getElementById('btn-guardar');
  const btnCnrt = document.getElementById('btn-cnrt');

  // Estado: consultando
  statusEl.style.display = 'block';
  statusEl.style.background = 'rgba(59,130,246,0.08)';
  statusEl.style.border = '1px solid rgba(59,130,246,0.2)';
  statusEl.style.color = 'var(--text2)';
  statusEl.innerHTML = `<span style="display:inline-flex;align-items:center;gap:8px;">
    <span class="spinner" style="border-top-color:var(--accent);border-color:rgba(59,130,246,0.2);"></span>
    Consultando CNRT para <strong style="font-family:var(--mono);">${pat}</strong>…
  </span>`;
  fieldsEl.style.display = 'none';
  manualEl.style.display = 'none';
  btnGuardar.style.display = 'none';
  btnCnrt.disabled = true;

  try {
    const url = `${window.location.origin}/api/cnrt-proxy?base=equipos&path=${encodeURIComponent('/equipos?dominios='+pat)}`;
    const res = await fetch(url);
    const data = await res.json();

    btnCnrt.disabled = false;

    if(data.result !== 'ok' || !data.data?.dominios?.length){
      // Sin resultado — mostrar campos manuales
      statusEl.style.background = 'rgba(245,158,11,0.08)';
      statusEl.style.border = '1px solid rgba(245,158,11,0.2)';
      statusEl.style.color = '#f59e0b';
      statusEl.innerHTML = `⚠️ Patente <strong style="font-family:var(--mono);">${pat}</strong> no encontrada en CNRT. Completá los datos manualmente.`;
      manualEl.style.display = 'block';
      btnGuardar.style.display = 'flex';
      return;
    }

    const d = data.data.dominios[0];
    const rto = d.rto;
    const ruta = d.ruta;

    // Autocompletar campos
    const marca = rto?.marcaChasis || ruta?.marcaChasis || '';
    const modelo = ruta?.modeloChasis || '';
    const anio = ruta?.anioModelo || '';
    const ejes = rto?.configuracionEjes || (rto?.cantEjes ? rto.cantEjes+' ejes' : '');
    const categoria = data.data.categoriaEscalado || '';
    const pbtc = data.data.pbtc || '';

    document.getElementById('nf-marca').value = marca;
    document.getElementById('nf-modelo').value = modelo;
    document.getElementById('nf-anio').value = anio;
    document.getElementById('nf-ejes').value = ejes;
    document.getElementById('nf-categoria').value = categoria;
    document.getElementById('nf-pbtc').value = pbtc;

    // Guardar datos CNRT en variable global para saveNew
    window._cnrtData = { marca, modelo, anio, ejes, categoria, pbtc };

    // Estado: éxito
    const tipoVehiculo = rto?.tipoVehiculo || (currentSection==='tractor'?'Tractor':'Semirremolque');
    statusEl.style.background = 'var(--ok-bg)';
    statusEl.style.border = '1px solid rgba(34,197,94,0.2)';
    statusEl.style.color = 'var(--ok)';
    statusEl.innerHTML = `✓ <strong>${tipoVehiculo}</strong> encontrado — revisá los datos y confirmá.`;

    fieldsEl.style.display = 'block';
    btnGuardar.style.display = 'flex';

  } catch(e) {
    btnCnrt.disabled = false;
    statusEl.style.background = 'var(--bad-bg)';
    statusEl.style.border = '1px solid rgba(239,68,68,0.2)';
    statusEl.style.color = 'var(--bad)';
    statusEl.innerHTML = `✗ Error al consultar CNRT. Completá los datos manualmente.`;
    manualEl.style.display = 'block';
    btnGuardar.style.display = 'flex';
  }
}

async function saveNew(){
  let entry;
  if(currentSection==='chofer'){
    const ap=(document.getElementById('nf-apellido').value||'').trim().toUpperCase();
    const nm=(document.getElementById('nf-nombre').value||'').trim().toUpperCase();
    const dni=(document.getElementById('nf-dni').value||'').trim();
    const emp=(document.getElementById('nf-empresa').value||'').trim().toUpperCase();
    if(!ap||!nm||!dni){ showToast('⚠️ Apellido, nombre y DNI son obligatorios'); return; }
    const dniF=dni.replace(/\B(?=(\d{3})+(?!\d))/g,'.');
    entry={id:'c'+Date.now(),label:`${ap}, ${nm}`,sub:`DNI ${dniF}${emp?' · '+emp:''}`,docs:{}};
  } else if(currentSection==='transporte'){
    const emp=(document.getElementById('nf-empresa').value||'').trim().toUpperCase();
    const cuit=(document.getElementById('nf-cuit').value||'').trim();
    if(!emp){ showToast('⚠️ El nombre es obligatorio'); return; }
    entry={id:'tp'+Date.now(),label:emp,sub:cuit?`CUIT ${cuit}`:'',docs:{}};
  } else {
    const pat=(document.getElementById('nf-patente').value||'').trim().toUpperCase();
    if(!pat){ showToast('⚠️ La patente es obligatoria'); return; }
    const marca=(document.getElementById('nf-marca')?.value||'').trim().toUpperCase();
    const anio=(document.getElementById('nf-anio')?.value||'').trim();
    const modelo=(document.getElementById('nf-modelo')?.value||'').trim().toUpperCase();
    const ejes=(document.getElementById('nf-ejes')?.value||'').trim();
    const categoria=(document.getElementById('nf-categoria')?.value||'').trim().toUpperCase();
    const pbtc=(document.getElementById('nf-pbtc')?.value||'').trim();
    const subParts=[marca,anio].filter(Boolean);
    entry={
      id:'v'+Date.now(),
      label:pat,
      sub:subParts.join(' · '),
      categoria:categoria||'',
      pbtc:pbtc||'',
      ejes:ejes||'',
      docs:{}
    };
    window._cnrtData=null;
  }
  if(!db[currentSection]) db[currentSection]=[];
  db[currentSection].push(entry);
  updateCounts();
  try {
    const uuid = await sbSaveEntidad(entry, currentSection);
    entry.id = uuid; // reemplazar ID local por UUID de Supabase
    sbWriteAuditLog({ accion: 'entidad_creada', entidad_id: entry.id, entidad_label: entry.label, entidad_tipo: currentSection }).catch(() => {});
    showToast('✓ Guardado correctamente');
  } catch(e) {
    db[currentSection] = db[currentSection].filter(x => x !== entry);
    updateCounts();
    showToast('Error al guardar: ' + e.message);
    return;
  }
  setTimeout(()=>{ openEntity(entry.id); },600);
}
