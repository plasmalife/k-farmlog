export default function FarmScene() {
  return (
    <svg
      className="farm-scene"
      viewBox="0 0 560 300"
      fill="none"
      aria-hidden="true"
    >
      <defs>
        <linearGradient id="sky" x2="0" y2="1">
          <stop stopColor="#dceee5" />
          <stop offset="1" stopColor="#f1f4dc" />
        </linearGradient>
        <linearGradient id="hill" x2="1" y2="1">
          <stop stopColor="#679c76" />
          <stop offset="1" stopColor="#2b6e4d" />
        </linearGradient>
      </defs>
      <rect width="560" height="300" rx="28" fill="url(#sky)" />
      <circle cx="430" cy="67" r="31" fill="#efcf7f" />
      <path d="M0 170Q90 50 227 160Q365 72 560 151V300H0Z" fill="#b2c9a0" />
      <path d="M0 205Q190 115 360 175T560 185V300H0Z" fill="url(#hill)" />
      <path d="M0 252Q230 143 560 253V300H0Z" fill="#94b477" />
      <path
        d="M45 300Q250 167 560 281M128 300Q300 195 501 300M238 300Q349 231 416 300"
        stroke="#d1dba6"
        strokeWidth="17"
      />
      <path d="M0 271Q200 180 354 235" stroke="#c8d498" strokeWidth="12" />
      <path d="M322 151H393V206H322Z" fill="#f3e9d2" />
      <path d="m310 155 47-36 49 36Z" fill="#b9785c" />
      <path d="M349 175h17v31h-17Z" fill="#557c60" />
      <path d="M380 135v-22h10v30" fill="#a06049" />
      <path
        d="M96 194v-49M128 188v-48M463 213v-44"
        stroke="#496845"
        strokeWidth="7"
      />
      <circle cx="96" cy="133" r="24" fill="#387d57" />
      <circle cx="128" cy="124" r="29" fill="#4b9164" />
      <circle cx="464" cy="157" r="26" fill="#3b8056" />
      <path
        d="M252 206q7-16 16 0M262 209q7-16 16 0"
        stroke="#f4e5b6"
        strokeWidth="4"
        strokeLinecap="round"
      />
      <path
        d="M182 55q13-12 27 0q13-12 27 0"
        stroke="#8ea797"
        strokeWidth="3"
        strokeLinecap="round"
      />
    </svg>
  );
}
