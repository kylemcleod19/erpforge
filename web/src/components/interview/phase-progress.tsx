import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

export type InterviewPhase =
  | "intake"
  | "routing"
  | "modules"
  | "gap_analysis"
  | "review"
  | "compilation"
  | "complete";

const PHASES: { key: InterviewPhase; label: string }[] = [
  { key: "intake", label: "Intake" },
  { key: "routing", label: "Routing" },
  { key: "modules", label: "Modules" },
  { key: "gap_analysis", label: "Gap Analysis" },
  { key: "review", label: "Review" },
  { key: "compilation", label: "Compilation" },
  { key: "complete", label: "Complete" },
];

const PHASE_ORDER = PHASES.map((p) => p.key);

function phaseIndex(phase: InterviewPhase): number {
  return PHASE_ORDER.indexOf(phase);
}

interface PhaseProgressProps {
  currentPhase: InterviewPhase;
}

export function PhaseProgress({ currentPhase }: PhaseProgressProps) {
  const current = phaseIndex(currentPhase);

  return (
    <div className="w-full">
      <div className="flex items-center gap-0">
        {PHASES.map((phase, i) => {
          const done = i < current;
          const active = i === current;
          return (
            <div key={phase.key} className="flex items-center flex-1 last:flex-none">
              {/* Step indicator */}
              <div className="flex flex-col items-center gap-1">
                <div
                  className={cn(
                    "h-6 w-6 rounded-full flex items-center justify-center text-xs font-medium shrink-0 transition-colors",
                    done && "bg-primary text-primary-foreground",
                    active && "bg-primary text-primary-foreground ring-2 ring-primary ring-offset-2",
                    !done && !active && "bg-muted text-muted-foreground"
                  )}
                >
                  {done ? <Check className="h-3 w-3" /> : i + 1}
                </div>
                <span
                  className={cn(
                    "text-[10px] whitespace-nowrap hidden sm:block",
                    active && "text-foreground font-medium",
                    done && "text-muted-foreground",
                    !done && !active && "text-muted-foreground/50"
                  )}
                >
                  {phase.label}
                </span>
              </div>
              {/* Connector */}
              {i < PHASES.length - 1 && (
                <div
                  className={cn(
                    "h-px flex-1 mx-1 transition-colors",
                    i < current ? "bg-primary" : "bg-border"
                  )}
                />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
