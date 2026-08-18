/**
 * Client-side export helpers — CSV download and print.
 * Kept dependency-free so exports work offline and in every browser.
 */

function escapeCell(value) {
  if (value === null || value === undefined) return '';
  const text = String(value);
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

/** Turn an array of arrays into CSV text. */
export function toCSV(rows) {
  return rows.map(row => row.map(escapeCell).join(',')).join('\r\n');
}

/** Trigger a browser download of CSV text. */
export function downloadCSV(filename, rows) {
  // BOM keeps Excel happy with accented characters and the ✓ / ✗ symbols.
  const blob = new Blob(['﻿' + toCSV(rows)], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/** Build a filename like "skills-matrix-production-line-a-2026-08-18.csv". */
export function exportFilename(base, scope, extension = 'csv') {
  const slug = (scope || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
  const date = new Date().toISOString().split('T')[0];
  return [base, slug, date].filter(Boolean).join('-') + '.' + extension;
}
