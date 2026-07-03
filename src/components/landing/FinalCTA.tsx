import { Button } from "@/components/ui/button";
import { ArrowRight, Play, CheckCircle, Clock, CreditCard } from "lucide-react";
import { Link } from "react-router-dom";

export function FinalCTA() {
  return (
    <section className="mx-auto max-w-7xl px-6 py-20 lg:py-28">
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-secondary via-primary to-secondary">
        {/* Decorative elements */}
        <div className="absolute inset-0 -z-10">
          <div className="absolute top-0 right-0 h-64 w-64 rounded-full bg-accent/20 blur-3xl" />
          <div className="absolute bottom-0 left-0 h-64 w-64 rounded-full bg-success/20 blur-3xl" />
        </div>
        
        <div className="px-8 py-16 sm:px-16 sm:py-20 text-center">
          <h2 className="text-3xl font-bold tracking-tight text-primary-foreground sm:text-4xl lg:text-5xl">
            Ready to simplify your loan workflow?
          </h2>
          <p className="text-2xl md:text-3xl text-primary-foreground/80 font-medium mt-2">
            Less noise. Clear tasks. Shared knowledge.
          </p>

          <p className="mx-auto mt-6 max-w-2xl text-lg leading-relaxed text-primary-foreground/70">
            Control Tower helps your team close the loop on status, action items, and borrower
            follow-through — with AI that respects your roles and your docs.
          </p>

          {/* CTAs */}
          <div className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row">
            <Button
              size="lg"
              variant="secondary"
              className="h-14 rounded-full px-10 text-base font-semibold shadow-lg bg-white text-secondary hover:bg-white/90"
              asChild
            >
              <Link to="/signup">
                Get Started
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
            <Button
              size="lg"
              variant="outline"
              className="h-14 rounded-full px-10 text-base font-semibold border-primary-foreground/30 text-primary-foreground hover:bg-primary-foreground/10 bg-transparent"
              asChild
            >
              <Link to="/login">
                <Play className="mr-2 h-4 w-4" />
                Sign In
              </Link>
            </Button>
          </div>

          {/* Trust Line with icons */}
          <div className="mt-10 flex flex-wrap items-center justify-center gap-6 text-sm text-primary-foreground/70">
            <div className="flex items-center gap-2">
              <CreditCard className="h-4 w-4" />
              <span>No credit card required to explore</span>
            </div>
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4" />
              <span>Get your team on one workspace</span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle className="h-4 w-4" />
              <span>Aligned with how Control Tower ships today</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
