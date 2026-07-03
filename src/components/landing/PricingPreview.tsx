import { Link } from "react-router-dom";
import { Check } from "lucide-react";
import { Button } from "@/components/ui/button";

/** Control Tower — honest checklist (no comparison to spreadsheets/LOS). */
const includedFeatures = [
  "Loan pipeline view (role-scoped)",
  "Borrowers and loan files (where you grant access)",
  "Tasks assigned to you and your team",
  "AI-generated action items and prioritization",
  "Knowledge base uploads and semantic search",
  "AI chat grounded on your knowledge library",
  "Notifications for loan and task updates",
  "Borrower portal — invites, uploads, condition tracking",
  "Role-based navigation — LO, manager, support staff, admin",
  "HubSpot pipeline views (when your tenant enables the module)",
];

export function PricingPreview() {
  return (
    <section className="border-y border-border/50 bg-card">
      <div className="mx-auto max-w-7xl px-6 py-20 lg:py-28">
        <div className="mx-auto max-w-3xl text-center">
          <h2 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
            See what&apos;s <span className="text-primary">included</span>
          </h2>
          <p className="mt-4 text-lg text-muted-foreground">
            Control Tower is a practical layer for day-to-day origination work — not a promise to
            replace your LOS or every enterprise integration on day one.
          </p>
        </div>

        <div className="mx-auto mt-16 max-w-2xl overflow-hidden rounded-xl border-2 border-primary/20 bg-card shadow-lg">
          <div className="border-b border-border bg-mortgage-teal-light/40 p-4 text-center">
            <span className="inline-flex items-center rounded-full bg-gradient-to-r from-primary to-secondary px-4 py-1.5 text-sm font-semibold text-primary-foreground">
              Control Tower
            </span>
          </div>
          <ul className="divide-y divide-border/60">
            {includedFeatures.map((line) => (
              <li
                key={line}
                className="flex items-start gap-3 p-4 text-sm text-foreground md:text-base"
              >
                <Check className="mt-0.5 h-5 w-5 shrink-0 text-success" aria-hidden />
                <span>{line}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="mt-12 text-center">
          <p className="text-muted-foreground mb-6">
            Ready to try Control Tower with your team? Sign in or create an account.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button
              size="lg"
              className="h-14 rounded-full px-10 text-base font-semibold shadow-lg bg-gradient-to-r from-primary to-secondary hover:from-primary/90 hover:to-secondary/90"
              asChild
            >
              <Link to="/signup">Get Started</Link>
            </Button>
            <Button
              size="lg"
              variant="outline"
              className="h-14 rounded-full px-10 text-base font-semibold border-2 border-primary hover:bg-primary/5"
              asChild
            >
              <Link to="/login">Sign In</Link>
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
}
