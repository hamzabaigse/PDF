/**
 * Crop PDF Margins Engine
 * 100% Client-Side In-Browser Execution using pdf-lib & pdf.js
 * Features:
 * - Crop page margins (Left, Right, Top, Bottom)
 * - Apply crop box to current page or all pages
 */

let currentPdfFile = null;
let pdfJsDoc = null;
let currentPageNum = 1;
let totalPages = 1;

document.addEventListener('DOMContentLoaded', () => {
  const dropzone = document.getElementById('dropzone');
  const fileInput = document.getElementById('file-input');
  const applyCropBtn = document.getElementById('apply-crop-btn');
  const prevPageBtn = document.getElementById('prev-page-btn');
  const nextPageBtn = document.getElementById('next-page-btn');

  if (dropzone && fileInput) {
    setupDropzone(dropzone, fileInput, (files) => handleFileSelected(files[0]));
  }

  if (applyCropBtn) applyCropBtn.addEventListener('click', applyCropMargins);
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

  try {
    const arrayBuffer = await file.arrayBuffer();
    pdfJsDoc = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    totalPages = pdfJsDoc.numPages;

    document.getElementById('dropzone-container').style.display = 'none';
    document.getElementById('workspace-controls').style.display = 'block';

    renderCurrentPage();
    showToast(`Loaded ${file.name} for cropping`, 'success');
  } catch (err) {
    console.error(err);
    showToast('Failed to load PDF document.', 'error');
  }
}

async function renderCurrentPage() {
  if (!pdfJsDoc) return;
  const page = await pdfJsDoc.getPage(currentPageNum);
  const viewport = page.getViewport({ scale: 1.0 });

  const pdfCanvas = document.getElementById('pdf-canvas');
  const pdfCtx = pdfCanvas.getContext('2d');
  pdfCanvas.height = viewport.height;
  pdfCanvas.width = viewport.width;

  await page.render({ canvasContext: pdfCtx, viewport: viewport }).promise;
  document.getElementById('page-indicator').innerText = `Page ${currentPageNum} of ${totalPages}`;
}

function changePage(delta) {
  const newPage = currentPageNum + delta;
  if (newPage >= 1 && newPage <= totalPages) {
    currentPageNum = newPage;
    renderCurrentPage();
  }
}

async function applyCropMargins() {
  if (!currentPdfFile) return;

  const btn = document.getElementById('apply-crop-btn');
  if (btn) btn.disabled = true;

  try {
    const { PDFDocument } = PDFLib;
    const arrayBuffer = await currentPdfFile.arrayBuffer();
    const pdfDoc = await PDFDocument.load(arrayBuffer);

    const margin = parseInt(document.getElementById('crop-margin') ? document.getElementById('crop-margin').value : '30');
    const applyAll = document.getElementById('crop-scope') ? document.getElementById('crop-scope').value === 'all' : true;

    const pages = pdfDoc.getPages();

    for (let i = 0; i < pages.length; i++) {
      if (!applyAll && (i + 1) !== currentPageNum) continue;

      const page = pages[i];
      const { x, y, width, height } = page.getCropBox();

      const newX = x + margin;
      const newY = y + margin;
      const newWidth = Math.max(50, width - (margin * 2));
      const newHeight = Math.max(50, height - (margin * 2));

      page.setCropBox(newX, newY, newWidth, newHeight);
    }

    const pdfBytes = await pdfDoc.save();
    const blob = new Blob([pdfBytes], { type: 'application/pdf' });
    downloadBlob(blob, `Cropped_${currentPdfFile.name}`);
    showToast('PDF Cropped successfully!', 'success');
  } catch (err) {
    console.error(err);
    showToast('Failed to crop PDF.', 'error');
  } finally {
    if (btn) btn.disabled = false;
  }
}
