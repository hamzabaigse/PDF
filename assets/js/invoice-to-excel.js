/**
 * Bulk Invoice & Receipt to Excel / CSV Parser Engine
 * 100% Client-Side In-Browser Text & Financial Field Extraction
 * Features:
 * - Multi-file PDF batch upload
 * - Automated extraction of Invoice #, Date, Vendor Name, Tax, Total Amount & Currency
 * - Interactive Editable Data Table
 * - Export directly to Excel (.xlsx) using SheetJS & CSV
 */

let extractedInvoices = [];

document.addEventListener('DOMContentLoaded', () => {
  const dropzone = document.getElementById('dropzone');
  const fileInput = document.getElementById('file-input');
  const processBtn = document.getElementById('process-invoices-btn');
  const exportXlsxBtn = document.getElementById('export-xlsx-btn');
  const exportCsvBtn = document.getElementById('export-csv-btn');
  const addManualRowBtn = document.getElementById('add-manual-row-btn');

  if (dropzone && fileInput) {
    setupDropzone(dropzone, fileInput, (files) => handleInvoiceFilesSelected(files));
  }

  if (fileInput) {
    fileInput.addEventListener('change', (e) => {
      if (e.target.files.length > 0) {
        handleInvoiceFilesSelected(Array.from(e.target.files));
      }
    });
  }

  if (exportXlsxBtn) exportXlsxBtn.addEventListener('click', exportToExcel);
  if (exportCsvBtn) exportCsvBtn.addEventListener('click', exportToCsv);
  if (addManualRowBtn) addManualRowBtn.addEventListener('click', addManualInvoiceRow);
});

async function handleInvoiceFilesSelected(files) {
  const pdfFiles = files.filter(f => f.name.toLowerCase().endsWith('.pdf'));

  if (pdfFiles.length === 0) {
    showToast('Please select valid PDF invoice documents.', 'error');
    return;
  }

  document.getElementById('dropzone-container').style.display = 'none';
  document.getElementById('workspace-controls').style.display = 'block';

  showToast(`Parsing ${pdfFiles.length} PDF invoice(s)...`, 'info');

  const tbody = document.getElementById('invoice-table-body');
  tbody.innerHTML = '';
  extractedInvoices = [];

  for (let i = 0; i < pdfFiles.length; i++) {
    const file = pdfFiles[i];
    try {
      const parsedData = await parsePdfInvoice(file);
      parsedData.id = 'inv_' + Math.random().toString(36).substring(2, 9);
      extractedInvoices.push(parsedData);
      renderInvoiceRow(parsedData);
    } catch (err) {
      console.error(`Failed to parse ${file.name}:`, err);
      showToast(`Error parsing ${file.name}`, 'warning');
    }
  }

  updateSummaryStats();
  showToast(`Successfully parsed ${extractedInvoices.length} invoice(s)!`, 'success');
}

async function parsePdfInvoice(file) {
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;

  let fullText = '';
  for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
    const page = await pdf.getPage(pageNum);
    const content = await page.getTextContent();
    const pageText = content.items.map(item => item.str).join(' ');
    fullText += pageText + ' \n ';
  }

  // Smart Heuristic Extraction Rules
  const invoiceNum = extractInvoiceNumber(fullText, file.name);
  const date = extractInvoiceDate(fullText);
  const vendor = extractVendorName(fullText, file.name);
  const { total, currency } = extractTotalAmount(fullText);
  const tax = extractTaxAmount(fullText);

  return {
    filename: file.name,
    vendor: vendor,
    invoiceNum: invoiceNum,
    date: date,
    subtotal: (total > tax ? (total - tax).toFixed(2) : total.toFixed(2)),
    tax: tax > 0 ? tax.toFixed(2) : '0.00',
    total: total.toFixed(2),
    currency: currency
  };
}

/* Regex & Pattern Extractors */
function extractInvoiceNumber(text, filename) {
  const match = text.match(/(?:Invoice\s*#?|Inv\s*#?|Invoice\s*No\.?|Doc\s*#?)\s*[:\-\s]*([A-Z0-9\-_]{3,20})/i);
  if (match) return match[1].trim();

  const numMatch = text.match(/#\s*([0-9\-_]{3,15})/);
  if (numMatch) return numMatch[1].trim();

  return 'INV-' + filename.replace(/\.[^/.]+$/, "").substring(0, 8);
}

function extractInvoiceDate(text) {
  // ISO (2026-09-26), US (09/26/2026), EU (26/09/2026), Textual (26 Sep 2026)
  const dateMatch = text.match(/(?:Date|Invoice\s*Date|Issued)\s*[:\-\s]*([0-9]{1,4}[\/\-\.][0-9]{1,2}[\/\-\.][0-9]{1,4}|[A-Za-z]{3,9}\s+[0-9]{1,2},?\s+[0-9]{4}|[0-9]{1,2}\s+[A-Za-z]{3,9}\s+[0-9]{4})/i);
  if (dateMatch) return dateMatch[1].trim();

  const generalDate = text.match(/([0-9]{2,4}[\/\-\.][0-9]{1,2}[\/\-\.][0-9]{2,4})/);
  if (generalDate) return generalDate[1].trim();

  return new Date().toISOString().split('T')[0];
}

function extractVendorName(text, filename) {
  const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 2);
  
  // Look for company names near the top of the invoice
  for (let i = 0; i < Math.min(5, lines.length); i++) {
    const line = lines[i];
    if (!line.toLowerCase().includes('invoice') && !line.toLowerCase().includes('page') && !line.match(/^[0-9\W]+$/)) {
      return line.substring(0, 35);
    }
  }

  return filename.split('.')[0].replace(/[^a-zA-Z0-9\s]/g, ' ').trim() || 'Vendor / Supplier';
}

function extractTotalAmount(text) {
  let currency = '$';
  if (text.includes('€') || text.toLowerCase().includes('eur')) currency = '€';
  if (text.includes('£') || text.toLowerCase().includes('gbp')) currency = '£';
  if (text.includes('₹') || text.toLowerCase().includes('inr')) currency = '₹';

  const totalMatch = text.match(/(?:Grand\s*Total|Total\s*Due|Amount\s*Due|Total|Balance\s*Due)\s*[:\-\s]*[^\d]*([0-9]{1,3}(?:,[0-9]{3})*(?:\.[0-9]{2})?)/i);
  if (totalMatch) {
    const amtStr = totalMatch[1].replace(/,/g, '');
    const amt = parseFloat(amtStr);
    if (!isNaN(amt)) return { total: amt, currency: currency };
  }

  // Fallback to highest numeric value with 2 decimals
  const amounts = text.match(/\d+\.\d{2}/g);
  if (amounts && amounts.length > 0) {
    const nums = amounts.map(n => parseFloat(n)).filter(n => !isNaN(n));
    if (nums.length > 0) {
      return { total: Math.max(...nums), currency: currency };
    }
  }

  return { total: 0.00, currency: '$' };
}

function extractTaxAmount(text) {
  const taxMatch = text.match(/(?:Tax|VAT|GST|HST|Sales\s*Tax)\s*[:\-\s]*[^\d]*([0-9]{1,3}(?:,[0-9]{3})*(?:\.[0-9]{2})?)/i);
  if (taxMatch) {
    const taxStr = taxMatch[1].replace(/,/g, '');
    const tax = parseFloat(taxStr);
    if (!isNaN(tax)) return tax;
  }
  return 0.00;
}

/* Render & Edit Table Rows */
function renderInvoiceRow(item) {
  const tbody = document.getElementById('invoice-table-body');
  const tr = document.createElement('tr');
  tr.id = item.id;
  tr.innerHTML = `
    <td><input type="text" class="form-control form-control-sm" value="${escapeHtml(item.filename)}" onchange="updateInvoiceItem('${item.id}', 'filename', this.value)"></td>
    <td><input type="text" class="form-control form-control-sm" value="${escapeHtml(item.vendor)}" onchange="updateInvoiceItem('${item.id}', 'vendor', this.value)"></td>
    <td><input type="text" class="form-control form-control-sm" value="${escapeHtml(item.invoiceNum)}" onchange="updateInvoiceItem('${item.id}', 'invoiceNum', this.value)"></td>
    <td><input type="text" class="form-control form-control-sm" value="${escapeHtml(item.date)}" onchange="updateInvoiceItem('${item.id}', 'date', this.value)"></td>
    <td><input type="text" class="form-control form-control-sm" value="${item.currency} ${item.tax}" onchange="updateInvoiceItem('${item.id}', 'tax', this.value)"></td>
    <td><input type="text" class="form-control form-control-sm" style="font-weight:700; color:var(--primary);" value="${item.currency} ${item.total}" onchange="updateInvoiceItem('${item.id}', 'total', this.value)"></td>
    <td style="text-align: center;">
      <button class="btn btn-danger btn-sm" onclick="deleteInvoiceRow('${item.id}')" title="Delete Row"><i class="fas fa-trash"></i></button>
    </td>
  `;
  tbody.appendChild(tr);
}

function updateInvoiceItem(id, key, val) {
  const item = extractedInvoices.find(i => i.id === id);
  if (item) {
    item[key] = val;
    updateSummaryStats();
  }
}

function deleteInvoiceRow(id) {
  extractedInvoices = extractedInvoices.filter(i => i.id !== id);
  const tr = document.getElementById(id);
  if (tr) tr.remove();
  updateSummaryStats();
  showToast('Row removed', 'info');
}

function addManualInvoiceRow() {
  const id = 'inv_' + Math.random().toString(36).substring(2, 9);
  const newItem = {
    id: id,
    filename: 'Manual_Entry.pdf',
    vendor: 'New Vendor',
    invoiceNum: 'INV-100' + (extractedInvoices.length + 1),
    date: new Date().toISOString().split('T')[0],
    subtotal: '0.00',
    tax: '0.00',
    total: '0.00',
    currency: '$'
  };
  extractedInvoices.push(newItem);
  renderInvoiceRow(newItem);
  updateSummaryStats();
}

function updateSummaryStats() {
  const countEl = document.getElementById('summary-count');
  const sumEl = document.getElementById('summary-total');

  if (countEl) countEl.innerText = extractedInvoices.length;

  let totalSum = 0;
  extractedInvoices.forEach(inv => {
    const cleanTotal = parseFloat(inv.total.toString().replace(/[^0-9.]/g, ''));
    if (!isNaN(cleanTotal)) totalSum += cleanTotal;
  });

  if (sumEl) sumEl.innerText = '$' + totalSum.toFixed(2);
}

function escapeHtml(str) {
  return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

/* SheetJS Excel & CSV Exports */
function exportToExcel() {
  if (extractedInvoices.length === 0) {
    showToast('No parsed invoice data to export.', 'warning');
    return;
  }

  try {
    const exportData = extractedInvoices.map(item => ({
      "File Name": item.filename,
      "Vendor / Business": item.vendor,
      "Invoice Number": item.invoiceNum,
      "Invoice Date": item.date,
      "Tax Amount": item.tax,
      "Total Amount": item.total,
      "Currency": item.currency
    }));

    const worksheet = XLSX.utils.json_to_sheet(exportData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Invoices");

    XLSX.writeFile(workbook, `Invoices_Export_${new Date().toISOString().split('T')[0]}.xlsx`);
    showToast('Exported to Excel (.xlsx) successfully!', 'success');
  } catch (err) {
    console.error(err);
    showToast('Failed to export Excel file.', 'error');
  }
}

function exportToCsv() {
  if (extractedInvoices.length === 0) {
    showToast('No parsed invoice data to export.', 'warning');
    return;
  }

  try {
    const exportData = extractedInvoices.map(item => ({
      "File Name": item.filename,
      "Vendor / Business": item.vendor,
      "Invoice Number": item.invoiceNum,
      "Invoice Date": item.date,
      "Tax Amount": item.tax,
      "Total Amount": item.total,
      "Currency": item.currency
    }));

    const worksheet = XLSX.utils.json_to_sheet(exportData);
    const csvContent = XLSX.utils.sheet_to_csv(worksheet);

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    downloadBlob(blob, `Invoices_Export_${new Date().toISOString().split('T')[0]}.csv`);
    showToast('Exported to CSV successfully!', 'success');
  } catch (err) {
    console.error(err);
    showToast('Failed to export CSV file.', 'error');
  }
}
