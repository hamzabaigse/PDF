/**
 * PDF Master Hub - PDF Text Extractor Engine
 * Extracts raw text content from PDF documents page by page using pdf.js.
 */

let extractedTextContent = '';

document.addEventListener('DOMContentLoaded', () => {
  const dropzone = document.getElementById('dropzone');
  const fileInput = document.getElementById('file-input');
  const copyBtn = document.getElementById('copy-text-btn');
  const downloadBtn = document.getElementById('download-txt-btn');

  if (dropzone && fileInput) {
    setupDropzone(dropzone, fileInput, (files) => handleFileSelected(files[0]));
  }

  if (copyBtn) {
    copyBtn.addEventListener('click', () => {
      if (!extractedTextContent) return;
      navigator.clipboard.writeText(extractedTextContent);
      showToast('Text copied to clipboard!', 'success');
    });
  }

  if (downloadBtn) {
    downloadBtn.addEventListener('click', () => {
      if (!extractedTextContent) return;
      const blob = new Blob([extractedTextContent], { type: 'text/plain;charset=utf-8' });
      downloadBlob(blob, 'Extracted_PDF_Text.txt');
      showToast('Text file downloaded!', 'success');
    });
  }
});

async function handleFileSelected(file) {
  if (!file || !file.name.toLowerCase().endsWith('.pdf')) {
    showToast('Please upload a valid PDF file.', 'error');
    return;
  }

  try {
    const arrayBuffer = await file.arrayBuffer();
    const pdfJsDoc = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    const numPages = pdfJsDoc.numPages;

    let fullText = '';

    for (let i = 1; i <= numPages; i++) {
      const page = await pdfJsDoc.getPage(i);
      const textContent = await page.getTextContent();
      const pageText = textContent.items.map(item => item.str).join(' ');
      fullText += `--- PAGE ${i} ---\n\n${pageText}\n\n`;
    }

    extractedTextContent = fullText;

    document.getElementById('dropzone-container').style.display = 'none';
    document.getElementById('workspace-controls').style.display = 'block';

    const textarea = document.getElementById('extracted-text-area');
    if (textarea) textarea.value = fullText;

    const wordCount = fullText.split(/\s+/).filter(w => w.length > 0).length;
    const charCount = fullText.length;

    const statsEl = document.getElementById('text-stats');
    if (statsEl) statsEl.innerText = `Pages: ${numPages} | Words: ${wordCount.toLocaleString()} | Characters: ${charCount.toLocaleString()}`;

    showToast('Text extracted successfully!', 'success');
  } catch (err) {
    console.error(err);
    showToast('Failed to extract text from PDF.', 'error');
  }
}
