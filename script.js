let rowId = 0;
const rowsEl = document.getElementById('rows');
let driveImageBase64 = null;

const driveUploadBox = document.getElementById('driveUploadBox');
const driveFileInput = document.getElementById('driveFile');

// Eventos para la subida de la foto de portada del pendrive
driveUploadBox.addEventListener('click', () => driveFileInput.click());
driveFileInput.addEventListener('change', function(e){
  const file = e.target.files[0];
  if(file){
    const reader = new FileReader();
    reader.onload = function(event){
      driveImageBase64 = event.target.result;
      document.getElementById('driveImgLabel').innerHTML = `<img src="${driveImageBase64}">`;
    };
    reader.readAsDataURL(file);
  }
});

document.getElementById('drivePasteBtn').addEventListener('click', async () => {
  const file = await readImageFromClipboard();
  if(file){
    const reader = new FileReader();
    reader.onload = function(event){
      driveImageBase64 = event.target.result;
      document.getElementById('driveImgLabel').innerHTML = `<img src="${driveImageBase64}">`;
    };
    reader.readAsDataURL(file);
  }
});

async function pasteImageFromClipboard(box){
  const file = await readImageFromClipboard();
  if(file) processRowImage(file, box);
}

// Lectura de imágenes desde el portapapeles
async function readImageFromClipboard(){
  try{
    if(!navigator.clipboard || !navigator.clipboard.read){
      alert('Tu navegador no permite leer el portapapeles directamente. Usá la opción de galería en su lugar.');
      return null;
    }
    const items = await navigator.clipboard.read();
    for(const item of items){
      const imgType = item.types.find(t => t.startsWith('image/'));
      if(imgType){
        const blob = await item.getType(imgType);
        return blob;
      }
    }
    alert('No se encontró ninguna imagen en el portapapeles. Copiá una imagen primero y volvé a intentar.');
    return null;
  } catch(err){
    console.error(err);
    alert('No se pudo acceder al portapapeles (puede requerir permiso o no estar soportado en este navegador). Probá con la opción de galería.');
    return null;
  }
}

// Generación dinámica de filas de juegos
function makeRow(name, value, unit){
  const id = 'r' + (rowId++);
  const div = document.createElement('div');
  div.className = 'row';
  div.dataset.id = id;
  div.innerHTML = `
    <input type="text" placeholder="Nombre del juego" value="${name||''}">
    <input type="number" min="0" step="any" inputmode="decimal" value="${value!==undefined?value:''}" placeholder="0">
    <select>
      <option value="GB" ${unit==='GB'?'selected':''}>GB</option>
      <option value="MB" ${unit!=='GB'?'selected':''}>MB</option>
    </select>
    <div class="img-uploader row-uploader" title="Tocá para subir portada">
      <span style="font-size:10px;">+ Imagen</span>
      <input type="file" accept="image/*" style="display:none;">
    </div>
    <button type="button" class="row-paste-btn" title="Pegar imagen del portapapeles">📋</button>
    <button class="del" title="Eliminar">✕</button>
  `;

  const fileInput = div.querySelector('input[type="file"]');
  const uploaderBox = div.querySelector('.img-uploader');
  const rowPasteBtn = div.querySelector('.row-paste-btn');

  uploaderBox.addEventListener('click', (e) => {
    e.stopPropagation();
    fileInput.click();
  });

  fileInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if(file) processRowImage(file, uploaderBox);
  });

  rowPasteBtn.addEventListener('click', async () => {
    await pasteImageFromClipboard(uploaderBox);
  });

  div.addEventListener('paste', (e) => {
    const items = (e.clipboardData || e.originalEvent.clipboardData).items;
    for (const item of items) {
      if (item.kind === 'file' && item.type.startsWith('image/')) {
        processRowImage(item.getAsFile(), uploaderBox);
      }
    }
  });

  div.querySelectorAll('input, select').forEach(el => el.addEventListener('input', calc));
  div.querySelector('.del').addEventListener('click', () => { div.remove(); calc(); });
  rowsEl.appendChild(div);
}

function processRowImage(file, box) {
  const reader = new FileReader();
  reader.onload = function(event) {
    box.dataset.img = event.target.result;
    box.innerHTML = `<img src="${event.target.result}">`;
  };
  reader.readAsDataURL(file);
}

// Listeners globales para el cálculo matemático del almacenamiento
document.getElementById('addRow').addEventListener('click', () => { makeRow('', '', 'GB'); calc(); });
document.getElementById('driveSize').addEventListener('input', calc);
document.getElementById('driveUnit').addEventListener('input', calc);
document.getElementById('fakeRealSize').addEventListener('input', calc);

document.getElementById('driveStatus').addEventListener('change', () => {
  const isFake = document.getElementById('driveStatus').value === 'Falso';
  document.getElementById('fakeSizeGroup').style.display = isFake ? 'block' : 'none';
  calc();
});

function toMB(value, unit){
  const v = parseFloat(value);
  if(isNaN(v) || v < 0) return 0;
  return unit === 'GB' ? v * 1024 : v;
}

function fmt(n){
  if(isNaN(n)) return "0";
  if(n >= 1000) return n.toLocaleString('es-AR', {maximumFractionDigits:2});
  return (Math.round(n*100)/100).toString();
}

// Función central de lógica y cálculos
function calc(){
  const isFake = document.getElementById('driveStatus').value === 'Falso';
  let baseSizeInput = parseFloat(document.getElementById('driveSize').value) || 0;

  if(isFake) {
    baseSizeInput = parseFloat(document.getElementById('fakeRealSize').value) || 0;
  }

  const formattedRealValue = baseSizeInput * 0.9313;
  const driveUnit = document.getElementById('driveUnit').value;
  const driveSizeMaxMB = driveUnit === 'GB' ? formattedRealValue * 1024 : formattedRealValue;

  const games = [...rowsEl.querySelectorAll('.row')].map(row => {
    const inputs = row.querySelectorAll('input');
    const valInput = inputs[1];
    const nameInput = inputs[0];
    const unit = row.querySelector('select').value;
    const imgData = row.querySelector('.img-uploader').dataset.img || null;
    return { name: nameInput.value || 'Juego sin nombre', mb: toMB(valInput.value, unit), img: imgData };
  }).filter(g => g.mb > 0);

  const totalMB = games.reduce((s,g)=>s+g.mb, 0);
  const totalGB = totalMB / 1024;

  let running = 0, fitCount = 0;
  for(const g of games){
    if(running + g.mb <= driveSizeMaxMB){
      running += g.mb;
      fitCount++;
    }
  }

  const free = driveSizeMaxMB - totalMB;
  const pct = driveSizeMaxMB > 0 ? Math.min((totalMB / driveSizeMaxMB) * 100, 100) : 0;
  const over = totalMB > driveSizeMaxMB;

  document.getElementById('barFill').style.width = pct + '%';
  document.getElementById('barFill').classList.toggle('over', over);

  document.getElementById('usedLabel').textContent = fmt(totalMB/1024) + ' GB';
  document.getElementById('limitLabel').textContent = fmt(driveSizeMaxMB/1024) + ' GB';
  document.getElementById('pctLabel').textContent = Math.round(pct) + '%';

  document.getElementById('totalGB').textContent = fmt(totalGB) + ' GB';
  document.getElementById('totalMB').textContent = fmt(totalMB) + ' MB';
  document.getElementById('freeSpace').textContent = (over ? '−' : '') + fmt(Math.abs(free)/1024) + ' GB';
  document.getElementById('fitCount').textContent = fitCount + ' / ' + games.length;

  const pill = document.getElementById('statusPill');
  if(games.length === 0){
    pill.textContent = 'SIN JUEGOS AÚN';
    pill.className = 'status-pill ok';
  } else if(!over){
    pill.textContent = 'ESPACIO ESTRUCTURAL CORRECTO (ENTRAN TODOS)';
    pill.className = 'status-pill ok';
  } else {
    pill.textContent = 'ALERTA: CAPACIDAD EXCEDIDA';
    pill.className = 'status-pill no';
  }
}

// Evento e inyección de datos estructurados para jsPDF
document.getElementById('generatePDF').addEventListener('click', () => {
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF();

  const owner = document.getElementById('ownerName').value;
  const dName = document.getElementById('driveName').value;
  const dBrand = document.getElementById('driveBrand').value;
  const dStatus = document.getElementById('driveStatus').value;
  const commercialSize = document.getElementById('driveSize').value + ' ' + document.getElementById('driveUnit').value;
  const isFake = dStatus === 'Falso';
  const realSizeInfo = isFake ? (document.getElementById('fakeRealSize').value + ' ' + document.getElementById('driveUnit').value) : 'N/A';

  const totalGamesGB = document.getElementById('totalGB').textContent;
  const freeSpaceGB = document.getElementById('freeSpace').textContent;
  const limitRealGB = document.getElementById('limitLabel').textContent;

  const darkBg = [20, 25, 21];

  doc.setFillColor(...darkBg);
  doc.rect(0, 0, 210, 40, 'F');

  doc.setFont("helvetica", "bold");
  doc.setFontSize(22);
  doc.setTextColor(214, 175, 55);
  doc.text("REPORTE DE CARGA Y AUDITORÍA", 14, 18);

  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(255, 255, 255);
  doc.text(`PROPIETARIO: ${owner.toUpperCase()}`, 14, 26);
  doc.text(`SISTEMA DE ARCHIVOS: exFAT | FECHA: ${new Date().toLocaleDateString()}`, 14, 32);

  doc.setFontSize(12);
  doc.setTextColor(...darkBg);
  doc.setFont("helvetica", "bold");
  doc.text("ANÁLISIS DEL HARDWARE", 14, 50);

  let infoY = 56;
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.text(`• Dispositivo: ${dName} (${dBrand})`, 14, infoY);
  doc.text(`• Capacidad en Blíster: ${commercialSize}`, 14, infoY + 6);

  if(isFake) {
    doc.setTextColor(200, 0, 0);
    doc.setFont("helvetica", "bold");
    doc.text(`• ESTADO: RÉPLICA / FALSO (Capacidad real en chip: ${realSizeInfo})`, 14, infoY + 12);
  } else {
    doc.setTextColor(0, 128, 0);
    doc.text(`• ESTADO: HARDWARE ORIGINAL`, 14, infoY + 12);
  }

  doc.setFont("helvetica", "normal");
  doc.setTextColor(0, 0, 0);
  doc.text(`• Límite real formateado neto: ${limitRealGB}`, 14, infoY + 18);
  doc.text(`• Espacio Ocupado por ISOs: ${totalGamesGB}`, 14, infoY + 24);
  doc.text(`• Espacio Libre Restante: ${freeSpaceGB}`, 14, infoY + 30);

  if(driveImageBase64) {
    try {
      doc.addImage(driveImageBase64, 'JPEG', 145, 46, 50, 38);
    } catch(e) { console.error(e); }
  }

  doc.setDrawColor(214, 175, 55);
  doc.setLineWidth(0.5);
  doc.line(14, 92, 196, 92);

  doc.setFontSize(12);
  doc.setTextColor(...darkBg);
  doc.setFont("helvetica", "bold");
  doc.text("DETALLE DE ISOs COMPILADAS", 14, 99);

  const tableRows = [];
  const rowImages = [];
  const gamesElements = [...rowsEl.querySelectorAll('.row')];

  gamesElements.forEach(row => {
    const inputs = row.querySelectorAll('input');
    const name = inputs[0].value || 'Juego';
    const size = inputs[1].value + ' ' + row.querySelector('select').value;
    const imgData = row.querySelector('.img-uploader').dataset.img || null;
    tableRows.push(['', name, size]);
    rowImages.push(imgData);
  });

  if(tableRows.length === 0){
    tableRows.push(['', 'Sin juegos cargados', '-']);
    rowImages.push(null);
  }

  function imgFormatFromDataUrl(dataUrl){
    const match = /^data:image\/(png|jpeg|jpg|webp)/i.exec(dataUrl || '');
    if(!match) return 'JPEG';
    const ext = match[1].toUpperCase();
    return ext === 'JPG' ? 'JPEG' : ext;
  }

  const IMG_CELL_SIZE = 16; 

  doc.autoTable({
    startY: 104,
    head: [['Portada', 'Juego / ISO', 'Tamaño']],
    body: tableRows,
    theme: 'grid',
    headStyles: {
      fillColor: [20, 25, 21],
      textColor: [214, 175, 55],
      fontStyle: 'bold'
    },
    bodyStyles: {
      textColor: [30, 30, 30],
      fontSize: 9,
      minCellHeight: IMG_CELL_SIZE + 4,
      valign: 'middle'
    },
    columnStyles: {
      0: { cellWidth: IMG_CELL_SIZE + 6 }
    },
    alternateRowStyles: {
      fillColor: [245, 245, 240]
    },
    margin: { left: 14, right: 14 },
    didDrawCell: function(data) {
      if(data.section === 'body' && data.column.index === 0){
        const imgData = rowImages[data.row.index];
        if(imgData){
          try{
            const format = imgFormatFromDataUrl(imgData);
            const cell = data.cell;
            const size = Math.min(cell.height - 3, IMG_CELL_SIZE);
            const x = cell.x + (cell.width - size) / 2;
            const y = cell.y + (cell.height - size) / 2;
            doc.addImage(imgData, format, x, y, size, size);
          } catch(e) { console.error('Error dibujando portada en PDF:', e); }
        }
      }
    },
    didDrawPage: function(data) {
      const pageHeight = doc.internal.pageSize.height;
      doc.setFontSize(8);
      doc.setTextColor(150, 150, 150);
      doc.text('Generado automáticamente — Gold Storage Manager', 14, pageHeight - 10);
    }
  });

  const finalY = doc.lastAutoTable.finalY + 10;
  doc.setFontSize(9);
  doc.setTextColor(100, 100, 100);
  if(finalY < doc.internal.pageSize.height - 20){
    doc.text(`Total de ISOs en la lista: ${gamesElements.length}`, 14, finalY);
  }

  const fileName = `Reporte_${dName.replace(/\s+/g,'_')}_${owner.replace(/\s+/g,'_')}.pdf`;
  doc.save(fileName);
});

// Inicializar la app con dos filas de ejemplo predeterminadas
makeRow('God of War Ragnarök', 65, 'GB');
makeRow('Hollow Knight', 250, 'MB');
calc();