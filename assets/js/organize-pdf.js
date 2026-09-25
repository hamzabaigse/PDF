/**
 * PDF Master Hub - PDF Visual Page Organizer Engine
 * Reorder, rotate, delete, or duplicate pages in an intuitive grid view.
 */

let currentPdfFile = null;
let pagesOrder = []; // Array of page objects { originalIndex, rotation }

document.addEventListener('DOMContentLoaded', () => {
  const dropzone = document.getElementById('dropzone');
  const fileInput = document.getElementById('file-input');
  const saveBtn = document.getElementById('save-organize-btn');

  if (dropzone && fileInput) {
    setupDropzone(dropzone, fileInput, (files) => handleFileSelected(files[0]));
  }

  if (saveBtn) saveBtn.addEventListener('click', processPdfOrganize);
});

async function handleFileSelected(file) {
  if (!file || !file.name.toLowerCase().endsWith('.pdf')) {
    showToast('Please upload a valid PDF file.', 'error');
    return;
  }

  currentPdfFile = file;
  pagesOrder = [];

  try {
    const arrayBuffer = await file.arrayBuffer();
    const pdfJsDoc = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    const numPages = pdfJsDoc.numPages;

    for (let i = 0; i < numPages; i++) {
      pagesOrder.push({ originalIndex: i, rotation: 0 });
    }

    document.getElementById('dropzone-container').style.display = 'none';
    document.getElementById('workspace-controls').style.display = 'block';

    renderPageGrid(pdfJsDoc);
    showToast(`Loaded ${file.name} (${numPages} pages)`, 'success');
  } catch (err) {
    console.error(err);
    showToast('Failed to load PDF file.', 'error');
  }
}

async function renderPageGrid(pdfJsDoc) {
  const grid = document.getElementById('page-grid');
  if (!grid) return;

  if (!pdfJsDoc) {
    const arrayBuffer = await currentPdfFile.arrayBuffer();
    pdfJsDoc = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  }

  grid.innerHTML = '';

  pagesOrder.forEach((pageItem, currentIndex) => {
    const card = document.createElement('div');
    card.className = 'file-card';

    card.innerHTML = `
      <button class="file-remove-btn" onclick="deletePage(${currentIndex})" title="Delete Page"><i class="fas fa-trash"></i></button>
      <div class="file-preview">
        <canvas id="page_canvas_${currentIndex}" style="transform: rotate(${pageItem.rotation}deg);"></canvas>
      </div>
      <div class="file-name">Page ${pageItem.originalIndex + 1}</div>
      <div style="display: flex; gap: 0.3rem; margin-top: 0.5rem; flex-wrap: wrap;">
        <button class="btn btn-sm btn-secondary" onclick="movePage(${currentIndex}, -1)" ${currentIndex === 0 ? 'disabled' : ''}><i class="fas fa-arrow-left"></i></button>
        <button class="btn btn-sm btn-secondary" onclick="movePage(${currentIndex}, 1)" ${currentIndex === pagesOrder.length - 1 ? 'disabled' : ''}><i class="fas fa-arrow-right"></i></button>
        <button class="btn btn-sm btn-secondary" onclick="rotatePageItem(${currentIndex})"><i class="fas fa-redo"></i></button>
        <button class="btn btn-sm btn-secondary" onclick="duplicatePage(${currentIndex})" title="Duplicate"><i class="fas fa-copy"></i></button>
      </div>
    `;

    grid.appendChild(card);

    pdfJsDoc.getPage(pageItem.originalIndex + 1).then(page => {
      const canvas = document.getElementById(`page_canvas_${currentIndex}`);
      if (!canvas) return;
      const viewport = page.getViewport({ scale: 0.3 });
      const context = canvas.getContext('2d');
      canvas.height = viewport.height;
      canvas.width = viewport.width;
      page.render({ canvasContext: context, viewport: viewport });
    });
  });
}

function movePage(index, dir) {
  const newIdx = index + dir;
  if (newIdx < 0 || newIdx >= pagesOrder.length) return;
  const temp = pagesOrder[index];
  pagesOrder[index] = pagesOrder[newIdx];
  pagesOrder[newIdx] = temp;
  renderPageGrid();
}

function rotatePageItem(index) {
  pagesOrder[index].rotation = (pagesOrder[index].rotation + 90) % 360;
  renderPageGrid();
}

function duplicatePage(index) {
  const item = pagesOrder[index];
  pagesOrder.splice(index + 1, 0, { originalIndex: item.originalIndex, rotation: item.rotation });
  renderPageGrid();
  showToast('Page duplicated', 'info');
}

function deletePage(index) {
  if (pagesOrder.length <= 1) {
    showToast('Cannot delete the last remaining page.', 'warning');
    return;
  }
  pagesOrder.splice(index, 1);
  renderPageGrid();
  showToast('Page removed', 'info');
}

async function processPdfOrganize() {
  if (!currentPdfFile || pagesOrder.length === 0) return;

  try {
    const { PDFDocument, degrees } = PDFLib;
    const arrayBuffer = await currentPdfFile.arrayBuffer();
    const sourcePdf = await PDFDocument.load(arrayBuffer);
    const newPdf = await PDFDocument.create();

    for (let i = 0; i < pagesOrder.length; i++) {
      const item = pagesOrder[i];
      const [copiedPage] = await newPdf.copyPages(sourcePdf, [item.originalIndex]);
      if (item.rotation !== 0) {
        const curRot = copiedPage.getRotation().angle;
        copiedPage.setRotation(degrees((curRot + item.rotation) % 360));
      }
      newPdf.addPage(copiedPage);
    }

    const pdfBytes = await newPdf.save();
    const blob = new Blob([pdfBytes], { type: 'application/pdf' });
    downloadBlob(blob, `Organized_${currentPdfFile.name}`);
    showToast('Organized PDF exported successfully!', 'success');
  } catch (err) {
    console.error(err);
    showToast('Failed to export organized PDF.', 'error');
  }
}
