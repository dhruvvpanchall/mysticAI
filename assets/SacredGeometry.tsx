import * as React from "react";

type Props = React.SVGProps<SVGSVGElement> & { stroke?: string };

// Round to a fixed precision so server (Node V8) and browser V8 render
// identical strings for trig output — otherwise the last decimal can drift
// and trigger a React hydration mismatch on cx/cy attributes.
const r3 = (n: number) => Math.round(n * 1000) / 1000;

/**
 * Mandala-inspired sacred geometry — flower-of-life rosette with an outer
 * twelve-petal ring and concentric guides. Rendered as a single SVG that
 * scales cleanly and accepts any stroke color via the `stroke` prop.
 */
export function SacredGeometry({ stroke = "currentColor", ...props }: Props) {
  const cx = 200;
  const cy = 200;
  const r = 56;
  // Flower of life — 6 surrounding circles + center.
  const positions = Array.from({ length: 6 }).map((_, i) => {
    const a = (Math.PI / 3) * i;
    return { x: r3(cx + Math.cos(a) * r), y: r3(cy + Math.sin(a) * r) };
  });
  const petals = Array.from({ length: 12 });

  return (
    <svg
      viewBox="0 0 400 400"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden
      {...props}
    >
      <g stroke={stroke} strokeOpacity="0.55" strokeWidth="0.8">
        {/* outer rings */}
        <circle cx={cx} cy={cy} r="190" strokeOpacity="0.15" />
        <circle cx={cx} cy={cy} r="170" strokeOpacity="0.25" />
        <circle cx={cx} cy={cy} r="150" strokeOpacity="0.35" />
        <circle cx={cx} cy={cy} r="120" strokeOpacity="0.45" />

        {/* twelve petals (outer ring) */}
        {petals.map((_, i) => {
          const a = (Math.PI * 2 * i) / 12;
          return (
            <line
              key={i}
              x1={r3(cx + Math.cos(a) * 120)}
              y1={r3(cy + Math.sin(a) * 120)}
              x2={r3(cx + Math.cos(a) * 170)}
              y2={r3(cy + Math.sin(a) * 170)}
              strokeOpacity="0.4"
            />
          );
        })}

        {/* flower of life core */}
        <circle cx={cx} cy={cy} r={r} />
        {positions.map((p, i) => (
          <circle key={i} cx={p.x} cy={p.y} r={r} />
        ))}

        {/* second concentric ring of small circles */}
        {Array.from({ length: 12 }).map((_, i) => {
          const a = (Math.PI * 2 * i) / 12;
          return (
            <circle
              key={`s-${i}`}
              cx={r3(cx + Math.cos(a) * 100)}
              cy={r3(cy + Math.sin(a) * 100)}
              r="14"
              strokeOpacity="0.4"
            />
          );
        })}

        {/* inner triangle (Sri Yantra hint) */}
        <polygon
          points={`${cx},${cy - 40} ${cx - 35},${cy + 22} ${cx + 35},${cy + 22}`}
          strokeOpacity="0.55"
        />
        <polygon
          points={`${cx},${cy + 40} ${cx - 35},${cy - 22} ${cx + 35},${cy - 22}`}
          strokeOpacity="0.55"
        />
      </g>
    </svg>
  );
}
