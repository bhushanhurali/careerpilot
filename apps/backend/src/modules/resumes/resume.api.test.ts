import { randomUUID } from 'node:crypto';
import { mkdtemp, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { crc32 } from 'node:zlib';

import request from 'supertest';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import { createApp } from '../../app.js';
import { env } from '../../config/env.js';
import { createMigrator } from '../../db/migrator.js';
import { ResumeModel, resumeMimeTypes } from '../../db/models/resume.model.js';
import { UserModel } from '../../db/models/user.model.js';
import { sequelize } from '../../db/sequelize.js';
import type { ApiResponse } from '../../shared/responses/api-response.js';
import { signAccessToken } from '../../shared/security/jwt.js';
import { maxResumeBytes } from './resume.parser.js';
import { LocalResumeStorage } from './resume.storage.js';
import type { ResumeDto } from './resume.types.js';

const url = '/api/v1/resumes';
const [pdfMime, docxMime] = resumeMimeTypes;

function pdf(text: string): Buffer {
  const stream = text ? `BT /F1 12 Tf 10 10 Td (${text}) Tj ET` : '';
  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 200 200] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>',
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
    `<< /Length ${String(stream.length)} >>\nstream\n${stream}\nendstream`,
  ];
  let source = '%PDF-1.4\n';
  const offsets = objects.map((object, index) => {
    const offset = source.length;
    source += `${String(index + 1)} 0 obj\n${object}\nendobj\n`;
    return `${String(offset).padStart(10, '0')} 00000 n \n`;
  });
  return Buffer.from(
    `${source}xref\n0 6\n0000000000 65535 f \n${offsets.join('')}trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${String(source.length)}\n%%EOF\n`,
  );
}

function zip(entries: Record<string, string>): Buffer {
  const files: Buffer[] = [];
  const directory: Buffer[] = [];
  let offset = 0;
  for (const [name, value] of Object.entries(entries)) {
    const filename = Buffer.from(name);
    const bytes = Buffer.from(value);
    const local = Buffer.alloc(30);
    const central = Buffer.alloc(46);
    local.writeUInt32LE(0x04034b50);
    central.writeUInt32LE(0x02014b50);
    local.writeUInt16LE(20, 4);
    central.writeUInt16LE(20, 6);
    for (const [header, start] of [
      [local, 14],
      [central, 16],
    ] as const) {
      header.writeUInt32LE(crc32(bytes), start);
      header.writeUInt32LE(bytes.length, start + 4);
      header.writeUInt32LE(bytes.length, start + 8);
      header.writeUInt16LE(filename.length, start + 12);
    }
    central.writeUInt32LE(offset, 42);
    files.push(local, filename, bytes);
    directory.push(central, filename);
    offset += local.length + filename.length + bytes.length;
  }
  const index = Buffer.concat(directory);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50);
  end.writeUInt16LE(directory.length / 2, 8);
  end.writeUInt16LE(directory.length / 2, 10);
  end.writeUInt32LE(index.length, 12);
  end.writeUInt32LE(offset, 16);
  return Buffer.concat([...files, index, end]);
}

function docx(text: string): Buffer {
  return zip({
    '_rels/.rels':
      '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>',
    '[Content_Types].xml':
      '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>',
    'word/document.xml': `<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body><w:p><w:r><w:t>${text}</w:t></w:r></w:p></w:body></w:document>`,
  });
}

async function owner(): Promise<string> {
  const id = randomUUID();
  await UserModel.create({
    id,
    email: `${id}@example.com`,
    passwordHash: 'test-password-hash',
    firstName: 'Test',
    lastName: 'User',
  });
  return `Bearer ${signAccessToken({ id, role: 'user' })}`;
}

describe('Resume API', () => {
  let app: ReturnType<typeof createApp>;
  let directory: string;
  const previousDirectory = env.RESUME_STORAGE_DIR;

  beforeAll(async () => {
    await createMigrator().up();
  });

  beforeEach(async () => {
    await sequelize.query('TRUNCATE TABLE resumes, users RESTART IDENTITY CASCADE;');
    directory = await mkdtemp(join(tmpdir(), 'careerpilot-resume-api-'));
    env.RESUME_STORAGE_DIR = directory;
    app = createApp();
  });

  afterEach(async () => {
    vi.restoreAllMocks();
    env.RESUME_STORAGE_DIR = previousDirectory;
    await rm(directory, { recursive: true, force: true });
  });

  function upload(
    token: string,
    content: Buffer,
    filename = 'Resume.pdf',
    contentType: string = pdfMime,
  ) {
    return request(app)
      .post(url)
      .set('Authorization', token)
      .field('title', ' Backend resume ')
      .attach('file', content, { filename, contentType });
  }

  async function uploaded(token: string, content: Buffer, filename?: string, mimeType?: string) {
    const result = await upload(token, content, filename, mimeType).expect(201);
    const data = (result.body as ApiResponse<{ resume: ResumeDto }>).data;
    if (!data) throw new Error('Expected resume metadata');
    expect(Object.keys(data.resume).sort()).toEqual(
      [
        'id',
        'title',
        'originalFilename',
        'mimeType',
        'fileSizeBytes',
        'createdAt',
        'updatedAt',
      ].sort(),
    );
    return data.resume;
  }

  it('requires authentication on every route', async () => {
    const item = `${url}/${randomUUID()}`;
    await request(app).post(url).expect(401);
    await request(app).get(url).expect(401);
    await request(app).get(item).expect(401);
    await request(app).get(`${item}/download`).expect(401);
    await request(app).delete(item).expect(401);
  });

  it('extracts PDF and DOCX text privately and downloads the original bytes as an attachment', async () => {
    const token = await owner();
    const original = pdf('Private PDF resume');
    const first = await uploaded(token, original);
    const second = await uploaded(token, docx('Private DOCX resume'), 'Resume.docx', docxMime);
    expect(first).toMatchObject({
      title: 'Backend resume',
      fileSizeBytes: original.length,
      mimeType: pdfMime,
    });
    expect((await ResumeModel.findByPk(first.id))?.extractedText).toBe('Private PDF resume');
    expect((await ResumeModel.findByPk(second.id))?.extractedText).toBe('Private DOCX resume');
    const detail = await request(app)
      .get(`${url}/${first.id}`)
      .set('Authorization', token)
      .expect(200);
    expect((detail.body as ApiResponse<{ resume: ResumeDto }>).data?.resume).toEqual(first);
    await request(app)
      .get(`${url}/${first.id}/download`)
      .set('Authorization', token)
      .expect('Content-Disposition', 'attachment; filename="Resume.pdf"')
      .expect('Cache-Control', 'private, no-store')
      .expect('Content-Type', pdfMime)
      .buffer(true)
      .parse((response, callback) => {
        const chunks: Buffer[] = [];
        response.on('data', (chunk: Buffer) => chunks.push(chunk));
        response.on('end', () => callback(null, Buffer.concat(chunks)));
      })
      .expect(200)
      .expect((response) => expect(response.body).toEqual(original));
  });

  it('scopes metadata, downloads and deletion by owner and retains bytes after soft deletion', async () => {
    const token = await owner();
    const outsider = await owner();
    const resume = await uploaded(token, pdf('Private text'));
    const item = `${url}/${resume.id}`;
    const list = await request(app).get(url).set('Authorization', outsider).expect(200);
    expect((list.body as ApiResponse<{ resumes: ResumeDto[] }>).data?.resumes).toEqual([]);
    await request(app).get(item).set('Authorization', outsider).expect(404);
    await request(app).get(`${item}/download`).set('Authorization', outsider).expect(404);
    await request(app).delete(item).set('Authorization', outsider).expect(404);
    await request(app).delete(item).set('Authorization', token).expect(200);
    await request(app).get(item).set('Authorization', token).expect(404);
    await request(app).get(`${item}/download`).set('Authorization', token).expect(404);
    expect((await ResumeModel.findByPk(resume.id, { paranoid: false }))?.deletedAt).toBeInstanceOf(
      Date,
    );
    expect(await readdir(directory)).toHaveLength(1);
  });

  it('rejects unsupported, malformed, empty, encrypted, and oversized uploads without writing files', async () => {
    const token = await owner();
    const cases = [
      [pdf('Text'), 'Resume.txt', pdfMime, 415, 'RESUME_UNSUPPORTED_TYPE'],
      [pdf('Text'), 'Resume.docx', pdfMime, 415, 'RESUME_UNSUPPORTED_TYPE'],
      [Buffer.from('%PDF-1.7 corrupt'), 'Resume.pdf', pdfMime, 422, 'RESUME_UNREADABLE'],
      [Buffer.alloc(0), 'Resume.pdf', pdfMime, 422, 'RESUME_UNREADABLE'],
      [pdf(''), 'Resume.pdf', pdfMime, 422, 'RESUME_NO_TEXT'],
      [zip({ 'sample.txt': 'Not Word' }), 'Resume.docx', docxMime, 422, 'RESUME_UNREADABLE'],
      [docx('<invalid>'), 'Resume.docx', docxMime, 422, 'RESUME_UNREADABLE'],
      [Buffer.from('d0cf11e0a1b11ae1', 'hex'), 'Resume.docx', docxMime, 422, 'RESUME_ENCRYPTED'],
      [Buffer.alloc(maxResumeBytes + 1), 'Resume.pdf', pdfMime, 413, 'RESUME_TOO_LARGE'],
    ] as const;
    for (const [content, filename, mimeType, status, code] of cases) {
      const result = await upload(token, content, filename, mimeType).expect(status);
      expect((result.body as ApiResponse<never>).error?.code).toBe(code);
    }
    expect(await ResumeModel.count()).toBe(0);
    expect(await readdir(directory)).toEqual([]);
  });

  it('rejects a path supplied in the raw multipart filename', async () => {
    const token = await owner();
    const body = Buffer.concat([
      Buffer.from(
        `--resume-test\r\nContent-Disposition: form-data; name="title"\r\n\r\nResume\r\n--resume-test\r\nContent-Disposition: form-data; name="file"; filename="../Resume.pdf"\r\nContent-Type: ${pdfMime}\r\n\r\n`,
      ),
      pdf('Private text'),
      Buffer.from('\r\n--resume-test--\r\n'),
    ]);
    const result = await request(app)
      .post(url)
      .set('Authorization', token)
      .set('Content-Type', 'multipart/form-data; boundary=resume-test')
      .send(body)
      .expect(400);
    expect((result.body as ApiResponse<never>).error?.code).toBe('RESUME_INVALID_FILENAME');
    expect(await readdir(directory)).toEqual([]);
  });

  it('cleans up after a failed metadata insert and sanitizes storage errors', async () => {
    const token = await owner();
    const failure = new Error('private/path Private PDF resume');
    const create = vi.spyOn(ResumeModel, 'create').mockRejectedValueOnce(failure);
    const failed = await upload(token, pdf('Private PDF resume')).expect(500);
    expect(failed.text).not.toContain('private/path');
    expect(failed.text).not.toContain('Private PDF resume');
    expect(await ResumeModel.count()).toBe(0);
    expect(await readdir(directory)).toEqual([]);
    create.mockRestore();
    vi.spyOn(LocalResumeStorage.prototype, 'put').mockRejectedValueOnce(failure);
    await upload(token, pdf('Private PDF resume')).expect(500);
    expect(await ResumeModel.count()).toBe(0);
    expect(await readdir(directory)).toEqual([]);
    const resume = await uploaded(token, pdf('Private PDF resume'));
    vi.spyOn(LocalResumeStorage.prototype, 'open').mockRejectedValueOnce(failure);
    const download = await request(app)
      .get(`${url}/${resume.id}/download`)
      .set('Authorization', token)
      .expect(500);
    expect((download.body as ApiResponse<never>).error?.code).toBe('RESUME_STORAGE_ERROR');
    expect(download.text).not.toContain('private/path');
  });
});
