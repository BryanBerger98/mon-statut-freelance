/**
 * ACRE dégressive — shared band primitive for the "réel" variants: TNS réel
 * (ei-reel / eurl-*) and the SASU président assimilé-salarié (spec §D.5 +
 * `.claude/docs/business/regulatory/acre-assimile-salarie-verdict.md`).
 *
 * Full `tauxExo` while the assiette ≤ `plafondPleinPass × PASS`, linearly degressive
 * to 0 at `plafondNulPass × PASS`, then nil above. The two réel variants share the
 * same band shape (décret CSS D131-6-1) and differ only by their `tauxExo` constant.
 * Micro ACRE (acre.ts) is a separate, date-conditioned flat rate and does NOT use this.
 */
import { ACRE_ASSIMILE_TAUX_EXO, ACRE_REEL_DEGRESSIVITE_PLAFOND_PASS, ACRE_REEL_PLAFOND_REVENU_PASS, PASS_ANNUEL } from '../constants';

type AcreDegressiveExoTauxInput = {
  assiette: number;
  tauxExo: number;
  plafondPleinPass: number;
  plafondNulPass: number;
};

/**
 * Resolves a degressive ACRE exonération rate from its band parameters.
 * @param input the assiette, the full-band rate, and the plein / nul PASS plafonds
 * @returns the exonération rate in [0, tauxExo] (full ≤ plein, 0 ≥ nul, linear between)
 */
export const acreDegressiveExoTaux = (input: AcreDegressiveExoTauxInput): number => {
  const { assiette, tauxExo, plafondPleinPass, plafondNulPass } = input;
  const plafondPlein = plafondPleinPass * PASS_ANNUEL;
  const plafondNul = plafondNulPass * PASS_ANNUEL;
  if (assiette <= plafondPlein) return tauxExo;
  if (assiette >= plafondNul) return 0;
  const coeff = (plafondNul - assiette) / (plafondNul - plafondPlein);
  return tauxExo * coeff;
};

/**
 * Degressive ACRE rate for a SASU président assimilé-salarié (firstYear), tested on brut.
 * @param brut the gross annual salary used as the ACRE revenu test (euros)
 * @returns the exonération rate in [0, ACRE_ASSIMILE_TAUX_EXO]
 */
export const acreAssimileExoTaux = (brut: number): number =>
  acreDegressiveExoTaux({
    assiette: brut,
    tauxExo: ACRE_ASSIMILE_TAUX_EXO,
    plafondPleinPass: ACRE_REEL_PLAFOND_REVENU_PASS,
    plafondNulPass: ACRE_REEL_DEGRESSIVITE_PLAFOND_PASS,
  });
