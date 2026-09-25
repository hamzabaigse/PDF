/**
 * PDF Master Hub - PDF Watermark Generator Engine
 */

let currentPdfFile = null;

document.addEventListener('DOMContentLoaded', () => {
  const dropzone = document.getElementById('dropzone');
  const fileInput = document.getElementById('file-input');
  const applyBtn = document.getElementById('apply-watermark-btn');

  if (dropzone && fileInput) {
    setupDropzone(dropzone, fileInput, (files) => handleFileSelected(files[0]));
  }

  if (applyBtn) applyBtn.addEventListener('click', processWatermark);
});

function handleFileSelected(file) {
  if (!file || !file.name.toLowerCase().endsWith('.pdf')) {
    showToast('Please upload a valid PDF file.', 'error');
    return;
  }

  currentPdfFile = file;
  document.getElementById('dropzone-container').style.display = 'none';
  document.getElementById('workspace-controls').style.display = 'block';

  showToast(`Loaded ${file.name} for watermarking`, 'success');
}

async function processWatermark() {
  if (!currentPdfFile) return;

  const text = document.getElementById('watermark-text') ? document.getElementById('watermark-text').value.trim() : 'CONFIDENTIAL';
  const opacity = document.getElementById('watermark-opacity') ? parseFloat(document.getElementById('watermark-opacity').value) : 0.3;
  const size = document.getElementById('watermark-size') ? parseInt(document.getElementById('watermark-size').value) : 50;
  const colorHex = document.getElementById('watermark-color') ? document.getElementById('watermark-color').value : '#ef4444';

  if (!text) {
    showToast('Please enter watermark text.', 'warning');
    return;
  }

  try {
    const { PDFDocument, degrees, StandardFonts, rgb } = PDFLib;
    const arrayBuffer = await currentPdfFile.arrayBuffer();
    const pdfDoc = await PDFDocument.load(arrayBuffer);
    const font = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

    // Convert hex color to rgb
    const r = parseInt(colorHex.substr(1,2),16) / 255;
    const g = parseInt(colorHex.substr(3,2),16) / 255;
    const b = parseInt(colorHex.substr(5,2),16) / 255;

    const pages = pdfDoc.getPages();
    pages.forEach(page => {
      const { width, height } = page.getSize();
      page.drawText(text, {
        x: width / 4,
        y: height / 2,
        size: size,
        font: font,
        color: rgb(r, g, b),
        opacity: opacity,
        rotate: degrees(45)
      });
    });

    const pdfBytes = await pdfDoc.save();
    const blob = new Blob([pdfBytes], { type: 'application/pdf' });
    downloadBlob(blob, `Watermarked_${currentPdfFile.name}`);
    showToast('Watermark added successfully!', 'success');
  } catch (err) {
    console.error(err);
    showToast('Failed to apply watermark.', 'error');
  }
}
