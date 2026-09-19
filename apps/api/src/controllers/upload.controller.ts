import { Response } from 'express';
import path from 'path';
import { randomUUID } from 'crypto';
import sharp from 'sharp';
import { AuthRequest } from '../middlewares/auth.middleware';
import { ValidationError } from '../utils/app-error';
import { AVATARS_DIR, AVATARS_PUBLIC_PATH, LOGOS_DIR, LOGOS_PUBLIC_PATH } from '../middlewares/upload.middleware';
import { modifierLogo } from '../services/parametres.service';
import type { IdentitePlateformeView } from '@baobaoheath/shared-types';
import fs from 'fs/promises';

// Les avatars sont affichés au maximum à ~72px (hero profil patient) : on
// stocke en 256px pour rester net sur écrans haute densité sans imposer le
// téléchargement de l'original à chaque chargement de page — la plateforme
// cible des connexions à faible débit.
const TAILLE_AVATAR_PX = 256;

export async function uploadAvatarController(req: AuthRequest, res: Response): Promise<void> {
  if (!req.file) {
    throw new ValidationError('Aucune image reçue.');
  }

  const filename = `${req.user!.userId}-${Date.now()}-${randomUUID().slice(0, 8)}.webp`;

  try {
    await sharp(req.file.buffer)
      .rotate() // respecte l'orientation EXIF des photos prises au téléphone
      .resize(TAILLE_AVATAR_PX, TAILLE_AVATAR_PX, { fit: 'cover', position: 'centre' })
      .webp({ quality: 82 })
      .toFile(path.join(AVATARS_DIR, filename));
  } catch {
    throw new ValidationError("Image illisible ou corrompue.");
  }

  const url = `${req.protocol}://${req.get('host')}${AVATARS_PUBLIC_PATH}/${filename}`;
  res.status(200).json({ success: true, data: { url } });
}

// Le logo s'affiche dans la barre de navigation (~32px de haut) et dans les
// e-mails : 512px de large suffisent. On garde les proportions et la
// transparence (PNG) ; un SVG est conserve tel quel.
const LARGEUR_LOGO_PX = 512;

export async function uploadLogoController(req: AuthRequest, res: Response): Promise<void> {
  if (!req.file) {
    throw new ValidationError('Aucune image reçue.');
  }

  const estSvg = req.file.mimetype === 'image/svg+xml';
  const filename = `logo-${Date.now()}-${randomUUID().slice(0, 8)}.${estSvg ? 'svg' : 'png'}`;

  try {
    if (estSvg) {
      await fs.writeFile(path.join(LOGOS_DIR, filename), req.file.buffer);
    } else {
      await sharp(req.file.buffer)
        .rotate()
        .resize({ width: LARGEUR_LOGO_PX, height: LARGEUR_LOGO_PX, fit: 'inside', withoutEnlargement: true })
        .png({ compressionLevel: 9 })
        .toFile(path.join(LOGOS_DIR, filename));
    }
  } catch {
    throw new ValidationError('Image illisible ou corrompue.');
  }

  const logoUrl = `${req.protocol}://${req.get('host')}${LOGOS_PUBLIC_PATH}/${filename}`;
  const data: IdentitePlateformeView = await modifierLogo(req.user!.userId, logoUrl);
  res.status(200).json({ success: true, data });
}
