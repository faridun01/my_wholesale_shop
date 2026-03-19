import fs from 'fs';
import multer from 'multer';
import path from 'path';
import { fileURLToPath } from 'url';
import { securityConfig } from '../config/security.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const uploadsDir = path.resolve(__dirname, '../../uploads');

if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

const imageMimeTypes = new Set(['image/jpeg', 'image/png', 'image/webp']);
const ocrMimeTypes = new Set([...imageMimeTypes, 'application/pdf']);

const buildStorage = () =>
  multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, uploadsDir),
    filename: (_req, file, cb) => {
      const extension = path.extname(file.originalname || '').toLowerCase();
      cb(null, `${crypto.randomUUID()}${extension}`);
    },
  });

const createFileFilter =
  (allowedMimeTypes: Set<string>) =>
  (_req: Express.Request, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
    if (!allowedMimeTypes.has(file.mimetype)) {
      return cb(new Error('Unsupported file type'));
    }

    cb(null, true);
  };

export const imageUpload = multer({
  storage: buildStorage(),
  limits: { fileSize: securityConfig.upload.maxImageBytes, files: 1 },
  fileFilter: createFileFilter(imageMimeTypes),
});

export const ocrUpload = multer({
  storage: buildStorage(),
  limits: { fileSize: securityConfig.upload.maxDocumentBytes, files: 1 },
  fileFilter: createFileFilter(ocrMimeTypes),
});
