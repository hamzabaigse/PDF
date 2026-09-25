/**
 * PDF Master Hub - PDF Compressor Engine
 * Client-Side page image re-sampling and PDF structure optimization.
 */

let currentPdfFile = null;

document.addEventListener('DOMContentLoaded', () => {
  const dropzone = document.getElementById('dropzone');
  const fileInput = document.getElementById('file-input');
  const compressBtn = document.getElementById('compress-pdf-btn');

  if (dropzone && fileInput) {
    setupDropzone(dropzone, fileInput, (files) => handleFileSelected(files[0]));
  }

  if (compressBtn) compressBtn.addEventListener('click', processPdfCompression);
});

function handleFileSelected(file) {
  if (!file || !file.name.toLowerCase().endsWith('.pdf')) {
    showToast('Please upload a valid PDF file.', 'error');
    return;
  }

  currentPdfFile = file;
  document.getElementById('dropzone-container').style.display = 'none';
  document.getElementById('workspace-controls').style.display = 'block';

  document.getElementById('original-size-badge').innerText = `Original Size: ${formatBytes(file.size)}`;
  showToast(`Loaded ${file.name} for compression`, 'success');
}

async function processPdfCompression() {
  if (!currentPdfFile) return;

  const level = document.getElementById('compression-level') ? document.getElementById('compression-level').value : 'medium';
  const compressBtn = document.getElementById('compress-pdf-btn');
  const progressText = document.getElementById('progress-text');
  const progressBar = document.getElementById('progress-bar');
  const progressFill = document.getElementById('progress-fill');

  if (compressBtn) compressBtn.disabled = true;
  if (progressBar) progressBar.style.display = 'block';

  let scale = 1.2;
  let quality = 0.7;

  if (level === 'extreme') {
    scale = 0.9;
    quality = 0.5;
  } else if (level === 'less') {
    scale = 1.5;
    quality = 0.85;
  }

  try {
    const arrayBuffer = await currentPdfFile.arrayBuffer();
    const pdfJsDoc = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    const numPages = pdfJsDoc.numPages;

    const { PDFDocument } = PDFLib;
    const newPdf = await PDFDocument.create();

    for (let i = 1; i <= numPages; i++) {
      if (progressText) progressText.innerText = `Compressing page ${i} of ${numPages}...`;
      if (progressFill) progressFill.style.width = `${Math.round((i / numPages) * 100)}%`;

      const page = await pdfJsDoc.getPage(i);
      const viewport = page.getViewport({ scale: scale });
      const canvas = document.createElement('canvas');
      canvas.width = viewport.width;
      canvas.height = viewport.height;
      const ctx = canvas.getContext('2d');

      await page.render({ canvasContext: ctx, viewport: viewport }).promise;

      const jpgDataUrl = canvas.toDataURL('image/jpeg', quality);
      const jpgBytes = await fetch(jpgDataUrl).then(res => res.arrayBuffer());
      const embeddedImage = await newPdf.embedJpg(jpgBytes);

      const pdfPage = newPdf.addPage([embeddedImage.width, embeddedImage.height]);
      pdfPage.drawImage(embeddedImage, {
        x: 0,
        y: 0,
        width: embeddedImage.width,
        height: embeddedImage.height
      });
    }

    const pdfBytes = await newPdf.save();
    const newSize = pdfBytes.byteLength;
    const originalSize = currentPdfFile.size;
    const savings = Math.max(0, Math.round(((originalSize - newSize) / originalSize) * 100));

    const blob = new Blob([pdfBytes], { type: 'application/pdf' });
    downloadBlob(blob, `Compressed_${currentPdfFile.name}`);

    showToast(`PDF Compressed by ${savings}%! (${formatBytes(newSize)})`, 'success');
  } catch (err) {
    console.error(err);
    showToast('Error compressing PDF file.', 'error');
  } finally {
    if (compressBtn) compressBtn.disabled = false;
    if (progressBar) progressBar.style.display = 'none';
  }
}
