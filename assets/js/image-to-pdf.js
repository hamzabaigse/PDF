/**
 * PDF Master Hub - Images to PDF Converter Engine
 * Converts JPG, PNG, and WebP images to PDF document.
 */

let imageFiles = []; // Array of { id, file, url, name, size }

document.addEventListener('DOMContentLoaded', () => {
  const dropzone = document.getElementById('dropzone');
  const fileInput = document.getElementById('file-input');
  const convertBtn = document.getElementById('convert-btn');
  const clearBtn = document.getElementById('clear-btn');

  if (dropzone && fileInput) {
    setupDropzone(dropzone, fileInput, handleImagesSelected);
  }

  if (convertBtn) convertBtn.addEventListener('click', processImagesToPdf);
  if (clearBtn) {
    clearBtn.addEventListener('click', () => {
      imageFiles = [];
      renderImageList();
      showToast('Image list cleared', 'info');
    });
  }
});

function handleImagesSelected(files) {
  const validImages = files.filter(f => f.type.startsWith('image/'));

  if (validImages.length === 0) {
    showToast('Please select valid JPG, PNG, or WebP images.', 'error');
    return;
  }

  validImages.forEach(file => {
    const id = 'img_' + Math.random().toString(36).substring(2, 9);
    const url = URL.createObjectURL(file);
    imageFiles.push({ id, file, url, name: file.name, size: formatBytes(file.size) });
  });

  renderImageList();
  showToast(`Added ${validImages.length} image(s)`, 'success');
}

function renderImageList() {
  const grid = document.getElementById('image-grid');
  const workspaceControls = document.getElementById('workspace-controls');
  const dropzoneContainer = document.getElementById('dropzone-container');

  if (!grid) return;

  if (imageFiles.length === 0) {
    grid.innerHTML = '';
    if (workspaceControls) workspaceControls.style.display = 'none';
    if (dropzoneContainer) dropzoneContainer.style.display = 'block';
    return;
  }

  if (workspaceControls) workspaceControls.style.display = 'block';

  grid.innerHTML = imageFiles.map((item, index) => `
    <div class="file-card">
      <button class="file-remove-btn" onclick="removeImage('${item.id}')"><i class="fas fa-times"></i></button>
      <div class="file-preview">
        <img src="${item.url}" alt="${item.name}">
      </div>
      <div class="file-name">${index + 1}. ${item.name}</div>
      <div class="file-size">${item.size}</div>
      <div style="display: flex; gap: 0.5rem; margin-top: 0.5rem;">
        <button class="btn btn-sm btn-secondary" onclick="moveImage(${index}, -1)" ${index === 0 ? 'disabled' : ''}><i class="fas fa-arrow-left"></i></button>
        <button class="btn btn-sm btn-secondary" onclick="moveImage(${index}, 1)" ${index === imageFiles.length - 1 ? 'disabled' : ''}><i class="fas fa-arrow-right"></i></button>
      </div>
    </div>
  `).join('');
}

function removeImage(id) {
  imageFiles = imageFiles.filter(img => img.id !== id);
  renderImageList();
}

function moveImage(index, direction) {
  const newIndex = index + direction;
  if (newIndex < 0 || newIndex >= imageFiles.length) return;
  const temp = imageFiles[index];
  imageFiles[index] = imageFiles[newIndex];
  imageFiles[newIndex] = temp;
  renderImageList();
}

async function processImagesToPdf() {
  if (imageFiles.length === 0) return;

  const pageSizeOpt = document.getElementById('page-size') ? document.getElementById('page-size').value : 'A4';
  const orientationOpt = document.getElementById('orientation') ? document.getElementById('orientation').value : 'portrait';
  const marginOpt = document.getElementById('margin') ? document.getElementById('margin').value : 'small';

  const convertBtn = document.getElementById('convert-btn');
  if (convertBtn) convertBtn.disabled = true;

  try {
    const { PDFDocument, PageSizes } = PDFLib;
    const pdfDoc = await PDFDocument.create();

    let margin = 0;
    if (marginOpt === 'small') margin = 20;
    if (marginOpt === 'large') margin = 40;

    for (const item of imageFiles) {
      const imageBytes = await item.file.arrayBuffer();
      let embeddedImage;

      if (item.file.type === 'image/png') {
        embeddedImage = await pdfDoc.embedPng(imageBytes);
      } else {
        // Convert to JPG canvas data if needed or embed JPG
        try {
          embeddedImage = await pdfDoc.embedJpg(imageBytes);
        } catch {
          // Fallback via canvas draw for unsupported formats like WebP
          const img = new Image();
          img.src = item.url;
          await new Promise(resolve => img.onload = resolve);
          const canvas = document.createElement('canvas');
          canvas.width = img.width;
          canvas.height = img.height;
          const ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0);
          const jpgDataUrl = canvas.toDataURL('image/jpeg', 0.9);
          const jpgBytes = await fetch(jpgDataUrl).then(res => res.arrayBuffer());
          embeddedImage = await pdfDoc.embedJpg(jpgBytes);
        }
      }

      const imgWidth = embeddedImage.width;
      const imgHeight = embeddedImage.height;

      let pageWidth, pageHeight;

      if (pageSizeOpt === 'fit') {
        pageWidth = imgWidth + margin * 2;
        pageHeight = imgHeight + margin * 2;
      } else if (pageSizeOpt === 'Letter') {
        pageWidth = PageSizes.Letter[0];
        pageHeight = PageSizes.Letter[1];
      } else { // A4
        pageWidth = PageSizes.A4[0];
        pageHeight = PageSizes.A4[1];
      }

      if (orientationOpt === 'landscape' && pageWidth < pageHeight) {
        const tmp = pageWidth;
        pageWidth = pageHeight;
        pageHeight = tmp;
      }

      const page = pdfDoc.addPage([pageWidth, pageHeight]);
      const availableWidth = pageWidth - margin * 2;
      const availableHeight = pageHeight - margin * 2;

      const scale = Math.min(availableWidth / imgWidth, availableHeight / imgHeight);
      const drawWidth = imgWidth * scale;
      const drawHeight = imgHeight * scale;

      const x = (pageWidth - drawWidth) / 2;
      const y = (pageHeight - drawHeight) / 2;

      page.drawImage(embeddedImage, {
        x,
        y,
        width: drawWidth,
        height: drawHeight
      });
    }

    const pdfBytes = await pdfDoc.save();
    const blob = new Blob([pdfBytes], { type: 'application/pdf' });
    downloadBlob(blob, 'Images_Converted.pdf');
    showToast('Images successfully converted to PDF!', 'success');
  } catch (err) {
    console.error(err);
    showToast('Failed to convert images to PDF.', 'error');
  } finally {
    if (convertBtn) convertBtn.disabled = false;
  }
}
