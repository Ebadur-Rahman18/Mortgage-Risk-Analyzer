import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Brain, Menu, X, Sparkles } from "lucide-react";
import { useState } from "react";
import {
  PricingHero,
  PricingCards,
  AgenticWorkforceList,
  ROICalculator,
  CollabAISecurityBadge,
} from "@/components/pricing";
import { Footer } from "@/components/landing/Footer";

export default function Pricing() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const navLinks = [
    { label: "Features", href: "/#features" },
  ];

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-50 border-b border-border/50 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
        <nav className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
          <Link to="/" className="flex items-center gap-3 group">
            <div className="relative flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-secondary shadow-md">
              <Brain className="h-5 w-5 text-primary-foreground" />
              <Sparkles className="absolute -top-1 -right-1 h-3 w-3 text-amber-400" />
            </div>
            <div className="hidden sm:flex flex-col leading-tight">
              <span className="font-bold text-foreground text-base">MCT Lite</span>
              <span className="text-xs text-muted-foreground">Mortgage Control Tower Lite</span>
            </div>
          </Link>

          <div className="hidden md:flex items-center gap-8">
            {navLinks.map((link) => (
              <Link
                key={link.label}
                to={link.href}
                className="text-sm font-medium text-muted-foreground hover:text-mortgage-teal transition-colors"
              >
                {link.label}
              </Link>
            ))}
          </div>

          <div className="hidden md:flex items-center gap-3">
            <Button variant="ghost" size="sm" asChild>
              <Link to="/login">Sign in</Link>
            </Button>
            <Button
              size="sm"
              className="rounded-full bg-gradient-to-r from-mortgage-teal to-mortgage-teal/90 hover:from-mortgage-teal/90 hover:to-mortgage-teal/80 text-white shadow-md"
              asChild
            >
              <Link to="/signup">Get Started</Link>
            </Button>
          </div>

          <button
            className="md:hidden p-2 text-muted-foreground hover:text-foreground"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          >
            {mobileMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
          </button>
        </nav>

        {mobileMenuOpen && (
          <div className="md:hidden border-t border-border bg-background px-6 py-4">
            <div className="flex flex-col gap-4">
              {navLinks.map((link) => (
                <Link
                  key={link.label}
                  to={link.href}
                  className="text-sm font-medium text-muted-foreground hover:text-mortgage-teal"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  {link.label}
                </Link>
              ))}
              <div className="flex flex-col gap-2 pt-4 border-t border-border">
                <Button variant="outline" size="sm" asChild>
                  <Link to="/login">Sign in</Link>
                </Button>
                <Button
                  size="sm"
                  className="rounded-full bg-gradient-to-r from-mortgage-teal to-mortgage-teal/90 text-white"
                  asChild
                >
                  <Link to="/signup">Get Started</Link>
                </Button>
              </div>
            </div>
          </div>
        )}
      </header>

      <main>
        <PricingHero />
        <PricingCards />
        <AgenticWorkforceList />
        <ROICalculator />
        <CollabAISecurityBadge />
      </main>

      <Footer />
    </div>
  );
}
