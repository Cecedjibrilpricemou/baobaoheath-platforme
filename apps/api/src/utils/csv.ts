// L'implementation vit desormais dans `@baobaoheath/shared-types` : le
// navigateur en a besoin pour fabriquer les fichiers d'impression, et deux
// copies des regles d'echappement divergeraient en silence.
//
// Ce relais evite de toucher aux appelants existants (journal, analytics,
// referentiels).
export { SEPARATEUR_CSV, BOM_UTF8, champCsv, enCsv } from '@baobaoheath/shared-types';
