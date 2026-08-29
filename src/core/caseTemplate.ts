// ─────────────────────────────────────────────────────────────
// Case-taking template — "Chronic — adult" (6 sections).
// Shared by the web case sheet and the practitioner mobile case sheet.
// ─────────────────────────────────────────────────────────────

export type FieldType = 'textarea' | 'chips'

export interface CaseField {
  key: string
  label: string
  type: FieldType
  placeholder?: string
  options?: string[]
  multi?: boolean // chips: multi-select vs single-select
}

export interface CaseSectionDef {
  id: string
  title: string
  short: string
  icon: string // phosphor name
  fields: CaseField[]
}

export const CASE_SECTIONS: CaseSectionDef[] = [
  {
    id: 'chief',
    title: 'Chief complaint',
    short: 'Chief',
    icon: 'ph-target',
    fields: [
      {
        key: 'verbatim',
        label: "Patient's own words",
        type: 'textarea',
        placeholder: 'Record verbatim — the exact words carry the case.',
      },
      { key: 'duration', label: 'Duration & onset', type: 'textarea', placeholder: 'When did it start, and after what?' },
      {
        key: 'severity',
        label: 'Severity',
        type: 'chips',
        options: ['Mild', 'Moderate', 'Marked', 'Severe'],
      },
    ],
  },
  {
    id: 'history',
    title: 'History',
    short: 'History',
    icon: 'ph-clock-counter-clockwise',
    fields: [
      { key: 'hpc', label: 'History of presenting complaint', type: 'textarea' },
      { key: 'past', label: 'Past history', type: 'textarea' },
      { key: 'family', label: 'Family history', type: 'textarea' },
    ],
  },
  {
    id: 'modalities',
    title: 'Modalities',
    short: 'Modalities',
    icon: 'ph-arrows-left-right',
    fields: [
      {
        key: 'better',
        label: 'Better for',
        type: 'chips',
        multi: true,
        options: ['Warmth', 'Rest', 'Quiet', 'Open air', 'Firm pressure', 'Company', 'Eating'],
      },
      {
        key: 'worse',
        label: 'Worse for',
        type: 'chips',
        multi: true,
        options: ['Cold air', 'Coffee', 'Late nights', 'Noise', 'Before storms', 'Lying on left', 'Alcohol'],
      },
      { key: 'timeAgg', label: 'Time of aggravation', type: 'textarea', placeholder: 'e.g. worse 3–5am' },
    ],
  },
  {
    id: 'personal',
    title: 'Personal',
    short: 'Personal',
    icon: 'ph-drop-half',
    fields: [
      {
        key: 'thermals',
        label: 'Thermals & thirst',
        type: 'chips',
        multi: true,
        options: ['Chilly', 'Hot', 'Thirsty', 'Thirstless', 'Craves warm drinks'],
      },
      { key: 'appetite', label: 'Appetite, cravings & aversions', type: 'textarea' },
      { key: 'sleep', label: 'Sleep, dreams & perspiration', type: 'textarea' },
    ],
  },
  {
    id: 'mental',
    title: 'Mental & emotional',
    short: 'Mental',
    icon: 'ph-brain',
    fields: [
      { key: 'personality', label: 'Personality & disposition', type: 'textarea' },
      {
        key: 'fears',
        label: 'Fears & anxieties',
        type: 'chips',
        multi: true,
        options: ['Anticipation', 'Failure', 'Being alone', 'Loss of control', 'Health'],
      },
      { key: 'stress', label: 'Stress reactions & mood', type: 'textarea' },
    ],
  },
  {
    id: 'particulars',
    title: 'Physicals & particulars',
    short: 'Physicals',
    icon: 'ph-heartbeat',
    fields: [
      { key: 'generals', label: 'Physical generals', type: 'textarea' },
      { key: 'particulars', label: 'Particulars', type: 'textarea' },
      {
        key: 'systems',
        label: 'Systems reviewed',
        type: 'chips',
        multi: true,
        options: ['Digestive', 'Respiratory', 'Skin', 'Gynaecological', 'Musculoskeletal'],
      },
    ],
  },
]

export const ACUTE_SECTIONS: CaseSectionDef[] = [
  {
    id: 'chief',
    title: 'Chief complaint',
    short: 'Chief',
    icon: 'ph-target',
    fields: [
      { key: 'verbatim', label: "Patient's own words", type: 'textarea', placeholder: 'What happened? When did it start?' },
      { key: 'onset', label: 'Onset & cause', type: 'textarea', placeholder: 'Sudden or gradual? After exposure to cold, injury, fright?' },
      { key: 'severity', label: 'Severity', type: 'chips', options: ['Mild', 'Moderate', 'Marked', 'Severe'] },
    ],
  },
  {
    id: 'modalities',
    title: 'Modalities',
    short: 'Modalities',
    icon: 'ph-arrows-left-right',
    fields: [
      { key: 'better', label: 'Better for', type: 'chips', multi: true, options: ['Warmth', 'Rest', 'Cold application', 'Pressure', 'Open air', 'Bending double', 'Motion'] },
      { key: 'worse', label: 'Worse for', type: 'chips', multi: true, options: ['Touch', 'Motion', 'Cold', 'Heat', 'Night', 'Jarring', 'Lying on affected side'] },
      { key: 'timeAgg', label: 'Time of aggravation', type: 'textarea', placeholder: 'e.g. worse at 3am, evening, after midnight' },
    ],
  },
  {
    id: 'concomitants',
    title: 'Concomitants',
    short: 'Accomp.',
    icon: 'ph-link-simple',
    fields: [
      { key: 'accompanying', label: 'Accompanying symptoms', type: 'textarea', placeholder: 'Nausea, thirst, fever pattern, restlessness, discharges' },
      { key: 'thirst', label: 'Thirst', type: 'chips', options: ['Absent', 'Sips', 'Normal', 'Large quantities', 'Cold water', 'Warm water'] },
      { key: 'temperature', label: 'Fever pattern', type: 'textarea', placeholder: 'Chill → heat → sweat sequence, time of fever' },
    ],
  },
  {
    id: 'mental',
    title: 'Mental state',
    short: 'Mental',
    icon: 'ph-brain',
    fields: [
      { key: 'mental', label: 'Mood & behavior during illness', type: 'chips', multi: true, options: ['Restless', 'Irritable', 'Anxious', 'Weepy', 'Wants company', 'Wants to be alone', 'Indifferent'] },
      { key: 'notes', label: 'Notes', type: 'textarea' },
    ],
  },
]

export const PEDIATRIC_SECTIONS: CaseSectionDef[] = [
  {
    id: 'chief',
    title: 'Presenting complaint',
    short: 'Complaint',
    icon: 'ph-target',
    fields: [
      { key: 'verbatim', label: "Parent's description", type: 'textarea', placeholder: "Record the parent's words and the child's own expressions if verbal." },
      { key: 'duration', label: 'Duration & onset', type: 'textarea' },
      { key: 'severity', label: 'Severity', type: 'chips', options: ['Mild', 'Moderate', 'Marked', 'Severe'] },
    ],
  },
  {
    id: 'birth',
    title: 'Birth & milestones',
    short: 'Birth',
    icon: 'ph-baby',
    fields: [
      { key: 'delivery', label: 'Delivery', type: 'chips', options: ['Normal vaginal', 'Caesarean', 'Assisted', 'Premature'] },
      { key: 'birthWeight', label: 'Birth weight & APGAR', type: 'textarea', placeholder: 'e.g. 3.2 kg, APGAR 9/10' },
      { key: 'milestones', label: 'Milestones', type: 'chips', multi: true, options: ['Delayed sitting', 'Delayed walking', 'Delayed speech', 'Normal milestones', 'Early walker'] },
      { key: 'vaccination', label: 'Vaccination status', type: 'textarea', placeholder: 'Up to date? Which vaccines given?' },
    ],
  },
  {
    id: 'behaviour',
    title: 'Behaviour & temperament',
    short: 'Behaviour',
    icon: 'ph-smiley',
    fields: [
      { key: 'temperament', label: 'Temperament', type: 'chips', multi: true, options: ['Shy', 'Stubborn', 'Clingy', 'Independent', 'Hyperactive', 'Slow', 'Destructive', 'Fearful', 'Friendly'] },
      { key: 'fears', label: 'Fears', type: 'chips', multi: true, options: ['Dark', 'Animals', 'Loud noises', 'Being alone', 'Strangers', 'Water', 'School'] },
      { key: 'sleep', label: 'Sleep pattern', type: 'textarea', placeholder: 'Position, restless? Night terrors? Teeth grinding?' },
    ],
  },
  {
    id: 'appetite',
    title: 'Appetite & diet',
    short: 'Diet',
    icon: 'ph-fork-knife',
    fields: [
      { key: 'feeding', label: 'Feeding', type: 'chips', options: ['Breast-fed', 'Formula', 'Mixed', 'Weaned'] },
      { key: 'cravings', label: 'Cravings & aversions', type: 'textarea', placeholder: 'Picky eater? Craves sweets, salt, cold drinks?' },
      { key: 'thirst', label: 'Thirst', type: 'chips', options: ['Absent', 'Sips', 'Normal', 'Excessive'] },
    ],
  },
  {
    id: 'family',
    title: 'Family history',
    short: 'Family',
    icon: 'ph-users-three',
    fields: [
      { key: 'family', label: 'Family history', type: 'chips', multi: true, options: ['Asthma', 'Eczema', 'Diabetes', 'Thyroid', 'TB', 'Cancer', 'Mental illness'] },
      { key: 'notes', label: 'Additional notes', type: 'textarea' },
    ],
  },
]

export const FIRST_VISIT_SECTIONS: CaseSectionDef[] = [
  {
    id: 'chief',
    title: 'Chief complaint',
    short: 'Chief',
    icon: 'ph-target',
    fields: [
      { key: 'verbatim', label: "Patient's own words", type: 'textarea', placeholder: 'Record verbatim — the exact words carry the case.' },
      { key: 'duration', label: 'Duration & onset', type: 'textarea', placeholder: 'When did it start? What happened around that time?' },
      { key: 'severity', label: 'Severity', type: 'chips', options: ['Mild', 'Moderate', 'Marked', 'Severe'] },
      { key: 'previousTreatment', label: 'Previous treatment', type: 'textarea', placeholder: 'What have they tried — allopathic, homeopathic, ayurvedic?' },
    ],
  },
  {
    id: 'history',
    title: 'Full history',
    short: 'History',
    icon: 'ph-clock-counter-clockwise',
    fields: [
      { key: 'hpc', label: 'History of presenting complaint', type: 'textarea' },
      { key: 'past', label: 'Past illnesses & surgeries', type: 'textarea' },
      { key: 'family', label: 'Family history', type: 'chips', multi: true, options: ['Asthma', 'Diabetes', 'Hypertension', 'Thyroid', 'TB', 'Cancer', 'Skin disease', 'Mental illness'] },
      { key: 'allergies', label: 'Drug allergies', type: 'textarea' },
    ],
  },
  {
    id: 'modalities',
    title: 'Modalities',
    short: 'Modalities',
    icon: 'ph-arrows-left-right',
    fields: [
      { key: 'better', label: 'Better for', type: 'chips', multi: true, options: ['Warmth', 'Rest', 'Quiet', 'Open air', 'Firm pressure', 'Company', 'Eating', 'Motion'] },
      { key: 'worse', label: 'Worse for', type: 'chips', multi: true, options: ['Cold air', 'Coffee', 'Late nights', 'Noise', 'Before storms', 'Lying on left', 'Alcohol', 'Morning', 'Evening'] },
      { key: 'timeAgg', label: 'Time of aggravation', type: 'textarea', placeholder: 'e.g. worse 3–5am' },
    ],
  },
  {
    id: 'personal',
    title: 'Constitution',
    short: 'Constitution',
    icon: 'ph-drop-half',
    fields: [
      { key: 'thermals', label: 'Thermals & thirst', type: 'chips', multi: true, options: ['Chilly', 'Hot', 'Thirsty', 'Thirstless', 'Craves warm drinks', 'Craves cold drinks'] },
      { key: 'appetite', label: 'Appetite, cravings & aversions', type: 'textarea' },
      { key: 'sleep', label: 'Sleep, dreams & perspiration', type: 'textarea' },
      { key: 'menses', label: 'Menstrual history (if applicable)', type: 'textarea', placeholder: 'Cycle, flow, pain, PMS symptoms' },
    ],
  },
  {
    id: 'mental',
    title: 'Mental & emotional',
    short: 'Mental',
    icon: 'ph-brain',
    fields: [
      { key: 'personality', label: 'Personality & disposition', type: 'textarea' },
      { key: 'fears', label: 'Fears & anxieties', type: 'chips', multi: true, options: ['Anticipation', 'Failure', 'Being alone', 'Loss of control', 'Health', 'Death', 'Heights', 'Claustrophobia'] },
      { key: 'stress', label: 'Stress reactions & mood', type: 'textarea' },
      { key: 'will', label: 'Will & motivation', type: 'textarea', placeholder: 'Decision-making, initiative, stubbornness or yielding' },
    ],
  },
  {
    id: 'particulars',
    title: 'Physicals & particulars',
    short: 'Physicals',
    icon: 'ph-heartbeat',
    fields: [
      { key: 'generals', label: 'Physical generals', type: 'textarea' },
      { key: 'particulars', label: 'Particulars', type: 'textarea' },
      { key: 'systems', label: 'Systems reviewed', type: 'chips', multi: true, options: ['Digestive', 'Respiratory', 'Skin', 'Gynaecological', 'Musculoskeletal', 'Urinary', 'Cardiovascular', 'Nervous'] },
      { key: 'vitals', label: 'Vitals & observations', type: 'textarea', placeholder: 'BP, pulse, weight, tongue, nails, complexion' },
    ],
  },
]

// A template "name" is just a string id — one of the 4 built-ins below, or
// a custom template's own id once a clinic has created one (see
// CustomCaseTemplate). Kept as `string` rather than a fixed union so a new
// custom template never needs a type change to be usable.
export type CaseTemplateName = string

export interface CaseTemplateInfo {
  name: CaseTemplateName
  label: string
  description: string
  sections: CaseSectionDef[]
}

// A clinic-created template, stored in Supabase (case_templates table) and
// held in the store — as opposed to the 4 built-ins below, which are fixed
// in code. Editable/deletable; built-ins are neither.
export interface CustomCaseTemplate {
  id: string
  label: string
  description: string
  sections: CaseSectionDef[]
  createdBy: string | null
  createdAt: string
}

export const CASE_TEMPLATES: CaseTemplateInfo[] = [
  { name: 'chronic', label: 'Chronic — Adult', description: 'Full constitutional case-taking for chronic complaints', sections: CASE_SECTIONS },
  { name: 'acute', label: 'Acute', description: 'Quick focused case for fevers, injuries, sudden illness', sections: ACUTE_SECTIONS },
  { name: 'pediatric', label: 'Pediatric', description: 'Child case-taking with milestones, behaviour, feeding', sections: PEDIATRIC_SECTIONS },
  { name: 'first-visit', label: 'First Visit', description: 'Comprehensive intake for new patients', sections: FIRST_VISIT_SECTIONS },
]

export function allTemplates(custom: CustomCaseTemplate[]): CaseTemplateInfo[] {
  return [...CASE_TEMPLATES, ...custom.map((t) => ({ name: t.id, label: t.label, description: t.description, sections: t.sections }))]
}

export function getSections(template: CaseTemplateName, custom: CustomCaseTemplate[] = []): CaseSectionDef[] {
  const builtIn = CASE_TEMPLATES.find((t) => t.name === template)
  if (builtIn) return builtIn.sections
  const found = custom.find((t) => t.id === template)
  return found?.sections ?? CASE_SECTIONS
}

export function emptyCaseFor(template: CaseTemplateName): CaseState {
  const sections = getSections(template)
  const c: CaseState = {}
  for (const s of sections) c[s.id] = emptySection()
  return c
}

export interface SectionState {
  fields: Record<string, string>
  chips: Record<string, string[]>
  done: boolean
}
export type CaseState = Record<string, SectionState> // sectionId -> state

export function emptySection(): SectionState {
  return { fields: {}, chips: {}, done: false }
}

export function emptyCase(): CaseState {
  const c: CaseState = {}
  for (const s of CASE_SECTIONS) c[s.id] = emptySection()
  return c
}

// Ananya's partially-taken follow-up case (matches the "insomnia" persona).
export function seedAnanyaCase(): CaseState {
  const c = emptyCase()
  c.chief = {
    fields: {
      verbatim: 'I wake at 3am with my mind racing and can’t switch off. Falling asleep is easier than staying asleep.',
      duration: 'About 14 months, started after a stressful work project and long night shifts.',
    },
    chips: { severity: ['Marked'] },
    done: true,
  }
  c.history = {
    fields: {
      hpc: 'Gradual onset, worse during deadlines. Tried melatonin with little effect.',
      past: 'Recurrent acidity. Occasional migraines in her twenties.',
      family: 'Mother — anxiety and insomnia. Father — hypertension.',
    },
    chips: {},
    done: true,
  }
  c.modalities = {
    fields: { timeAgg: 'Consistently worse 3–5am.' },
    chips: { better: ['Warmth', 'Quiet'], worse: ['Coffee', 'Late nights', 'Noise'] },
    done: true,
  }
  c.personal = {
    fields: { appetite: 'Strong coffee habit (3–4/day). Craves spicy food.', sleep: 'Light sleeper, vivid dreams of unfinished work.' },
    chips: { thermals: ['Chilly', 'Craves warm drinks'] },
    done: false,
  }
  c.mental = {
    fields: { personality: 'Driven, orderly, irritable when overworked.' },
    chips: { fears: ['Anticipation', 'Failure'] },
    done: false,
  }
  return c
}
