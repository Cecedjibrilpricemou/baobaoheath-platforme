// Qui recrute l'encadrement de la plateforme.
//
// **`ADMIN_REGIONAL` et `ADMIN_NATIONAL` n'etaient creables par personne.**
// Ils figuraient dans l'enumeration des roles, dans les gardes de routes et
// dans les menus, mais aucun schema de l'application ne les acceptait : le
// seul moyen d'en obtenir un etait le jeu de donnees initial ou une insertion
// SQL directe.
//
// La consequence passait inapercue parce que la base de demonstration en
// porte un : en dehors d'elle, un unique super administrateur tenait toute la
// plateforme. Et comme c'est a l'encadrement qu'il revient de recruter les
// livreurs, lui seul pouvait le faire aussi.
import { creerAdministrateur, listerAdministrateurs } from '../src/services/administrateur-recrutement.service';
import type { JwtPayload } from '../src/types/auth.types';
import { ConflictError, ForbiddenError } from '../src/utils/app-error';
import { Role } from '../src/config/generated/client/client';

jest.mock('../src/config/prisma', () => ({
  prisma: {
    utilisateur: { create: jest.fn(), findFirst: jest.fn(), findMany: jest.fn() },
  },
}));
jest.mock('../src/utils/password.utils', () => ({
  hashPassword: jest.fn().mockResolvedValue('empreinte'),
}));
jest.mock('../src/services/admin-structure.service', () => ({
  genererMotDePasseTemp: jest.fn().mockReturnValue('BaoBao@Demo123'),
}));

type M = jest.Mock;
const { prisma } = jest.requireMock('../src/config/prisma') as {
  prisma: { utilisateur: { create: M; findFirst: M; findMany: M } };
};

const SUPER: JwtPayload = { userId: 'su-1', role: Role.SUPER_ADMIN, sessionId: 's' };
const NATIONAL: JwtPayload = { userId: 'an-1', role: Role.ADMIN_NATIONAL, sessionId: 's' };
const REGIONAL: JwtPayload = { userId: 'ar-1', role: Role.ADMIN_REGIONAL, sessionId: 's' };
const STRUCTURE: JwtPayload = { userId: 'as-1', role: Role.ADMIN_STRUCTURE, sessionId: 's' };

const DTO = {
  prenom: 'Aissatou',
  nom: 'Barry',
  telephone: '620100030',
  email: 'Aissatou.Barry@Sante.GN',
  role: 'ADMIN_REGIONAL' as const,
};

const CREE = {
  id: 'u-neuf', prenom: 'Aissatou', nom: 'Barry', telephone: '620100030',
  email: 'aissatou.barry@sante.gn', role: Role.ADMIN_REGIONAL,
  estActif: true, creeLe: new Date('2026-10-28T10:00:00Z'),
};

beforeEach(() => {
  jest.clearAllMocks();
  prisma.utilisateur.findFirst.mockResolvedValue(null);
  prisma.utilisateur.create.mockResolvedValue(CREE);
  prisma.utilisateur.findMany.mockResolvedValue([CREE]);
});

describe('qui a le droit de recruter', () => {
  it('le super administrateur, et lui seul', async () => {
    const r = await creerAdministrateur(SUPER, DTO);
    expect(r.administrateur.role).toBe('ADMIN_REGIONAL');
    expect(prisma.utilisateur.create).toHaveBeenCalled();
  });

  // **Un administrateur national qui nommerait ses pairs se donnerait des
  // collegues sans que personne l'ait decide.** La plateforme perdrait la
  // trace de qui tient les cles.
  it.each([
    ['un administrateur national', NATIONAL],
    ['un administrateur regional', REGIONAL],
    ['un administrateur de structure', STRUCTURE],
  ])('refuse %s', async (_libelle, qui) => {
    await expect(creerAdministrateur(qui, DTO)).rejects.toThrow(ForbiddenError);
    expect(prisma.utilisateur.create).not.toHaveBeenCalled();
  });

  it('refuse aussi la lecture de la liste a qui n est pas super administrateur', async () => {
    await expect(listerAdministrateurs(NATIONAL)).rejects.toThrow(ForbiddenError);
    expect(prisma.utilisateur.findMany).not.toHaveBeenCalled();
  });
});

describe('ce que la creation pose', () => {
  it('cree un compte sans etablissement : son perimetre est la plateforme', async () => {
    await creerAdministrateur(SUPER, DTO);
    const data = prisma.utilisateur.create.mock.calls[0]?.[0].data as { idStructure: unknown };
    expect(data.idStructure).toBeNull();
  });

  // Le mot de passe temporaire ne vaut que pour la premiere connexion.
  it('impose le changement du mot de passe, et le rend une fois', async () => {
    const r = await creerAdministrateur(SUPER, DTO);
    const data = prisma.utilisateur.create.mock.calls[0]?.[0].data as { doitChangerMotDePasse: boolean };
    expect(data.doitChangerMotDePasse).toBe(true);
    expect(r.motDePasseTemporaire).toBe('BaoBao@Demo123');
  });

  // **L'email est son identifiant de connexion** : tout compte qui n'est ni
  // PATIENT ni LIVREUR se connecte par email. Il est normalise, sans quoi
  // `Aissatou.Barry@Sante.GN` et `aissatou.barry@sante.gn` feraient deux
  // comptes pour une seule personne.
  it('normalise l adresse email en minuscules', async () => {
    await creerAdministrateur(SUPER, DTO);
    const data = prisma.utilisateur.create.mock.calls[0]?.[0].data as { email: string };
    expect(data.email).toBe('aissatou.barry@sante.gn');
  });

  it('ne rend jamais l empreinte du mot de passe', async () => {
    const r = await creerAdministrateur(SUPER, DTO);
    expect(JSON.stringify(r.administrateur)).not.toContain('empreinte');
  });
});

describe('les doublons', () => {
  it('refuse un telephone deja pris, en le nommant', async () => {
    prisma.utilisateur.findFirst.mockResolvedValue({ telephone: DTO.telephone, email: 'autre@sante.gn' });
    await expect(creerAdministrateur(SUPER, DTO)).rejects.toThrow(/telephone/i);
    expect(prisma.utilisateur.create).not.toHaveBeenCalled();
  });

  it('refuse une adresse email deja prise, en la nommant', async () => {
    prisma.utilisateur.findFirst.mockResolvedValue({ telephone: '620100099', email: 'aissatou.barry@sante.gn' });
    await expect(creerAdministrateur(SUPER, DTO)).rejects.toThrow(ConflictError);
    await expect(creerAdministrateur(SUPER, DTO)).rejects.toThrow(/email/i);
  });
});

describe('les roles que ce service ne cree pas', () => {
  // Il recrute l'encadrement, pas des comptes metier ni des pairs.
  it.each(['SUPER_ADMIN', 'MEDECIN', 'PATIENT', 'LIVREUR'])('refuse %s', async (role) => {
    await expect(
      creerAdministrateur(SUPER, { ...DTO, role: role as never }),
    ).rejects.toThrow(ForbiddenError);
    expect(prisma.utilisateur.create).not.toHaveBeenCalled();
  });
});

describe('la liste', () => {
  it('ne porte que les deux roles d encadrement', async () => {
    await listerAdministrateurs(SUPER);
    const appel = prisma.utilisateur.findMany.mock.calls[0]?.[0] as {
      where: { role: { in: string[] } };
    };
    expect(appel.where.role.in.slice().sort()).toEqual(['ADMIN_NATIONAL', 'ADMIN_REGIONAL']);
  });
});
