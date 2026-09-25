/**
 * PDF Master Hub - PDF Signer & Annotator Engine (Draggable Placement System)
 * Allows users to create text, date, and drawing signature tags, drag them anywhere
 * on the PDF page canvas, and burn them into the PDF with pdf-lib.
 */

let currentPdfFile = null;
let pdfJsDoc = null;
let currentPageNum = 1;
let totalPages = 1;
let viewportScale = 1.2;

// Array of annotation objects across pages:
// { id, pageNum, type: 'text'|'image', textContent, imageSrc, fontColor, fontSize, x, y, width, height }
let annotations = []; 

// Signature Pad State
let sigPadCanvas = null;
let sigPadCtx = null;
let isDrawingSig = false;

document.addEventListener('DOMContentLoaded', () => {
  const dropzone = document.getElementById('dropzone');
  const fileInput = document.getElementById('file-input');
  const prevPageBtn = document.getElementById('prev-page-btn');
  const nextPageBtn = document.getElementById('next-page-btn');
  const openSigModalBtn = document.getElementById('open-sign-modal-btn');
  const closeSigModalBtn = document.getElementById('close-modal-btn');
  const clearSigPadBtn = document.getElementById('clear-sig-pad-btn');
  const applySigBtn = document.getElementById('apply-sig-btn');
  const addDateBtn = document.getElementById('add-date-btn');
  const addTextBtn = document.getElementById('add-text-btn');
  const clearAnnotationsBtn = document.getElementById('clear-annotations-btn');
  const downloadSignedBtn = document.getElementById('download-signed-btn');

  if (dropzone && fileInput) {
    setupDropzone(dropzone, fileInput, (files) => handleFileSelected(files[0]));
  }

  if (prevPageBtn) prevPageBtn.addEventListener('click', () => changePage(-1));
  if (nextPageBtn) nextPageBtn.addEventListener('click', () => changePage(1));
  
  if (openSigModalBtn) openSigModalBtn.addEventListener('click', openSignatureModal);
  if (closeSigModalBtn) closeSigModalBtn.addEventListener('click', closeSignatureModal);
  if (clearSigPadBtn) clearSigPadBtn.addEventListener('click', clearSignaturePad);
  if (applySigBtn) applySigBtn.addEventListener('click', applySignatureToPage);

  if (addDateBtn) addDateBtn.addEventListener('click', addDateAnnotation);
  if (addTextBtn) addTextBtn.addEventListener('click', addTextAnnotation);
  if (clearAnnotationsBtn) clearAnnotationsBtn.addEventListener('click', clearPageAnnotations);
  if (downloadSignedBtn) downloadSignedBtn.addEventListener('click', burnAndSavePdf);

  initSignaturePadModal();
});

/* Initialize Signature Creator Modal Canvas */
function initSignaturePadModal() {
  sigPadCanvas = document.getElementById('signature-draw-pad');
  if (!sigPadCanvas) return;
  sigPadCtx = sigPadCanvas.getContext('2d');

  sigPadCanvas.addEventListener('mousedown', startSigDrawing);
  sigPadCanvas.addEventListener('mousemove', drawSig);
  sigPadCanvas.addEventListener('mouseup', stopSigDrawing);
  sigPadCanvas.addEventListener('mouseleave', stopSigDrawing);

  sigPadCanvas.addEventListener('touchstart', (e) => {
    e.preventDefault();
    const touch = e.touches[0];
    const rect = sigPadCanvas.getBoundingClientRect();
    startSigDrawing({ clientX: touch.clientX, clientY: touch.clientY });
  });

  sigPadCanvas.addEventListener('touchmove', (e) => {
    e.preventDefault();
    const touch = e.touches[0];
    drawSig({ clientX: touch.clientX, clientY: touch.clientY });
  });

  sigPadCanvas.addEventListener('touchend', stopSigDrawing);
}

function startSigDrawing(e) {
  isDrawingSig = true;
  const rect = sigPadCanvas.getBoundingClientRect();
  const scaleX = sigPadCanvas.width / rect.width;
  const scaleY = sigPadCanvas.height / rect.height;
  const x = (e.clientX - rect.left) * scaleX;
  const y = (e.clientY - rect.top) * scaleY;

  sigPadCtx.beginPath();
  sigPadCtx.moveTo(x, y);

  const color = document.getElementById('sig-pen-color') ? document.getElementById('sig-pen-color').value : '#000000';
  sigPadCtx.strokeStyle = color;
  sigPadCtx.lineWidth = 3;
  sigPadCtx.lineCap = 'round';
  sigPadCtx.lineJoin = 'round';
}

function drawSig(e) {
  if (!isDrawingSig) return;
  const rect = sigPadCanvas.getBoundingClientRect();
  const scaleX = sigPadCanvas.width / rect.width;
  const scaleY = sigPadCanvas.height / rect.height;
  const x = (e.clientX - rect.left) * scaleX;
  const y = (e.clientY - rect.top) * scaleY;

  sigPadCtx.lineTo(x, y);
  sigPadCtx.stroke();
}

function stopSigDrawing() {
  isDrawingSig = false;
}

function clearSignaturePad() {
  if (!sigPadCtx || !sigPadCanvas) return;
  sigPadCtx.clearRect(0, 0, sigPadCanvas.width, sigPadCanvas.height);
}

function openSignatureModal() {
  const modal = document.getElementById('sign-modal');
  if (modal) {
    modal.style.display = 'flex';
    clearSignaturePad();
  }
}

function closeSignatureModal() {
  const modal = document.getElementById('sign-modal');
  if (modal) modal.style.display = 'none';
}

function applySignatureToPage() {
  if (!sigPadCanvas) return;
  const dataUrl = sigPadCanvas.toDataURL('image/png');

  const id = 'ann_' + Math.random().toString(36).substring(2, 9);
  annotations.push({
    id: id,
    pageNum: currentPageNum,
    type: 'image',
    imageSrc: dataUrl,
    x: 40,
    y: 40,
    width: 160,
    height: 60
  });

  closeSignatureModal();
  renderAnnotationsForCurrentPage();
  showToast('Signature added! Drag to position it.', 'success');
}

/* File Upload & PDF JS Page Rendering */
async function handleFileSelected(file) {
  if (!file || !file.name.toLowerCase().endsWith('.pdf')) {
    showToast('Please upload a valid PDF file.', 'error');
    return;
  }

  currentPdfFile = file;
  currentPageNum = 1;
  annotations = [];

  try {
    const arrayBuffer = await file.arrayBuffer();
    pdfJsDoc = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    totalPages = pdfJsDoc.numPages;

    document.getElementById('dropzone-container').style.display = 'none';
    document.getElementById('workspace-controls').style.display = 'block';

    renderCurrentPage();
    showToast(`Loaded ${file.name} for signing`, 'success');
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

  renderAnnotationsForCurrentPage();
}

function changePage(delta) {
  const newPage = currentPageNum + delta;
  if (newPage >= 1 && newPage <= totalPages) {
    currentPageNum = newPage;
    renderCurrentPage();
  }
}

/* Add Text & Date Annotation Functions */
function addTextAnnotation() {
  const input = document.getElementById('custom-text-input');
  if (!input || !input.value.trim()) {
    showToast('Please type text in the box first.', 'warning');
    return;
  }

  const text = input.value.trim();
  const fontSize = parseInt(document.getElementById('text-size') ? document.getElementById('text-size').value : 18);
  const fontColor = document.getElementById('text-color') ? document.getElementById('text-color').value : '#000000';

  const id = 'ann_' + Math.random().toString(36).substring(2, 9);
  annotations.push({
    id: id,
    pageNum: currentPageNum,
    type: 'text',
    textContent: text,
    fontSize: fontSize,
    fontColor: fontColor,
    x: 40,
    y: 40
  });

  input.value = '';
  renderAnnotationsForCurrentPage();
  showToast('Text tag added! Drag to position.', 'info');
}

function addDateAnnotation() {
  const today = new Date().toLocaleDateString();
  const fontSize = 18;
  const fontColor = document.getElementById('text-color') ? document.getElementById('text-color').value : '#000000';

  const id = 'ann_' + Math.random().toString(36).substring(2, 9);
  annotations.push({
    id: id,
    pageNum: currentPageNum,
    type: 'text',
    textContent: `Date: ${today}`,
    fontSize: fontSize,
    fontColor: fontColor,
    x: 40,
    y: 80
  });

  renderAnnotationsForCurrentPage();
  showToast('Date tag added! Drag to position.', 'info');
}

function clearPageAnnotations() {
  annotations = annotations.filter(a => a.pageNum !== currentPageNum);
  renderAnnotationsForCurrentPage();
  showToast('Tags cleared for current page', 'info');
}

/* Render & Draggable Interaction System */
function renderAnnotationsForCurrentPage() {
  const container = document.getElementById('annotations-container');
  if (!container) return;
  container.innerHTML = '';
  container.style.pointerEvents = 'none';

  const currentPageAnn = annotations.filter(a => a.pageNum === currentPageNum);

  currentPageAnn.forEach(ann => {
    const el = document.createElement('div');
    el.className = 'annotation-item';
    el.id = ann.id;
    el.style.left = ann.x + 'px';
    el.style.top = ann.y + 'px';
    el.style.pointerEvents = 'auto';

    if (ann.type === 'text') {
      el.innerHTML = `
        <span class="annotation-text" style="font-size: ${ann.fontSize}px; color: ${ann.fontColor};">${ann.textContent}</span>
        <button class="annotation-delete-btn" onclick="deleteAnnotation('${ann.id}')"><i class="fas fa-times"></i></button>
      `;
    } else if (ann.type === 'image') {
      el.innerHTML = `
        <img class="annotation-img" src="${ann.imageSrc}" style="width: ${ann.width || 160}px;">
        <button class="annotation-delete-btn" onclick="deleteAnnotation('${ann.id}')"><i class="fas fa-times"></i></button>
      `;
    }

    container.appendChild(el);
    makeElementDraggable(el, ann);
  });
}

function deleteAnnotation(id) {
  annotations = annotations.filter(a => a.id !== id);
  renderAnnotationsForCurrentPage();
}

function makeElementDraggable(el, ann) {
  let isDragging = false;
  let startX = 0, startY = 0;
  let initialLeft = ann.x;
  let initialTop = ann.y;

  const wrapper = document.getElementById('canvas-wrapper');

  const onStart = (e) => {
    // If click on delete button, do not drag
    if (e.target.closest('.annotation-delete-btn')) return;

    isDragging = true;
    el.classList.add('active');

    const clientX = e.type.startsWith('touch') ? e.touches[0].clientX : e.clientX;
    const clientY = e.type.startsWith('touch') ? e.touches[0].clientY : e.clientY;

    startX = clientX;
    startY = clientY;
    initialLeft = ann.x;
    initialTop = ann.y;

    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onEnd);
    document.addEventListener('touchmove', onMove, { passive: false });
    document.addEventListener('touchend', onEnd);
  };

  const onMove = (e) => {
    if (!isDragging) return;
    if (e.cancelable) e.preventDefault();

    const clientX = e.type.startsWith('touch') ? e.touches[0].clientX : e.clientX;
    const clientY = e.type.startsWith('touch') ? e.touches[0].clientY : e.clientY;

    const deltaX = clientX - startX;
    const deltaY = clientY - startY;

    let newX = initialLeft + deltaX;
    let newY = initialTop + deltaY;

    // Bounds checking inside canvas wrapper
    const wrapperRect = wrapper.getBoundingClientRect();
    const elRect = el.getBoundingClientRect();

    newX = Math.max(0, Math.min(newX, wrapperRect.width - elRect.width));
    newY = Math.max(0, Math.min(newY, wrapperRect.height - elRect.height));

    ann.x = newX;
    ann.y = newY;
    el.style.left = newX + 'px';
    el.style.top = newY + 'px';
  };

  const onEnd = () => {
    if (isDragging) {
      isDragging = false;
      el.classList.remove('active');
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onEnd);
      document.removeEventListener('touchmove', onMove);
      document.removeEventListener('touchend', onEnd);
    }
  };

  el.addEventListener('mousedown', onStart);
  el.addEventListener('touchstart', onStart, { passive: false });
}

/* Save & Burn Tags into PDF */
async function burnAndSavePdf() {
  if (!currentPdfFile) return;

  if (annotations.length === 0) {
    showToast('No signature or text tags added yet.', 'warning');
    return;
  }

  const downloadBtn = document.getElementById('download-signed-btn');
  if (downloadBtn) downloadBtn.disabled = true;

  try {
    const { PDFDocument, rgb, StandardFonts } = PDFLib;
    const arrayBuffer = await currentPdfFile.arrayBuffer();
    const pdfDoc = await PDFDocument.load(arrayBuffer);
    const standardFont = await pdfDoc.embedFont(StandardFonts.Helvetica);

    const pdfCanvas = document.getElementById('pdf-canvas');
    const renderedWidth = pdfCanvas.width;
    const renderedHeight = pdfCanvas.height;

    // Group annotations by pageNum
    const pages = pdfDoc.getPages();

    for (let pNum = 1; pNum <= pages.length; pNum++) {
      const pageAnn = annotations.filter(a => a.pageNum === pNum);
      if (pageAnn.length === 0) continue;

      const page = pages[pNum - 1];
      const { width: pdfPageWidth, height: pdfPageHeight } = page.getSize();

      const scaleX = pdfPageWidth / renderedWidth;
      const scaleY = pdfPageHeight / renderedHeight;

      for (const ann of pageAnn) {
        const el = document.getElementById(ann.id);
        let elHeight = 30;
        let elWidth = 100;
        if (el) {
          const rect = el.getBoundingClientRect();
          elWidth = rect.width;
          elHeight = rect.height;
        }

        // Convert HTML top-left relative coordinates to PDF bottom-left coordinates
        const pdfX = ann.x * scaleX;
        const pdfY = (renderedHeight - ann.y - elHeight) * scaleY;

        if (ann.type === 'text') {
          // Parse Hex Color to RGB
          const hex = ann.fontColor || '#000000';
          const r = parseInt(hex.substr(1,2),16) / 255;
          const g = parseInt(hex.substr(3,2),16) / 255;
          const b = parseInt(hex.substr(5,2),16) / 255;

          const pdfFontSize = (ann.fontSize || 18) * scaleY;

          page.drawText(ann.textContent, {
            x: pdfX,
            y: pdfY + (4 * scaleY),
            size: pdfFontSize,
            font: standardFont,
            color: rgb(r, g, b)
          });
        } else if (ann.type === 'image') {
          const signatureImageBytes = await fetch(ann.imageSrc).then(res => res.arrayBuffer());
          const signatureImage = await pdfDoc.embedPng(signatureImageBytes);

          const drawWidth = (ann.width || 160) * scaleX;
          const drawHeight = (ann.height || 60) * scaleY;

          page.drawImage(signatureImage, {
            x: pdfX,
            y: pdfY,
            width: drawWidth,
            height: drawHeight
          });
        }
      }
    }

    const pdfBytes = await pdfDoc.save();
    const blob = new Blob([pdfBytes], { type: 'application/pdf' });

    downloadBlob(blob, `Signed_${currentPdfFile.name}`);
    showToast('Signed PDF generated and downloaded successfully!', 'success');
  } catch (err) {
    console.error(err);
    showToast('Error generating signed PDF.', 'error');
  } finally {
    if (downloadBtn) downloadBtn.disabled = false;
  }
}
