
export function TempLogo() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 100 100"
      className="h-full w-full object-contain"
    >
      <circle
        cx="50"
        cy="50"
        r="45"
        stroke="hsl(var(--primary))"
        fill="hsl(var(--primary) / 0.1)"
        strokeWidth="3"
      />
      <text
        x="50%"
        y="53%"
        dominantBaseline="middle"
        textAnchor="middle"
        fontSize="32"
        fill="hsl(var(--primary))"
        fontFamily="sans-serif"
        fontWeight="bold"
        letterSpacing="-1"
      >
        BMS3
      </text>
    </svg>
  );
}
