/**
 * Minimal XLSX (Office Open XML) writer/reader
 * Creates valid .xlsx files compatible with all Excel versions
 * No external dependencies required
 */

// Minimal CRC32 for ZIP
const crcTable = (() => {
  const t: number[] = [];
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c;
  }
  return t;
})();

function crc32(buf: Uint8Array): number {
  let crc = 0xffffffff;
  for (let i = 0; i < buf.length; i++) crc = crcTable[(crc ^ buf[i]) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

function u16(n: number): Uint8Array {
  return new Uint8Array([n & 0xff, (n >> 8) & 0xff]);
}
function u32(n: number): Uint8Array {
  return new Uint8Array([n & 0xff, (n >> 8) & 0xff, (n >> 16) & 0xff, (n >> 24) & 0xff]);
}

function concat(...arrays: Uint8Array[]): Uint8Array {
  const total = arrays.reduce((s, a) => s + a.length, 0);
  const out = new Uint8Array(total);
  let offset = 0;
  for (const a of arrays) { out.set(a, offset); offset += a.length; }
  return out;
}

const enc = new TextEncoder();

function deflateRaw(data: Uint8Array): Uint8Array {
  // Store method (no compression) - always compatible
  // Split into 65535-byte blocks
  const blocks: Uint8Array[] = [];
  let offset = 0;
  while (offset < data.length) {
    const end = Math.min(offset + 65535, data.length);
    const block = data.slice(offset, end);
    const isLast = end === data.length ? 1 : 0;
    const len = block.length;
    const nlen = (~len) & 0xffff;
    blocks.push(new Uint8Array([isLast, len & 0xff, (len >> 8) & 0xff, nlen & 0xff, (nlen >> 8) & 0xff]));
    blocks.push(block);
    offset = end;
  }
  if (data.length === 0) {
    blocks.push(new Uint8Array([1, 0, 0, 0xff, 0xff]));
  }
  return concat(...blocks);
}

function deflate(data: Uint8Array): Uint8Array {
  const raw = deflateRaw(data);
  // zlib header: CMF=0x78 (deflate, window=32k), FLG computed so CMF*256+FLG % 31 == 0
  const cmf = 0x78;
  const flg = 0x9c; // 0x789c is standard zlib no-compression header
  const adler = adler32(data);
  return concat(
    new Uint8Array([cmf, flg]),
    raw,
    new Uint8Array([
      (adler >> 24) & 0xff,
      (adler >> 16) & 0xff,
      (adler >> 8) & 0xff,
      adler & 0xff,
    ])
  );
}

function adler32(data: Uint8Array): number {
  let s1 = 1, s2 = 0;
  for (let i = 0; i < data.length; i++) {
    s1 = (s1 + data[i]) % 65521;
    s2 = (s2 + s1) % 65521;
  }
  return (s2 << 16) | s1;
}

interface ZipEntry {
  name: string;
  data: Uint8Array;
  compressed: Uint8Array;
  crc: number;
  offset: number;
}

function zipFile(files: { name: string; data: string }[]): Uint8Array<ArrayBuffer> {
  const entries: ZipEntry[] = [];
  const localHeaders: Uint8Array[] = [];
  let offset = 0;

  for (const f of files) {
    const data = enc.encode(f.data);
    const compressed = deflate(data);
    const crc = crc32(data);
    const nameBytes = enc.encode(f.name);

    // Local file header
    const lh = concat(
      new Uint8Array([0x50, 0x4b, 0x03, 0x04]), // signature
      u16(20),        // version needed
      u16(0),         // flags
      u16(8),         // compression: deflate
      u16(0), u16(0), // mod time/date
      u32(crc),
      u32(compressed.length),
      u32(data.length),
      u16(nameBytes.length),
      u16(0),         // extra length
      nameBytes,
      compressed
    );

    entries.push({ name: f.name, data, compressed, crc, offset });
    localHeaders.push(lh);
    offset += lh.length;
  }

  // Central directory
  const centralDir: Uint8Array[] = [];
  for (let i = 0; i < entries.length; i++) {
    const e = entries[i];
    const nameBytes = enc.encode(e.name);
    const cd = concat(
      new Uint8Array([0x50, 0x4b, 0x01, 0x02]), // signature
      u16(20), u16(20), // version made by / needed
      u16(0),           // flags
      u16(8),           // compression
      u16(0), u16(0),   // mod time/date
      u32(e.crc),
      u32(e.compressed.length),
      u32(e.data.length),
      u16(nameBytes.length),
      u16(0), u16(0),   // extra, comment
      u16(0),           // disk start
      u16(0), u16(0),   // internal/external attrs
      u32(e.offset),
      nameBytes
    );
    centralDir.push(cd);
  }

  const cdBytes = concat(...centralDir);
  const cdOffset = offset;

  // End of central directory
  const eocd = concat(
    new Uint8Array([0x50, 0x4b, 0x05, 0x06]),
    u16(0), u16(0),
    u16(entries.length), u16(entries.length),
    u32(cdBytes.length),
    u32(cdOffset),
    u16(0)
  );

  const result = concat(...localHeaders, cdBytes, eocd);
  // Ensure the buffer is a plain ArrayBuffer (not SharedArrayBuffer) for Blob compatibility
  return new Uint8Array(result.buffer.slice(result.byteOffset, result.byteOffset + result.byteLength) as ArrayBuffer);
}

// XML escape
function xe(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

export interface XlsxCell {
  v: string | number;
  t: 's' | 'n'; // string or number
  bold?: boolean;
}

export type XlsxRow = XlsxCell[];

export function buildXlsx(rows: XlsxRow[]): Uint8Array<ArrayBuffer> {
  // Shared strings
  const sharedStrings: string[] = [];
  const ssMap = new Map<string, number>();

  function getSS(s: string): number {
    if (ssMap.has(s)) return ssMap.get(s)!;
    const idx = sharedStrings.length;
    sharedStrings.push(s);
    ssMap.set(s, idx);
    return idx;
  }

  // Build sheet data
  const colLetters = ['A','B','C','D','E','F','G','H','I','J','K','L','M','N','O','P'];

  let sheetXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
<sheetData>`;

  for (let r = 0; r < rows.length; r++) {
    const row = rows[r];
    sheetXml += `<row r="${r + 1}">`;
    for (let c = 0; c < row.length; c++) {
      const cell = row[c];
      const ref = `${colLetters[c]}${r + 1}`;
      // Style index: 0=normal, 1=bold
      const s = cell.bold ? ' s="1"' : '';
      if (cell.t === 'n') {
        sheetXml += `<c r="${ref}" t="n"${s}><v>${cell.v}</v></c>`;
      } else {
        const idx = getSS(String(cell.v));
        sheetXml += `<c r="${ref}" t="s"${s}><v>${idx}</v></c>`;
      }
    }
    sheetXml += `</row>`;
  }

  sheetXml += `</sheetData></worksheet>`;

  // Shared strings XML
  const ssXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<sst xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" count="${sharedStrings.length}" uniqueCount="${sharedStrings.length}">
${sharedStrings.map(s => `<si><t xml:space="preserve">${xe(s)}</t></si>`).join('')}
</sst>`;

  // Styles XML with bold font
  const stylesXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
<fonts count="2">
<font><sz val="11"/><name val="Calibri"/></font>
<font><b/><sz val="11"/><name val="Calibri"/></font>
</fonts>
<fills count="2">
<fill><patternFill patternType="none"/></fill>
<fill><patternFill patternType="gray125"/></fill>
</fills>
<borders count="1">
<border><left/><right/><top/><bottom/><diagonal/></border>
</borders>
<cellStyleXfs count="1">
<xf numFmtId="0" fontId="0" fillId="0" borderId="0"/>
</cellStyleXfs>
<cellXfs count="2">
<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>
<xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1"/>
</cellXfs>
</styleSheet>`;

  const workbookXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"
          xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
<sheets>
<sheet name="Inventory" sheetId="1" r:id="rId1"/>
</sheets>
</workbook>`;

  const workbookRels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>
<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/sharedStrings" Target="sharedStrings.xml"/>
<Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
</Relationships>`;

  const relsXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>
</Relationships>`;

  const contentTypesXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
<Default Extension="xml" ContentType="application/xml"/>
<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
<Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>
<Override PartName="/xl/sharedStrings.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sharedStrings+xml"/>
<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>
</Types>`;

  return zipFile([
    { name: '[Content_Types].xml', data: contentTypesXml },
    { name: '_rels/.rels', data: relsXml },
    { name: 'xl/workbook.xml', data: workbookXml },
    { name: 'xl/_rels/workbook.xml.rels', data: workbookRels },
    { name: 'xl/worksheets/sheet1.xml', data: sheetXml },
    { name: 'xl/sharedStrings.xml', data: ssXml },
    { name: 'xl/styles.xml', data: stylesXml },
  ]);
}

export function downloadXlsx(rows: XlsxRow[], filename: string): void {
  const bytes = buildXlsx(rows);
  // bytes is Uint8Array<ArrayBuffer> — safe to pass to Blob
  const blob = new Blob([bytes], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

// ─── XLSX Reader ────────────────────────────────────────────────────────────

function colStrToIdx(col: string): number {
  let idx = 0;
  for (let i = 0; i < col.length; i++) {
    idx = idx * 26 + (col.charCodeAt(i) - 64);
  }
  return idx - 1;
}

function extractRowsFromSheetXml(sheetXml: string, sharedStrs: string[]): string[][] {
  const parser = new DOMParser();
  const doc = parser.parseFromString(sheetXml, 'application/xml');
  const rows: string[][] = [];
  const rowEls = doc.querySelectorAll('row');

  rowEls.forEach(rowEl => {
    const rIdx = parseInt(rowEl.getAttribute('r') || '1', 10) - 1;
    while (rows.length <= rIdx) rows.push([]);
    const row = rows[rIdx];

    const cells = rowEl.querySelectorAll('c');
    cells.forEach(cell => {
      const ref = cell.getAttribute('r') || '';
      const colStr = ref.replace(/[0-9]/g, '');
      const colIdx = colStrToIdx(colStr);
      while (row.length <= colIdx) row.push('');

      const t = cell.getAttribute('t') || '';
      const vEl = cell.querySelector('v');
      const v = vEl?.textContent || '';

      if (t === 's') {
        row[colIdx] = sharedStrs[parseInt(v, 10)] ?? '';
      } else if (t === 'inlineStr') {
        const isEl = cell.querySelector('is t');
        row[colIdx] = isEl?.textContent || '';
      } else {
        row[colIdx] = v;
      }
    });
  });

  return rows;
}

function extractSharedStrings(xml: string): string[] {
  const parser = new DOMParser();
  const doc = parser.parseFromString(xml, 'application/xml');
  const sharedStrs: string[] = [];
  const sis = doc.querySelectorAll('si');
  sis.forEach(si => {
    const ts = si.querySelectorAll('t');
    let text = '';
    ts.forEach(t => { text += t.textContent || ''; });
    sharedStrs.push(text);
  });
  return sharedStrs;
}

// ─── Async ZIP reader using DecompressionStream ──────────────────────────────

async function decompressDeflateRaw(data: Uint8Array): Promise<Uint8Array<ArrayBuffer>> {
  const ds = new DecompressionStream('deflate-raw');
  const writer = ds.writable.getWriter();
  const reader = ds.readable.getReader();

  // Ensure we pass a Uint8Array<ArrayBuffer> to writer.write
  const safeData = new Uint8Array(
    data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength) as ArrayBuffer
  );
  writer.write(safeData);
  writer.close();

  const chunks: Uint8Array[] = [];
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    if (value) chunks.push(value);
  }

  const total = chunks.reduce((s, c) => s + c.length, 0);
  const out = new Uint8Array(new ArrayBuffer(total));
  let offset = 0;
  for (const c of chunks) { out.set(c, offset); offset += c.length; }
  return out;
}

async function unzipAsync(data: Uint8Array): Promise<Record<string, Uint8Array>> {
  const files: Record<string, Uint8Array> = {};
  let i = 0;

  while (i < data.length - 4) {
    if (
      data[i] === 0x50 && data[i + 1] === 0x4b &&
      data[i + 2] === 0x03 && data[i + 3] === 0x04
    ) {
      const compression = data[i + 8] | (data[i + 9] << 8);
      const compressedSize =
        data[i + 18] | (data[i + 19] << 8) | (data[i + 20] << 16) | (data[i + 21] << 24);
      const nameLen = data[i + 26] | (data[i + 27] << 8);
      const extraLen = data[i + 28] | (data[i + 29] << 8);
      const name = new TextDecoder().decode(data.slice(i + 30, i + 30 + nameLen));
      const dataStart = i + 30 + nameLen + extraLen;
      const compData = data.slice(dataStart, dataStart + compressedSize);

      if (compression === 0) {
        // Stored — copy into a plain ArrayBuffer-backed Uint8Array
        const stored = new Uint8Array(new ArrayBuffer(compData.length));
        stored.set(compData);
        files[name] = stored;
      } else if (compression === 8) {
        try {
          files[name] = await decompressDeflateRaw(compData);
        } catch {
          // skip unreadable entries
        }
      }
      i = dataStart + compressedSize;
    } else {
      i++;
    }
  }
  return files;
}

/** Parse a .xlsx file (ArrayBuffer) and return rows as string[][] */
export async function parseXlsxAsync(buffer: ArrayBuffer): Promise<string[][]> {
  const bytes = new Uint8Array(buffer);
  const files = await unzipAsync(bytes);

  // Shared strings
  const sharedStrs: string[] = [];
  const ssFile = files['xl/sharedStrings.xml'];
  if (ssFile) {
    const xml = new TextDecoder().decode(ssFile);
    sharedStrs.push(...extractSharedStrings(xml));
  }

  // Find first worksheet
  let sheetFile: Uint8Array | undefined;
  for (const key of Object.keys(files)) {
    if (key.startsWith('xl/worksheets/') && key.endsWith('.xml')) {
      sheetFile = files[key];
      break;
    }
  }
  if (!sheetFile) return [];

  const sheetXml = new TextDecoder().decode(sheetFile);
  return extractRowsFromSheetXml(sheetXml, sharedStrs);
}
