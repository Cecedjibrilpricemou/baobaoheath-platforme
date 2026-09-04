import { Router, Request, Response, NextFunction } from 'express';
import multer from 'multer';
import { authenticate } from '../middlewares/auth.middleware';
import { uploadAvatar } from '../middlewares/upload.middleware';
import { uploadAvatarController } from '../controllers/upload.controller';
import { ValidationError } from '../utils/app-error';

const router = Router();

router.use(authenticate);

router.post('/avatar', (req: Request, res: Response, next: NextFunction) => {
  uploadAvatar(req, res, (err: unknown) => {
    if (err) {
      const message =
        err instanceof multer.MulterError && err.code === 'LIMIT_FILE_SIZE'
          ? 'Image trop volumineuse (3 Mo maximum).'
          : err instanceof Error
            ? err.message
            : 'Échec du téléversement.';
      next(new ValidationError(message));
      return;
    }
    next();
  });
}, uploadAvatarController);

export default router;
