// The clinic's investigation (lab test) checklist — extracted verbatim from
// the practice's own reference list ("INV- DR NEHA"). Static reference data,
// same pattern as remedies.ts: a fixed catalog, not something stored per-
// clinic in the database.
export interface InvestigationCategory {
  category: string
  tests: string[]
}

export interface InvestigationEntry {
  test: string
  category: string
}

// Shared search helpers — used identically by the web and practitioner-app
// pickers so a fix to matching behavior (e.g. multi-word queries) never
// needs to be made twice. Deliberately prefix-of-word matching, not plain
// substring search: the client asked specifically for "search option
// starting words". Each word of the query is matched independently against
// the target's words, so a multi-word query like "vitamin d" still matches
// "Vitamin D", and a category name like "Thyroid" surfaces every test in
// that category even though none of their own names start with "thyroid".
export const wordsOf = (s: string) => s.toLowerCase().split(/[\s/,–-]+/).filter(Boolean)

export const matchesAllWords = (queryWords: string[], targetWords: string[]) =>
  queryWords.every((qw) => targetWords.some((tw) => tw.startsWith(qw)))

export const INVESTIGATION_CATALOG: InvestigationCategory[] = [
  {
    category: 'Haematology',
    tests: ['CBC', 'ESR', 'P.S. for M.P. – Peripheral Smear for Malaria Parasite', 'M.P. Rapid Antigen', 'Absolute Eosinophil Count', 'Platelet Count', 'Blood Group', 'G6PD'],
  },
  {
    category: 'Diabetic Profile',
    tests: ['Blood Sugar – Fasting / Post-prandial / Random', 'HbA1c', 'GTT – Glucose Tolerance Test', 'Insulin – Fasting / Post-prandial / 2 hrs post glucose', 'C Peptide – Fasting / Prandial (ng/mL)', 'GAD-AB', 'HOMA-IR'],
  },
  {
    category: 'Lipid Profile',
    tests: ['Total Cholesterol', 'HDL Cholesterol', 'LDL', 'Triglycerides', 'Lipoprotein A', 'Apolipoprotein – A1/B Ratio', 'Apolipoprotein – A1', 'Apolipoprotein – B', 'Apolipoprotein E'],
  },
  {
    category: 'Renal Function Tests',
    tests: ['Creatinine', 'Urea', 'Uric Acid', 'Calcium', 'Electrolytes', 'Bicarbonate', 'eGFR'],
  },
  {
    category: 'Liver Function Tests',
    tests: ['Serum Bilirubin – Total & Direct', 'SGPT', 'SGOT', 'GGTP', 'Alkaline Phosphatase', 'Serum Proteins'],
  },
  {
    category: 'Iron Studies',
    tests: ['Serum Iron', 'TIBC', 'Ferritin', 'Transferrin Saturation'],
  },
  {
    category: 'Vitamins',
    tests: ['Vitamin D', 'Vitamin B12', 'Folic Acid', 'Vitamin A', 'Vitamin E', 'Vitamin K'],
  },
  {
    category: 'Thyroid Profile',
    tests: ['T3, T4, TSH', 'TSH', 'FT3, FT4, TSH', 'USG Neck', 'Anti-TPO', 'Anti-Tg'],
  },
  {
    category: 'Scans',
    tests: ['USG Abdomen & Pelvis', 'X-ray', 'CT Scan', 'MRI Scan'],
  },
  {
    category: 'Cardiac Markers',
    tests: ['CPK-MB', 'Troponin-I', 'Troponin-T', 'NT-Pro BNP', 'ECG', '2D-ECHO'],
  },
  {
    category: 'Coagulation Tests',
    tests: ['BT / CT', 'PT / INR', 'APTT', 'Clotting Time', 'D-Dimer'],
  },
  {
    category: 'Urine Examination',
    tests: ['Urine Routine & Microscopy', 'Urine C & S – Culture & Sensitivity', 'Urine Pregnancy Test', 'Urine Albumin Creatinine Ratio', 'Urine Microalbumin'],
  },
  {
    category: 'Stool Examination',
    tests: ['Stool Routine & Microscopy', 'Occult Blood (IFOB)', 'Stool C & S – Culture & Sensitivity'],
  },
  {
    category: 'Sputum Examination',
    tests: ['Sputum for AFB', 'Gram Stain', 'KOH', 'Sputum C & S – Culture & Sensitivity'],
  },
  {
    category: 'Serology Tests',
    tests: ['R.A. – Rheumatoid Arthritis Factor', 'ASO – Anti-Streptolysin O', 'CRP – C-Reactive Protein', 'Hs-CRP', 'HIV', 'HBsAg', 'Hepatitis B – Viral Load', 'VDRL', 'Widal (Slide)', 'Entrocheck', 'HCV', 'Dengue NS1 + IgG + IgM', 'Chikungunya', 'Leptospira', 'Mantoux Test (Tuberculin Test)', 'Homocysteine'],
  },
  {
    category: 'Special Tests',
    tests: ['LH / FSH / Prolactin', 'TORCH (All 8)', 'ANA', 'ANA Blot', 'Procalcitonin', 'Cortisol', 'Anti-CCP', 'HLA-B27', 'ADA', 'MTB', 'Beta-HCG', 'S. Immunoglobulin IgE', 'Widal Test', 'TB Gold', 'Pap Smear', 'Typhi Dot IgG', 'Typhi Dot IgM', 'ACTH', 'PTH', 'Anti-ds DNA', 'FNAC'],
  },
  {
    category: 'Biochemistry – Others',
    tests: ['Serum Phosphorous', 'Serum Magnesium', 'Serum Amylase', 'Serum Lipase', 'Serum Ammonia', 'Serum LDH', 'CPK – Total', 'Serum Cholinesterase'],
  },
  {
    category: 'Cancer Markers',
    tests: ['CA-125', 'CA 19-9', 'CEA', 'AFP', 'PSA', 'β-HCG'],
  },
  {
    category: 'Body Fluids',
    tests: ['Semen Analysis', 'Ascitic Fluid', 'Pleural Fluid', 'Synovial Fluid'],
  },
  {
    category: 'Others',
    tests: ['Blood Culture', 'Pus Culture'],
  },
  {
    category: 'Hormonal Assay',
    tests: ['Estradiol', 'Estrogen', 'Progesterone', 'Testosterone', 'LH', 'FSH', 'DHEA-S', 'SHBG', 'AMH', 'Prolactin', 'GH'],
  },
]

export const ALL_INVESTIGATIONS: InvestigationEntry[] = INVESTIGATION_CATALOG.flatMap((c) =>
  c.tests.map((test) => ({ test, category: c.category })),
)
