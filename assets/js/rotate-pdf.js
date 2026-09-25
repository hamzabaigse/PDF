/**
 * PDF Master Hub - PDF Page Rotator & Page Numbering Engine
 */

let currentPdfFile = null;
let pageRotations = {}; // pageNum -> degrees (0, 90, 180, 270)
let totalPages = 0;

document.addEventListener('DOMContentLoaded', () => {
  const dropzone = document.getElementById('dropzone');
  const fileInput = document.getElementById('file-input');
  const rotateAllCwBtn = document.getElementById('rotate-all-cw');
  const saveBtn = document.getElementById('save-rotate-btn');

  if (dropzone && fileInput) {
    setupDropzone(dropzone, fileInput, (files) => handleFileSelected(files[0]));
  }

  if (rotateAllCwBtn) {
    rotateAllCwBtn.addEventListener('click', () => {
      for (let i = 1; i <= totalPages; i++) {
        pageRotations[i] = ((pageRotations[i] || 0) + 90) % 360;
      }
      renderPageGrid();
    });
  }

  if (saveBtn) saveBtn.addEventListener('click', processPdfRotation);
});

async function handleFileSelected(file) {
  if (!file || !file.name.toLowerCase().endsWith('.pdf')) {
    showToast('Please upload a valid PDF file.', 'error');
    return;
  }

  currentPdfFile = file;
  pageRotations = {};

  try {
    const arrayBuffer = await file.arrayBuffer();
    const pdfJsDoc = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    totalPages = pdfJsDoc.numPages;

    for (let i = 1; i <= totalPages; i++) pageRotations[i] = 0;

    document.getElementById('dropzone-container').style.display = 'none';
    document.getElementById('workspace-controls').style.display = 'block';

    renderPageGrid(pdfJsDoc);
    showToast(`Loaded ${file.name} (${totalPages} pages)`, 'success');
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

  for (let i = 1; i <= totalPages; i++) {
    const card = document.createElement('div');
    card.className = 'file-card';

    const deg = pageRotations[i] || 0;

    card.innerHTML = `
      <div class="file-preview">
        <canvas id="page_canvas_${i}" style="transform: rotate(${deg}deg); transition: transform 0.3s;"></canvas>
      </div>
      <div class="file-name">Page ${i} (${deg}°)</div>
      <button class="btn btn-sm btn-secondary" onclick="rotatePage(${i})" style="margin-top: 0.5rem;"><i class="fas fa-redo"></i> Rotate 90°</button>
    `;

    grid.appendChild(card);

    pdfJsDoc.getPage(i).then(page => {
      const canvas = document.getElementById(`page_canvas_${i}`);
      if (!canvas) return;
      const viewport = page.getViewport({ scale: 0.3 });
      const context = canvas.getContext('2d');
      canvas.height = viewport.height;
      canvas.width = viewport.width;
      page.render({ canvasContext: context, viewport: viewport });
    });
  }
}

function rotatePage(pageNum) {
  pageRotations[pageNum] = ((pageRotations[pageNum] || 0) + 90) % 360;
  const canvas = document.getElementById(`page_canvas_${pageNum}`);
  const cardName = canvas ? canvas.closest('.file-card').querySelector('.file-name') : null;
  if (canvas) canvas.style.transform = `rotate(${pageRotations[pageNum]}deg)`;
  if (cardName) cardName.innerText = `Page ${pageNum} (${pageRotations[pageNum]}°)`;
}

async function processPdfRotation() {
  if (!currentPdfFile) return;

  const addNumbers = document.getElementById('add-page-numbers') ? document.getElementById('add-page-numbers').checked : false;

  try {
    const { PDFDocument, degrees, StandardFonts, rgb } = PDFLib;
    const arrayBuffer = await currentPdfFile.arrayBuffer();
    const pdfDoc = await PDFDocument.load(arrayBuffer);
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);

    for (let i = 1; i <= totalPages; i++) {
      const page = pdfDoc.getPage(i - 1);
      const addRot = pageRotations[i] || 0;
      if (addRot !== 0) {
        const currentRot = page.getRotation().angle;
        page.setRotation(degrees((currentRot + addRot) % 360));
      }

      if (addNumbers) {
        const { width, height } = page.getSize();
        page.drawText(`Page ${i} of ${totalPages}`, {
          x: width - 100,
          y: 20,
          size: 10,
          font: font,
          color: rgb(0.3, 0.3, 0.3)
        });
      }
    }

    const pdfBytes = await pdfDoc.save();
    const blob = new Blob([pdfBytes], { type: 'application/pdf' });
    downloadBlob(blob, `Rotated_${currentPdfFile.name}`);
    showToast('PDF rotated & saved!', 'success');
  } catch (err) {
    console.error(err);
    showToast('Failed to save rotated PDF.', 'error');
  }
}
