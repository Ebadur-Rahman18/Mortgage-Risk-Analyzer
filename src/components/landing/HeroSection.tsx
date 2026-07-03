import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowRight, Play, Shield, Link2, Brain, TrendingUp, AlertTriangle, Clock, CheckCircle } from "lucide-react";

export function HeroSection() {
  return (
    <section className="relative overflow-hidden bg-gradient-to-b from-mortgage-cream via-background to-background">
      {/* Decorative background elements */}
      <div className="absolute inset-0 -z-10">
        <div className="absolute top-0 left-1/4 h-96 w-96 rounded-full bg-gradient-to-br from-primary/20 to-transparent blur-3xl" />
        <div className="absolute top-1/3 right-1/4 h-64 w-64 rounded-full bg-gradient-to-bl from-accent/15 to-transparent blur-3xl" />
        <div className="absolute bottom-0 left-1/2 h-72 w-72 -translate-x-1/2 rounded-full bg-gradient-to-t from-success/10 to-transparent blur-3xl" />
      </div>

      <div className="mx-auto max-w-7xl px-6 py-16 sm:py-24 lg:py-32">
        <div className="grid gap-12 lg:grid-cols-2 lg:gap-16 items-center">
          {/* Left Column - Content */}
          <div className="flex flex-col items-start text-left">
            {/* Trust Badge */}
            <Badge 
              variant="outline" 
              className="mb-6 rounded-full border-primary/30 bg-mortgage-teal-light px-4 py-1.5 text-sm font-medium text-primary"
            >
              <Shield className="mr-2 h-4 w-4 text-primary" />
              Built for mortgage teams
            </Badge>

            {/* Headline */}
            <h1 className="text-4xl font-bold tracking-tight text-foreground sm:text-5xl lg:text-6xl">
              <span className="bg-gradient-to-r from-primary via-secondary to-primary bg-clip-text text-transparent">
                Your Loan Pipeline.
              </span>
              <br />
              Your Team. One Hub.
            </h1>
            <p className="mt-2 text-sm font-medium text-muted-foreground">
              Mortgage Control Tower Lite
            </p>

            {/* Subheadline */}
            <p className="mt-6 text-xl text-muted-foreground leading-relaxed max-w-xl">
              Loan officers, support staff, and branch leads get{" "}
              <strong className="text-foreground">AI action items</strong>, a shared knowledge
              base, and live loan status — without spreadsheet chaos or feature bloat.
            </p>

            {/* Trust Indicators */}
            <div className="mt-8 flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
              <div className="flex items-center gap-2 rounded-full bg-mortgage-teal-light px-3 py-1.5">
                <Brain className="h-4 w-4 text-primary" />
                <span className="text-foreground font-medium">AI-powered</span>
              </div>
              <div className="flex items-center gap-2 rounded-full bg-mortgage-gold-light px-3 py-1.5">
                <Link2 className="h-4 w-4 text-accent" />
                <span className="text-foreground font-medium">Borrower portal</span>
              </div>
              <div className="flex items-center gap-2 rounded-full bg-mortgage-green-light px-3 py-1.5">
                <Shield className="h-4 w-4 text-success" />
                <span className="text-foreground font-medium">Role-based access</span>
              </div>
            </div>

            {/* CTAs */}
            <div className="mt-10 flex flex-wrap items-center gap-4">
              <Button
                size="lg"
                className="h-14 rounded-full px-8 text-base font-semibold shadow-lg bg-gradient-to-r from-primary to-secondary hover:from-primary/90 hover:to-secondary/90"
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
                className="h-14 rounded-full px-8 text-base font-semibold border-primary/30 hover:bg-mortgage-teal-light"
                asChild
              >
                <Link to="/login">
                  <Play className="mr-2 h-4 w-4 text-primary" />
                  Sign In
                </Link>
              </Button>
            </div>
          </div>

          {/* Right Column - Dashboard Preview */}
          <div className="relative">
            {/* Gradient border effect */}
            <div className="absolute -inset-1 rounded-2xl bg-gradient-to-br from-primary via-accent to-success opacity-20 blur-sm" />
            
            <div className="relative rounded-xl border border-border/50 bg-card p-6 shadow-2xl">
              {/* Dashboard Header */}
              <div className="mb-6 flex items-center justify-between border-b border-border pb-4">
                <div className="flex items-center gap-2">
                  <div className="h-3 w-3 rounded-full bg-destructive" />
                  <div className="h-3 w-3 rounded-full bg-accent" />
                  <div className="h-3 w-3 rounded-full bg-success" />
                </div>
                <span className="text-xs font-medium text-muted-foreground">Control Tower snapshot</span>
              </div>

              {/* Metrics Cards */}
              <div className="grid grid-cols-2 gap-4 mb-6">
                <div className="rounded-lg bg-mortgage-teal-light border border-primary/20 p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <TrendingUp className="h-4 w-4 text-primary" />
                    <span className="text-xs text-primary font-medium">My active loans</span>
                  </div>
                  <p className="text-2xl font-bold text-primary">24</p>
                </div>
                <div className="rounded-lg bg-mortgage-gold-light border border-accent/20 p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <Clock className="h-4 w-4 text-accent" />
                    <span className="text-xs text-accent font-medium">Open action items</span>
                  </div>
                  <p className="text-2xl font-bold text-accent">9</p>
                </div>
                <div className="rounded-lg bg-mortgage-green-light border border-success/20 p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <CheckCircle className="h-4 w-4 text-success" />
                    <span className="text-xs text-success font-medium">Knowledge docs</span>
                  </div>
                  <p className="text-2xl font-bold text-success">47</p>
                </div>
                <div className="rounded-lg bg-mortgage-red-light border border-destructive/20 p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <AlertTriangle className="h-4 w-4 text-destructive" />
                    <span className="text-xs text-destructive font-medium">Tasks due today</span>
                  </div>
                  <p className="text-2xl font-bold text-destructive">5</p>
                </div>
              </div>

              {/* Pipeline Stages */}
              <div className="space-y-3">
                <div className="flex items-center justify-between text-sm">
                  <span className="font-medium text-foreground">Loan stages</span>
                  <span className="text-muted-foreground">Sample mix</span>
                </div>
                <div className="flex gap-1.5">
                  {[
                    { name: "Application", value: 35, color: "bg-primary" },
                    { name: "Processing", value: 28, color: "bg-info" },
                    { name: "Underwriting", value: 20, color: "bg-accent" },
                    { name: "CTC", value: 12, color: "bg-success" },
                    { name: "Closing", value: 5, color: "bg-secondary" },
                  ].map((stage) => (
                    <div
                      key={stage.name}
                      className={`h-3 rounded-full ${stage.color}`}
                      style={{ width: `${stage.value}%` }}
                      title={`${stage.name}: ${stage.value}%`}
                    />
                  ))}
                </div>
                <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
                  {[
                    { name: "Application", color: "bg-primary" },
                    { name: "Processing", color: "bg-info" },
                    { name: "Underwriting", color: "bg-accent" },
                    { name: "CTC", color: "bg-success" },
                    { name: "Closing", color: "bg-secondary" },
                  ].map((stage) => (
                    <div key={stage.name} className="flex items-center gap-1.5">
                      <div className={`h-2 w-2 rounded-full ${stage.color}`} />
                      <span>{stage.name}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
