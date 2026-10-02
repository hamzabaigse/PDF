/**
 * PDF Page Numbers Engine
 * 100% Client-Side In-Browser Execution using pdf-lib
 * Features:
 * - Position (Bottom-Right, Bottom-Center, Bottom-Left, Top-Right, Top-Center)
 * - Format ("Page X of Y", "X", "- X -")
 * - Font Size (10px to 24px) & Color
 * - Page range selection
 */

let currentPdfFile = null;

document.addEventListener('DOMContentLoaded', () => {
  const dropzone = document.getElementById('dropzone');
  const fileInput = document.getElementById('file-input');
  const addNumbersBtn = document.getElementById('add-numbers-btn');

  if (dropzone && fileInput) {
    setupDropzone(dropzone, fileInput, (files) => handleFileSelected(files[0]));
  }

  if (addNumbersBtn) {
    addNumbersBtn.addEventListener('click', applyPageNumbers);
  }
});

async function handleFileSelected(file) {
  if (!file || !file.name.toLowerCase().endsWith('.pdf')) {
    showToast('Please upload a valid PDF file.', 'error');
    return;
  }

  currentPdfFile = file;
  document.getElementById('dropzone-container').style.display = 'none';
  document.getElementById('workspace-controls').style.display = 'block';

  showToast(`Loaded ${file.name} for numbering`, 'success');
}

async function applyPageNumbers() {
  if (!currentPdfFile) return;

  const btn = document.getElementById('add-numbers-btn');
  if (btn) btn.disabled = true;

  try {
    const { PDFDocument, rgb, StandardFonts } = PDFLib;
    const arrayBuffer = await currentPdfFile.arrayBuffer();
    const pdfDoc = await PDFDocument.load(arrayBuffer);
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);

    const position = document.getElementById('num-position') ? document.getElementById('num-position').value : 'bottom-center';
    const formatStr = document.getElementById('num-format') ? document.getElementById('num-format').value : 'page-x-of-y';
    const fontSize = parseInt(document.getElementById('num-size') ? document.getElementById('num-size').value : '12');
    const colorHex = document.getElementById('num-color') ? document.getElementById('num-color').value : '#000000';

    const r = parseInt(colorHex.substr(1,2),16) / 255;
    const g = parseInt(colorHex.substr(3,2),16) / 255;
    const b = parseInt(colorHex.substr(5,2),16) / 255;

    const pages = pdfDoc.getPages();
    const totalPages = pages.length;

    for (let i = 0; i < totalPages; i++) {
      const page = pages[i];
      const { width, height } = page.getSize();
      const pageNum = i + 1;

      let labelText = `Page ${pageNum} of ${totalPages}`;
      if (formatStr === 'x') labelText = `${pageNum}`;
      if (formatStr === 'dash-x') labelText = `- ${pageNum} -`;

      const textWidth = font.widthOfTextAtSize(labelText, fontSize);
      const textHeight = fontSize;

      let x = (width - textWidth) / 2;
      let y = 30; // default bottom

      if (position === 'bottom-right') x = width - textWidth - 40;
      if (position === 'bottom-left') x = 40;
      if (position === 'top-center') y = height - 40;
      if (position === 'top-right') { x = width - textWidth - 40; y = height - 40; }
      if (position === 'top-left') { x = 40; y = height - 40; }

      page.drawText(labelText, {
        x: x,
        y: y,
        size: fontSize,
        font: font,
        color: rgb(r, g, b)
      });
    }

    const pdfBytes = await pdfDoc.save();
    const blob = new Blob([pdfBytes], { type: 'application/pdf' });
    downloadBlob(blob, `Numbered_${currentPdfFile.name}`);
    showToast('Page numbers added successfully!', 'success');
  } catch (err) {
    console.error(err);
    showToast('Failed to add page numbers.', 'error');
  } finally {
    if (btn) btn.disabled = false;
  }
}
