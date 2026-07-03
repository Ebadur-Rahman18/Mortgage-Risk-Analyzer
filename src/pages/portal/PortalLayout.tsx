import { Outlet, Link } from "react-router-dom";
import { Home } from "lucide-react";

export default function PortalLayout() {
  return (
    <div className="min-h-screen bg-muted/30">
      <header className="border-b bg-background">
        <div className="mx-auto flex h-14 max-w-3xl items-center justify-between px-4">
          <span className="text-sm font-semibold tracking-tight">Borrower document portal</span>
          <Link
            to="/"
            className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
          >
            <Home className="h-3.5 w-3.5" />
            Lender site
          </Link>
        </div>
      </header>
      <main className="mx-auto max-w-3xl px-4 py-8">
        <Outlet />
      </main>
    </div>
  );
}
