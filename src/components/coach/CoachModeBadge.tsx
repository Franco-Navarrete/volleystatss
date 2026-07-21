import { Keyboard } from "lucide-react";
import { useCoachMode } from "@/lib/coach-mode-store";

export function CoachModeBadge() {
  const enabled = useCoachMode((s) => s.enabled);
  if (!enabled) return null;
  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-primary/40 bg-primary/10 text-primary px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider">
      <Keyboard className="size-3" /> Coach Mode
    </span>
  );
}
