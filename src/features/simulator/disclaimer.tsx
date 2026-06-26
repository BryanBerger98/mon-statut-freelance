/**
 * Mandatory result disclaimer (product-spec §C.5, verbatim). Every figures surface
 * must show it (CLAUDE.md working rules: every result is an estimate, not advice).
 */

export type DisclaimerProps = {
  /** Optional layout classes (spacing only). */
  className?: string;
};

const Disclaimer = ({ className }: DisclaimerProps) => (
  <p className={`text-xs text-muted-foreground ${className ?? ''}`.trim()}>
    Estimation indicative pour l'année 2026, calculée à partir des chiffres que vous avez saisis. Ce résultat ne constitue pas un conseil
    juridique ou fiscal personnalisé.
  </p>
);

export default Disclaimer;
