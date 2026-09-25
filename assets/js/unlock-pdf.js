/**
 * PDF Master Hub - PDF Password Remover & Unlock Engine
 */

let currentPdfFile = null;

document.addEventListener('DOMContentLoaded', () => {
  const dropzone = document.getElementById('dropzone');
  const fileInput = document.getElementById('file-input');
  const unlockBtn = document.getElementById('unlock-pdf-btn');

  if (dropzone && fileInput) {
    setupDropzone(dropzone, fileInput, (files) => handleFileSelected(files[0]));
  }

  if (unlockBtn) unlockBtn.addEventListener('click', processPdfUnlock);
});

function handleFileSelected(file) {
  if (!file || !file.name.toLowerCase().endsWith('.pdf')) {
    showToast('Please upload a valid PDF file.', 'error');
    return;
  }

  currentPdfFile = file;
  document.getElementById('dropzone-container').style.display = 'none';
  document.getElementById('workspace-controls').style.display = 'block';

  showToast(`Loaded ${file.name} for unlocking`, 'success');
}

async function processPdfUnlock() {
  if (!currentPdfFile) return;

  const password = document.getElementById('unlock-password') ? document.getElementById('unlock-password').value.trim() : '';

  try {
    const { PDFDocument } = PDFLib;
    const arrayBuffer = await currentPdfFile.arrayBuffer();
    
    // Load with password
    const pdfDoc = await PDFDocument.load(arrayBuffer, { password: password || undefined });

    // Save without password
    const pdfBytes = await pdfDoc.save();

    const blob = new Blob([pdfBytes], { type: 'application/pdf' });
    downloadBlob(blob, `Unlocked_${currentPdfFile.name}`);
    showToast('PDF successfully unlocked & saved!', 'success');
  } catch (err) {
    console.error(err);
    showToast('Incorrect password or unable to unlock file.', 'error');
  }
}
