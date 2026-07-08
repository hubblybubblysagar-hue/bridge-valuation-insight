import { useEffect, useRef, useState } from "react";

// Editorial-style animated area chart showing hypothetical growth of $10K
// via ExitBridge-guided sale outcomes. Draws on view.
export function GrowthChart() {
  const svgRef = useRef<SVGSVGElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!svgRef.current) return;
    const io = new IntersectionObserver(
      ([entry]) => entry.isIntersecting && setVisible(true),
      { threshold: 0.2 },
    );
    io.observe(svgRef.current);
    return () => io.disconnect();
  }, []);

  const width = 720;
  const height = 340;
  const pad = { l: 44, r: 20, t: 24, b: 32 };

  // Three hypothetical outcomes over 20 years
  const years = Array.from({ length: 21 }, (_, i) => 2005 + i);

  const outcomes: { key: string; label: string; color: string; series: number[] }[] = [
    {
      key: "guided",
      label: "Owner-guided (ExitBridge-informed)",
      color: "var(--olive)",
      series: years.map((_, i) => 10000 * Math.pow(1.11, i)),
    },
    {
      key: "broker",
      label: "Traditional broker-led",
      color: "var(--chart-3)",
      series: years.map((_, i) => 10000 * Math.pow(1.075, i)),
    },
    {
      key: "unplanned",
      label: "Unplanned exit",
      color: "var(--muted-foreground)",
      series: years.map((_, i) => 10000 * Math.pow(1.045, i)),
    },
  ];

  const maxY = Math.max(...outcomes.flatMap((o) => o.series));
  const xFor = (i: number) => pad.l + (i / (years.length - 1)) * (width - pad.l - pad.r);
  const yFor = (v: number) => height - pad.b - (v / maxY) * (height - pad.t - pad.b);

  const line = (series: number[]) =>
    series.map((v, i) => `${i === 0 ? "M" : "L"} ${xFor(i)} ${yFor(v)}`).join(" ");
  const area = (series: number[]) =>
    `${line(series)} L ${xFor(series.length - 1)} ${height - pad.b} L ${xFor(0)} ${height - pad.b} Z`;

  const yTicks = [0, 25000, 50000, 75000, 100000];

  return (
    <svg
      ref={svgRef}
      viewBox={`0 0 ${width} ${height}`}
      className="w-full"
      role="img"
      aria-label="Hypothetical outcomes chart"
    >
      {yTicks.map((t) => (
        <g key={t}>
          <line
            x1={pad.l}
            x2={width - pad.r}
            y1={yFor(t)}
            y2={yFor(t)}
            stroke="currentColor"
            strokeOpacity={0.08}
            strokeDasharray="2 4"
          />
          <text
            x={pad.l - 8}
            y={yFor(t) + 4}
            textAnchor="end"
            className="fill-current text-[10px] opacity-50"
          >
            ${t.toLocaleString()}
          </text>
        </g>
      ))}
      {years.map((y, i) =>
        i % 4 === 0 ? (
          <text
            key={y}
            x={xFor(i)}
            y={height - 10}
            textAnchor="middle"
            className="fill-current text-[10px] opacity-50"
          >
            {y}
          </text>
        ) : null,
      )}

      {outcomes.map((o) => (
        <path
          key={o.key + "-a"}
          d={area(o.series)}
          fill={o.color}
          opacity={0.08}
          style={{
            opacity: visible ? 0.08 : 0,
            transition: "opacity 1.4s ease 0.4s",
          }}
        />
      ))}
      {outcomes.map((o) => (
        <path
          key={o.key + "-l"}
          d={line(o.series)}
          fill="none"
          stroke={o.color}
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
          style={{
            strokeDasharray: 2000,
            strokeDashoffset: visible ? 0 : 2000,
            transition: "stroke-dashoffset 2.4s cubic-bezier(0.65, 0, 0.35, 1)",
          }}
        />
      ))}

      {/* End labels */}
      {outcomes.map((o) => (
        <g
          key={o.key + "-lab"}
          style={{ opacity: visible ? 1 : 0, transition: "opacity 0.6s ease 2s" }}
        >
          <circle cx={xFor(years.length - 1)} cy={yFor(o.series.at(-1)!)} r={3} fill={o.color} />
          <text
            x={xFor(years.length - 1) - 8}
            y={yFor(o.series.at(-1)!) - 10}
            textAnchor="end"
            className="fill-current text-[11px] font-medium"
            fill={o.color}
          >
            {"$" + Math.round(o.series.at(-1)! / 1000) + "K"}
          </text>
        </g>
      ))}
    </svg>
  );
}
