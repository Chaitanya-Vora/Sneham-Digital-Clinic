import { useState } from 'react'
import { Label } from '../design-system/ui'
import { Pressable } from '../design-system/Pressable'
import { Phone } from './kit'

// Patient sign-up: nothing is chosen for her, anything missing is said plainly
// when she taps Continue (the button is never a dead, greyed control), and a
// city she leaves empty stays empty — it is no longer quietly filled with
// "Mumbai".
const CITIES = ['Chiplun', 'Ratnagiri', 'Mumbai', 'Pune']
export function SignUpLab() {
  const [name, setName] = useState('')
  const [age, setAge] = useState('')
  const [sex, setSex] = useState<'Female' | 'Male' | 'Other' | null>(null)
  const [phone, setPhone] = useState('')
  const [city, setCity] = useState('')
  const [tried, setTried] = useState(false)
  const [done, setDone] = useState(false)

  const missing = {
    name: name.trim().length < 2,
    age: age.trim().length === 0,
    sex: sex === null,
    phone: phone.replace(/\D/g, '').length < 7,
  }
  const ok = !Object.values(missing).some(Boolean)
  const field = 'mt-1.5 w-full rounded-[12px] border bg-surface px-3.5 py-2.5 text-[14px] text-body outline-none focus:border-green-border'
  const bad = (k: keyof typeof missing) => tried && missing[k]
  const err = (t: string) => <p className="mt-1 text-[12px] font-medium text-danger">{t}</p>

  return (
    <div className="flex flex-wrap items-start gap-8">
      <Phone label="Sign-up" note="Tap Continue with the form empty, then fill it in." height={800}>
        <div className="h-full overflow-y-auto px-[18px] pb-[110px] pt-[var(--app-top)] no-scrollbar">
          <div className="flex h-16 w-16 items-center justify-center rounded-[20px] bg-tint text-ink-deep">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><circle cx="12" cy="8" r="4" /><path d="M4 20c1.5-4 14.5-4 16 0" /></svg>
          </div>
          <h1 className="mt-5 font-display text-[24px] font-bold text-ink">Welcome to Sneham</h1>
          <p className="mt-1 text-[14px] leading-relaxed text-muted">Tell us a little about yourself so your doctor can see your profile.</p>

          <div className="mt-5 space-y-4">
            <div>
              <Label>Full name</Label>
              <input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Priya Sharma" className={`${field} ${bad('name') ? 'border-danger' : 'border-border'}`} />
              {bad('name') && err('Enter your name')}
            </div>
            <div className="grid grid-cols-[1fr_1.9fr] gap-3">
              <div>
                <Label>Age</Label>
                <input value={age} onChange={(e) => setAge(e.target.value.replace(/\D/g, ''))} placeholder="28" inputMode="numeric" className={`${field} ${bad('age') ? 'border-danger' : 'border-border'}`} />
                {bad('age') && err('Required')}
              </div>
              <div>
                <Label>Sex</Label>
                <div className="mt-1.5 flex gap-2">
                  {(['Female', 'Male', 'Other'] as const).map((o) => (
                    <button key={o} type="button" onClick={() => setSex(o)} className={`flex-1 rounded-[12px] border py-2.5 text-[13.5px] font-semibold transition ${sex === o ? 'border-brand bg-brand text-white' : bad('sex') ? 'border-danger bg-surface text-body' : 'border-border bg-surface text-body'}`}>{o}</button>
                  ))}
                </div>
                {bad('sex') && err('Choose one')}
              </div>
            </div>
            <div>
              <Label>Phone number</Label>
              <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+91 98765 43210" type="tel" className={`${field} ${bad('phone') ? 'border-danger' : 'border-border'}`} />
              {bad('phone') ? err('Enter a valid phone number') : <p className="mt-1 text-[11.5px] text-faint">If your clinic already has a record for you, this helps us find it.</p>}
            </div>
            <div>
              <Label>City <span className="font-normal normal-case tracking-normal text-faint">· optional</span></Label>
              <input value={city} onChange={(e) => setCity(e.target.value)} placeholder="e.g. Chiplun" className={`${field} border-border`} />
              <div className="mt-2 flex flex-wrap gap-1.5">
                {CITIES.map((c) => (
                  <button key={c} type="button" onClick={() => setCity(c)} className={`rounded-pill border px-3 py-1 text-[12.5px] font-semibold transition ${city === c ? 'border-green-border bg-tint text-ink-deep' : 'border-border bg-surface text-muted'}`}>{c}</button>
                ))}
              </div>
              <p className="mt-1.5 text-[11.5px] text-faint">Left empty, it stays empty.</p>
            </div>
          </div>
        </div>
        <div className="absolute inset-x-0 bottom-0 z-30 border-t border-border bg-surface/90 px-[18px] pt-3 backdrop-blur-xl" style={{ paddingBottom: 'var(--app-bottom)' }}>
          <Pressable hap={ok ? 'success' : 'tick'} onClick={() => { setTried(true); if (ok) setDone(true) }} className="flex w-full items-center justify-center rounded-pill bg-brand py-3.5 font-display text-[15px] font-semibold text-screen shadow-cta">Continue</Pressable>
        </div>
        {done && (
          <div className="absolute inset-0 z-[60] flex items-center justify-center bg-ink/25 px-8 backdrop-blur-[2px]" onClick={() => setDone(false)}>
            <div className="rounded-[24px] border border-border bg-surface p-6 text-center shadow-modal">
              <div className="font-display text-[17px] font-bold text-ink">Next step</div>
              <div className="mt-1 text-[13px] text-muted">{city ? `City saved as ${city}` : 'City left empty'} · {sex}</div>
            </div>
          </div>
        )}
      </Phone>
      <div className="max-w-[330px] pt-10 text-[14px] leading-relaxed text-body">
        <p className="font-display text-[15px] font-semibold text-ink">Why this shape</p>
        <ul className="mt-2 list-disc space-y-2 pl-5">
          <li><span className="font-semibold text-ink">No sex is chosen for her.</span> Nothing saves a record she did not make.</li>
          <li><span className="font-semibold text-ink">Continue is always live.</span> Tapped too early, it says exactly what is missing, in the field, in the app's terracotta — not a greyed-out button that gives no reason.</li>
          <li><span className="font-semibold text-ink">City is optional and honest.</span> Empty stays empty (today it silently becomes "Mumbai"); four tap-to-fill suggestions for her patients' usual towns.</li>
          <li>Same fields, same look as the app's current sign-up — only the behaviour changes.</li>
        </ul>
      </div>
    </div>
  )
}
