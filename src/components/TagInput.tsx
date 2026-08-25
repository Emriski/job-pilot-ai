import { useId, useState } from "react";
import { X } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function TagInput({
  label,
  hint,
  values,
  onChange,
  max = 20,
}: {
  label: string;
  hint?: string;
  values: string[];
  onChange: (values: string[]) => void;
  max?: number;
}) {
  const id = useId();
  const [draft, setDraft] = useState("");

  function commit() {
    const value = draft.trim().slice(0, 120);
    if (!value) return;
    if (values.some((item) => item.toLowerCase() === value.toLowerCase())) {
      setDraft("");
      return;
    }
    if (values.length >= max) return;
    onChange([...values, value]);
    setDraft("");
  }

  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      {hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
      <Input
        id={id}
        value={draft}
        placeholder="Type and press Enter"
        onChange={(event) => setDraft(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === ",") {
            event.preventDefault();
            commit();
          }
        }}
        onBlur={commit}
      />
      {values.length ? (
        <ul className="flex flex-wrap gap-1.5 pt-1">
          {values.map((value) => (
            <li key={value}>
              <Badge variant="secondary" className="gap-1 font-normal">
                {value}
                <button
                  type="button"
                  aria-label={`Remove ${value}`}
                  onClick={() => onChange(values.filter((item) => item !== value))}
                  className="rounded-full p-0.5 hover:bg-background/60"
                >
                  <X className="size-3" aria-hidden="true" />
                </button>
              </Badge>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
