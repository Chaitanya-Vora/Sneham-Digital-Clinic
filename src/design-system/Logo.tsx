// Sneham brand mark — a homeopathy globule-drop cradled by a leaf, in brand
// green. Crisp SVG placeholder; swap for the official PNG lockup in polish.

export function SnehamMark({ size = 34 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" fill="none" aria-hidden>
      <rect width="40" height="40" rx="12" fill="#41603C" />
      {/* drop */}
      <path
        d="M20 9c4.2 5 7 8.6 7 12.4A7 7 0 0 1 13 21.4C13 17.6 15.8 14 20 9Z"
        fill="#DCE6D0"
      />
      {/* leaf highlight */}
      <path
        d="M20 15.5c1.8 1.9 2.9 3.4 2.9 5a2.9 2.9 0 1 1-5.8 0c0-1.6 1.1-3.1 2.9-5Z"
        fill="#7A9B66"
      />
    </svg>
  )
}

// Arrival treatment for the auth screens: the brand is the page's only voice,
// so it takes the display step of the scale rather than sitting under a heading.
export function SnehamHero({ caption }: { caption?: string }) {
  return (
    <div className="flex flex-col items-center gap-3.5">
      <SnehamMark size={48} />
      <div className="text-center">
        <div className="font-display text-[34px] font-bold leading-[1] tracking-[-0.03em] text-ink">
          Sneham
        </div>
        <div className="font-display text-[21px] font-semibold leading-[1.15] tracking-[-0.012em] text-body-mid">
          Digital Clinic
        </div>
        <div className="mt-2 font-body text-[12px] tracking-[0.07em] text-faint">
          {caption ?? 'Healing with compassion'}
        </div>
      </div>
    </div>
  )
}

export function SnehamLockup({ dense = false }: { dense?: boolean }) {
  return (
    <div className="flex items-center gap-2.5">
      <SnehamMark size={dense ? 30 : 34} />
      <div className="leading-tight">
        <div className="font-display font-bold text-ink text-[15px] tracking-[-0.02em]">
          Sneham Digital Clinic
        </div>
        {!dense && (
          <div className="text-[11px] text-faint font-body">Healing with compassion</div>
        )}
      </div>
    </div>
  )
}
