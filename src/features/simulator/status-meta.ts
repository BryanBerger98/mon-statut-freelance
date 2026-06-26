import type { StatusId } from '@/domain/validation';

/**
 * User-facing French display data for one status — labels, description, social
 * regime, fiscalité, the creation path (parcours), and the key pros/cons.
 *
 * SOURCE: distilled from the design-time `status-reference` fiches in
 * `.claude/docs/business/statuses/<id>.md`. This is presentation copy only — it
 * holds NO numbers (rates/seuils live in `src/domain/constants.ts`) and NO
 * computation. The simulator reads it to render the ranking cards, the setup
 * path (product-spec §C.3) and the status pages.
 */
export type StatusMeta = {
  /** Canonical status id (matches the calc engine). */
  id: StatusId;
  /** Short FR display name (e.g. « EURL à l'IS »). */
  label: string;
  /** One-sentence FR description of who/what the status is for. */
  tagline: string;
  /** Régime social, short FR label (TNS / Assimilé-salarié / Salarié). */
  regimeSocial: string;
  /** How profit/income is taxed, short FR phrase. */
  fiscalite: string;
  /** Ordered FR creation steps (« Comment créer ce statut ? », product-spec §C.3). */
  setupSteps: readonly string[];
  /** Key FR strengths (reason copy on the status page). */
  avantages: readonly string[];
  /** Key FR drawbacks/limits. */
  inconvenients: readonly string[];
};

/**
 * Per-status FR display data, keyed by `StatusId`. Full (non-Partial) record so
 * TS enforces all 7 statuses are present.
 */
export const STATUS_META: Record<StatusId, StatusMeta> = {
  'micro-entreprise': {
    id: 'micro-entreprise',
    label: 'Micro-entreprise',
    tagline: 'Le régime le plus simple pour démarrer solo : cotisations au prorata du CA, zéro comptabilité lourde.',
    regimeSocial: 'TNS (travailleur non salarié)',
    fiscalite: 'Impôt sur le revenu (barème progressif) sur le CA après abattement forfaitaire',
    setupSteps: [
      "Déclarer le début d'activité sur le guichet unique (formalites.entreprises.gouv.fr)",
      'Obtenir automatiquement un SIREN/SIRET (immatriculation au RNE)',
      'Affiliation URSSAF/SSI déclenchée automatiquement à la déclaration',
      "(Optionnel) Demander l'ACRE si éligible auprès de l'URSSAF",
      'Ouvrir un compte bancaire dédié si le CA dépasse le seuil deux années de suite',
      '(Selon activité) Souscrire les assurances professionnelles requises',
    ],
    avantages: [
      'Création gratuite et quasi-immédiate, sans capital ni statuts',
      'Cotisations proportionnelles au CA : pas de CA, pas de charges',
      'Comptabilité allégée (livre des recettes uniquement, sans liasse fiscale)',
      "Option versement libératoire pour lisser le paiement de l'IR",
    ],
    inconvenients: [
      'Cotisations et IR calculés sur le CA, pas sur le bénéfice réel — défavorable si les charges sont élevées',
      "Plafond de chiffre d'affaires au-delà duquel le régime ne s'applique plus",
      'Aucune assurance chômage ; droits à la retraite conditionnés au niveau de CA',
      "TVA non récupérable sur les achats tant que la franchise en base s'applique",
    ],
  },
  'ei-reel': {
    id: 'ei-reel',
    label: 'EI au réel',
    tagline: "L'entreprise individuelle avec déduction des charges réelles, idéale quand les dépenses professionnelles sont élevées.",
    regimeSocial: 'TNS (travailleur non salarié)',
    fiscalite: 'Impôt sur le revenu (barème progressif) sur le bénéfice réel (BIC ou BNC)',
    setupSteps: [
      "Déclarer le début d'activité sur le guichet unique (formalites.entreprises.gouv.fr)",
      'Obtenir un SIREN/SIRET (immatriculation au RNE)',
      'Choisir le régime réel (simplifié ou normal) pour BIC ou BNC',
      'Affiliation URSSAF/SSI automatique dès la déclaration',
      "(Optionnel) Demander l'ACRE si éligible",
      'Ouvrir un compte bancaire dédié et faire appel à un expert-comptable',
      'Souscrire les assurances professionnelles nécessaires',
    ],
    avantages: [
      'Toutes les charges professionnelles réelles sont déductibles du bénéfice',
      'Même protection du patrimoine personnel que la micro-entreprise (loi 2022)',
      'Aucun capital, pas de statuts, pas de dépôt au greffe',
      "Option pour l'impôt sur les sociétés sans changer de forme juridique",
    ],
    inconvenients: [
      "Comptabilité complète obligatoire (liasse fiscale) : coût d'expert-comptable",
      "Régime TNS : pas d'assurance chômage, retraite via la SSI",
      "Tout le bénéfice est imposé à l'IR chaque année (sauf option IS)",
      'Cotisations minimales dues même en cas de bénéfice faible ou nul',
    ],
  },
  'eurl-ir': {
    id: 'eurl-ir',
    label: "EURL à l'IR",
    tagline: "Société unipersonnelle à responsabilité limitée avec transparence fiscale IR, idéale avant un éventuel passage à l'IS.",
    regimeSocial: 'TNS (travailleur non salarié)',
    fiscalite: 'Impôt sur le revenu (barème progressif) sur le bénéfice de la société — translucidité fiscale',
    setupSteps: [
      "Rédiger les statuts de l'EURL",
      'Déposer le capital social sur un compte bloqué (banque ou notaire)',
      "Publier un avis de constitution dans un support d'annonces légales",
      'Immatriculer la société via le guichet unique INPI (RCS + RNE)',
      'Déclarer les bénéficiaires effectifs',
      "Affiliation URSSAF/SSI du gérant (automatique à l'immatriculation)",
      "(Optionnel) Demander l'ACRE auprès de l'URSSAF",
    ],
    avantages: [
      'Responsabilité limitée aux apports (la société est une personne morale distincte)',
      'Cotisations TNS moins élevées que le régime assimilé-salarié pour un revenu équivalent',
      "Passage à l'IS facilité si la situation évolue (EURL à l'IS)",
      'Les déficits peuvent être imputés sur le revenu global du foyer',
    ],
    inconvenients: [
      "Formalités de création plus lourdes que l'EI (capital, annonce légale, RCS)",
      "TNS : pas d'assurance chômage ; cotisations minimales même en cas de bénéfice faible",
      "Tout le bénéfice est imposé à l'IR chaque année (pas de mécanisme de dividendes)",
      'Comptabilité complète et dépôt des comptes au greffe obligatoires',
    ],
  },
  'eurl-is': {
    id: 'eurl-is',
    label: "EURL à l'IS",
    tagline: "Société unipersonnelle à l'IS permettant d'arbitrer entre rémunération et dividendes, avec des cotisations TNS.",
    regimeSocial: 'TNS (travailleur non salarié)',
    fiscalite: 'Impôt sur les sociétés + dividendes imposés au PFU ou au barème IR',
    setupSteps: [
      "Rédiger les statuts de l'EURL en mentionnant l'option IS",
      'Déposer le capital social sur un compte bloqué',
      "Publier un avis de constitution dans un support d'annonces légales",
      'Immatriculer la société via le guichet unique INPI (RCS + RNE)',
      'Déclarer les bénéficiaires effectifs',
      "Notifier l'option IS au Service des impôts des entreprises (SIE)",
      "Affiliation URSSAF/SSI du gérant (automatique à l'immatriculation)",
    ],
    avantages: [
      'Arbitrage rémunération/dividendes : les bénéfices peuvent être conservés dans la société',
      'Cotisations TNS plus faibles que le régime assimilé-salarié sur la rémunération',
      'Responsabilité limitée aux apports',
      'Un capital social élevé réduit mécaniquement la part des dividendes soumise aux cotisations',
    ],
    inconvenients: [
      'Les dividendes dépassant un seuil (10 % du capital + primes + comptes courants) sont soumis aux cotisations TNS',
      'Option IS irrévocable passé le délai de renonciation glissant',
      'Comptabilité IS complète + dépôt des comptes au greffe ; expert-comptable indispensable',
      "Pas d'assurance chômage (TNS) ; cotisations minimales même sans rémunération versée",
    ],
  },
  'sasu-ir': {
    id: 'sasu-ir',
    label: "SASU à l'IR",
    tagline: 'SASU avec option IR temporaire, utile pour imputer les déficits sur le revenu du foyer en phase de démarrage.',
    regimeSocial: 'Assimilé-salarié',
    fiscalite: 'Impôt sur le revenu (barème progressif) sur le résultat de la société — option temporaire et limitée dans le temps',
    setupSteps: [
      "Rédiger les statuts de la SASU et exercer l'option IR (art. 239 bis AB CGI)",
      'Déposer le capital social sur un compte bloqué',
      "Publier un avis de constitution dans un support d'annonces légales",
      'Immatriculer la société via le guichet unique INPI (RCS + RNE)',
      'Déclarer les bénéficiaires effectifs',
      "Notifier l'option IR au Service des impôts des entreprises (SIE)",
      'Affilier le président au régime général (URSSAF/DSN) dès sa rémunération',
    ],
    avantages: [
      'Responsabilité limitée et grande liberté statutaire propre à la SAS',
      'Déficits imputables sur le revenu du foyer fiscal en phase de lancement',
      'Protection sociale complète du régime général (maladie, retraite Agirc-Arrco, prévoyance cadre)',
      "Pas de cotisations si aucune rémunération n'est versée",
    ],
    inconvenients: [
      "Option IR limitée dans le temps, avec retour automatique à l'IS à l'échéance",
      "Pas d'assurance chômage malgré le statut d'assimilé-salarié (absence de contrat de travail)",
      'Charges patronales élevées sur la rémunération (taux plein depuis 2026, sans réduction)',
      'Comptabilité complète, dépôt des comptes au greffe ; expert-comptable nécessaire',
    ],
  },
  'sasu-is': {
    id: 'sasu-is',
    label: "SASU à l'IS",
    tagline:
      'La SASU standard : protection sociale de cadre, dividendes sans cotisations sociales, structure évolutive pour lever des fonds.',
    regimeSocial: 'Assimilé-salarié',
    fiscalite: 'Impôt sur les sociétés + dividendes soumis aux prélèvements sociaux uniquement (PFU ou barème IR)',
    setupSteps: [
      'Rédiger les statuts de la SASU (IS de droit commun, aucune option à exercer)',
      'Déposer le capital social sur un compte bloqué',
      "Publier un avis de constitution dans un support d'annonces légales",
      'Immatriculer la société via le guichet unique INPI (RCS + RNE)',
      'Déclarer les bénéficiaires effectifs',
      'Affilier le président au régime général (URSSAF/DSN) dès sa rémunération',
      "(Optionnel) Demander l'ACRE auprès de l'URSSAF",
    ],
    avantages: [
      'Les dividendes ne supportent aucune cotisation sociale (uniquement prélèvements sociaux)',
      'Protection sociale complète du régime général (maladie, retraite Agirc-Arrco, prévoyance cadre)',
      "Pas de cotisations si aucune rémunération n'est versée",
      'Structure évolutive : la SASU peut accueillir des investisseurs en passant en SAS',
    ],
    inconvenients: [
      "Pas d'assurance chômage (assimilé-salarié sans contrat de travail)",
      'Charges patronales élevées sur la rémunération (taux plein depuis 2026, sans réduction générale)',
      'Une stratégie 100 % dividendes ne génère aucun droit à la retraite ni aux indemnités journalières',
      'Comptabilité IS complète, dépôt des comptes au greffe ; expert-comptable indispensable',
    ],
  },
  'portage-salarial': {
    id: 'portage-salarial',
    label: 'Portage salarial',
    tagline: 'Freelance avec statut salarié complet (chômage inclus) via une société de portage qui facture le client et verse un salaire.',
    regimeSocial: 'Salarié',
    fiscalite: "Salaire imposé à l'IR (barème progressif) comme traitements et salaires",
    setupSteps: [
      'Choisir une société de portage salarial (garantie financière + convention collective)',
      "Trouver et négocier la mission avec l'entreprise cliente",
      "Signer la convention d'adhésion et le contrat de travail en portage (CDI ou CDD)",
      'La société de portage signe le contrat de prestation et facture le client',
      'La société de portage prélève ses frais et cotisations, puis verse le salaire net',
    ],
    avantages: [
      "Protection sociale complète incluant l'assurance chômage (ARE entre les missions)",
      "Aucune structure à créer : pas d'immatriculation, pas de capital, pas de comptabilité",
      'Pas de responsabilité commerciale personnelle envers le client',
      'Réduction générale des cotisations patronales applicable (RGDU en 2026)',
    ],
    inconvenients: [
      'Revenu net généralement le plus faible des 7 statuts (frais de gestion + cotisations salariales et patronales)',
      "Aucun levier fiscal (pas de dividendes, pas d'IS, pas de déduction de charges)",
      'Réservé aux prestations intellectuelles ; certaines activités sont exclues',
      "Dépendance vis-à-vis de la société de portage pour la facturation et l'administration",
    ],
  },
};
