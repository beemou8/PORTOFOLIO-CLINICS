import { randomUUID } from 'node:crypto';
import { mkdir, unlink, writeFile } from 'node:fs/promises';
import path from 'node:path';

const DEFAULT_UPLOAD_DIR = 'uploads';
export const UPLOAD_ROOT = path.resolve(process.cwd(), process.env.UPLOAD_DIR || DEFAULT_UPLOAD_DIR);
export const UPLOAD_URL_PREFIX = '/uploads';

export async function ensureUploadRoot() {
  await mkdir(UPLOAD_ROOT, { recursive: true });
}

const EXT_BY_MIME: Record<string, string> = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
};

function hasValidImageSignature(buffer: Buffer, mimeType: string) {
  if (mimeType === 'image/jpeg') {
    return buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
  }
  if (mimeType === 'image/png') {
    return buffer.length >= 8 && buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
  }
  if (mimeType === 'image/webp') {
    return buffer.length >= 12
      && buffer.subarray(0, 4).toString('ascii') === 'RIFF'
      && buffer.subarray(8, 12).toString('ascii') === 'WEBP';
  }
  return false;
}

export async function saveLocalImage(options: {
  subdir: string;
  filePrefix: string;
  mimeType: string;
  dataBase64: string;
  maxBytes?: number;
}) {
  const { subdir, filePrefix, mimeType, dataBase64, maxBytes = 5 * 1024 * 1024 } = options;
  const ext = EXT_BY_MIME[mimeType];
  if (!ext) throw new Error('Foto harus JPG, PNG, atau WEBP.');

  const buffer = Buffer.from(dataBase64, 'base64');
  if (!buffer.length || buffer.length > maxBytes) {
    throw new Error(`Ukuran foto maksimal ${Math.floor(maxBytes / 1024 / 1024)} MB.`);
  }
  if (!hasValidImageSignature(buffer, mimeType)) {
    throw new Error('Isi file tidak sesuai format foto yang dipilih.');
  }

  const safeSubdir = subdir.replace(/[^a-zA-Z0-9_-]/g, '');
  const safePrefix = filePrefix.replace(/[^a-zA-Z0-9_-]/g, '-');
  const targetDir = path.join(UPLOAD_ROOT, safeSubdir);
  await mkdir(targetDir, { recursive: true });

  const fileName = `${safePrefix}-${randomUUID()}${ext}`;
  const absolutePath = path.join(targetDir, fileName);
  await writeFile(absolutePath, buffer, { flag: 'wx' });

  return {
    absolutePath,
    publicUrl: `${UPLOAD_URL_PREFIX}/${safeSubdir}/${fileName}`,
  };
}

export async function deleteLocalUpload(publicUrl?: string | null) {
  if (!publicUrl || !publicUrl.startsWith(`${UPLOAD_URL_PREFIX}/`)) return;

  const relative = publicUrl.slice(`${UPLOAD_URL_PREFIX}/`.length);
  const absolute = path.resolve(UPLOAD_ROOT, relative);
  const relativeCheck = path.relative(UPLOAD_ROOT, absolute);
  if (relativeCheck.startsWith('..') || path.isAbsolute(relativeCheck)) return;

  try {
    await unlink(absolute);
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;
    if (code !== 'ENOENT') console.warn(`Gagal menghapus file upload lama: ${absolute}`, error);
  }
}
