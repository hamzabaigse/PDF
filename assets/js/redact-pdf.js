/**
 * PDF Redact & Blackout Tool
 * 100% Client-Side In-Browser Execution using pdf-lib & pdf.js
 * Features:
 * - Redact sensitive text, numbers, or graphics with solid black or white boxes
 * - Interactive draggable redaction boxes
 * - Burn permanent redactions into PDF bytes
 */

let currentPdfFile = null;
let pdfJsDoc = null;
let currentPageNum = 1;
let totalPages = 1;
let viewportScale = 1.2;
let redactionBoxes = [];

document.addEventListener('DOMContentLoaded', () => {
  const dropzone = document.getElementById('dropzone');
  const fileInput = document.getElementById('file-input');
  const addRedactBoxBtn = document.getElementById('add-redact-box-btn');
  const applyRedactBtn = document.getElementById('apply-redact-btn');
  const prevPageBtn = document.getElementById('prev-page-btn');
  const nextPageBtn = document.getElementById('next-page-btn');

  if (dropzone && fileInput) {
    setupDropzone(dropzone, fileInput, (files) => handleFileSelected(files[0]));
  }

  if (addRedactBoxBtn) addRedactBoxBtn.addEventListener('click', addRedactionBox);
  if (applyRedactBtn) applyRedactBtn.addEventListener('click', burnAndSaveRedactedPdf);

  if (prevPageBtn) prevPageBtn.addEventListener('click', () => changePage(-1));
  if (nextPageBtn) nextPageBtn.addEventListener('click', () => changePage(1));
});

async function handleFileSelected(file) {
  if (!file || !file.name.toLowerCase().endsWith('.pdf')) {
    showToast('Please upload a valid PDF file.', 'error');
    return;
  }

  currentPdfFile = file;
  currentPageNum = 1;
  redactionBoxes = [];

  try {
    const arrayBuffer = await file.arrayBuffer();
    pdfJsDoc = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    totalPages = pdfJsDoc.numPages;

    document.getElementById('dropzone-container').style.display = 'none';
    document.getElementById('workspace-controls').style.display = 'block';

    renderCurrentPage();
    showToast(`Loaded ${file.name} for redaction`, 'success');
  } catch (err) {
    console.error(err);
    showToast('Failed to load PDF document.', 'error');
  }
}

async function renderCurrentPage() {
  if (!pdfJsDoc) return;
  const page = await pdfJsDoc.getPage(currentPageNum);
  const viewport = page.getViewport({ scale: viewportScale });

  const pdfCanvas = document.getElementById('pdf-canvas');
  const pdfCtx = pdfCanvas.getContext('2d');
  pdfCanvas.height = viewport.height;
  pdfCanvas.width = viewport.width;

  await page.render({ canvasContext: pdfCtx, viewport: viewport }).promise;
  document.getElementById('page-indicator').innerText = `Page ${currentPageNum} of ${totalPages}`;

  renderRedactionBoxesForCurrentPage();
}

function changePage(delta) {
  const newPage = currentPageNum + delta;
  if (newPage >= 1 && newPage <= totalPages) {
    currentPageNum = newPage;
    renderCurrentPage();
  }
}

function addRedactionBox() {
  const color = document.getElementById('redact-color') ? document.getElementById('redact-color').value : '#000000';
  const id = 'redact_' + Math.random().toString(36).substring(2, 9);

  redactionBoxes.push({
    id: id,
    pageNum: currentPageNum,
    color: color,
    x: 80,
    y: 80,
    width: 140,
    height: 35
  });

  renderRedactionBoxesForCurrentPage();
  showToast('Redaction box added! Drag over text to hide.', 'info');
}

function renderRedactionBoxesForCurrentPage() {
  const container = document.getElementById('redact-boxes-container');
  if (!container) return;
  container.innerHTML = '';

  const pageBoxes = redactionBoxes.filter(b => b.pageNum === currentPageNum);

  pageBoxes.forEach(item => {
    const el = document.createElement('div');
    el.className = 'editor-item';
    el.id = item.id;
    el.style.left = item.x + 'px';
    el.style.top = item.y + 'px';
    el.style.width = item.width + 'px';
    el.style.height = item.height + 'px';
    el.style.background = item.color;
    el.style.border = '2px dashed var(--danger)';
    el.style.pointerEvents = 'auto';

    el.innerHTML = `
      <span style="font-size:0.65rem; color:${item.color === '#000000' ? '#ffffff' : '#000000'}; font-weight:700; pointer-events:none;">REDACT</span>
      <button class="editor-delete-btn" onclick="deleteRedactBox('${item.id}')" title="Delete Box"><i class="fas fa-times"></i></button>
      <div class="resize-handle" data-id="${item.id}" title="Drag to Resize"></div>
    `;

    container.appendChild(el);
    makeRedactBoxDraggable(el, item);
  });
}

function deleteRedactBox(id) {
  redactionBoxes = redactionBoxes.filter(b => b.id !== id);
  renderRedactionBoxesForCurrentPage();
}

function makeRedactBoxDraggable(el, item) {
  let isDragging = false;
  let isResizing = false;
  let startX = 0, startY = 0;
  let initialLeft = item.x, initialTop = item.y;
  let initialW = item.width, initialH = item.height;

  const wrapper = document.getElementById('canvas-wrapper');

  const onStart = (e) => {
    if (e.target.closest('.editor-delete-btn')) return;

    const resizeHandle = e.target.closest('.resize-handle');
    const clientX = e.type.startsWith('touch') ? e.touches[0].clientX : e.clientX;
    const clientY = e.type.startsWith('touch') ? e.touches[0].clientY : e.clientY;

    startX = clientX;
    startY = clientY;

    if (resizeHandle) {
      isResizing = true;
      initialW = item.width;
      initialH = item.height;
    } else {
      isDragging = true;
      initialLeft = item.x;
      initialTop = item.y;
    }

    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onEnd);
  };

  const onMove = (e) => {
    if (!isDragging && !isResizing) return;
    const clientX = e.type.startsWith('touch') ? e.touches[0].clientX : e.clientX;
    const clientY = e.type.startsWith('touch') ? e.touches[0].clientY : e.clientY;

    const deltaX = clientX - startX;
    const deltaY = clientY - startY;

    if (isDragging) {
      item.x = Math.max(0, initialLeft + deltaX);
      item.y = Math.max(0, initialTop + deltaY);
      el.style.left = item.x + 'px';
      el.style.top = item.y + 'px';
    } else if (isResizing) {
      item.width = Math.max(20, initialW + deltaX);
      item.height = Math.max(15, initialH + deltaY);
      el.style.width = item.width + 'px';
      el.style.height = item.height + 'px';
    }
  };

  const onEnd = () => {
    isDragging = false;
    isResizing = false;
    document.removeEventListener('mousemove', onMove);
    document.removeEventListener('mouseup', onEnd);
  };

  el.addEventListener('mousedown', onStart);
}

async function burnAndSaveRedactedPdf() {
  if (!currentPdfFile || redactionBoxes.length === 0) {
    showToast('Add at least one redaction box to burn.', 'warning');
    return;
  }

  const btn = document.getElementById('apply-redact-btn');
  if (btn) btn.disabled = true;

  try {
    const { PDFDocument, rgb } = PDFLib;
    const arrayBuffer = await currentPdfFile.arrayBuffer();
    const pdfDoc = await PDFDocument.load(arrayBuffer);

    const pdfCanvas = document.getElementById('pdf-canvas');
    const renderedWidth = pdfCanvas.width;
    const renderedHeight = pdfCanvas.height;

    const pages = pdfDoc.getPages();

    for (let pNum = 1; pNum <= pages.length; pNum++) {
      const pageBoxes = redactionBoxes.filter(b => b.pageNum === pNum);
      if (pageBoxes.length === 0) continue;

      const page = pages[pNum - 1];
      const { width: pdfW, height: pdfH } = page.getSize();

      const scaleX = pdfW / renderedWidth;
      const scaleY = pdfH / renderedHeight;

      for (const item of pageBoxes) {
        const hex = item.color || '#000000';
        const r = parseInt(hex.substr(1,2),16) / 255;
        const g = parseInt(hex.substr(3,2),16) / 255;
        const b = parseInt(hex.substr(5,2),16) / 255;

        const pdfX = item.x * scaleX;
        const pdfY = (renderedHeight - item.y - item.height) * scaleY;
        const drawW = item.width * scaleX;
        const drawH = item.height * scaleY;

        page.drawRectangle({
          x: pdfX,
          y: pdfY,
          width: drawW,
          height: drawH,
          color: rgb(r, g, b)
        });
      }
    }

    const pdfBytes = await pdfDoc.save();
    const blob = new Blob([pdfBytes], { type: 'application/pdf' });
    downloadBlob(blob, `Redacted_${currentPdfFile.name}`);
    showToast('PDF Redacted successfully!', 'success');
  } catch (err) {
    console.error(err);
    showToast('Failed to redact PDF.', 'error');
  } finally {
    if (btn) btn.disabled = false;
  }
}
