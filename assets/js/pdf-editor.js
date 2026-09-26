/**
 * PDF Master Hub - All-in-One PDF Editor Engine
 * Features:
 * 1. Font Family Selector (Helvetica/Sans-Serif, Times/Serif, Courier/Monospace).
 * 2. Font Sizes (10px to 72px).
 * 3. Adjustable Whiteout / PDF Eraser Tool (Small 15px, Medium 30px, Large 60px, Huge 100px)
 *    to erase/white-out any underlying text, logo, or lines on the PDF.
 * 4. Photo Upload & Resizing, Drawing Signature Modal.
 * 5. Undo / Redo History Stack (Ctrl+Z / Ctrl+Y).
 */

let currentPdfFile = null;
let pdfJsDoc = null;
let currentPageNum = 1;
let totalPages = 1;
let viewportScale = 1.2;

// Array of editor elements across pages:
// { id, pageNum, type: 'text'|'photo'|'signature'|'eraser', textContent, imageSrc, fontSize, fontColor, fontFamily, x, y, width, height }
let editorElements = [];

// Undo / Redo History Stack
let undoStack = [];
let redoStack = [];

let sigPadCanvas = null;
let sigPadCtx = null;
let isDrawingSig = false;

document.addEventListener('DOMContentLoaded', () => {
  const dropzone = document.getElementById('dropzone');
  const fileInput = document.getElementById('file-input');
  const prevPageBtn = document.getElementById('prev-page-btn');
  const nextPageBtn = document.getElementById('next-page-btn');
  
  // Custom Text & Date
  const addDateBtn = document.getElementById('add-date-btn');
  const addCustomTextBtn = document.getElementById('add-custom-text-btn');
  const customTextInput = document.getElementById('custom-text-input');

  // Eraser / Whiteout Tool
  const addEraserBtn = document.getElementById('add-eraser-btn');

  // Photo Upload
  const photoInput = document.getElementById('photo-upload-input');
  const addPhotoBtn = document.getElementById('add-photo-btn');

  // Signature Modal
  const openSigModalBtn = document.getElementById('open-sig-modal-btn');
  const closeSigModalBtn = document.getElementById('close-sig-modal-btn');
  const clearSigPadBtn = document.getElementById('clear-sig-pad-btn');
  const applySigBtn = document.getElementById('apply-sig-btn');

  // Undo / Redo / Clear
  const undoBtn = document.getElementById('undo-btn');
  const redoBtn = document.getElementById('redo-btn');
  const clearElementsBtn = document.getElementById('clear-elements-btn');
  const downloadEditedPdfBtn = document.getElementById('download-edited-pdf-btn');

  if (dropzone && fileInput) {
    setupDropzone(dropzone, fileInput, (files) => handleFileSelected(files[0]));
  }

  if (prevPageBtn) prevPageBtn.addEventListener('click', () => changePage(-1));
  if (nextPageBtn) nextPageBtn.addEventListener('click', () => changePage(1));

  if (addDateBtn) addDateBtn.addEventListener('click', addDateField);
  if (addCustomTextBtn) addCustomTextBtn.addEventListener('click', addCustomTextField);

  if (addEraserBtn) addEraserBtn.addEventListener('click', addEraserBlock);

  if (customTextInput) {
    customTextInput.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        addCustomTextField();
      }
    });
  }

  if (addPhotoBtn && photoInput) {
    addPhotoBtn.addEventListener('click', () => photoInput.click());
    photoInput.addEventListener('change', handlePhotoSelected);
  }

  if (openSigModalBtn) openSigModalBtn.addEventListener('click', openSignatureModal);
  if (closeSigModalBtn) closeSigModalBtn.addEventListener('click', closeSignatureModal);
  if (clearSigPadBtn) clearSigPadBtn.addEventListener('click', clearSignaturePad);
  if (applySigBtn) applySigBtn.addEventListener('click', applySignatureToPage);

  if (undoBtn) undoBtn.addEventListener('click', undoAction);
  if (redoBtn) redoBtn.addEventListener('click', redoAction);
  if (clearElementsBtn) clearElementsBtn.addEventListener('click', clearPageElements);
  if (downloadEditedPdfBtn) downloadEditedPdfBtn.addEventListener('click', burnAndSavePdf);

  // Keyboard Shortcuts for Undo (Ctrl+Z) & Redo (Ctrl+Y)
  document.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
      if (e.shiftKey) {
        redoAction();
      } else {
        undoAction();
      }
    } else if ((e.ctrlKey || e.metaKey) && e.key === 'y') {
      redoAction();
    }
  });

  initSignaturePadModal();
});

/* History Stack Helpers */
function pushHistoryState() {
  undoStack.push(JSON.stringify(editorElements));
  redoStack = [];
  updateHistoryButtonsUI();
}

function undoAction() {
  if (undoStack.length === 0) {
    showToast('Nothing to undo', 'info');
    return;
  }
  redoStack.push(JSON.stringify(editorElements));
  const previousState = undoStack.pop();
  editorElements = JSON.parse(previousState);
  renderElementsForCurrentPage();
  updateHistoryButtonsUI();
  showToast('Action undone', 'info');
}

function redoAction() {
  if (redoStack.length === 0) {
    showToast('Nothing to redo', 'info');
    return;
  }
  undoStack.push(JSON.stringify(editorElements));
  const nextState = redoStack.pop();
  editorElements = JSON.parse(nextState);
  renderElementsForCurrentPage();
  updateHistoryButtonsUI();
  showToast('Action redone', 'info');
}

function updateHistoryButtonsUI() {
  const undoBtn = document.getElementById('undo-btn');
  const redoBtn = document.getElementById('redo-btn');
  if (undoBtn) undoBtn.disabled = undoStack.length === 0;
  if (redoBtn) redoBtn.disabled = redoStack.length === 0;
}

/* Signature Pad Modal */
function initSignaturePadModal() {
  sigPadCanvas = document.getElementById('editor-sig-pad');
  if (!sigPadCanvas) return;
  sigPadCtx = sigPadCanvas.getContext('2d');

  sigPadCanvas.addEventListener('mousedown', startSigDrawing);
  sigPadCanvas.addEventListener('mousemove', drawSig);
  sigPadCanvas.addEventListener('mouseup', stopSigDrawing);
  sigPadCanvas.addEventListener('mouseleave', stopSigDrawing);

  sigPadCanvas.addEventListener('touchstart', (e) => {
    e.preventDefault();
    const touch = e.touches[0];
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
  const modal = document.getElementById('editor-sig-modal');
  if (modal) {
    modal.style.display = 'flex';
    clearSignaturePad();
  }
}

function closeSignatureModal() {
  const modal = document.getElementById('editor-sig-modal');
  if (modal) modal.style.display = 'none';
}

function applySignatureToPage() {
  if (!sigPadCanvas) return;
  const dataUrl = sigPadCanvas.toDataURL('image/png');

  pushHistoryState();

  const id = 'el_' + Math.random().toString(36).substring(2, 9);
  editorElements.push({
    id: id,
    pageNum: currentPageNum,
    type: 'signature',
    imageSrc: dataUrl,
    x: 50,
    y: 50,
    width: 160,
    height: 60
  });

  closeSignatureModal();
  renderElementsForCurrentPage();
  showToast('Signature added! Drag to position.', 'success');
}

/* File Upload & PDF Page Rendering */
async function handleFileSelected(file) {
  if (!file || !file.name.toLowerCase().endsWith('.pdf')) {
    showToast('Please upload a valid PDF file.', 'error');
    return;
  }

  currentPdfFile = file;
  currentPageNum = 1;
  editorElements = [];
  undoStack = [];
  redoStack = [];
  updateHistoryButtonsUI();

  try {
    const arrayBuffer = await file.arrayBuffer();
    pdfJsDoc = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    totalPages = pdfJsDoc.numPages;

    document.getElementById('dropzone-container').style.display = 'none';
    document.getElementById('workspace-controls').style.display = 'block';

    renderCurrentPage();
    showToast(`Loaded ${file.name} for editing`, 'success');
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

  renderElementsForCurrentPage();
}

function changePage(delta) {
  const newPage = currentPageNum + delta;
  if (newPage >= 1 && newPage <= totalPages) {
    currentPageNum = newPage;
    renderCurrentPage();
  }
}

/* Add Text & Date Annotations */
function addDateField() {
  const today = new Date().toLocaleDateString();
  addTextElement(`Date: ${today}`);
}

function addCustomTextField() {
  const input = document.getElementById('custom-text-input');
  if (!input || !input.value.trim()) {
    showToast('Please enter text in the box first.', 'warning');
    return;
  }
  const fontSize = parseInt(document.getElementById('font-size') ? document.getElementById('font-size').value : 18);
  const fontFamily = document.getElementById('font-family') ? document.getElementById('font-family').value : 'Helvetica';

  addTextElement(input.value.trim(), fontSize, fontFamily);
  input.value = '';
}

function addTextElement(text, overrideFontSize = null, overrideFontFamily = null) {
  pushHistoryState();

  const fontSize = overrideFontSize || parseInt(document.getElementById('font-size') ? document.getElementById('font-size').value : 18);
  const fontColor = document.getElementById('font-color') ? document.getElementById('font-color').value : '#000000';
  const fontFamily = overrideFontFamily || (document.getElementById('font-family') ? document.getElementById('font-family').value : 'Helvetica');
  const id = 'el_' + Math.random().toString(36).substring(2, 9);
  
  editorElements.push({
    id: id,
    pageNum: currentPageNum,
    type: 'text',
    textContent: text,
    fontSize: fontSize,
    fontColor: fontColor,
    fontFamily: fontFamily,
    x: 50,
    y: 50
  });

  renderElementsForCurrentPage();
  showToast('Text tag placed! Drag to position.', 'info');
}

/* Whiteout / PDF Eraser Block Tool */
function addEraserBlock() {
  pushHistoryState();

  const sizeOpt = document.getElementById('eraser-size') ? document.getElementById('eraser-size').value : '30';
  let w = 80, h = 30;

  if (sizeOpt === '15') { w = 40; h = 20; }
  else if (sizeOpt === '30') { w = 80; h = 30; }
  else if (sizeOpt === '60') { w = 150; h = 50; }
  else if (sizeOpt === '100') { w = 220; h = 80; }

  const id = 'el_' + Math.random().toString(36).substring(2, 9);

  editorElements.push({
    id: id,
    pageNum: currentPageNum,
    type: 'eraser',
    x: 80,
    y: 80,
    width: w,
    height: h
  });

  renderElementsForCurrentPage();
  showToast('Eraser/Whiteout block added! Drag & resize over text to erase.', 'success');
}

/* Photo Upload & Placement */
function handlePhotoSelected(e) {
  const file = e.target.files[0];
  if (!file || !file.type.startsWith('image/')) {
    showToast('Please select a valid image file (JPG, PNG, WebP).', 'error');
    return;
  }

  const reader = new FileReader();
  reader.onload = (event) => {
    pushHistoryState();

    const dataUrl = event.target.result;
    const id = 'el_' + Math.random().toString(36).substring(2, 9);

    editorElements.push({
      id: id,
      pageNum: currentPageNum,
      type: 'photo',
      imageSrc: dataUrl,
      x: 60,
      y: 60,
      width: 120,
      height: 150
    });

    renderElementsForCurrentPage();
    showToast('Photo added! Drag or resize handles to fit form box.', 'success');
  };
  reader.readAsDataURL(file);
  e.target.value = '';
}

function clearPageElements() {
  if (editorElements.filter(el => el.pageNum === currentPageNum).length === 0) return;
  pushHistoryState();
  editorElements = editorElements.filter(el => el.pageNum !== currentPageNum);
  renderElementsForCurrentPage();
  showToast('Page elements cleared', 'info');
}

/* Render & Interactive Drag/Resize Layer */
function renderElementsForCurrentPage() {
  const container = document.getElementById('editor-elements-container');
  if (!container) return;
  container.innerHTML = '';
  container.style.pointerEvents = 'none';

  const pageElems = editorElements.filter(el => el.pageNum === currentPageNum);

  pageElems.forEach(item => {
    const el = document.createElement('div');
    el.className = 'editor-item';
    el.id = item.id;
    el.style.left = item.x + 'px';
    el.style.top = item.y + 'px';
    el.style.pointerEvents = 'auto';

    if (item.type === 'text') {
      let fontCss = 'sans-serif';
      if (item.fontFamily === 'TimesRoman') fontCss = "'Times New Roman', serif";
      if (item.fontFamily === 'Courier') fontCss = "'Courier New', monospace";
      if (item.fontFamily === 'Georgia') fontCss = "Georgia, serif";
      if (item.fontFamily === 'Verdana') fontCss = "Verdana, sans-serif";

      el.innerHTML = `
        <span class="editor-text" style="font-size: ${item.fontSize}px; color: ${item.fontColor}; font-family: ${fontCss};">${item.textContent}</span>
        <button class="editor-delete-btn" onclick="deleteElement('${item.id}')" title="Delete Tag"><i class="fas fa-times"></i></button>
      `;
    } else if (item.type === 'photo' || item.type === 'signature') {
      el.style.width = item.width + 'px';
      el.style.height = item.height + 'px';
      el.innerHTML = `
        <img class="editor-photo" src="${item.imageSrc}" style="width: 100%; height: 100%; object-fit: contain;">
        <button class="editor-delete-btn" onclick="deleteElement('${item.id}')" title="Delete Image"><i class="fas fa-times"></i></button>
        <div class="resize-handle" data-id="${item.id}" title="Drag to Resize"></div>
      `;
    } else if (item.type === 'eraser') {
      el.style.width = item.width + 'px';
      el.style.height = item.height + 'px';
      el.style.background = '#ffffff';
      el.style.border = '2px dashed var(--danger)';
      el.style.boxShadow = '0 0 6px rgba(239, 68, 68, 0.4)';
      el.innerHTML = `
        <span style="font-size: 0.65rem; color: #666; font-weight:700; pointer-events:none;">WHITEOUT</span>
        <button class="editor-delete-btn" onclick="deleteElement('${item.id}')" title="Remove Eraser Block"><i class="fas fa-times"></i></button>
        <div class="resize-handle" data-id="${item.id}" title="Drag to Resize Eraser Area"></div>
      `;
    }

    container.appendChild(el);
    makeElementDraggableAndResizable(el, item);
  });
}

function deleteElement(id) {
  pushHistoryState();
  editorElements = editorElements.filter(el => el.id !== id);
  renderElementsForCurrentPage();
}

function makeElementDraggableAndResizable(el, item) {
  let isDragging = false;
  let isResizing = false;
  let startX = 0, startY = 0;
  let initialLeft = item.x;
  let initialTop = item.y;
  let initialWidth = item.width || 120;
  let initialHeight = item.height || 150;

  const wrapper = document.getElementById('canvas-wrapper');

  const onStart = (e) => {
    if (e.target.closest('.editor-delete-btn')) return;

    pushHistoryState();

    const resizeHandle = e.target.closest('.resize-handle');
    const clientX = e.type.startsWith('touch') ? e.touches[0].clientX : e.clientX;
    const clientY = e.type.startsWith('touch') ? e.touches[0].clientY : e.clientY;

    startX = clientX;
    startY = clientY;

    if (resizeHandle) {
      isResizing = true;
      initialWidth = item.width || el.offsetWidth;
      initialHeight = item.height || el.offsetHeight;
    } else {
      isDragging = true;
      initialLeft = item.x;
      initialTop = item.y;
    }

    el.classList.add('active');

    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onEnd);
    document.addEventListener('touchmove', onMove, { passive: false });
    document.addEventListener('touchend', onEnd);
  };

  const onMove = (e) => {
    if (!isDragging && !isResizing) return;
    if (e.cancelable) e.preventDefault();

    const clientX = e.type.startsWith('touch') ? e.touches[0].clientX : e.clientX;
    const clientY = e.type.startsWith('touch') ? e.touches[0].clientY : e.clientY;

    const deltaX = clientX - startX;
    const deltaY = clientY - startY;

    if (isDragging) {
      let newX = initialLeft + deltaX;
      let newY = initialTop + deltaY;

      const wrapperRect = wrapper.getBoundingClientRect();
      const elRect = el.getBoundingClientRect();

      newX = Math.max(0, Math.min(newX, wrapperRect.width - elRect.width));
      newY = Math.max(0, Math.min(newY, wrapperRect.height - elRect.height));

      item.x = newX;
      item.y = newY;
      el.style.left = newX + 'px';
      el.style.top = newY + 'px';
    } else if (isResizing) {
      let newW = Math.max(20, initialWidth + deltaX);
      let newH = Math.max(15, initialHeight + deltaY);

      item.width = newW;
      item.height = newH;
      el.style.width = newW + 'px';
      el.style.height = newH + 'px';
    }
  };

  const onEnd = () => {
    if (isDragging || isResizing) {
      isDragging = false;
      isResizing = false;
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

/* Save & Burn All Elements (Text, Erasers, Photos, Signatures) into PDF */
async function burnAndSavePdf() {
  if (!currentPdfFile) return;

  if (editorElements.length === 0) {
    showToast('No text, whiteout erasers, photos, or signature elements added yet.', 'warning');
    return;
  }

  const downloadBtn = document.getElementById('download-edited-pdf-btn');
  if (downloadBtn) downloadBtn.disabled = true;

  try {
    const { PDFDocument, rgb, StandardFonts } = PDFLib;
    const arrayBuffer = await currentPdfFile.arrayBuffer();
    const pdfDoc = await PDFDocument.load(arrayBuffer);

    // Embed Standard Fonts
    const fontHelvetica = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
    const fontTimes = await pdfDoc.embedFont(StandardFonts.TimesRomanBold);
    const fontCourier = await pdfDoc.embedFont(StandardFonts.CourierBold);

    const pdfCanvas = document.getElementById('pdf-canvas');
    const renderedWidth = pdfCanvas.width;
    const renderedHeight = pdfCanvas.height;

    const pages = pdfDoc.getPages();

    for (let pNum = 1; pNum <= pages.length; pNum++) {
      const pageElements = editorElements.filter(el => el.pageNum === pNum);
      if (pageElements.length === 0) continue;

      const page = pages[pNum - 1];
      const { width: pdfPageWidth, height: pdfPageHeight } = page.getSize();

      const scaleX = pdfPageWidth / renderedWidth;
      const scaleY = pdfPageHeight / renderedHeight;

      for (const item of pageElements) {
        const domEl = document.getElementById(item.id);
        let domWidth = item.width || 120;
        let domHeight = item.height || 40;
        if (domEl) {
          const rect = domEl.getBoundingClientRect();
          domWidth = rect.width;
          domHeight = rect.height;
        }

        const pdfX = item.x * scaleX;
        const pdfY = (renderedHeight - item.y - domHeight) * scaleY;

        if (item.type === 'eraser') {
          // Whiteout erase: draw solid white rectangle at coordinates
          const drawW = domWidth * scaleX;
          const drawH = domHeight * scaleY;

          page.drawRectangle({
            x: pdfX,
            y: pdfY,
            width: drawW,
            height: drawH,
            color: rgb(1, 1, 1) // Pure solid white fill
          });

        } else if (item.type === 'text') {
          const hex = item.fontColor || '#000000';
          const r = parseInt(hex.substr(1,2),16) / 255;
          const g = parseInt(hex.substr(3,2),16) / 255;
          const b = parseInt(hex.substr(5,2),16) / 255;

          const pdfFontSize = (item.fontSize || 18) * scaleY;

          let targetFont = fontHelvetica;
          if (item.fontFamily === 'TimesRoman' || item.fontFamily === 'Georgia') targetFont = fontTimes;
          if (item.fontFamily === 'Courier') targetFont = fontCourier;

          page.drawText(item.textContent, {
            x: pdfX,
            y: pdfY + (4 * scaleY),
            size: pdfFontSize,
            font: targetFont,
            color: rgb(r, g, b)
          });

        } else if (item.type === 'photo' || item.type === 'signature') {
          const imageBytes = await fetch(item.imageSrc).then(res => res.arrayBuffer());
          let embeddedImage;

          try {
            embeddedImage = await pdfDoc.embedPng(imageBytes);
          } catch {
            embeddedImage = await pdfDoc.embedJpg(imageBytes);
          }

          const drawWidth = domWidth * scaleX;
          const drawHeight = domHeight * scaleY;

          page.drawImage(embeddedImage, {
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

    downloadBlob(blob, `Edited_${currentPdfFile.name}`);
    showToast('Edited PDF exported successfully!', 'success');
  } catch (err) {
    console.error(err);
    showToast('Failed to generate edited PDF.', 'error');
  } finally {
    if (downloadBtn) downloadBtn.disabled = false;
  }
}
