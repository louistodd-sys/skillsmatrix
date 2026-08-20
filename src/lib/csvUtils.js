/**
 * RFC-4180-ish CSV parsing shared by the importers.
 * Handles: quoted fields, escaped quotes (""), commas and newlines inside
 * quotes, CRLF line endings, and a UTF-8 BOM. Returns raw string cells —
 * interpretation belongs to the caller.
 */

export function parseCSV(text) {
  // Strip BOM
  let src = text;
  if (src.charCodeAt(0) === 0xfeff) src = src.slice(1);

  const rows = [];
  let row = [];
  let cell = '';
  let inQuotes = false;

  for (let i = 0; i < src.length; i++) {
    const ch = src[i];
    if (inQuotes) {
      if (ch === '"') {
        if (src[i + 1] === '"') { cell += '"'; i++; }
        else inQuotes = false;
      } else {
        cell += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ',') {
      row.push(cell); cell = '';
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && src[i + 1] === '\n') i++;
      row.push(cell); cell = '';
      rows.push(row); row = [];
    } else {
      cell += ch;
    }
  }
  if (cell.length > 0 || row.length > 0) {
    row.push(cell);
    rows.push(row);
  }

  // Drop rows that are entirely empty
  return rows.filter(r => r.some(c => String(c).trim() !== ''));
}

/**
 * Fuzzy-match spreadsheet headers to known fields.
 * `fields` is [{ key, labels: ['team', 'team name', ...] }].
 * Returns { [key]: columnIndex | -1 }.
 */
export function autoMatchColumns(headerRow, fields) {
  const norm = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9]/g, '');
  const headers = headerRow.map(norm);
  const mapping = {};
  const taken = new Set();
  for (const field of fields) {
    let found = -1;
    const candidates = field.labels.map(norm);
    // Exact normalised match first, then substring either way
    for (let i = 0; i < headers.length; i++) {
      if (taken.has(i)) continue;
      if (candidates.includes(headers[i])) { found = i; break; }
    }
    if (found === -1) {
      for (let i = 0; i < headers.length; i++) {
        if (taken.has(i) || !headers[i]) continue;
        if (candidates.some(c => headers[i].includes(c) || c.includes(headers[i]))) { found = i; break; }
      }
    }
    if (found !== -1) taken.add(found);
    mapping[field.key] = found;
  }
  return mapping;
}

export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
