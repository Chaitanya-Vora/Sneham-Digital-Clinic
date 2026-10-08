// The ℞ sign, drawn from the same vector outline the printed prescription uses
// (no font has the glyph, so it is a path).
const RX_PATH =
  'M 1.46875 0 L 1.46875 -14.625 L 6.9375 -14.625 C 9.90625 -14.625 11.390625 -13.414062 11.390625 -11 C 11.390625 -10.09375 11.132812 -9.269531 10.625 -8.53125 C 10.125 -7.789062 9.4375 -7.222656 8.5625 -6.828125 L 9.640625 -5.28125 L 10.796875 -6.84375 L 13.0625 -6.84375 L 10.71875 -3.734375 L 13.34375 0 L 10.15625 0 L 9.078125 -1.546875 L 7.921875 0 L 5.671875 0 L 7.984375 -3.09375 L 6 -5.984375 L 4.328125 -5.984375 L 4.328125 0 Z M 4.328125 -7.984375 L 5.03125 -7.984375 C 7.238281 -7.984375 8.34375 -8.875 8.34375 -10.65625 C 8.34375 -11.957031 7.359375 -12.609375 5.390625 -12.609375 L 4.328125 -12.609375 Z'

export function RxGlyph({ width = 24, className = '' }: { width?: number; className?: string }) {
  return (
    <svg viewBox="1 -15 13 15.4" width={width} height={width * (15.4 / 13)} className={className} aria-hidden="true">
      <path d={RX_PATH} fill="currentColor" />
    </svg>
  )
}
