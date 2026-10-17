// Le corps accepte par « valider et signer ».
//
// **Le schema etait `.strict()` et `idOrdonnances` n'y figurait pas**, alors
// que `validerConsultation` le lit pour signer les ordonnances choisies. Toute
// requete portant cette cle etait rejetee en bloc.
//
// Le front, de son cote, envoyait `diagnosticConfirme` et `commentaires` :
// deux noms qui n'existent sur aucun endpoint, sous un `@ts-ignore` et un
// commentaire « adapter selon l'implementation backend reelle ». Resultat :
// **400 a chaque validation**, dans le seul ecran ou le medecin peut signer.
// `ValiderConsultationDto` (shared-types) decrivait le bon contrat.
import { validerConsultationSchema } from '../src/validators/api.schemas';

describe('le corps de la validation', () => {
  it('accepte les ordonnances a signer', () => {
    const r = validerConsultationSchema.safeParse({
      notesMedecin: 'Paludisme simple confirme.',
      idOrdonnances: ['ord-1', 'ord-2'],
    });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.idOrdonnances).toEqual(['ord-1', 'ord-2']);
  });

  it('accepte une validation sans note ni ordonnance', () => {
    expect(validerConsultationSchema.safeParse({}).success).toBe(true);
  });

  // Les trois champs que le front inventait.
  it.each(['diagnosticConfirme', 'commentaires', 'ajustementTraitement'])(
    'refuse %s, qui n existe sur aucun endpoint',
    (cle) => {
      expect(validerConsultationSchema.safeParse({ [cle]: 'CONFIRME' }).success).toBe(false);
    },
  );

  // Le corps exact que l'ecran envoyait : il echouait en entier.
  it('refuse l ancien corps de l ecran de validation', () => {
    expect(validerConsultationSchema.safeParse({
      diagnosticConfirme: 'CONFIRME',
      commentaires: 'ok',
      idOrdonnances: ['ord-1'],
    }).success).toBe(false);
  });

  // Et le corps corrige passe.
  it('accepte le corps corrige', () => {
    expect(validerConsultationSchema.safeParse({
      notesMedecin: 'ok',
      idOrdonnances: ['ord-1'],
    }).success).toBe(true);
  });

  it('refuse une liste d ordonnances qui n en est pas une', () => {
    expect(validerConsultationSchema.safeParse({ idOrdonnances: 'ord-1' }).success).toBe(false);
    expect(validerConsultationSchema.safeParse({ idOrdonnances: [''] }).success).toBe(false);
  });
});
