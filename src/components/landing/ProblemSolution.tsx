import { Fragment } from "react";
import { Check, X } from "lucide-react";

const comparisons = [
  {
    oldWay: "Jumping between tools to check loan status and conditions",
    newWay: "One pipeline view with status, conditions, and what is blocking close",
  },
  {
    oldWay: "Chasing the team for updates on every file",
    newWay: "Notifications surface loan and task updates without the noise",
  },
  {
    oldWay: "Digging through shared drives for underwriting and product guidelines",
    newWay: "Knowledge base plus AI search finds answers from your team's docs in seconds",
  },
  {
    oldWay: "Starting each morning not sure what to tackle first",
    newWay: "AI-generated action items prioritize loans and tasks that need attention",
  },
  {
    oldWay: "No clear view of what is assigned to whom",
    newWay: "Tasks and action items show ownership and due dates for the whole team",
  },
];

export function ProblemSolution() {
  return (
    <section className="bg-gradient-to-b from-background to-mortgage-cream">
      <div className="mx-auto max-w-7xl px-6 py-20 lg:py-28">
        <div className="mx-auto max-w-3xl text-center">
          <h2 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
            Less Scrambling, <span className="text-destructive">More Flow</span>
          </h2>
          <p className="mt-4 text-lg text-muted-foreground">
            Control Tower is built for day-to-day loan operations — clear status, shared knowledge,
            and AI that helps the team stay aligned.
            <span className="font-medium text-foreground"> One place to work the file forward.</span>
          </p>
        </div>

        {/* Comparison Grid */}
        <div className="mx-auto mt-16 max-w-4xl">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 md:gap-6">
            {/* Headers */}
            <div className="hidden md:block rounded-xl bg-mortgage-red-light border border-destructive/20 p-4 text-center">
              <span className="text-sm font-semibold text-destructive uppercase tracking-wide">
                ❌ The Old Way
              </span>
            </div>
            <div className="hidden md:block rounded-xl bg-mortgage-green-light border border-success/20 p-4 text-center">
              <span className="text-sm font-semibold text-success uppercase tracking-wide">
                ✓ With Control Tower
              </span>
            </div>

            {/* Comparison Rows */}
            {comparisons.map((item, index) => (
              <Fragment key={index}>
                <div className="flex items-start gap-3 rounded-xl bg-mortgage-red-light/50 border border-destructive/10 p-4 md:p-5">
                  <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-destructive/20">
                    <X className="h-4 w-4 text-destructive" />
                  </div>
                  <p className="text-sm text-muted-foreground leading-relaxed">{item.oldWay}</p>
                </div>
                <div className="flex items-start gap-3 rounded-xl bg-mortgage-green-light/50 border border-success/10 p-4 md:p-5">
                  <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-success/20">
                    <Check className="h-4 w-4 text-success" />
                  </div>
                  <p className="text-sm text-foreground font-medium leading-relaxed">{item.newWay}</p>
                </div>
              </Fragment>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
