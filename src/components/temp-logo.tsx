
export function TempLogo() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 100 100"
      className="h-full w-full object-contain"
    >
      {/* Stylized background shape - a rounded diamond/shield that looks like a crest */}
      <path
        d="M50 5 C75 5 95 25 95 50 C95 75 75 95 50 95 C25 95 5 75 5 50 C5 25 25 5 50 5 Z"
        fill="hsl(var(--primary))"
      />
      
      {/* Stylized BMS3 Text with thick, modern lettering */}
      <text
        x="50"
        y="58"
        textAnchor="middle"
        fill="white"
        style={{
          fontSize: '28px',
          fontWeight: '900',
          fontFamily: 'sans-serif',
          letterSpacing: '-1.5px'
        }}
      >
        Bms3
      </text>
      
      {/* Decorative institutional elements */}
      <circle cx="50" cy="22" r="3" fill="white" fillOpacity="0.8" />
      <circle cx="50" cy="78" r="3" fill="white" fillOpacity="0.8" />
      <path d="M30 50 H35 M65 50 H70" stroke="white" strokeWidth="2" strokeLinecap="round" strokeOpacity="0.5" />
    </svg>
  );
}
