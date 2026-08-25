import { cn } from "@/lib/utils";

function tone(score: number) {
  if (score >= 75) return { stroke: "var(--color-success)", label: "STRONG" };
  if (score >= 60) return { stroke: "var(--color-primary)", label: "GOOD" };
  if (score >= 40) return { stroke: "var(--color-warning)", label: "FAIR" };
  return { stroke: "var(--color-destructive)", label: "WEAK" };
}

export function ScoreRing({
  score,
  size = 132,
  caption,
  className,
}: {
  score: number;
  size?: number;
  caption?: string;
  className?: string;
}) {
  const radius = (size - 14) / 2;
  const circumference = 2 * Math.PI * radius;
  const clamped = Math.max(0, Math.min(100, Math.round(score)));
  const { stroke, label } = tone(clamped);

  return (
    <div className={cn("flex flex-col items-center gap-2", className)}>
      <div className="relative" style={{ width: size, height: size }}>
        <svg
          width={size}
          height={size}
          role="img"
          aria-label={`Score ${clamped} out of 100, rated ${label}`}
          className="-rotate-90"
        >
          <circle cx={size / 2} cy={size / 2} r={radius} fill="none" strokeWidth={10} stroke="var(--color-muted)" />
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            strokeWidth={10}
            stroke={stroke}
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={circumference - (clamped / 100) * circumference}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center" aria-hidden="true">
          <span className="font-display text-3xl font-semibold leading-none text-foreground">{clamped}</span>
          <span className="mt-1 text-[0.65rem] font-semibold tracking-widest text-muted-foreground">{label}</span>
        </div>
      </div>
      {caption ? <p className="text-xs text-muted-foreground">{caption}</p> : null}
    </div>
  );
}

export function ScoreBar({ label, value }: { label: string; value: number }) {
  const clamped = Math.max(0, Math.min(100, Math.round(value)));
  const { stroke } = tone(clamped);
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-sm">
        <span className="text-muted-foreground">{label}</span>
        <span className="font-medium text-foreground">{clamped}</span>
      </div>
      <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
        <div className="h-full rounded-full transition-all" style={{ width: `${clamped}%`, backgroundColor: stroke }} />
      </div>
    </div>
  );
}
