/**
 * PDF to Markdown Converter Engine
 * 100% Client-Side In-Browser Execution using pdf.js
 * Features:
 * - Extract headings, paragraphs, bullet points, and text into clean Markdown (.md)
 * - Copy Markdown directly or Download .md file
 */

let extractedMarkdownText = '';

document.addEventListener('DOMContentLoaded', () => {
  const dropzone = document.getElementById('dropzone');
  const fileInput = document.getElementById('file-input');
  const copyMdBtn = document.getElementById('copy-md-btn');
  const downloadMdBtn = document.getElementById('download-md-btn');

  if (dropzone && fileInput) {
    setupDropzone(dropzone, fileInput, (files) => handleFileSelected(files[0]));
  }

  if (copyMdBtn) copyMdBtn.addEventListener('click', copyMarkdownToClipboard);
  if (downloadMdBtn) downloadMdBtn.addEventListener('click', downloadMarkdownFile);
});

async function handleFileSelected(file) {
  if (!file || !file.name.toLowerCase().endsWith('.pdf')) {
    showToast('Please select a valid PDF file.', 'error');
    return;
  }

  showToast(`Extracting Markdown from ${file.name}...`, 'info');

  try {
    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;

    let mdOutput = `# ${file.name.replace(/\.[^/.]+$/, "")}\n\n`;

    for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
      const page = await pdf.getPage(pageNum);
      const textContent = await page.getTextContent();
      
      mdOutput += `## Page ${pageNum}\n\n`;

      let lastY = null;
      let lineText = '';

      textContent.items.forEach(item => {
        const text = item.str.trim();
        if (!text) return;

        // Simple heuristic for headings based on font height or bold status
        if (item.transform && item.transform[0] > 14) {
          mdOutput += `### ${text}\n\n`;
        } else {
          mdOutput += `${text} `;
        }
      });

      mdOutput += `\n\n---\n\n`;
    }

    extractedMarkdownText = mdOutput;

    document.getElementById('dropzone-container').style.display = 'none';
    document.getElementById('workspace-controls').style.display = 'block';

    const textarea = document.getElementById('markdown-preview');
    if (textarea) textarea.value = extractedMarkdownText;

    showToast('PDF converted to Markdown successfully!', 'success');
  } catch (err) {
    console.error(err);
    showToast('Failed to convert PDF to Markdown.', 'error');
  }
}

function copyMarkdownToClipboard() {
  if (!extractedMarkdownText) return;
  navigator.clipboard.writeText(extractedMarkdownText).then(() => {
    showToast('Markdown copied to clipboard!', 'success');
  }).catch(() => {
    showToast('Failed to copy text.', 'error');
  });
}

function downloadMarkdownFile() {
  if (!extractedMarkdownText) return;
  const blob = new Blob([extractedMarkdownText], { type: 'text/markdown;charset=utf-8;' });
  downloadBlob(blob, 'Document_Converted.md');
  showToast('Downloaded .md file!', 'success');
}
