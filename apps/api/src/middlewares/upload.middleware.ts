import multer from 'multer';
import path from 'path';
import fs from 'fs';

const AVATARS_DIR = path.join(process.cwd(), 'uploads', 'avatars');
fs.mkdirSync(AVATARS_DIR, { recursive: true });

export const TYPES_IMAGE_ACCEPTES = ['image/jpeg', 'image/png', 'image/webp'];

// Stockage en mémoire : l'image est redimensionnée par sharp avant d'être
// écrite sur disque, on n'écrit donc jamais l'original pleine résolution.
export const uploadAvatar = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 3 * 1024 * 1024, files: 1 },
  fileFilter: (_req, file, cb) => {
    if (!TYPES_IMAGE_ACCEPTES.includes(file.mimetype)) {
      cb(new Error('Format non supporté — utilisez une image JPEG, PNG ou WebP.'));
      return;
    }
    cb(null, true);
  },
}).single('photo');

export const AVATARS_PUBLIC_PATH = '/uploads/avatars';
export { AVATARS_DIR };
