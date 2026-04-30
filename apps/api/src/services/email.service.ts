// src/services/email.service.ts
import nodemailer from 'nodemailer';

// ── Transporter Gmail ─────────────────────────────────────────────
const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.GMAIL_USER,
        pass: process.env.GMAIL_APP_PASSWORD
    }
});

// ── Email de bienvenue pour un admin de structure ─────────────────
export async function envoyerEmailAdminStructure(dto: {
    destinataire: string;
    prenomNom: string;
    nomStructure: string;
    telephone: string;
    motDePasseTemporaire: string;
}): Promise<void> {
    const html = `
<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Vos identifiants BaoBaoHealth</title>
</head>
<body style="margin:0;padding:0;background:#f4f6f8;font-family:'Segoe UI',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f6f8;padding:40px 20px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 4px 20px rgba(0,0,0,0.08);">

          <!-- Header -->
          <tr>
            <td style="background:linear-gradient(135deg,#0B2618 0%,#1B5E35 100%);padding:40px 40px 30px;text-align:center;">
              <div style="font-size:36px;margin-bottom:10px;">🌳</div>
              <h1 style="color:#ffffff;margin:0;font-size:24px;font-weight:800;letter-spacing:-0.5px;">BaoBaoHealth</h1>
              <p style="color:rgba(255,255,255,0.7);margin:6px 0 0;font-size:13px;">La santé numérique au service de la Guinée 🇬🇳</p>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding:40px;">
              <h2 style="color:#1B5E35;font-size:20px;margin:0 0 16px;font-weight:700;">Bienvenue, ${dto.prenomNom} !</h2>
              <p style="color:#444;font-size:15px;line-height:1.6;margin:0 0 20px;">
                Votre compte <strong>Administrateur de structure</strong> a été créé sur la plateforme BaoBaoHealth.
                Vous êtes désormais responsable de la structure suivante :
              </p>

              <!-- Structure -->
              <div style="background:#f0fdf4;border:1px solid #86efac;border-radius:8px;padding:16px 20px;margin:0 0 24px;">
                <p style="margin:0;color:#15803d;font-size:14px;font-weight:600;">🏥 ${dto.nomStructure}</p>
              </div>

              <p style="color:#444;font-size:15px;line-height:1.6;margin:0 0 24px;">
                Voici vos identifiants de connexion. <strong>Conservez-les précieusement.</strong>
              </p>

              <!-- Identifiants -->
              <table width="100%" cellpadding="0" cellspacing="0" style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;overflow:hidden;margin:0 0 24px;">
                <tr>
                  <td style="padding:14px 20px;border-bottom:1px solid #e2e8f0;">
                    <span style="color:#64748b;font-size:12px;font-weight:600;text-transform:uppercase;letter-spacing:0.5px;">Téléphone</span><br>
                    <strong style="color:#1e293b;font-size:16px;">${dto.telephone}</strong>
                  </td>
                </tr>
                <tr>
                  <td style="padding:14px 20px;">
                    <span style="color:#64748b;font-size:12px;font-weight:600;text-transform:uppercase;letter-spacing:0.5px;">Mot de passe temporaire</span><br>
                    <strong style="color:#1B5E35;font-size:20px;font-family:monospace;letter-spacing:2px;">${dto.motDePasseTemporaire}</strong>
                  </td>
                </tr>
              </table>

              <!-- Alerte -->
              <div style="background:#fffbeb;border:1px solid #fcd34d;border-left:4px solid #f59e0b;border-radius:8px;padding:14px 18px;margin:0 0 24px;">
                <p style="margin:0;color:#92400e;font-size:13px;line-height:1.6;">
                  ⚠️ <strong>Important :</strong> Lors de votre première connexion, vous serez invité à changer ce mot de passe temporaire.
                </p>
              </div>

              <!-- CTA -->
              <div style="text-align:center;margin:0 0 32px;">
                <a href="http://localhost:4200/auth/login"
                   style="background:#1B5E35;color:#ffffff;padding:14px 32px;border-radius:8px;text-decoration:none;font-size:15px;font-weight:700;display:inline-block;">
                  Se connecter à BaoBaoHealth
                </a>
              </div>

              <p style="color:#94a3b8;font-size:13px;line-height:1.6;margin:0;">
                Si vous n'êtes pas à l'origine de cette demande ou si vous rencontrez des difficultés,
                contactez l'administrateur de la plateforme.
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background:#f8fafc;padding:20px 40px;text-align:center;border-top:1px solid #e2e8f0;">
              <p style="margin:0;color:#94a3b8;font-size:12px;">
                © 2026 BaoBaoHealth · Guinée 🇬🇳 · Tous droits réservés
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `;

    await transporter.sendMail({
        from: `"BaoBaoHealth 🌳" <${process.env.GMAIL_USER}>`,
        to: dto.destinataire,
        subject: `🏥 Vos identifiants BaoBaoHealth — ${dto.nomStructure}`,
        html
    });
}

// ── Email de bienvenue pour un agent (ASC, Médecin, Pharmacien) ───
export async function envoyerEmailAgent(dto: {
    destinataire: string;
    prenomNom: string;
    role: string;
    nomStructure: string;
    telephone: string;
    motDePasseTemporaire: string;
}): Promise<void> {
    const roleLabel: Record<string, string> = {
        'ASC': 'Agent de Santé Communautaire',
        'ASC_SUPERVISOR': 'Superviseur ASC',
        'MEDECIN': 'Médecin',
        'PHARMACIEN': 'Pharmacien'
    };

    const html = `
<!DOCTYPE html>
<html lang="fr">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#f4f6f8;font-family:'Segoe UI',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f6f8;padding:40px 20px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 4px 20px rgba(0,0,0,0.08);">
          <tr>
            <td style="background:linear-gradient(135deg,#0B2618 0%,#1B5E35 100%);padding:40px 40px 30px;text-align:center;">
              <div style="font-size:36px;margin-bottom:10px;">🌳</div>
              <h1 style="color:#ffffff;margin:0;font-size:24px;font-weight:800;">BaoBaoHealth</h1>
              <p style="color:rgba(255,255,255,0.7);margin:6px 0 0;font-size:13px;">La santé numérique au service de la Guinée 🇬🇳</p>
            </td>
          </tr>
          <tr>
            <td style="padding:40px;">
              <h2 style="color:#1B5E35;font-size:20px;margin:0 0 16px;font-weight:700;">Bienvenue, ${dto.prenomNom} !</h2>
              <p style="color:#444;font-size:15px;line-height:1.6;margin:0 0 20px;">
                Votre compte <strong>${roleLabel[dto.role] ?? dto.role}</strong> a été créé sur BaoBaoHealth
                pour la structure <strong>${dto.nomStructure}</strong>.
              </p>
              <table width="100%" cellpadding="0" cellspacing="0" style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;overflow:hidden;margin:0 0 24px;">
                <tr>
                  <td style="padding:14px 20px;border-bottom:1px solid #e2e8f0;">
                    <span style="color:#64748b;font-size:12px;font-weight:600;text-transform:uppercase;">Téléphone</span><br>
                    <strong style="color:#1e293b;font-size:16px;">${dto.telephone}</strong>
                  </td>
                </tr>
                <tr>
                  <td style="padding:14px 20px;">
                    <span style="color:#64748b;font-size:12px;font-weight:600;text-transform:uppercase;">Mot de passe temporaire</span><br>
                    <strong style="color:#1B5E35;font-size:20px;font-family:monospace;letter-spacing:2px;">${dto.motDePasseTemporaire}</strong>
                  </td>
                </tr>
              </table>
              <div style="background:#fffbeb;border:1px solid #fcd34d;border-left:4px solid #f59e0b;border-radius:8px;padding:14px 18px;margin:0 0 24px;">
                <p style="margin:0;color:#92400e;font-size:13px;">⚠️ <strong>Changez ce mot de passe</strong> lors de votre première connexion.</p>
              </div>
              <div style="text-align:center;margin:0 0 24px;">
                <a href="http://localhost:4200/auth/login" style="background:#1B5E35;color:#ffffff;padding:14px 32px;border-radius:8px;text-decoration:none;font-size:15px;font-weight:700;display:inline-block;">
                  Se connecter
                </a>
              </div>
            </td>
          </tr>
          <tr>
            <td style="background:#f8fafc;padding:20px 40px;text-align:center;border-top:1px solid #e2e8f0;">
              <p style="margin:0;color:#94a3b8;font-size:12px;">© 2026 BaoBaoHealth · Guinée 🇬🇳</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `;

    await transporter.sendMail({
        from: `"BaoBaoHealth 🌳" <${process.env.GMAIL_USER}>`,
        to: dto.destinataire,
        subject: `🌳 Vos identifiants BaoBaoHealth — ${dto.nomStructure}`,
        html
    });
}