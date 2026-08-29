import { useClinic } from '../core/store'
import { type CaseField, type CaseTemplateName, getSections } from '../core/caseTemplate'
import { Chip, Label } from '../design-system/ui'

// One field, wired straight to the store — edits persist immediately and
// show up anywhere the same case is read.
export function CaseFieldEditor({
  patientId,
  sectionId,
  field,
}: {
  patientId: string
  sectionId: string
  field: CaseField
}) {
  const value = useClinic((s) => s.caseData[patientId]?.[sectionId]?.fields[field.key] ?? '')
  const chips = useClinic((s) => s.caseData[patientId]?.[sectionId]?.chips[field.key] ?? [])
  const setField = useClinic((s) => s.setCaseField)
  const toggleChip = useClinic((s) => s.toggleCaseChip)

  if (field.type === 'chips') {
    return (
      <div>
        <Label>{field.label}</Label>
        <div className="mt-2 flex flex-wrap gap-2">
          {field.options!.map((opt) => (
            <Chip
              key={opt}
              selected={chips.includes(opt)}
              onClick={() => toggleChip(patientId, sectionId, field.key, opt, !!field.multi)}
            >
              {opt}
            </Chip>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div>
      <Label>{field.label}</Label>
      <textarea
        value={value}
        onChange={(e) => setField(patientId, sectionId, field.key, e.target.value)}
        placeholder={field.placeholder}
        rows={3}
        className="mt-2 w-full resize-y rounded-[14px] border border-border bg-surface px-3.5 py-2.5 text-[14px] leading-relaxed text-body outline-none transition focus:border-green-border focus:bg-surface-hover placeholder:text-faint"
      />
    </div>
  )
}

// section completion helper — a section counts as "filled" if it has any
// content, and "done" when the practitioner marks it. Total is derived from
// the currently selected template's own section list, not a fixed count —
// templates differ in how many sections they have (acute has 4, chronic has 6).
export function useCaseProgress(patientId: string, template: CaseTemplateName) {
  return useClinic((s) => {
    const c = s.caseData[patientId]
    const templateSections = getSections(template)
    const total = templateSections.length
    let done = 0
    const doneIds: Record<string, boolean> = {}
    for (const sec of templateSections) {
      const isDone = !!c?.[sec.id]?.done
      doneIds[sec.id] = isDone
      if (isDone) done++
    }
    return { done, total, doneIds }
  })
}

// autosave status for a patient's case — reflects the debounced write to the
// backing store so the UI can show saving / saved / error instead of nothing.
export function useCaseSaveStatus(patientId: string) {
  return useClinic((s) => s.caseSaveStatus[patientId])
}

export function sectionHasContent(state?: { fields: Record<string, string>; chips: Record<string, string[]> }) {
  if (!state) return false
  const anyField = Object.values(state.fields).some((v) => v.trim().length > 0)
  const anyChip = Object.values(state.chips).some((a) => a.length > 0)
  return anyField || anyChip
}
