import type { KartColour } from '@/lib/spelling-race/types'

export type LayeredRacerProps = {
  colour: KartColour
  boosted: boolean
  reducedMotion: boolean
}

export default function LayeredRacer({ colour, boosted, reducedMotion }: LayeredRacerProps) {
  const motion = reducedMotion ? '' : 'race-motion'
  const kartColour = `var(--grand-prix-kart-${colour})`

  return (
    <div aria-label={`Your ${colour} kart on the starting grid`} className={`relative h-72 overflow-hidden rounded-xl border ${motion}`} style={{ background: 'linear-gradient(180deg, var(--grand-prix-sky) 0%, var(--grand-prix-sky) 55%, var(--grand-prix-grass) 55%)', borderColor: 'var(--line)' }}>
      <svg aria-hidden="true" className="absolute inset-0 h-full w-full" viewBox="0 0 640 360" preserveAspectRatio="xMidYMid slice">
        <defs>
          <linearGradient id="road" x1="0" x2="0" y1="0" y2="1"><stop stopColor="var(--grand-prix-asphalt)" /><stop offset="1" stopColor="var(--grand-prix-shadow)" /></linearGradient>
          <linearGradient id="body" x1="0" x2="0" y1="0" y2="1"><stop stopColor="var(--grand-prix-kart-stripe)" /><stop offset="0.18" stopColor={kartColour} /><stop offset="1" stopColor={kartColour} /></linearGradient>
          <linearGradient id="visor" x1="0" x2="0" y1="0" y2="1"><stop stopColor="var(--grand-prix-ambient)" /><stop offset="1" stopColor="var(--grand-prix-gantry-post)" /></linearGradient>
          <filter id="kart-shadow" x="-30%" y="-30%" width="160%" height="180%"><feDropShadow dx="0" dy="9" stdDeviation="8" floodColor="var(--grand-prix-shadow)" floodOpacity="0.55" /></filter>
        </defs>

        <path d="M160 360 270 154h100l110 206Z" fill="url(#road)" />
        <path d="M269 154h102" stroke="var(--grand-prix-kart-stripe)" strokeWidth="8" strokeDasharray="18 14" />
        <path d="M227 238h186M187 306h266" stroke="var(--grand-prix-kart-stripe)" strokeOpacity="0.7" strokeWidth="3" />
        <path d="M152 360h336" stroke="var(--grand-prix-kerb-red)" strokeWidth="17" strokeDasharray="20 20" />
        <path d="M172 360h296" stroke="var(--grand-prix-kart-stripe)" strokeWidth="17" strokeDasharray="20 20" strokeDashoffset="20" />

        <g opacity="0.82">
          <path d="M64 156h64l18-53 18 53h64" fill="none" stroke="var(--grand-prix-gantry)" strokeWidth="8" />
          <rect x="118" y="88" width="72" height="22" rx="4" fill="var(--grand-prix-kart-stripe)" />
          <rect x="126" y="93" width="12" height="12" fill="var(--grand-prix-kerb-red)" />
          <rect x="150" y="93" width="12" height="12" fill="var(--grand-prix-asphalt)" />
          <rect x="174" y="93" width="12" height="12" fill="var(--grand-prix-kerb-red)" />
        </g>

        <g filter="url(#kart-shadow)" className={boosted && !reducedMotion ? 'origin-[320px_270px] scale-[1.04]' : ''}>
          <ellipse cx="320" cy="315" rx="148" ry="22" fill="var(--grand-prix-shadow)" opacity="0.56" />
          <g fill="var(--grand-prix-tyre)" stroke="var(--grand-prix-kart-stripe)" strokeWidth="5">
            <circle cx="205" cy="286" r="38" /><circle cx="435" cy="286" r="38" />
            <circle cx="205" cy="286" r="17" fill="var(--grand-prix-gantry)" /><circle cx="435" cy="286" r="17" fill="var(--grand-prix-gantry)" />
          </g>
          <path d="M174 281 217 238h206l43 43-16 31H190Z" fill="url(#body)" stroke="var(--grand-prix-tyre)" strokeWidth="7" strokeLinejoin="round" />
          <path d="M260 232 280 177h80l20 55Z" fill={kartColour} stroke="var(--grand-prix-tyre)" strokeWidth="7" strokeLinejoin="round" />
          <path d="M280 201q40-38 80 0v26h-80Z" fill="url(#visor)" stroke="var(--grand-prix-kart-stripe)" strokeWidth="5" />
          <path d="M293 185q27-28 54 0" fill="none" stroke="var(--grand-prix-kart-stripe)" strokeWidth="12" strokeLinecap="round" />
          <path d="M250 262h140l-18 57h-104Z" fill={kartColour} stroke="var(--grand-prix-tyre)" strokeWidth="7" strokeLinejoin="round" />
          <path d="M308 252h24v70h-24Z" fill="var(--grand-prix-kart-stripe)" />
          <path d="M206 261h-48l-17 26h77M434 261h48l17 26h-77" fill={kartColour} stroke="var(--grand-prix-tyre)" strokeWidth="7" strokeLinejoin="round" />
          <path d="M292 319h56l-11 20h-34Z" fill="var(--grand-prix-gantry)" />
          <path d="M215 236h-38v-18h38M425 236h38v-18h-38" fill={kartColour} stroke="var(--grand-prix-tyre)" strokeWidth="6" strokeLinejoin="round" />
          <path d="M250 217h140" stroke="var(--grand-prix-kart-stripe)" strokeWidth="7" strokeLinecap="round" />
          <circle cx="265" cy="297" r="8" fill="var(--grand-prix-sun)" /><circle cx="375" cy="297" r="8" fill="var(--grand-prix-sun)" />
        </g>
      </svg>
      <div className="absolute left-4 top-4 rounded-full border px-3 py-1 text-xs font-bold uppercase tracking-[0.14em]" style={{ background: 'var(--surface-2)', borderColor: 'var(--line)', color: 'var(--grand-prix-kart-stripe)' }}>Your kart</div>
    </div>
  )
}
