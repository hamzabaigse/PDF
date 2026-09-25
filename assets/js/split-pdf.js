/**
 * PDF Master Hub - PDF Splitter & Page Deleter Engine
 * Allows page visual selection, page range specification, extraction or deletion.
 */

let currentPdfFile = null;
let pdfDocLib = null;
let totalPages = 0;
let selectedPages = new Set(); // Stores 1-indexed page numbers

document.addEventListener('DOMContentLoaded', () => {
  const dropzone = document.getElementById('dropzone');
  const fileInput = document.getElementById('file-input');
  const splitBtn = document.getElementById('split-btn');
  const selectAllBtn = document.getElementById('select-all-btn');
  const deselectAllBtn = document.getElementById('deselect-all-btn');
  const rangeInput = document.getElementById('page-range-input');

  if (dropzone && fileInput) {
    setupDropzone(dropzone, fileInput, (files) => handleFileSelected(files[0]));
  }

  if (selectAllBtn) {
    selectAllBtn.addEventListener('click', () => {
      for (let i = 1; i <= totalPages; i++) selectedPages.add(i);
      updateSelectionUI();
    });
  }

  if (deselectAllBtn) {
    deselectAllBtn.addEventListener('click', () => {
      selectedPages.clear();
      updateSelectionUI();
    });
  }

  if (rangeInput) {
    rangeInput.addEventListener('input', (e) => parsePageRange(e.target.value));
  }

  if (splitBtn) {
    splitBtn.addEventListener('click', processPdfSplit);
  }
});

async function handleFileSelected(file) {
  if (!file || !file.name.toLowerCase().endsWith('.pdf')) {
    showToast('Please select a valid PDF file.', 'error');
    return;
  }

  currentPdfFile = file;
  selectedPages.clear();

  try {
    const arrayBuffer = await file.arrayBuffer();
    const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
    const pdf = await loadingTask.promise;
    totalPages = pdf.numPages;

    document.getElementById('dropzone-container').style.display = 'none';
    document.getElementById('workspace-controls').style.display = 'block';

    renderPageGrid(pdf);
    showToast(`Loaded ${file.name} (${totalPages} pages)`, 'success');
  } catch (err) {
    console.error(err);
    showToast('Failed to load PDF file.', 'error');
  }
}

async function renderPageGrid(pdfJsDoc) {
  const grid = document.getElementById('page-grid');
  if (!grid) return;

  grid.innerHTML = '';

  for (let i = 1; i <= totalPages; i++) {
    const card = document.createElement('div');
    card.className = 'file-card';
    card.id = `page_card_${i}`;
    card.onclick = () => togglePageSelection(i);

    card.innerHTML = `
      <div class="file-preview">
        <canvas id="page_canvas_${i}"></canvas>
      </div>
      <div class="file-name">Page ${i}</div>
      <input type="checkbox" id="chk_page_${i}" style="margin-top: 0.5rem;" ${selectedPages.has(i) ? 'checked' : ''}>
    `;

    grid.appendChild(card);

    // Render page canvas thumbnail
    pdfJsDoc.getPage(i).then(page => {
      const canvas = document.getElementById(`page_canvas_${i}`);
      if (!canvas) return;
      const viewport = page.getViewport({ scale: 0.35 });
      const context = canvas.getContext('2d');
      canvas.height = viewport.height;
      canvas.width = viewport.width;
      page.render({ canvasContext: context, viewport: viewport });
    });
  }
}

function togglePageSelection(pageNum) {
  if (selectedPages.has(pageNum)) {
    selectedPages.delete(pageNum);
  } else {
    selectedPages.add(pageNum);
  }
  updateSelectionUI();
}

function updateSelectionUI() {
  for (let i = 1; i <= totalPages; i++) {
    const chk = document.getElementById(`chk_page_${i}`);
    const card = document.getElementById(`page_card_${i}`);
    const isSelected = selectedPages.has(i);

    if (chk) chk.checked = isSelected;
    if (card) {
      if (isSelected) card.style.borderColor = 'var(--primary)';
      else card.style.borderColor = 'var(--border-color)';
    }
  }

  const rangeInput = document.getElementById('page-range-input');
  if (rangeInput && document.activeElement !== rangeInput) {
    const sorted = Array.from(selectedPages).sort((a, b) => a - b);
    rangeInput.value = sorted.join(', ');
  }
}

function parsePageRange(inputStr) {
  selectedPages.clear();
  const parts = inputStr.split(',');
  parts.forEach(part => {
    part = part.trim();
    if (part.includes('-')) {
      const [start, end] = part.split('-').map(Number);
      if (start && end && start <= end) {
        for (let i = start; i <= end; i++) {
          if (i >= 1 && i <= totalPages) selectedPages.add(i);
        }
      }
    } else {
      const num = Number(part);
      if (num >= 1 && num <= totalPages) selectedPages.add(num);
    }
  });
  updateSelectionUI();
}

async function processPdfSplit() {
  if (!currentPdfFile) return;

  const mode = document.getElementById('split-mode') ? document.getElementById('split-mode').value : 'extract';
  
  let targetPages = [];
  if (mode === 'extract') {
    targetPages = Array.from(selectedPages).sort((a, b) => a - b);
    if (targetPages.length === 0) {
      showToast('Select at least one page to extract.', 'warning');
      return;
    }
  } else { // delete mode
    for (let i = 1; i <= totalPages; i++) {
      if (!selectedPages.has(i)) targetPages.push(i);
    }
    if (targetPages.length === 0) {
      showToast('Cannot delete all pages from PDF.', 'warning');
      return;
    }
  }

  try {
    const { PDFDocument } = PDFLib;
    const arrayBuffer = await currentPdfFile.arrayBuffer();
    const sourcePdf = await PDFDocument.load(arrayBuffer);
    const newPdf = await PDFDocument.create();

    // Convert 1-indexed page numbers to 0-indexed indices
    const pageIndices = targetPages.map(p => p - 1);
    const copiedPages = await newPdf.copyPages(sourcePdf, pageIndices);
    copiedPages.forEach(p => newPdf.addPage(p));

    const newPdfBytes = await newPdf.save();
    const blob = new Blob([newPdfBytes], { type: 'application/pdf' });
    const outputName = mode === 'extract' ? 'Extracted_Pages.pdf' : 'Remaining_Pages.pdf';

    downloadBlob(blob, outputName);
    showToast(`PDF processed successfully!`, 'success');
  } catch (err) {
    console.error(err);
    showToast('Failed to process PDF split.', 'error');
  }
}
