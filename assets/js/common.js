/**
 * PDF Master Hub - Shared Common Utilities
 * Handles Theme Toggling, Mobile Navigation, Toast Notifications,
 * File Handling Helpers, and FAQ Accordions.
 */

// Initialize pdf.js worker URL globally if library is present
if (typeof pdfjsLib !== 'undefined') {
  pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
}

document.addEventListener('DOMContentLoaded', () => {
  initTheme();
  initMobileNav();
  initFaqAccordion();
  initAutoLangRedirect();
});

/* Global Language Switcher Dropdown Handler */
window.toggleLangMenu = function(e) {
  if (e) e.stopPropagation();
  const m = document.getElementById('lang-menu');
  if (m) m.style.display = m.style.display === 'block' ? 'none' : 'block';
};

document.addEventListener('click', () => {
  const m = document.getElementById('lang-menu');
  if (m) m.style.display = 'none';
});

/* Automatic Browser Language Detection for First-Time Visitors */
function initAutoLangRedirect() {
  const path = window.location.pathname;
  if (path === '/' || path === '/index.html') {
    const hasBeenRedirected = sessionStorage.getItem('lang_redirected');
    if (!hasBeenRedirected) {
      const userLang = (navigator.language || navigator.userLanguage || '').toLowerCase();
      let targetFolder = '';
      if (userLang.startsWith('de')) targetFolder = 'de/';
      else if (userLang.startsWith('fr')) targetFolder = 'fr/';
      else if (userLang.startsWith('es')) targetFolder = 'es/';
      else if (userLang.startsWith('ar')) targetFolder = 'ar/';

      if (targetFolder) {
        sessionStorage.setItem('lang_redirected', 'true');
        window.location.href = targetFolder + 'index.html';
      }
    }
  }
}

/* Theme Toggle Manager */
function initTheme() {
  const savedTheme = localStorage.getItem('pdf_hub_theme') || 'dark';
  document.documentElement.setAttribute('data-theme', savedTheme);
  updateThemeIcon(savedTheme);

  const themeBtn = document.getElementById('theme-toggle-btn');
  if (themeBtn) {
    themeBtn.addEventListener('click', () => {
      const currentTheme = document.documentElement.getAttribute('data-theme');
      const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
      document.documentElement.setAttribute('data-theme', newTheme);
      localStorage.setItem('pdf_hub_theme', newTheme);
      updateThemeIcon(newTheme);
    });
  }
}

function updateThemeIcon(theme) {
  const icon = document.querySelector('#theme-toggle-btn i');
  if (icon) {
    icon.className = theme === 'dark' ? 'fas fa-sun' : 'fas fa-moon';
  }
}

/* Mobile Menu Toggle */
function initMobileNav() {
  const menuBtn = document.getElementById('mobile-menu-btn');
  const navMenu = document.getElementById('nav-menu');
  if (menuBtn && navMenu) {
    menuBtn.addEventListener('click', () => {
      navMenu.classList.toggle('active');
      const isOpened = navMenu.classList.contains('active');
      menuBtn.innerHTML = isOpened ? '<i class="fas fa-times"></i>' : '<i class="fas fa-bars"></i>';
    });
  }
}

/* FAQ Accordion Toggle */
function initFaqAccordion() {
  const faqItems = document.querySelectorAll('.faq-item');
  faqItems.forEach(item => {
    const question = item.querySelector('.faq-question');
    if (question) {
      question.addEventListener('click', () => {
        const isActive = item.classList.contains('active');
        faqItems.forEach(other => other.classList.remove('active'));
        if (!isActive) {
          item.classList.add('active');
        }
      });
    }
  });
}

/* Toast Notification System */
function showToast(message, type = 'info') {
  let container = document.querySelector('.toast-container');
  if (!container) {
    container = document.createElement('div');
    container.className = 'toast-container';
    document.body.appendChild(container);
  }

  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  
  let icon = 'fa-info-circle';
  if (type === 'success') icon = 'fa-check-circle';
  if (type === 'error') icon = 'fa-exclamation-circle';
  if (type === 'warning') icon = 'fa-exclamation-triangle';

  toast.innerHTML = `<i class="fas ${icon}"></i> <span>${message}</span>`;
  container.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateX(100%)';
    setTimeout(() => toast.remove(), 300);
  }, 4000);
}

/* File Dropzone Setup Helper */
function setupDropzone(dropzoneEl, fileInputEl, onFilesSelected) {
  if (!dropzoneEl || !fileInputEl) return;

  dropzoneEl.addEventListener('click', () => fileInputEl.click());

  ['dragenter', 'dragover'].forEach(eventName => {
    dropzoneEl.addEventListener(eventName, (e) => {
      e.preventDefault();
      e.stopPropagation();
      dropzoneEl.classList.add('dragover');
    }, false);
  });

  ['dragleave', 'drop'].forEach(eventName => {
    dropzoneEl.addEventListener(eventName, (e) => {
      e.preventDefault();
      e.stopPropagation();
      dropzoneEl.classList.remove('dragover');
    }, false);
  });

  dropzoneEl.addEventListener('drop', (e) => {
    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0) {
      onFilesSelected(files);
    }
  });

  fileInputEl.addEventListener('change', (e) => {
    const files = Array.from(e.target.files);
    if (files.length > 0) {
      onFilesSelected(files);
    }
  });
}

/* Helper: Format Bytes to Human Readable Size */
function formatBytes(bytes, decimals = 2) {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

/* Helper: Trigger Client File Download */
function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, 100);
}

/* Helper: Render First Page Thumbnail of PDF File using pdf.js */
async function renderPdfThumbnail(file, canvasElement) {
  try {
    const arrayBuffer = await file.arrayBuffer();
    const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
    const pdf = await loadingTask.promise;
    const page = await pdf.getPage(1);

    const viewport = page.getViewport({ scale: 0.3 });
    const canvas = canvasElement;
    const context = canvas.getContext('2d');
    canvas.height = viewport.height;
    canvas.width = viewport.width;

    const renderContext = {
      canvasContext: context,
      viewport: viewport
    };
    await page.render(renderContext).promise;
  } catch (err) {
    console.error("Thumbnail rendering error:", err);
  }
}
