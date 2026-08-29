import { useState } from 'react'
import { motion } from 'framer-motion'
import { X, Plus, Trash, TextAa, ListChecks, WarningCircle } from '@phosphor-icons/react'
import { useClinic } from '../core/store'
import { newId } from '../core/db'
import type { CaseField, CaseSectionDef, CustomCaseTemplate, FieldType } from '../core/caseTemplate'
import { Button, Card, Chip, Label } from '../design-system/ui'
import { useToast } from '../design-system/toast'

// Full create/edit UI for a clinic's own case-taking templates — sections
// and fields, built on top of the same CaseSectionDef shape the 4 built-in
// templates use, so a custom template works everywhere a built-in one does.
export function CaseTemplateEditorModal({
  editing,
  onClose,
  onSaved,
}: {
  editing: CustomCaseTemplate | null
  onClose: () => void
  onSaved?: (template: CustomCaseTemplate) => void
}) {
  const createTemplate = useClinic((s) => s.createCaseTemplate)
  const updateTemplate = useClinic((s) => s.updateCaseTemplate)
  const deleteTemplate = useClinic((s) => s.deleteCaseTemplate)
  const toast = useToast()

  const [label, setLabel] = useState(editing?.label ?? '')
  const [description, setDescription] = useState(editing?.description ?? '')
  const [sections, setSections] = useState<CaseSectionDef[]>(editing?.sections ?? [])
  const [newSectionTitle, setNewSectionTitle] = useState('')
  const [openSectionId, setOpenSectionId] = useState<string | null>(sections[0]?.id ?? null)
  const [confirmDelete, setConfirmDelete] = useState(false)

  const addSection = () => {
    const title = newSectionTitle.trim()
    if (!title) return
    const section: CaseSectionDef = { id: newId(), title, short: title.slice(0, 12), icon: 'ph-note', fields: [] }
    setSections((s) => [...s, section])
    setNewSectionTitle('')
    setOpenSectionId(section.id)
  }

  const removeSection = (id: string) => setSections((s) => s.filter((sec) => sec.id !== id))

  const addField = (sectionId: string, field: CaseField) => {
    setSections((s) => s.map((sec) => (sec.id === sectionId ? { ...sec, fields: [...sec.fields, field] } : sec)))
  }

  const removeField = (sectionId: string, key: string) => {
    setSections((s) => s.map((sec) => (sec.id === sectionId ? { ...sec, fields: sec.fields.filter((f) => f.key !== key) } : sec)))
  }

  const canSave = label.trim().length > 0 && sections.length > 0 && sections.every((s) => s.fields.length > 0)

  const onSave = () => {
    if (!canSave) return
    if (editing) {
      updateTemplate(editing.id, { label: label.trim(), description: description.trim(), sections })
      toast({ title: 'Template updated', message: `${label.trim()} has been saved.` })
      onSaved?.({ ...editing, label: label.trim(), description: description.trim(), sections })
    } else {
      const created = createTemplate({ label: label.trim(), description: description.trim(), sections })
      toast({ title: 'Template created', message: `${label.trim()} is now available when starting a case.` })
      onSaved?.(created)
    }
    onClose()
  }

  const onDelete = () => {
    if (!editing) return
    deleteTemplate(editing.id)
    toast({ title: 'Template deleted', message: `${editing.label} has been removed.` })
    onClose()
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[95] flex items-center justify-center bg-black/40 p-6"
      onClick={onClose}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: 12 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.97, y: 8 }}
        transition={{ type: 'spring', stiffness: 400, damping: 32 }}
        onClick={(e) => e.stopPropagation()}
        className="flex max-h-[86vh] w-[min(640px,92vw)] flex-col rounded-[20px] border border-border bg-surface shadow-modal"
      >
        <div className="flex items-center justify-between border-b border-border px-5 py-4 sm:px-6">
          <h2 className="font-display text-[17px] font-bold text-ink">{editing ? 'Edit template' : 'New case template'}</h2>
          <button onClick={onClose} className="text-faint hover:text-body"><X size={18} weight="bold" /></button>
        </div>

        <div className="flex-1 space-y-5 overflow-y-auto px-5 py-5 sm:px-6">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <Label>Template name *</Label>
              <input
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                placeholder="e.g. Dermatology follow-up"
                className="mt-1.5 w-full rounded-[12px] border border-border bg-surface px-3.5 py-2.5 text-[13px] text-body outline-none placeholder:text-faint focus:border-green-border"
              />
            </div>
            <div>
              <Label>Description</Label>
              <input
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Shown under the name when picking a template"
                className="mt-1.5 w-full rounded-[12px] border border-border bg-surface px-3.5 py-2.5 text-[13px] text-body outline-none placeholder:text-faint focus:border-green-border"
              />
            </div>
          </div>

          <div>
            <Label>Sections</Label>
            <div className="mt-2 space-y-2">
              {sections.length === 0 && (
                <div className="rounded-[12px] border border-dashed border-border-dash px-4 py-5 text-center text-[12.5px] text-faint">
                  Add at least one section to build this template.
                </div>
              )}
              {sections.map((section) => (
                <SectionEditor
                  key={section.id}
                  section={section}
                  open={openSectionId === section.id}
                  onToggle={() => setOpenSectionId(openSectionId === section.id ? null : section.id)}
                  onRemove={() => removeSection(section.id)}
                  onAddField={(f) => addField(section.id, f)}
                  onRemoveField={(k) => removeField(section.id, k)}
                />
              ))}
            </div>

            <div className="mt-2.5 flex items-center gap-2">
              <input
                value={newSectionTitle}
                onChange={(e) => setNewSectionTitle(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addSection() } }}
                placeholder="New section title, e.g. Skin history"
                className="flex-1 rounded-[12px] border border-border bg-surface px-3.5 py-2.5 text-[13px] text-body outline-none placeholder:text-faint focus:border-green-border"
              />
              <Button variant="ghost" size="sm" onClick={addSection} disabled={!newSectionTitle.trim()}>
                <Plus size={15} weight="bold" /> Add section
              </Button>
            </div>
          </div>

          {!canSave && sections.length > 0 && (
            <div className="flex items-center gap-2 rounded-[10px] bg-amber-tint px-3.5 py-2.5 text-[12.5px] text-amber-text">
              <WarningCircle size={15} weight="fill" /> Every section needs at least one field before this template can be saved.
            </div>
          )}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border px-5 py-4 sm:px-6">
          <div>
            {editing && !confirmDelete && (
              <button onClick={() => setConfirmDelete(true)} className="flex items-center gap-1.5 text-[13px] font-semibold text-danger">
                <Trash size={15} /> Delete template
              </button>
            )}
            {editing && confirmDelete && (
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-[12.5px] text-muted">Delete "{editing.label}"? Past visits keep their own saved notes.</span>
                <Button variant="danger" size="sm" onClick={onDelete}>Delete</Button>
                <Button variant="ghost" size="sm" onClick={() => setConfirmDelete(false)}>Cancel</Button>
              </div>
            )}
          </div>
          <div className="flex items-center gap-2.5">
            <Button variant="ghost" size="sm" onClick={onClose}>Cancel</Button>
            <Button variant="primary" size="sm" disabled={!canSave} onClick={onSave}>
              {editing ? 'Save changes' : 'Create template'}
            </Button>
          </div>
        </div>
      </motion.div>
    </motion.div>
  )
}

function SectionEditor({
  section,
  open,
  onToggle,
  onRemove,
  onAddField,
  onRemoveField,
}: {
  section: CaseSectionDef
  open: boolean
  onToggle: () => void
  onRemove: () => void
  onAddField: (field: CaseField) => void
  onRemoveField: (key: string) => void
}) {
  const [fieldLabel, setFieldLabel] = useState('')
  const [fieldType, setFieldType] = useState<FieldType>('textarea')
  const [placeholder, setPlaceholder] = useState('')
  const [optionsText, setOptionsText] = useState('')
  const [multi, setMulti] = useState(true)

  const submitField = () => {
    const label = fieldLabel.trim()
    if (!label) return
    const base = label.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '') || newId()
    const existingKeys = new Set(section.fields.map((f) => f.key))
    let key = base
    let n = 2
    while (existingKeys.has(key)) key = `${base}_${n++}`
    if (fieldType === 'chips') {
      const options = optionsText.split(',').map((o) => o.trim()).filter(Boolean)
      if (options.length === 0) return
      onAddField({ key, label, type: 'chips', options, multi })
    } else {
      onAddField({ key, label, type: 'textarea', placeholder: placeholder.trim() || undefined })
    }
    setFieldLabel('')
    setPlaceholder('')
    setOptionsText('')
  }

  return (
    <Card className="overflow-hidden">
      <button onClick={onToggle} className="flex w-full items-center justify-between px-4 py-3 text-left">
        <div>
          <div className="text-[13.5px] font-semibold text-ink">{section.title}</div>
          <div className="text-[11.5px] text-faint">{section.fields.length} field{section.fields.length !== 1 ? 's' : ''}</div>
        </div>
        <button onClick={(e) => { e.stopPropagation(); onRemove() }} className="text-faint hover:text-danger"><Trash size={15} /></button>
      </button>

      {open && (
        <div className="space-y-3 border-t border-border px-4 py-3">
          {section.fields.map((f) => (
            <div key={f.key} className="flex items-center justify-between rounded-[10px] bg-tint-pale px-3 py-2">
              <div className="flex items-center gap-2">
                {f.type === 'chips' ? <ListChecks size={14} className="text-muted" /> : <TextAa size={14} className="text-muted" />}
                <span className="text-[12.5px] font-medium text-ink">{f.label}</span>
                {f.type === 'chips' && <span className="text-[11px] text-faint">{f.options?.join(', ')}</span>}
              </div>
              <button onClick={() => onRemoveField(f.key)} className="text-faint hover:text-danger"><X size={13} /></button>
            </div>
          ))}

          <div className="space-y-2 rounded-[10px] border border-dashed border-border-dash p-3">
            <div className="flex gap-2">
              <input
                value={fieldLabel}
                onChange={(e) => setFieldLabel(e.target.value)}
                placeholder="Field label, e.g. Sleep pattern"
                className="flex-1 rounded-[10px] border border-border bg-surface px-3 py-2 text-[12.5px] text-body outline-none placeholder:text-faint focus:border-green-border"
              />
              <div className="flex rounded-[10px] bg-tint-pale p-0.5">
                <button
                  onClick={() => setFieldType('textarea')}
                  className={`rounded-[8px] px-2.5 py-1.5 text-[11.5px] font-semibold transition ${fieldType === 'textarea' ? 'bg-surface text-ink shadow-card' : 'text-muted'}`}
                >
                  Free text
                </button>
                <button
                  onClick={() => setFieldType('chips')}
                  className={`rounded-[8px] px-2.5 py-1.5 text-[11.5px] font-semibold transition ${fieldType === 'chips' ? 'bg-surface text-ink shadow-card' : 'text-muted'}`}
                >
                  Chip options
                </button>
              </div>
            </div>

            {fieldType === 'textarea' ? (
              <input
                value={placeholder}
                onChange={(e) => setPlaceholder(e.target.value)}
                placeholder="Placeholder hint (optional)"
                className="w-full rounded-[10px] border border-border bg-surface px-3 py-2 text-[12.5px] text-body outline-none placeholder:text-faint focus:border-green-border"
              />
            ) : (
              <>
                <input
                  value={optionsText}
                  onChange={(e) => setOptionsText(e.target.value)}
                  placeholder="Options, comma separated — e.g. Mild, Moderate, Severe"
                  className="w-full rounded-[10px] border border-border bg-surface px-3 py-2 text-[12.5px] text-body outline-none placeholder:text-faint focus:border-green-border"
                />
                <div className="flex items-center gap-2">
                  <Chip selected={multi} onClick={() => setMulti(true)}>Multi-select</Chip>
                  <Chip selected={!multi} onClick={() => setMulti(false)}>Single-select</Chip>
                </div>
              </>
            )}

            <Button variant="ghost" size="sm" onClick={submitField} disabled={!fieldLabel.trim()}>
              <Plus size={14} weight="bold" /> Add field
            </Button>
          </div>
        </div>
      )}
    </Card>
  )
}
