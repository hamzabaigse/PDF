/**
 * PDF Master Hub - PDF to Image Extractor Engine
 * Renders PDF pages to high-resolution PNG or JPG image downloads.
 */

let currentPdfFile = null;
let pdfJsDoc = null;
let totalPages = 0;

document.addEventListener('DOMContentLoaded', () => {
  const dropzone = document.getElementById('dropzone');
  const fileInput = document.getElementById('file-input');
  const extractAllBtn = document.getElementById('extract-all-btn');

  if (dropzone && fileInput) {
    setupDropzone(dropzone, fileInput, (files) => handleFileSelected(files[0]));
  }

  if (extractAllBtn) extractAllBtn.addEventListener('click', extractAllPages);
});

async function handleFileSelected(file) {
  if (!file || !file.name.toLowerCase().endsWith('.pdf')) {
    showToast('Please upload a valid PDF file.', 'error');
    return;
  }

  currentPdfFile = file;

  try {
    const arrayBuffer = await file.arrayBuffer();
    pdfJsDoc = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    totalPages = pdfJsDoc.numPages;

    document.getElementById('dropzone-container').style.display = 'none';
    document.getElementById('workspace-controls').style.display = 'block';

    renderPageGrid();
    showToast(`Loaded ${file.name} (${totalPages} pages)`, 'success');
  } catch (err) {
    console.error(err);
    showToast('Failed to load PDF file.', 'error');
  }
}

async function renderPageGrid() {
  const grid = document.getElementById('page-grid');
  if (!grid) return;

  grid.innerHTML = '';

  for (let i = 1; i <= totalPages; i++) {
    const card = document.createElement('div');
    card.className = 'file-card';

    card.innerHTML = `
      <div class="file-preview">
        <canvas id="page_canvas_${i}"></canvas>
      </div>
      <div class="file-name">Page ${i}</div>
      <button class="btn btn-sm btn-primary" onclick="downloadPageAsImage(${i})" style="margin-top: 0.5rem;"><i class="fas fa-download"></i> Download Image</button>
    `;

    grid.appendChild(card);

    pdfJsDoc.getPage(i).then(page => {
      const canvas = document.getElementById(`page_canvas_${i}`);
      if (!canvas) return;
      const viewport = page.getViewport({ scale: 0.4 });
      const context = canvas.getContext('2d');
      canvas.height = viewport.height;
      canvas.width = viewport.width;
      page.render({ canvasContext: context, viewport: viewport });
    });
  }
}

async function downloadPageAsImage(pageNum) {
  if (!pdfJsDoc) return;
  const imageFormat = document.getElementById('image-format') ? document.getElementById('image-format').value : 'image/png';
  const ext = imageFormat === 'image/jpeg' ? 'jpg' : 'png';

  try {
    const page = await pdfJsDoc.getPage(pageNum);
    const viewport = page.getViewport({ scale: 2.0 }); // High DPI export
    const canvas = document.createElement('canvas');
    canvas.width = viewport.width;
    canvas.height = viewport.height;
    const ctx = canvas.getContext('2d');

    await page.render({ canvasContext: ctx, viewport: viewport }).promise;

    canvas.toBlob(blob => {
      downloadBlob(blob, `Page_${pageNum}_PDFMasterHub.${ext}`);
      showToast(`Downloaded Page ${pageNum} as ${ext.toUpperCase()}`, 'success');
    }, imageFormat, 0.95);

  } catch (err) {
    console.error(err);
    showToast(`Failed to export page ${pageNum}`, 'error');
  }
}

async function extractAllPages() {
  for (let i = 1; i <= totalPages; i++) {
    await downloadPageAsImage(i);
  }
}
