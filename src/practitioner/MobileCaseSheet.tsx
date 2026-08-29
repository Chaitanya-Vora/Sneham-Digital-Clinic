import { useState, useEffect } from 'react'
import { CaretLeft, CheckCircle, CircleNotch, DeviceMobile, Microphone, PencilSimpleLine, Prescription as RxIcon, WarningCircle } from '@phosphor-icons/react'
import { useClinic } from '../core/store'
import { uploadDocument } from '../core/db'
import { allTemplates, type CaseTemplateName, getSections } from '../core/caseTemplate'
import { Button, Label } from '../design-system/ui'
import { VoiceRecorder } from '../design-system/VoiceRecorder'
import { useToast } from '../design-system/toast'
import { CaseFieldEditor, useCaseProgress, useCaseSaveStatus } from '../components/CaseFields'
import { CaseTemplateEditorModal } from '../web/CaseTemplateEditor'

export function MobileCaseSheet({
  patientId,
  onBack,
  onPrescribe,
}: {
  patientId: string
  onBack: () => void
  onPrescribe: () => void
}) {
  const patient = useClinic((s) => s.patients.find((p) => p.id === patientId))
  const ensureCase = useClinic((s) => s.ensureCase)
  const markDone = useClinic((s) => s.markSectionDone)
  const addDocument = useClinic((s) => s.addDocument)
  const voiceNotes = useClinic((s) => s.documents.filter((d) => d.patientId === patientId && d.format === 'WEBM'))
  const caseState = useClinic((s) => s.caseData[patientId])
  const caseVisits = useClinic((s) => s.caseVisits.filter((v) => v.patientId === patientId))
  const customTemplates = useClinic((s) => s.caseTemplates)
  const templates = allTemplates(customTemplates)
  // Same reasoning as the web case sheet: no prior visits means this is a
  // first visit, so open on that template instead of always Chronic.
  const [template, setTemplate] = useState<CaseTemplateName>(() => {
    const mostRecent = [...caseVisits].sort((a, b) => b.date.localeCompare(a.date))[0]
    return mostRecent?.template ?? (caseVisits.length === 0 ? 'first-visit' : 'chronic')
  })
  const { done, total, doneIds } = useCaseProgress(patientId, template)
  const saveStatus = useCaseSaveStatus(patientId)
  const toast = useToast()
  const sections = getSections(template, customTemplates)
  const [activeId, setActiveId] = useState('chief')
  const [editingTemplate, setEditingTemplate] = useState(false)

  useEffect(() => { if (!caseState) ensureCase(patientId) }, [patientId, caseState, ensureCase])
  if (!patient) return (
    <div className="flex h-full items-center justify-center bg-screen">
      <div className="text-center">
        <div className="text-[14px] text-muted">Patient not found</div>
        <button onClick={onBack} className="mt-3 text-[13px] font-semibold text-brand">Go back</button>
      </div>
    </div>
  )
  const active = sections.find((s) => s.id === activeId) ?? sections[0]
  const pct = Math.round((done / total) * 100)

  return (
    <div className="flex h-full flex-col bg-screen">
      <div className="px-[18px] pb-2 pt-[var(--app-top)]">
        <div className="flex items-center justify-between">
          <button onClick={onBack} className="flex items-center gap-1 text-[13px] font-semibold text-brand">
            <CaretLeft size={15} weight="bold" /> Back
          </button>
          {saveStatus === 'saving' && (
            <span className="flex items-center gap-1 text-[11.5px] font-semibold text-muted">
              <CircleNotch size={13} className="animate-spin" /> Saving…
            </span>
          )}
          {saveStatus === 'saved' && (
            <span className="flex items-center gap-1 text-[11.5px] font-semibold text-success">
              <CheckCircle size={13} weight="fill" /> Saved
            </span>
          )}
          {saveStatus === 'error' && (
            <span className="flex items-center gap-1 text-[11.5px] font-semibold text-danger">
              <WarningCircle size={13} weight="fill" /> Not saved — retry
            </span>
          )}
          {saveStatus === 'queued' && (
            <span className="flex items-center gap-1 text-[11.5px] font-semibold text-amber-text">
              <DeviceMobile size={13} weight="fill" /> Saved on device — will sync
            </span>
          )}
        </div>
        <div className="mt-1 font-display text-[18px] font-bold text-ink">{patient.name}</div>
        <div className="mt-1 flex flex-wrap items-center gap-1.5">
          {templates.map((t) => (
            <button
              key={t.name}
              onClick={() => { setTemplate(t.name); setActiveId(getSections(t.name, customTemplates)[0].id) }}
              className={`rounded-pill px-3 py-1 text-[12px] font-semibold transition ${
                template === t.name ? 'bg-brand text-white' : 'bg-tint text-body'
              }`}
            >
              {t.label}
            </button>
          ))}
          <button
            onClick={() => setEditingTemplate(true)}
            className="flex items-center gap-1 rounded-pill border border-dashed border-border-dash px-2.5 py-1 text-[11.5px] font-semibold text-muted"
          >
            <PencilSimpleLine size={12} /> {customTemplates.some((c) => c.id === template) ? 'Edit' : 'New'}
          </button>
        </div>
        <div className="mt-0.5 text-[12px] text-faint">{done} of {total} sections</div>
        <div className="mt-2 h-1.5 overflow-hidden rounded-pill bg-tint-pale">
          <div className="h-full rounded-pill bg-accent transition-all" style={{ width: `${pct}%` }} />
        </div>
      </div>

      {/* section tabs */}
      <div className="no-scrollbar flex gap-2 overflow-x-auto px-[18px] py-2">
        {sections.map((s) => (
          <button
            key={s.id}
            onClick={() => setActiveId(s.id)}
            className={`flex shrink-0 items-center gap-1.5 rounded-pill px-3 py-1.5 text-[12.5px] font-semibold transition ${
              activeId === s.id ? 'bg-brand text-screen' : 'bg-surface text-muted border border-border'
            }`}
          >
            {doneIds[s.id] && <CheckCircle size={13} weight="fill" className={activeId === s.id ? 'text-screen' : 'text-success'} />}
            {s.short}
          </button>
        ))}
      </div>

      <div className="flex-1 space-y-5 overflow-y-auto px-[18px] pb-[120px] pt-2">
        <h2 className="font-display text-[17px] font-bold text-ink">{active.title}</h2>
        {active.fields.map((f) => (
          <CaseFieldEditor key={f.key} patientId={patientId} sectionId={active.id} field={f} />
        ))}
        <div>
          <Label>Voice notes</Label>
          {voiceNotes.length > 0 && (
            <div className="mt-2 space-y-1.5">
              {voiceNotes.map((d) => (
                <div key={d.id} className="flex items-center gap-2 rounded-[12px] border border-border bg-surface px-3 py-2">
                  <Microphone size={14} className="text-brand" />
                  <span className="flex-1 truncate text-[12.5px] font-medium text-ink">{d.name}</span>
                  <span className="shrink-0 text-[11px] text-faint">{d.date}</span>
                </div>
              ))}
            </div>
          )}
          <div className="mt-2">
            <VoiceRecorder
              onAttach={async (sec, blob) => {
                const dateLabel = new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })
                const file = new File([blob], `Voice note ${dateLabel}.webm`, { type: blob.type || 'audio/webm' })
                const doc = await uploadDocument(file, patientId)
                if (doc) {
                  addDocument(doc)
                  toast({ title: `Voice note attached · ${sec}s` })
                } else {
                  toast({ title: 'Could not save voice note', message: 'Check your connection and try again.' })
                }
              }}
            />
          </div>
        </div>
      </div>

      {/* action bar */}
      <div className="absolute inset-x-0 bottom-0 z-30 flex gap-2 border-t border-border bg-surface/95 px-[18px] pb-[var(--app-bottom)] pt-3 backdrop-blur">
        <Button
          variant="ghost"
          className="flex-1"
          onClick={() => markDone(patientId, active.id, !doneIds[active.id])}
        >
          <CheckCircle size={16} weight={doneIds[active.id] ? 'fill' : 'regular'} />
          {doneIds[active.id] ? 'Done' : 'Mark done'}
        </Button>
        <Button variant="primary" className="flex-1" onClick={onPrescribe}>
          <RxIcon size={16} weight="fill" /> Prescribe
        </Button>
      </div>

      {editingTemplate && (
        <CaseTemplateEditorModal
          editing={customTemplates.find((t) => t.id === template) ?? null}
          onClose={() => setEditingTemplate(false)}
          onSaved={(t) => { setTemplate(t.id); setActiveId(t.sections[0]?.id ?? 'chief') }}
        />
      )}
    </div>
  )
}
