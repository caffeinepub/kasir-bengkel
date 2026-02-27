// Self-contained XLSX writer and reader (no external dependencies)
// Uses CompressionStream/DecompressionStream (available in modern browsers)

// ─── CRC-32 ──────────────────────────────────────────────────────────────────
const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let j = 0; j < 8; j++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[i] = c;
  }
  return t;
})();

function crc32(data: Uint8Array): number {
  let crc = 0xffffffff;
  for (let i = 0; i < data.length; i++) {
    crc = CRC_TABLE[(crc ^ data[i]) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

// ─── Ensure plain ArrayBuffer-backed Uint8Array ───────────────────────────────
function toPlainUint8Array(data: Uint8Array): Uint8Array<ArrayBuffer> {
  const buf = new ArrayBuffer(data.length);
  const out = new Uint8Array(buf);
  out.set(data);
  return out as Uint8Array<ArrayBuffer>;
}

// ─── Compression (raw DEFLATE for ZIP) ───────────────────────────────────────
async function deflateRaw(data: Uint8Array): Promise<Uint8Array<ArrayBuffer>> {
  try {
    const cs = new CompressionStream('deflate-raw');
    const writer = cs.writable.getWriter();
    const reader = cs.readable.getReader();
    writer.write(toPlainUint8Array(data));
    writer.close();
    const chunks: Uint8Array[] = [];
    let totalLen = 0;
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(value);
      totalLen += value.length;
    }
    const buf = new ArrayBuffer(totalLen);
    const out = new Uint8Array(buf);
    let offset = 0;
    for (const chunk of chunks) {
      out.set(chunk, offset);
      offset += chunk.length;
    }
    return out as Uint8Array<ArrayBuffer>;
  } catch {
    // Fallback: store uncompressed
    return toPlainUint8Array(data);
  }
}

async function decompressDeflateRaw(data: Uint8Array): Promise<Uint8Array<ArrayBuffer>> {
  const safe = toPlainUint8Array(data);
  const ds = new DecompressionStream('deflate-raw');
  const writer = ds.writable.getWriter();
  const reader = ds.readable.getReader();
  writer.write(safe);
  writer.close();
  const chunks: Uint8Array[] = [];
  let totalLen = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
    totalLen += value.length;
  }
  const buf = new ArrayBuffer(totalLen);
  const out = new Uint8Array(buf);
  let offset = 0;
  for (const chunk of chunks) {
    out.set(chunk, offset);
    offset += chunk.length;
  }
  return out as Uint8Array<ArrayBuffer>;
}

// ─── Little-endian helpers ────────────────────────────────────────────────────
function u16(v: number, buf: Uint8Array, off: number) {
  buf[off] = v & 0xff;
  buf[off + 1] = (v >> 8) & 0xff;
}
function u32(v: number, buf: Uint8Array, off: number) {
  buf[off] = v & 0xff;
  buf[off + 1] = (v >> 8) & 0xff;
  buf[off + 2] = (v >> 16) & 0xff;
  buf[off + 3] = (v >> 24) & 0xff;
}

const enc = new TextEncoder();

// ─── ZIP builder ─────────────────────────────────────────────────────────────
interface ZipEntry {
  name: string;
  data: Uint8Array;
  compressed: Uint8Array;
  crc: number;
  offset: number;
}

async function zipFile(files: { name: string; data: string }[]): Promise<Uint8Array<ArrayBuffer>> {
  const entries: ZipEntry[] = [];

  for (const f of files) {
    const raw = enc.encode(f.data);
    const crc = crc32(raw);
    let compressed: Uint8Array = await deflateRaw(raw);
    // If compression doesn't help, store uncompressed
    if (compressed.length >= raw.length) {
      compressed = toPlainUint8Array(raw);
    }
    entries.push({ name: f.name, data: raw, compressed, crc, offset: 0 });
  }

  // Build local file headers + data
  const parts: Uint8Array[] = [];
  let offset = 0;

  for (const entry of entries) {
    entry.offset = offset;
    const nameBytes = enc.encode(entry.name);
    const method = entry.compressed === entry.data ? 0 : 8; // 0=store, 8=deflate
    const header = new Uint8Array(30 + nameBytes.length);
    u32(0x04034b50, header, 0);  // local file header sig
    u16(20, header, 4);           // version needed
    u16(0, header, 6);            // flags
    u16(method, header, 8);       // compression method
    u16(0, header, 10);           // mod time
    u16(0, header, 12);           // mod date
    u32(entry.crc, header, 14);   // crc32
    u32(entry.compressed.length, header, 18); // compressed size
    u32(entry.data.length, header, 22);       // uncompressed size
    u16(nameBytes.length, header, 26);        // filename length
    u16(0, header, 28);           // extra field length
    header.set(nameBytes, 30);
    parts.push(header);
    parts.push(entry.compressed);
    offset += header.length + entry.compressed.length;
  }

  // Central directory
  const cdParts: Uint8Array[] = [];
  let cdSize = 0;
  const cdOffset = offset;

  for (const entry of entries) {
    const nameBytes = enc.encode(entry.name);
    const method = entry.compressed === entry.data ? 0 : 8;
    const cd = new Uint8Array(46 + nameBytes.length);
    u32(0x02014b50, cd, 0);       // central dir sig
    u16(20, cd, 4);               // version made by
    u16(20, cd, 6);               // version needed
    u16(0, cd, 8);                // flags
    u16(method, cd, 10);          // compression method
    u16(0, cd, 12);               // mod time
    u16(0, cd, 14);               // mod date
    u32(entry.crc, cd, 16);       // crc32
    u32(entry.compressed.length, cd, 20); // compressed size
    u32(entry.data.length, cd, 24);       // uncompressed size
    u16(nameBytes.length, cd, 28);        // filename length
    u16(0, cd, 30);               // extra field length
    u16(0, cd, 32);               // file comment length
    u16(0, cd, 34);               // disk number start
    u16(0, cd, 36);               // internal attributes
    u32(0, cd, 38);               // external attributes
    u32(entry.offset, cd, 42);    // relative offset
    cd.set(nameBytes, 46);
    cdParts.push(cd);
    cdSize += cd.length;
  }

  // End of central directory
  const eocd = new Uint8Array(22);
  u32(0x06054b50, eocd, 0);       // EOCD sig
  u16(0, eocd, 4);                // disk number
  u16(0, eocd, 6);                // disk with CD
  u16(entries.length, eocd, 8);   // entries on disk
  u16(entries.length, eocd, 10);  // total entries
  u32(cdSize, eocd, 12);          // CD size
  u32(cdOffset, eocd, 16);        // CD offset
  u16(0, eocd, 20);               // comment length

  // Concatenate everything
  const allParts = [...parts, ...cdParts, eocd];
  const totalLen = allParts.reduce((s, p) => s + p.length, 0);
  const buffer = new ArrayBuffer(totalLen);
  const result = new Uint8Array(buffer);
  let pos = 0;
  for (const p of allParts) {
    result.set(p, pos);
    pos += p.length;
  }
  return result as Uint8Array<ArrayBuffer>;
}

// ─── XML helpers ─────────────────────────────────────────────────────────────
function escapeXml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

// ─── XLSX builder ────────────────────────────────────────────────────────────
export async function buildXlsx(
  headers: string[],
  rows: (string | number)[][]
): Promise<Uint8Array<ArrayBuffer>> {
  // Shared strings
  const strings: string[] = [];
  const strIndex: Record<string, number> = {};

  function si(s: string): number {
    if (strIndex[s] === undefined) {
      strIndex[s] = strings.length;
      strings.push(s);
    }
    return strIndex[s];
  }

  function colName(ci: number): string {
    let name = '';
    let n = ci;
    do {
      name = String.fromCharCode(65 + (n % 26)) + name;
      n = Math.floor(n / 26) - 1;
    } while (n >= 0);
    return name;
  }

  // Build sheet rows XML
  let sheetRowsXml = '';

  // Header row (row 1)
  let headerCells = '';
  headers.forEach((h, ci) => {
    const col = colName(ci);
    headerCells += `<c r="${col}1" t="s"><v>${si(h)}</v></c>`;
  });
  sheetRowsXml += `<row r="1">${headerCells}</row>`;

  // Data rows
  rows.forEach((row, ri) => {
    let cells = '';
    row.forEach((val, ci) => {
      const col = colName(ci);
      const rowNum = ri + 2;
      const ref = `${col}${rowNum}`;
      if (typeof val === 'number') {
        cells += `<c r="${ref}"><v>${val}</v></c>`;
      } else if (val === '' || val === null || val === undefined) {
        // empty cell — skip
      } else {
        cells += `<c r="${ref}" t="s"><v>${si(String(val))}</v></c>`;
      }
    });
    sheetRowsXml += `<row r="${ri + 2}">${cells}</row>`;
  });

  // Shared strings XML
  const sstXml =
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
    `<sst xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" count="${strings.length}" uniqueCount="${strings.length}">` +
    strings.map(s => `<si><t xml:space="preserve">${escapeXml(s)}</t></si>`).join('') +
    `</sst>`;

  // Sheet XML
  const sheetXml =
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
    `<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">` +
    `<sheetData>${sheetRowsXml}</sheetData>` +
    `</worksheet>`;

  // Workbook XML
  const workbookXml =
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
    `<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">` +
    `<sheets><sheet name="Sheet1" sheetId="1" r:id="rId1"/></sheets>` +
    `</workbook>`;

  // Styles XML (minimal)
  const stylesXml =
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
    `<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">` +
    `<fonts count="1"><font><sz val="11"/><name val="Calibri"/></font></fonts>` +
    `<fills count="2"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill></fills>` +
    `<borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders>` +
    `<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>` +
    `<cellXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/></cellXfs>` +
    `</styleSheet>`;

  // Relationships
  const workbookRels =
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
    `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">` +
    `<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>` +
    `<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/sharedStrings" Target="sharedStrings.xml"/>` +
    `<Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>` +
    `</Relationships>`;

  const rootRels =
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
    `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">` +
    `<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>` +
    `</Relationships>`;

  const contentTypes =
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
    `<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">` +
    `<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>` +
    `<Default Extension="xml" ContentType="application/xml"/>` +
    `<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>` +
    `<Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>` +
    `<Override PartName="/xl/sharedStrings.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sharedStrings+xml"/>` +
    `<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>` +
    `</Types>`;

  return zipFile([
    { name: '[Content_Types].xml', data: contentTypes },
    { name: '_rels/.rels', data: rootRels },
    { name: 'xl/workbook.xml', data: workbookXml },
    { name: 'xl/_rels/workbook.xml.rels', data: workbookRels },
    { name: 'xl/worksheets/sheet1.xml', data: sheetXml },
    { name: 'xl/sharedStrings.xml', data: sstXml },
    { name: 'xl/styles.xml', data: stylesXml },
  ]);
}

// ─── XLSX reader ─────────────────────────────────────────────────────────────
interface ZipFileEntry {
  name: string;
  data: Uint8Array;
}

async function readZip(buffer: ArrayBuffer): Promise<ZipFileEntry[]> {
  const view = new DataView(buffer);
  const bytes = new Uint8Array(buffer);
  const files: ZipFileEntry[] = [];

  // Find end of central directory
  let eocdOffset = -1;
  for (let i = bytes.length - 22; i >= 0; i--) {
    if (view.getUint32(i, true) === 0x06054b50) {
      eocdOffset = i;
      break;
    }
  }
  if (eocdOffset === -1) throw new Error('Invalid ZIP: EOCD not found');

  const cdOffset = view.getUint32(eocdOffset + 16, true);
  const cdCount = view.getUint16(eocdOffset + 8, true);

  let cdPos = cdOffset;
  for (let i = 0; i < cdCount; i++) {
    if (view.getUint32(cdPos, true) !== 0x02014b50) break;
    const method = view.getUint16(cdPos + 10, true);
    const compSize = view.getUint32(cdPos + 20, true);
    const nameLen = view.getUint16(cdPos + 28, true);
    const extraLen = view.getUint16(cdPos + 30, true);
    const commentLen = view.getUint16(cdPos + 32, true);
    const localOffset = view.getUint32(cdPos + 42, true);
    const name = new TextDecoder().decode(bytes.slice(cdPos + 46, cdPos + 46 + nameLen));
    cdPos += 46 + nameLen + extraLen + commentLen;

    // Read local file header
    const localNameLen = view.getUint16(localOffset + 26, true);
    const localExtraLen = view.getUint16(localOffset + 28, true);
    const dataStart = localOffset + 30 + localNameLen + localExtraLen;
    const compData = bytes.slice(dataStart, dataStart + compSize);

    let data: Uint8Array;
    if (method === 0) {
      data = toPlainUint8Array(compData);
    } else if (method === 8) {
      data = await decompressDeflateRaw(compData);
    } else {
      data = toPlainUint8Array(compData);
    }

    files.push({ name, data });
  }

  return files;
}

function parseXmlDoc(xml: string): Document {
  return new DOMParser().parseFromString(xml, 'application/xml');
}

/**
 * Convert a column letter string (e.g. "A", "B", "AA") to a zero-based column index.
 */
function colLetterToIndex(col: string): number {
  let index = 0;
  for (let i = 0; i < col.length; i++) {
    index = index * 26 + (col.charCodeAt(i) - 64);
  }
  return index - 1;
}

/**
 * Parse a cell reference like "A1", "BC23" into { col: number, row: number }.
 * col is zero-based, row is one-based.
 */
function parseCellRef(ref: string): { col: number; row: number } | null {
  const match = ref.match(/^([A-Z]+)(\d+)$/);
  if (!match) return null;
  return {
    col: colLetterToIndex(match[1]),
    row: parseInt(match[2], 10),
  };
}

/**
 * Extract the full text content from a shared string <si> element.
 * Handles both simple <t> and rich-text <r><t> runs, as well as
 * xml:space="preserve" whitespace.
 */
function extractSiText(siEl: Element): string {
  // Rich text: concatenate all <r><t> run texts
  const runs = siEl.querySelectorAll('r > t');
  if (runs.length > 0) {
    let text = '';
    runs.forEach(t => { text += t.textContent ?? ''; });
    return text;
  }
  // Simple: single <t> element
  const t = siEl.querySelector('t');
  return t?.textContent ?? '';
}

export async function readXlsx(buffer: ArrayBuffer): Promise<string[][]> {
  const files = await readZip(buffer);
  const dec = new TextDecoder();

  // ── Shared strings ──────────────────────────────────────────────────────────
  // Build the shared strings table, handling both simple <t> and rich-text <r><t> runs.
  const sstFile = files.find(f => f.name.includes('sharedStrings'));
  const sharedStrings: string[] = [];
  if (sstFile) {
    const sstDoc = parseXmlDoc(dec.decode(sstFile.data));
    sstDoc.querySelectorAll('si').forEach(si => {
      sharedStrings.push(extractSiText(si));
    });
  }

  // ── Find the first worksheet ────────────────────────────────────────────────
  const sheetFile = files.find(
    f => f.name.includes('sheet1.xml') || /worksheets\/sheet\d+\.xml/.test(f.name)
  );
  if (!sheetFile) return [];

  const sheetDoc = parseXmlDoc(dec.decode(sheetFile.data));
  const rows: string[][] = [];

  // ── Parse rows, placing each cell at its correct column index ───────────────
  // Excel omits empty cells entirely, so we must use the cell reference (e.g. "C5")
  // to determine the correct column position rather than relying on sequential order.
  sheetDoc.querySelectorAll('row').forEach(rowEl => {
    const cellEls = rowEl.querySelectorAll('c');
    if (cellEls.length === 0) return;

    // Determine the maximum column index in this row so we can size the array
    let maxCol = 0;
    cellEls.forEach(cell => {
      const ref = cell.getAttribute('r') ?? '';
      const parsed = parseCellRef(ref);
      if (parsed && parsed.col > maxCol) maxCol = parsed.col;
    });

    // Pre-fill with empty strings
    const cells: string[] = new Array(maxCol + 1).fill('');

    cellEls.forEach(cell => {
      const ref = cell.getAttribute('r') ?? '';
      const parsed = parseCellRef(ref);
      if (!parsed) return;

      const colIdx = parsed.col;
      const t = cell.getAttribute('t');
      const v = cell.querySelector('v')?.textContent ?? '';

      if (t === 's') {
        // Shared string reference
        cells[colIdx] = sharedStrings[parseInt(v, 10)] ?? '';
      } else if (t === 'inlineStr') {
        // Inline string (used by some Excel versions for newly typed cells)
        const isEl = cell.querySelector('is');
        if (isEl) {
          cells[colIdx] = extractSiText(isEl);
        } else {
          cells[colIdx] = v;
        }
      } else if (t === 'b') {
        // Boolean
        cells[colIdx] = v === '1' ? 'TRUE' : 'FALSE';
      } else if (t === 'str') {
        // Formula result string
        cells[colIdx] = v;
      } else {
        // Numeric or date value
        cells[colIdx] = v;
      }
    });

    rows.push(cells);
  });

  return rows;
}
