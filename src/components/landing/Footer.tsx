import { Link } from "react-router-dom";
import { Linkedin, Twitter } from "lucide-react";
import logoUrl from "@/assets/mortgageai-logo.svg";

const product = [
  { name: "Features", href: "#features" },
  { name: "Sign in", href: "/login", isRoute: true },
];

const company = [
  { name: "Documentation", href: "/knowledge", isRoute: true },
  { name: "Support", href: "/feedback", isRoute: true },
];

const legal = [
  { name: "Privacy Policy", href: "#" },
  { name: "Terms of Service", href: "#" },
];

export function Footer() {
  const renderLink = (item: { name: string; href: string; isRoute?: boolean }) => {
    if (item.isRoute) {
      return (
        <Link
          to={item.href}
          className="text-sm text-secondary-foreground/70 hover:text-primary transition-colors"
        >
          {item.name}
        </Link>
      );
    }
    return (
      <a
        href={item.href}
        className="text-sm text-secondary-foreground/70 hover:text-primary transition-colors"
      >
        {item.name}
      </a>
    );
  };

  return (
    <footer className="bg-secondary text-secondary-foreground">
      <div className="mx-auto max-w-7xl px-6 py-16 lg:py-20">
        <div className="grid grid-cols-2 gap-8 md:grid-cols-4">
          {/* Brand Column */}
          <div className="col-span-2">
            <Link to="/" className="flex items-center gap-3 mb-4 group">
              <div className="flex flex-col gap-0.5 rounded-lg bg-white/95 px-3 py-2 shadow-sm group-hover:bg-white transition-colors">
                <img src={logoUrl} alt="MortgageAI" className="h-6 w-auto" />
                <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-600">
                  Control Tower
                </span>
              </div>
            </Link>
            <p className="text-sm text-secondary-foreground/70 leading-relaxed mb-4">
              Your loan pipeline. Simplified. The streamlined command center for modern mortgage teams.
            </p>
            <div className="flex gap-4">
              <a
                href="#"
                className="flex h-9 w-9 items-center justify-center rounded-lg bg-secondary-foreground/10 hover:bg-primary transition-colors"
              >
                <Linkedin className="h-4 w-4" />
              </a>
              <a
                href="#"
                className="flex h-9 w-9 items-center justify-center rounded-lg bg-secondary-foreground/10 hover:bg-primary transition-colors"
              >
                <Twitter className="h-4 w-4" />
              </a>
            </div>
          </div>

          <div>
            <h3 className="font-semibold text-sm uppercase tracking-wide mb-4 text-primary">Product</h3>
            <ul className="space-y-3">
              {product.map((item) => (
                <li key={item.name}>{renderLink(item)}</li>
              ))}
            </ul>
          </div>

          <div>
            <h3 className="font-semibold text-sm uppercase tracking-wide mb-4 text-primary">Company</h3>
            <ul className="space-y-3">
              {company.map((item) => (
                <li key={item.name}>{renderLink(item)}</li>
              ))}
              {legal.map((item) => (
                <li key={item.name}>{renderLink(item)}</li>
              ))}
            </ul>
          </div>
        </div>

        <div className="mt-12 flex flex-col items-center justify-between gap-4 border-t border-secondary-foreground/10 pt-8 md:flex-row">
          <p className="text-sm text-secondary-foreground/50">
            © {new Date().getFullYear()} Mortgage Control Tower Lite. All rights reserved.
          </p>
          <p className="text-sm text-secondary-foreground/50">
            support@mortgagecontroltower.com
          </p>
        </div>
      </div>
    </footer>
  );
}
