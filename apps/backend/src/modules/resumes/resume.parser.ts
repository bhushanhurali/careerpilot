import { extname } from 'node:path';
import { buffer } from 'node:stream/consumers';
import { crc32 } from 'node:zlib';

import { SaxesParser } from 'saxes';
import { fromBuffer, type Entry, type ZipFile } from 'yauzl';

import { resumeMimeTypes, type ResumeMimeType } from '../../db/models/resume.model.js';
import { HttpError } from '../../shared/errors/http-error.js';

export const maxResumeBytes = 2 * 1024 * 1024;
const maxTextLength = 200_000;
const maxXmlBytes = 8 * 1024 * 1024;
const requiredDocxParts = new Set(['[Content_Types].xml', '_rels/.rels', 'word/document.xml']);
const wordNamespaces = [
  'http://schemas.openxmlformats.org/wordprocessingml/2006/main',
  'http://purl.oclc.org/ooxml/wordprocessingml/main',
];

function invalid(): HttpError {
  return new HttpError(422, 'RESUME_UNREADABLE', 'Resume document is malformed or unreadable');
}

function encrypted(): HttpError {
  return new HttpError(422, 'RESUME_ENCRYPTED', 'Encrypted resumes are not supported');
}

function tooComplex(): HttpError {
  return new HttpError(422, 'RESUME_TOO_COMPLEX', 'Resume exceeds document processing limits');
}

async function extractPdf(content: Buffer): Promise<string> {
  if (
    !/^%PDF-\d\.\d/.test(content.subarray(0, 8).toString('ascii')) ||
    !content.subarray(-1024).toString('latin1').replaceAll('\0', '').trimEnd().endsWith('%%EOF')
  ) {
    throw invalid();
  }

  const { getDocument, PasswordException, VerbosityLevel } =
    await import('pdfjs-dist/legacy/build/pdf.mjs');
  const task = getDocument({
    data: Uint8Array.from(content),
    stopAtErrors: true,
    verbosity: VerbosityLevel.ERRORS,
    useSystemFonts: false,
    useWasm: false,
  });
  try {
    const document = await task.promise;
    const { info } = await document.getMetadata();
    if ((info as { EncryptFilterName?: string | null }).EncryptFilterName) throw encrypted();
    if (document.numPages > 100) throw tooComplex();

    let text = '';
    for (let index = 1; index <= document.numPages; index++) {
      const page = await document.getPage(index);
      const { items } = await page.getTextContent();
      for (const item of items) {
        if ('str' in item) {
          text += item.str + (item.hasEOL ? '\n' : ' ');
          if (text.length > maxTextLength) throw tooComplex();
        }
      }
      text += '\n';
      page.cleanup();
    }
    return text;
  } catch (error) {
    if (error instanceof PasswordException) throw encrypted();
    throw error;
  } finally {
    await task.destroy();
  }
}

function openZip(content: Buffer): Promise<ZipFile> {
  return new Promise((resolve, reject) => {
    fromBuffer(content, { lazyEntries: true, validateEntrySizes: true }, (error, zip) => {
      if (error) reject(error);
      else resolve(zip);
    });
  });
}

function readXml(zip: ZipFile, entry: Entry): Promise<string> {
  return new Promise((resolve, reject) => {
    zip.openReadStream(entry, (error, stream) => {
      if (error) {
        reject(error);
        return;
      }
      void buffer(stream)
        .then((bytes) => {
          if (crc32(bytes) !== entry.crc32) throw invalid();
          // Word XML is normally UTF-8; also accept BOM-marked UTF-16.
          const bom = bytes.subarray(0, 2).toString('hex');
          const encoding = bom === 'fffe' ? 'utf-16le' : bom === 'feff' ? 'utf-16be' : 'utf-8';
          return new TextDecoder(encoding, { fatal: true }).decode(bytes);
        })
        .then(resolve, reject);
    });
  });
}

async function extractDocx(content: Buffer): Promise<string> {
  if (content.subarray(0, 8).toString('hex') === 'd0cf11e0a1b11ae1') throw encrypted();
  if (content.subarray(0, 4).toString('hex') !== '504b0304') throw invalid();
  const zip = await openZip(content);
  try {
    if (zip.entryCount > 1000) throw tooComplex();
    const parts = await new Promise<Map<string, string>>((resolve, reject) => {
      const xml = new Map<string, string>();
      zip.on('error', reject);
      zip.on('end', () => resolve(xml));
      zip.on('entry', (entry: Entry) => {
        if ((entry.generalPurposeBitFlag & 1) !== 0) {
          reject(encrypted());
          return;
        }
        if (!requiredDocxParts.has(entry.fileName)) {
          zip.readEntry();
          return;
        }
        if (xml.has(entry.fileName) || entry.uncompressedSize > maxXmlBytes) {
          reject(invalid());
          return;
        }
        void readXml(zip, entry)
          .then((value) => {
            xml.set(entry.fileName, value);
            zip.readEntry();
          })
          .catch(reject);
      });
      zip.readEntry();
    });
    const types = parts.get('[Content_Types].xml');
    const relationships = parts.get('_rels/.rels');
    const document = parts.get('word/document.xml');
    if (!types || !relationships || !document) throw invalid();

    const packageRelationships = xmlParser();
    const documentTargets = new Set<string>();
    packageRelationships.on('opentag', (tag) => {
      if (
        tag.local === 'Relationship' &&
        tag.uri === 'http://schemas.openxmlformats.org/package/2006/relationships' &&
        tag.attributes.TargetMode?.value !== 'External' &&
        [
          'http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument',
          'http://purl.oclc.org/ooxml/officeDocument/relationships/officeDocument',
        ].includes(tag.attributes.Type?.value ?? '')
      ) {
        const target = tag.attributes.Target?.value;
        if (target) documentTargets.add(target);
      }
    });
    packageRelationships.write(relationships).close();
    if (!documentTargets.has('word/document.xml') && !documentTargets.has('/word/document.xml')) {
      throw invalid();
    }

    const contentTypes = xmlParser();
    const overrides = new Set<string>();
    contentTypes.on('opentag', (tag) => {
      if (
        tag.local === 'Override' &&
        tag.uri === 'http://schemas.openxmlformats.org/package/2006/content-types' &&
        tag.attributes.ContentType?.value ===
          'application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml'
      ) {
        const part = tag.attributes.PartName?.value;
        if (part) overrides.add(part);
      }
    });
    contentTypes.write(types).close();
    if (!overrides.has('/word/document.xml')) throw invalid();

    const parser = xmlParser();
    let depth = 0;
    let bodyDepth = 0;
    const body = { seen: false };
    let textDepth = 0;
    let text = '';
    const append = (value: string) => {
      text += value;
      if (text.length > maxTextLength) throw tooComplex();
    };
    parser.on('opentag', (tag) => {
      depth++;
      const isWord = wordNamespaces.includes(tag.uri);
      if (depth === 1 && (!isWord || tag.local !== 'document')) throw invalid();
      if (depth === 2 && isWord && tag.local === 'body') {
        if (body.seen) throw invalid();
        body.seen = true;
        bodyDepth = depth;
      }
      if (bodyDepth && isWord && tag.local === 't') textDepth = depth;
      if (bodyDepth && isWord && (tag.local === 'tab' || tag.local === 'br')) append(' ');
    });
    const collect = (value: string) => {
      if (textDepth) append(value);
    };
    parser.on('text', collect);
    parser.on('cdata', collect);
    parser.on('closetag', (tag) => {
      if (textDepth === depth) textDepth = 0;
      if (bodyDepth && tag.local === 'p' && wordNamespaces.includes(tag.uri)) append('\n');
      if (bodyDepth === depth) bodyDepth = 0;
      depth--;
    });
    parser.write(document).close();
    if (!body.seen) throw invalid();
    return text;
  } finally {
    zip.close();
  }
}

function xmlParser() {
  const parser = new SaxesParser({ xmlns: true });
  parser.on('doctype', () => {
    throw invalid();
  });
  return parser;
}

export async function parseResume(content: Buffer, filename: string, declaredMimeType: string) {
  if (content.length > maxResumeBytes)
    throw new HttpError(413, 'RESUME_TOO_LARGE', 'Resume must be at most 2 MiB');
  if (content.length === 0) throw invalid();
  if (filename.length > 255 || /[\p{Cc}<>:"/\\|?*]/u.test(filename)) {
    throw new HttpError(400, 'RESUME_INVALID_FILENAME', 'Invalid resume filename');
  }

  const extension = extname(filename).toLowerCase();
  const mimeType: ResumeMimeType | undefined =
    extension === '.pdf'
      ? resumeMimeTypes[0]
      : extension === '.docx'
        ? resumeMimeTypes[1]
        : undefined;
  if (!mimeType || mimeType !== declaredMimeType) {
    throw new HttpError(
      415,
      'RESUME_UNSUPPORTED_TYPE',
      'Resume must be a PDF or DOCX with a matching file type',
    );
  }

  try {
    const text = (await (extension === '.pdf' ? extractPdf(content) : extractDocx(content)))
      .replaceAll('\0', '')
      .trim();
    if (!text)
      throw new HttpError(
        422,
        'RESUME_NO_TEXT',
        'Resume contains no readable text; OCR is not supported',
      );
    return { mimeType, text };
  } catch (error) {
    if (error instanceof HttpError) throw error;
    throw invalid();
  }
}
