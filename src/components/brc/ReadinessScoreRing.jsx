export default function ReadinessScoreRing({ pct, size = 110 }) {
  const r = (size / 2) - 10;
  const circ = 2 * Math.PI * r;
  const dash = (pct / 100) * circ;
  const color = pct >= 80 ? 'hsl(var(--rag-green))' : pct >= 50 ? 'hsl(var(--rag-amber))' : 'hsl(var(--rag-red))';

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ transform: 'rotate(-90deg)' }}>
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="hsl(var(--border))" strokeWidth="9" />
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={color} strokeWidth="9"
        strokeDasharray={`${dash} ${circ - dash}`} strokeLinecap="round" />
      <text
        x={size/2} y={size/2 + 7}
        textAnchor="middle" fontSize="20" fontWeight="700" fill={color}
        style={{ transform: `rotate(90deg)`, transformOrigin: `${size/2}px ${size/2}px` }}
      >{pct}%</text>
    </svg>
  );
}