import { useState, useMemo, useEffect } from 'react'
import { CheckCircle, Circle, CircleNotch, Prescription as RxIcon, FloppyDisk, CloudCheck, DeviceMobile, PencilSimpleLine, ClockCounterClockwise, NotePencil, Eye, WarningCircle, Plus } from '@phosphor-icons/react'
import { useClinic } from '../core/store'
import { allTemplates, type CaseTemplateName, type SectionState, getSections } from '../core/caseTemplate'
import { Badge, Button, Card, Chip, Label, PatientNotFound } from '../design-system/ui'
import { VoiceRecorder } from '../design-system/VoiceRecorder'
import { CaseFieldEditor, sectionHasContent, useCaseProgress, useCaseSaveStatus } from '../components/CaseFields'
import { CaseTemplateEditorModal } from './CaseTemplateEditor'

function VisitHistoryPanel({
  sections,
  visit,
  editing,
  onSave,
}: {
  sections: ReturnType<typeof getSections>
  visit: { sections: Record<string, unknown>; date: string; remedy?: string; outcome?: string }
  editing: boolean
  onSave: (sections: Record<string, SectionState>) => void
}) {
  const [activeId, setActiveId] = useState(sections[0]?.id ?? 'chief')
  // Local draft only exists while editing — keyed to this visit via the
  // parent's `key={viewingVisit.id}`, so switching visits always remounts
  // this component instead of carrying one visit's draft into another.
  const [draft, setDraft] = useState<Record<string, SectionState>>(() => visit.sections as Record<string, SectionState>)
  const active = sections.find((s) => s.id === activeId) ?? sections[0]
  const source = editing ? draft : (visit.sections as Record<string, SectionState>)
  const sectionState = (source[active.id] ?? { fields: {}, chips: {} }) as SectionState

  useEffect(() => {
    if (editing) onSave(draft)
    // Saves on every edit (autosave, matching the live case editor) rather
    // than only on an explicit "done" action — nothing to lose by leaving
    // the panel mid-edit.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draft])

  const setField = (sectionId: string, key: string, value: string) =>
    setDraft((d) => ({ ...d, [sectionId]: { ...(d[sectionId] ?? { fields: {}, chips: {}, done: false }), fields: { ...(d[sectionId]?.fields ?? {}), [key]: value } } }))

  const toggleChip = (sectionId: string, key: string, value: string, multi: boolean) =>
    setDraft((d) => {
      const cur = d[sectionId] ?? { fields: {}, chips: {}, done: false }
      const existing = cur.chips[key] ?? []
      const next = existing.includes(value)
        ? existing.filter((v) => v !== value)
        : multi ? [...existing, value] : [value]
      return { ...d, [sectionId]: { ...cur, chips: { ...cur.chips, [key]: next } } }
    })

  return (
    <div className="grid grid-cols-[200px_1fr] gap-3">
      <div className="space-y-1">
        {sections.map((s) => {
          const state = source[s.id] as SectionState | undefined
          const hasContent = sectionHasContent(state)
          return (
            <button
              key={s.id}
              onClick={() => setActiveId(s.id)}
              className={`flex w-full items-center gap-2 rounded-[10px] px-2.5 py-2 text-left text-[12.5px] font-medium transition ${
                activeId === s.id ? 'bg-surface text-ink shadow-card' : hasContent ? 'text-body hover:bg-surface/60' : 'text-faint'
              }`}
            >
              <Circle size={14} className={hasContent ? 'text-accent' : 'text-border-dash'} />
              {s.short}
            </button>
          )
        })}
      </div>

      <div className="space-y-4">
        <h3 className="font-display text-[15px] font-bold text-ink">{active.title}</h3>
        {active.fields.map((f) => {
          if (f.type === 'chips') {
            const selected = (sectionState?.chips?.[f.key] ?? []) as string[]
            if (!editing && !selected.length) return null
            return (
              <div key={f.key}>
                <Label>{f.label}</Label>
                {editing ? (
                  <div className="mt-1.5 flex flex-wrap gap-1.5">
                    {(f.options ?? []).map((opt) => (
                      <Chip key={opt} selected={selected.includes(opt)} onClick={() => toggleChip(active.id, f.key, opt, !!f.multi)}>
                        {opt}
                      </Chip>
                    ))}
                  </div>
                ) : (
                  <div className="mt-1.5 flex flex-wrap gap-1.5">
                    {selected.map((v) => (
                      <span key={v} className="rounded-pill bg-tint px-2.5 py-1 text-[12px] font-medium text-body">{v}</span>
                    ))}
                  </div>
                )}
              </div>
            )
          }
          const val = (sectionState?.fields?.[f.key] ?? '') as string
          if (!editing && !val.trim()) return null
          return (
            <div key={f.key}>
              <Label>{f.label}</Label>
              {editing ? (
                <textarea
                  value={val}
                  onChange={(e) => setField(active.id, f.key, e.target.value)}
                  rows={3}
                  className="mt-1.5 w-full resize-y rounded-[10px] border border-border bg-surface px-3 py-2 text-[13.5px] leading-relaxed text-body outline-none focus:border-green-border"
                />
              ) : (
                <p className="mt-1 whitespace-pre-wrap rounded-[10px] bg-tint-pale px-3 py-2 text-[13.5px] leading-relaxed text-body">{val}</p>
              )}
            </div>
          )
        })}
        {!editing && active.fields.every((f) => {
          if (f.type === 'chips') return !((sectionState?.chips?.[f.key] ?? []) as string[]).length
          return !((sectionState?.fields?.[f.key] ?? '') as string).trim()
        }) && (
          <p className="py-4 text-center text-[13px] text-faint">No notes recorded for this section.</p>
        )}
      </div>
    </div>
  )
}

export function CaseSheet({
  patientId,
  onPrescribe,
  onBack,
}: {
  patientId: string
  onPrescribe: () => void
  onBack: () => void
}) {
  const patient = useClinic((s) => s.patients.find((p) => p.id === patientId))
  const offline = useClinic((s) => s.offline)
  const ensureCase = useClinic((s) => s.ensureCase)
  const markDone = useClinic((s) => s.markSectionDone)
  const snapshotCaseVisit = useClinic((s) => s.snapshotCaseVisit)
  const caseState = useClinic((s) => s.caseData[patientId])
  const caseVisits = useClinic((s) => s.caseVisits.filter((v) => v.patientId === patientId))
  const practitioners = useClinic((s) => s.practitioners)
  const customTemplates = useClinic((s) => s.caseTemplates)
  const templates = allTemplates(customTemplates)
  const [template, setTemplate] = useState<CaseTemplateName>('chronic')
  const { done, total, doneIds } = useCaseProgress(patientId, template)
  const saveStatus = useCaseSaveStatus(patientId)
  const sections = getSections(template, customTemplates)
  const [activeId, setActiveId] = useState('chief')
  const [savedAt, setSavedAt] = useState<string | null>(null)
  const [showTemplatePicker, setShowTemplatePicker] = useState(false)
  const [tab, setTab] = useState<'edit' | 'history'>('edit')
  const [viewingVisitId, setViewingVisitId] = useState<string | null>(null)
  const [editingVisit, setEditingVisit] = useState(false)
  const [editingTemplate, setEditingTemplate] = useState<'new' | string | null>(null)
  const updateCaseVisit = useClinic((s) => s.updateCaseVisit)

  useEffect(() => {
    if (!caseState) ensureCase(patientId)
  }, [caseState, ensureCase, patientId])

  const active = sections.find((s) => s.id === activeId) ?? sections[0]
  const pct = Math.round((done / total) * 100)

  const sortedVisits = useMemo(
    () => [...caseVisits].sort((a, b) => b.date.localeCompare(a.date)),
    [caseVisits],
  )

  const viewingVisit = viewingVisitId ? sortedVisits.find((v) => v.id === viewingVisitId) : null
  const viewingSections = viewingVisit ? getSections((viewingVisit.template as CaseTemplateName) ?? 'chronic', customTemplates) : sections

  if (!patient) return <PatientNotFound onBack={onBack} />

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <button onClick={onBack} className="text-[13px] font-semibold text-brand">&larr; {patient.name}</button>
          <h1 className="mt-1 font-display text-[20px] font-bold text-ink">Case sheet &middot; {patient.name}</h1>
          <div className="text-[12.5px] text-faint">{done} of {total} sections &middot; {sortedVisits.length} past visit{sortedVisits.length !== 1 ? 's' : ''}</div>
        </div>
        <div className="flex items-center gap-2.5">
          {saveStatus === 'saving' ? (
            <Badge tone="neutral">
              <CircleNotch size={13} className="animate-spin" /> Saving…
            </Badge>
          ) : saveStatus === 'error' ? (
            <Badge tone="danger">
              <WarningCircle size={13} weight="fill" /> Not saved — check connection
            </Badge>
          ) : (
            <Badge tone={offline ? 'amber' : 'green'}>
              {offline ? <DeviceMobile size={13} weight="fill" /> : <CloudCheck size={13} weight="fill" />}
              {savedAt ? `Saved ${savedAt}` : offline ? 'Saved on this device' : 'Saved'}
            </Badge>
          )}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => { snapshotCaseVisit(patientId, undefined, template); setSavedAt('snapshot') }}
          >
            <FloppyDisk size={15} /> Save snapshot
          </Button>
          <Button variant="primary" size="sm" onClick={onPrescribe}>
            <RxIcon size={15} weight="fill" /> Write prescription
          </Button>
        </div>
      </div>

      {/* tab switcher */}
      <div className="flex gap-1 rounded-[12px] bg-tint-pale p-1">
        <button
          onClick={() => { setTab('edit'); setViewingVisitId(null) }}
          className={`flex items-center gap-1.5 rounded-[10px] px-4 py-2 text-[13px] font-semibold transition ${
            tab === 'edit' ? 'bg-surface text-ink shadow-card' : 'text-muted hover:text-body'
          }`}
        >
          <NotePencil size={15} /> Current notes
        </button>
        <button
          onClick={() => setTab('history')}
          className={`flex items-center gap-1.5 rounded-[10px] px-4 py-2 text-[13px] font-semibold transition ${
            tab === 'history' ? 'bg-surface text-ink shadow-card' : 'text-muted hover:text-body'
          }`}
        >
          <ClockCounterClockwise size={15} /> Visit history
          {sortedVisits.length > 0 && (
            <span className="ml-1 rounded-pill bg-accent/10 px-2 py-0.5 text-[11px] font-bold text-accent">{sortedVisits.length}</span>
          )}
        </button>
      </div>

      {tab === 'edit' && (
        <div className="grid grid-cols-[240px_1fr] gap-4">
          {/* section rail */}
          <div className="space-y-3">
            <Card className="p-4">
              <Label>Progress</Label>
              <div className="mt-1 flex items-end gap-2">
                <span className="font-display text-[24px] font-bold text-ink">{pct}%</span>
                <span className="mb-1 text-[12px] text-faint">{done}/{total} done</span>
              </div>
              <div className="mt-2 h-2 overflow-hidden rounded-pill bg-tint-pale">
                <div className="h-full rounded-pill bg-accent transition-all" style={{ width: `${pct}%` }} />
              </div>
            </Card>

            <div className="space-y-1.5">
              {sections.map((s) => {
                const isDone = doneIds[s.id]
                const hasContent = sectionHasContent(caseState?.[s.id])
                const isActive = activeId === s.id
                return (
                  <button
                    key={s.id}
                    onClick={() => setActiveId(s.id)}
                    className={`flex w-full items-center gap-2.5 rounded-[12px] px-3 py-2.5 text-left text-[13.5px] font-medium transition ${
                      isActive ? 'bg-surface text-ink shadow-card' : 'text-body hover:bg-surface/60'
                    }`}
                  >
                    {isDone ? (
                      <CheckCircle size={18} weight="fill" className="text-success" />
                    ) : (
                      <Circle size={18} className={hasContent ? 'text-accent' : 'text-border-dash'} />
                    )}
                    <span className="flex-1">{s.title}</span>
                  </button>
                )
              })}
            </div>
            <div className="relative">
              <button
                onClick={() => setShowTemplatePicker(!showTemplatePicker)}
                className="flex w-full items-center justify-center gap-1.5 rounded-[12px] border border-dashed border-border-dash py-2.5 text-[12.5px] font-semibold text-muted hover:text-body"
              >
                <PencilSimpleLine size={14} /> {templates.find((t) => t.name === template)?.label ?? 'Change template'}
              </button>
              {showTemplatePicker && (
                <Card className="absolute left-0 right-0 top-full z-10 mt-1 p-2 shadow-float">
                  {templates.map((t) => {
                    const isCustom = customTemplates.some((c) => c.id === t.name)
                    return (
                      <div key={t.name} className="flex items-center gap-1">
                        <button
                          onClick={() => { setTemplate(t.name); setActiveId(t.sections[0].id); setShowTemplatePicker(false) }}
                          className={`flex flex-1 flex-col rounded-[8px] px-3 py-2 text-left transition hover:bg-tint ${template === t.name ? 'bg-tint' : ''}`}
                        >
                          <span className="text-[13px] font-semibold text-ink">{t.label}</span>
                          <span className="text-[11.5px] text-muted">{t.description}</span>
                        </button>
                        {isCustom && (
                          <button
                            onClick={() => { setEditingTemplate(t.name); setShowTemplatePicker(false) }}
                            className="px-2 text-faint hover:text-body"
                            title="Edit template"
                          >
                            <PencilSimpleLine size={14} />
                          </button>
                        )}
                      </div>
                    )
                  })}
                  <button
                    onClick={() => { setEditingTemplate('new'); setShowTemplatePicker(false) }}
                    className="mt-1 flex w-full items-center gap-1.5 rounded-[8px] border-t border-border px-3 py-2.5 text-left text-[12.5px] font-semibold text-brand hover:bg-tint"
                  >
                    <Plus size={14} weight="bold" /> New custom template
                  </button>
                </Card>
              )}
            </div>
          </div>

          {/* section editor */}
          <Card className="p-6">
            <div className="mb-1 flex items-center justify-between">
              <h2 className="font-display text-[18px] font-bold text-ink">{active.title}</h2>
              <button
                onClick={() => markDone(patientId, active.id, !doneIds[active.id])}
                className={`flex items-center gap-1.5 rounded-pill px-3.5 py-1.5 text-[12.5px] font-semibold transition ${
                  doneIds[active.id] ? 'bg-tint text-brand' : 'border border-border bg-surface text-muted hover:text-body'
                }`}
              >
                <CheckCircle size={15} weight={doneIds[active.id] ? 'fill' : 'regular'} />
                {doneIds[active.id] ? 'Section done' : 'Mark done'}
              </button>
            </div>
            <p className="mb-5 text-[13px] text-muted">Write freely — narrative notes carry more than checkboxes.</p>

            <div className="space-y-5">
              {active.fields.map((f) => (
                <CaseFieldEditor key={f.key} patientId={patientId} sectionId={active.id} field={f} />
              ))}
            </div>

            <div className="mt-6">
              <Label>Voice note</Label>
              <div className="mt-2">
                <VoiceRecorder />
              </div>
            </div>

            <div className="mt-6 flex items-center justify-between border-t border-border pt-4">
              <span className="text-[12.5px] text-faint">Changes save automatically as you type.</span>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setSavedAt(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }))}
              >
                <FloppyDisk size={15} /> Save now
              </Button>
            </div>
          </Card>
        </div>
      )}

      {tab === 'history' && (
        <div className="grid grid-cols-[280px_1fr] gap-4">
          {/* visit list */}
          <div className="space-y-2">
            {sortedVisits.length === 0 ? (
              <Card className="p-6 text-center">
                <ClockCounterClockwise size={32} className="mx-auto text-border-dash" />
                <p className="mt-2 text-[13.5px] font-medium text-muted">No visit history yet</p>
                <p className="mt-1 text-[12px] text-faint">Case notes are saved automatically when a consult ends, or you can save a snapshot manually.</p>
              </Card>
            ) : (
              sortedVisits.map((v) => {
                const dr = practitioners.find((p) => p.id === v.practitionerId)
                const d = new Date(v.date)
                const isActive = viewingVisitId === v.id
                return (
                  <button
                    key={v.id}
                    onClick={() => { setViewingVisitId(v.id); setEditingVisit(false) }}
                    className={`flex w-full flex-col rounded-[12px] border px-4 py-3 text-left transition ${
                      isActive
                        ? 'border-green-border bg-surface shadow-card'
                        : 'border-border bg-surface/50 hover:border-border hover:bg-surface'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-[13.5px] font-semibold text-ink">
                        {d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                      </span>
                      <span className="text-[11.5px] text-faint">
                        {d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                    {dr && <span className="mt-0.5 text-[12px] text-muted">{dr.name}</span>}
                    {v.remedy && (
                      <span className="mt-1.5 inline-flex self-start rounded-pill bg-accent/10 px-2 py-0.5 text-[11px] font-semibold text-accent">{v.remedy}</span>
                    )}
                    <span className="mt-1 text-[11px] text-faint capitalize">{v.template} template</span>
                  </button>
                )
              })
            )}
          </div>

          {/* visit detail */}
          <Card className="p-6">
            {!viewingVisit ? (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <Eye size={36} className="text-border-dash" />
                <p className="mt-3 text-[14px] font-medium text-muted">Select a visit to view notes</p>
                <p className="mt-1 text-[12.5px] text-faint">Past visits stay in your permanent record — open one to review or amend it.</p>
              </div>
            ) : (
              <>
                <div className="mb-4 flex items-center justify-between">
                  <div>
                    <h2 className="font-display text-[17px] font-bold text-ink">
                      {new Date(viewingVisit.date).toLocaleDateString('en-IN', { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' })}
                    </h2>
                    <p className="text-[12.5px] text-muted">
                      {practitioners.find((p) => p.id === viewingVisit.practitionerId)?.name ?? 'Unknown'}
                      {viewingVisit.remedy && <> &middot; {viewingVisit.remedy}</>}
                      {viewingVisit.editedAt && (
                        <> &middot; amended {new Date(viewingVisit.editedAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}</>
                      )}
                    </p>
                  </div>
                  <Button
                    variant={editingVisit ? 'primary' : 'ghost'}
                    size="sm"
                    onClick={() => setEditingVisit((v) => !v)}
                  >
                    {editingVisit ? <><CheckCircle size={14} weight="fill" /> Done</> : <><PencilSimpleLine size={14} /> Amend</>}
                  </Button>
                </div>
                <VisitHistoryPanel
                  key={viewingVisit.id}
                  sections={viewingSections}
                  visit={viewingVisit}
                  editing={editingVisit}
                  onSave={(newSections) => updateCaseVisit(viewingVisit.id, { sections: newSections })}
                />
              </>
            )}
          </Card>
        </div>
      )}

      {editingTemplate && (
        <CaseTemplateEditorModal
          editing={editingTemplate === 'new' ? null : customTemplates.find((t) => t.id === editingTemplate) ?? null}
          onClose={() => setEditingTemplate(null)}
          onSaved={(t) => { setTemplate(t.id); setActiveId(t.sections[0]?.id ?? 'chief') }}
        />
      )}
    </div>
  )
}
