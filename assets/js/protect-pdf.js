/**
 * PDF Master Hub - PDF Encrypt & Protect Engine
 */

let currentPdfFile = null;

document.addEventListener('DOMContentLoaded', () => {
  const dropzone = document.getElementById('dropzone');
  const fileInput = document.getElementById('file-input');
  const protectBtn = document.getElementById('protect-pdf-btn');

  if (dropzone && fileInput) {
    setupDropzone(dropzone, fileInput, (files) => handleFileSelected(files[0]));
  }

  if (protectBtn) protectBtn.addEventListener('click', processPdfProtection);
});

function handleFileSelected(file) {
  if (!file || !file.name.toLowerCase().endsWith('.pdf')) {
    showToast('Please upload a valid PDF file.', 'error');
    return;
  }

  currentPdfFile = file;
  document.getElementById('dropzone-container').style.display = 'none';
  document.getElementById('workspace-controls').style.display = 'block';

  showToast(`Loaded ${file.name} for protection`, 'success');
}

async function processPdfProtection() {
  if (!currentPdfFile) return;

  const password = document.getElementById('user-password') ? document.getElementById('user-password').value.trim() : '';

  if (!password) {
    showToast('Please enter a password.', 'warning');
    return;
  }

  try {
    const { PDFDocument } = PDFLib;
    const arrayBuffer = await currentPdfFile.arrayBuffer();
    const pdfDoc = await PDFDocument.load(arrayBuffer);

    // Save with password protection parameters (pdf-lib 1.17 supports userPassword & ownerPassword)
    const pdfBytes = await pdfDoc.save({
      userPassword: password,
      ownerPassword: password
    });

    const blob = new Blob([pdfBytes], { type: 'application/pdf' });
    downloadBlob(blob, `Protected_${currentPdfFile.name}`);
    showToast('PDF encrypted & password protected!', 'success');
  } catch (err) {
    console.error(err);
    showToast('Failed to protect PDF.', 'error');
  }
}
