const levels = [
  0, 1, 0, 2, 0, 1, 3, 0, 1, 0, 2, 0, 0, 3, 1, 0, 2, 0, 1, 0, 0, 1, 0, 3, 2, 0,
  1, 0, 0, 2, 1, 0, 3, 0, 1, 0,
];

const levelClass: Record<number, string> = {
  0: "bg-muted border border-border",
  1: "bg-brand-primary/20",
  2: "bg-brand-accent/45",
  3: "bg-brand-accent",
};

export function RiskGrid() {
  return (
    <div className="rounded-2xl border border-border bg-background p-5 shadow-sm">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-muted-foreground">
          repository heatmap · preview
        </span>
        <span className="flex h-2 w-2 rounded-full bg-brand-accent" />
      </div>

      <div className="mt-4 grid grid-cols-6 gap-2">
        {levels.map((level, i) => (
          <div
            key={i}
            className={`aspect-square rounded-md ${levelClass[level]}`}
          />
        ))}
      </div>

      <div className="mt-5 flex items-center justify-between border-t border-border pt-4 text-xs text-muted-foreground">
        <div className="flex items-center gap-4">
          <span className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-sm bg-muted border border-border" />
            low
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-sm bg-brand-accent/45" />
            medium
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-sm bg-brand-accent" />
            high
          </span>
        </div>
        <span>36 components</span>
      </div>
    </div>
  );
}
