/**
 * PDF Master Hub - PDF Merger Engine
 * Client-Side PDF merging using pdf-lib and pdf.js
 */

let pdfFiles = []; // Stores { id, file, name, size, pageCount }

document.addEventListener('DOMContentLoaded', () => {
  const dropzone = document.getElementById('dropzone');
  const fileInput = document.getElementById('file-input');
  const addMoreInput = document.getElementById('add-more-input');
  const addMoreBtn = document.getElementById('add-more-btn');
  const mergeBtn = document.getElementById('merge-btn');
  const clearBtn = document.getElementById('clear-btn');

  if (dropzone && fileInput) {
    setupDropzone(dropzone, fileInput, handleFilesSelected);
  }

  if (addMoreBtn && addMoreInput) {
    addMoreBtn.addEventListener('click', () => addMoreInput.click());
    addMoreInput.addEventListener('change', (e) => {
      const files = Array.from(e.target.files);
      if (files.length > 0) handleFilesSelected(files);
    });
  }

  if (mergeBtn) {
    mergeBtn.addEventListener('click', processPdfMerge);
  }

  if (clearBtn) {
    clearBtn.addEventListener('click', () => {
      pdfFiles = [];
      renderFileList();
      showToast('File list cleared', 'info');
    });
  }
});

async function handleFilesSelected(files) {
  const pdfsOnly = files.filter(f => f.type === 'application/pdf' || f.name.toLowerCase().endsWith('.pdf'));
  
  if (pdfsOnly.length === 0) {
    showToast('Please select valid PDF files.', 'error');
    return;
  }

  for (const file of pdfsOnly) {
    try {
      const fileId = 'pdf_' + Math.random().toString(36).substring(2, 9);
      pdfFiles.push({
        id: fileId,
        file: file,
        name: file.name,
        size: formatBytes(file.size)
      });
    } catch (err) {
      console.error(err);
    }
  }

  renderFileList();
  showToast(`Added ${pdfsOnly.length} PDF file(s)`, 'success');
}

function renderFileList() {
  const fileListContainer = document.getElementById('file-list');
  const workspaceControls = document.getElementById('workspace-controls');
  const dropzoneContainer = document.getElementById('dropzone-container');

  if (!fileListContainer) return;

  if (pdfFiles.length === 0) {
    fileListContainer.innerHTML = '';
    if (workspaceControls) workspaceControls.style.display = 'none';
    if (dropzoneContainer) dropzoneContainer.style.display = 'block';
    return;
  }

  if (workspaceControls) workspaceControls.style.display = 'flex';

  fileListContainer.innerHTML = pdfFiles.map((item, index) => `
    <div class="file-card" data-id="${item.id}">
      <button class="file-remove-btn" onclick="removeFile('${item.id}')"><i class="fas fa-times"></i></button>
      <div class="file-preview" id="preview_${item.id}">
        <canvas id="canvas_${item.id}"></canvas>
      </div>
      <div class="file-name" title="${item.name}">${index + 1}. ${item.name}</div>
      <div class="file-size">${item.size}</div>
      <div style="display: flex; gap: 0.5rem; margin-top: 0.5rem;">
        <button class="btn btn-sm btn-secondary" onclick="moveFile(${index}, -1)" ${index === 0 ? 'disabled' : ''}><i class="fas fa-arrow-left"></i></button>
        <button class="btn btn-sm btn-secondary" onclick="moveFile(${index}, 1)" ${index === pdfFiles.length - 1 ? 'disabled' : ''}><i class="fas fa-arrow-right"></i></button>
      </div>
    </div>
  `).join('');

  // Render thumbnails
  pdfFiles.forEach(item => {
    const canvas = document.getElementById(`canvas_${item.id}`);
    if (canvas) {
      renderPdfThumbnail(item.file, canvas);
    }
  });
}

function removeFile(id) {
  pdfFiles = pdfFiles.filter(item => item.id !== id);
  renderFileList();
}

function moveFile(index, direction) {
  const newIndex = index + direction;
  if (newIndex < 0 || newIndex >= pdfFiles.length) return;
  const temp = pdfFiles[index];
  pdfFiles[index] = pdfFiles[newIndex];
  pdfFiles[newIndex] = temp;
  renderFileList();
}

async function processPdfMerge() {
  if (pdfFiles.length < 2) {
    showToast('Please add at least 2 PDF files to merge.', 'warning');
    return;
  }

  const progressBar = document.getElementById('progress-bar');
  const progressFill = document.getElementById('progress-fill');
  const progressText = document.getElementById('progress-text');
  const mergeBtn = document.getElementById('merge-btn');

  if (progressBar) progressBar.style.display = 'block';
  if (mergeBtn) mergeBtn.disabled = true;

  try {
    const { PDFDocument } = PDFLib;
    const mergedPdf = await PDFDocument.create();

    for (let i = 0; i < pdfFiles.length; i++) {
      const item = pdfFiles[i];
      if (progressText) progressText.innerText = `Processing file ${i + 1} of ${pdfFiles.length}: ${item.name}...`;
      if (progressFill) progressFill.style.width = `${Math.round(((i) / pdfFiles.length) * 100)}%`;

      const arrayBuffer = await item.file.arrayBuffer();
      const pdf = await PDFDocument.load(arrayBuffer);
      const copiedPages = await mergedPdf.copyPages(pdf, pdf.getPageIndices());
      copiedPages.forEach(page => mergedPdf.addPage(page));
    }

    if (progressFill) progressFill.style.width = '100%';
    if (progressText) progressText.innerText = 'Finalizing merged document...';

    const mergedPdfBytes = await mergedPdf.save();
    const blob = new Blob([mergedPdfBytes], { type: 'application/pdf' });

    downloadBlob(blob, 'Merged_PDFMasterHub.pdf');
    showToast('PDFs successfully merged!', 'success');

  } catch (err) {
    console.error("Error merging PDFs:", err);
    showToast('Error merging PDFs. Ensure files are valid and unencrypted.', 'error');
  } finally {
    if (progressBar) progressBar.style.display = 'none';
    if (mergeBtn) mergeBtn.disabled = false;
  }
}
