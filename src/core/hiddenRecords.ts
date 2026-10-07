// Records that exist in the database but should never appear on any screen.
//
// These two follow-up outcomes (and the one test photo attached to the first)
// were created while testing on the test patient "Chaitanya Vora" and could not
// be deleted from the database. They are left untouched there and simply not
// shown — in the phone apps, the web console and the patient app alike.
// To stop hiding one, delete its line.
export const HIDDEN_OUTCOME_IDS: ReadonlySet<string> = new Set([
  'fc99f764-a71a-4a36-aa8e-00c01c77058f', // "TEST regression note" + test photo
  '7c78da3c-bccb-4e38-a595-511dd07a9b7d', // "TEST second pass…"
])
