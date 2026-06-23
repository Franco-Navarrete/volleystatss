import { TEAM_GENDER_LABEL, type TeamGender } from "@/lib/volley-store";

export type GenderFilterValue = TeamGender | "all";

export function GenderFilter({
  value,
  onChange,
}: {
  value: GenderFilterValue;
  onChange: (value: GenderFilterValue) => void;
}) {
  const options: { value: GenderFilterValue; label: string }[] = [
    { value: "all", label: "Todos" },
    { value: "F", label: TEAM_GENDER_LABEL.F },
    { value: "M", label: TEAM_GENDER_LABEL.M },
  ];

  return (
    <div className="inline-flex items-center gap-1 rounded-lg bg-card border border-border/60 p-1">
      {options.map((opt) => {
        const active = value === opt.value;
        return (
          <button
            key={opt.value}
            type="button"
            onClick={() => onChange(opt.value)}
            className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-colors ${
              active
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:text-foreground hover:bg-secondary/50"
            }`}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}
