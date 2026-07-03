import { Link, useLocation } from "react-router-dom";
import { LogIn } from "lucide-react";
import logoUrl from "@/assets/mortgageai-logo.svg";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface PublicDocsLayoutProps {
  children: React.ReactNode;
}

const docsNav = [
  { name: "Vision", href: "/docs/vision" },
  { name: "Backlog", href: "/docs/backlog" },
  { name: "Technical", href: "/docs/technical" },
  { name: "Roadmap", href: "/docs/roadmap" },
];

export function PublicDocsLayout({ children }: PublicDocsLayoutProps) {
  const location = useLocation();

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <header className="sticky top-0 z-50 w-full border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="mx-auto max-w-7xl px-6">
          <div className="flex h-16 items-center justify-between">
            {/* Logo */}
            <Link to="/" className="flex items-center gap-3">
              <div className="flex flex-col gap-0.5 rounded-lg bg-white px-3 py-1.5 shadow-sm border border-border">
                <img src={logoUrl} alt="MortgageAI" className="h-5 w-auto" />
                <span className="text-[9px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                  Control Tower
                </span>
              </div>
              <span className="text-muted-foreground text-sm">Docs</span>
            </Link>

            {/* Navigation */}
            <nav className="hidden md:flex items-center gap-1">
              {docsNav.map((item) => (
                <Link
                  key={item.href}
                  to={item.href}
                  className={cn(
                    "px-4 py-2 rounded-md text-sm font-medium transition-colors",
                    location.pathname === item.href
                      ? "bg-primary/10 text-primary"
                      : "text-muted-foreground hover:text-foreground hover:bg-muted"
                  )}
                >
                  {item.name}
                </Link>
              ))}
            </nav>

            {/* Login Button */}
            <Button asChild variant="outline" size="sm">
              <Link to="/login" className="flex items-center gap-2">
                <LogIn className="h-4 w-4" />
                Login
              </Link>
            </Button>
          </div>
        </div>

        {/* Mobile Navigation */}
        <div className="md:hidden border-t border-border">
          <div className="flex overflow-x-auto px-4 py-2 gap-1">
            {docsNav.map((item) => (
              <Link
                key={item.href}
                to={item.href}
                className={cn(
                  "px-3 py-1.5 rounded-md text-sm font-medium whitespace-nowrap transition-colors",
                  location.pathname === item.href
                    ? "bg-primary/10 text-primary"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted"
                )}
              >
                {item.name}
              </Link>
            ))}
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 py-8">
        <div className="mx-auto max-w-7xl px-6">
          {children}
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-border bg-muted/30">
        <div className="mx-auto max-w-7xl px-6 py-8">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <Link 
              to="/" 
              className="text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              ← Back to Homepage
            </Link>
            <p className="text-sm text-muted-foreground">
              © {new Date().getFullYear()} Mortgage Control Tower. All rights reserved.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
