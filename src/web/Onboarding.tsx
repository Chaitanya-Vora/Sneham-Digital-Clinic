import { useState } from 'react'
import { CheckCircle, Stethoscope, ArrowRight } from '@phosphor-icons/react'
import { useClinic } from '../core/store'
import { Button, Card, Label } from '../design-system/ui'
import { SnehamMark } from '../design-system/Logo'
import { motion, AnimatePresence } from 'framer-motion'

const SPECIALTIES = [
  'General Homeopathy',
  'Chronic care',
  'Pediatrics',
  'Dermatology',
  'Gynaecology',
  'Psychiatry',
  'Gastroenterology',
  'Respiratory',
]

export function Onboarding({ onDone }: { onDone: () => void }) {
  const updatePractitioner = useClinic((s) => s.updatePractitioner)
  const practitionerId = useClinic((s) => s.currentPractitionerId)

  const [step, setStep] = useState(0)
  const [name, setName] = useState('')
  const [clinicName, setClinicName] = useState('')
  const [specialty, setSpecialty] = useState('General Homeopathy')
  const [qualifications, setQualifications] = useState('')
  const [regNo, setRegNo] = useState('')

  function finish() {
    const fullName = name.startsWith('Dr.') ? name : `Dr. ${name}`
    updatePractitioner(practitionerId, {
      name: fullName,
      initials: name.replace(/^Dr\.?\s*/i, '').split(' ').filter(Boolean).map(w => w[0]).join('').toUpperCase().slice(0, 2) || 'DR',
      specialty,
      qualifications: qualifications || undefined,
      registrationNo: regNo || undefined,
    })
    onDone()
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-canvas p-6">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md"
      >
        <div className="mb-8 flex flex-col items-center">
          <SnehamMark />
          <h1 className="mt-4 font-display text-[24px] font-bold text-ink">Welcome to Sneham</h1>
          <p className="mt-1 text-center text-[14px] text-muted">Let's set up your practice in under a minute.</p>
        </div>

        <Card className="p-6">
          <div className="mb-4 flex gap-2">
            {[0, 1, 2].map((s) => (
              <div key={s} className={`h-1 flex-1 rounded-pill transition-colors ${s <= step ? 'bg-accent' : 'bg-tint-pale'}`} />
            ))}
          </div>

          <AnimatePresence mode="wait">
            {step === 0 && (
              <motion.div key="s0" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-4">
                <div>
                  <Label>Your full name</Label>
                  <input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Dr. Meera Sharma"
                    className="mt-1.5 w-full rounded-[10px] border border-border bg-surface px-3.5 py-2.5 text-[14px] text-ink placeholder:text-faint focus:border-accent focus:outline-none"
                    autoFocus
                  />
                </div>
                <div>
                  <Label>Clinic name</Label>
                  <input
                    value={clinicName}
                    onChange={(e) => setClinicName(e.target.value)}
                    placeholder="Sneham Clinic, Bandra"
                    className="mt-1.5 w-full rounded-[10px] border border-border bg-surface px-3.5 py-2.5 text-[14px] text-ink placeholder:text-faint focus:border-accent focus:outline-none"
                  />
                </div>
                <Button variant="primary" className="w-full" onClick={() => setStep(1)} disabled={!name.trim()}>
                  Next <ArrowRight size={15} />
                </Button>
              </motion.div>
            )}

            {step === 1 && (
              <motion.div key="s1" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-4">
                <div>
                  <Label>Specialty</Label>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {SPECIALTIES.map((s) => (
                      <button
                        key={s}
                        onClick={() => setSpecialty(s)}
                        className={`rounded-pill border px-3.5 py-2 text-[13px] font-semibold transition ${specialty === s ? 'border-green-border bg-tint text-ink' : 'border-border bg-surface text-muted hover:text-body'}`}
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button variant="ghost" className="flex-1" onClick={() => setStep(0)}>Back</Button>
                  <Button variant="primary" className="flex-1" onClick={() => setStep(2)}>Next <ArrowRight size={15} /></Button>
                </div>
              </motion.div>
            )}

            {step === 2 && (
              <motion.div key="s2" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-4">
                <div>
                  <Label>Qualifications <span className="text-faint">(optional)</span></Label>
                  <input
                    value={qualifications}
                    onChange={(e) => setQualifications(e.target.value)}
                    placeholder="BHMS, MD (Hom)"
                    className="mt-1.5 w-full rounded-[10px] border border-border bg-surface px-3.5 py-2.5 text-[14px] text-ink placeholder:text-faint focus:border-accent focus:outline-none"
                  />
                </div>
                <div>
                  <Label>Registration number <span className="text-faint">(optional)</span></Label>
                  <input
                    value={regNo}
                    onChange={(e) => setRegNo(e.target.value)}
                    placeholder="Reg. 41982"
                    className="mt-1.5 w-full rounded-[10px] border border-border bg-surface px-3.5 py-2.5 text-[14px] text-ink placeholder:text-faint focus:border-accent focus:outline-none"
                  />
                </div>
                <div className="flex gap-2">
                  <Button variant="ghost" className="flex-1" onClick={() => setStep(1)}>Back</Button>
                  <Button variant="accent" className="flex-1" onClick={finish}>
                    <Stethoscope size={16} weight="fill" /> Start practicing
                  </Button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </Card>

        <div className="mt-4 flex items-center justify-center gap-1.5 text-[12px] text-faint">
          <CheckCircle size={13} weight="fill" className="text-success" />
          You can change these anytime in Settings
        </div>
      </motion.div>
    </div>
  )
}
