import { Badge } from "@/components/ui/badge";
import { Shield, Lock, CheckCircle } from "lucide-react";

export function PricingHero() {
  return (
    <section className="relative py-20 overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-br from-mortgage-cream via-white to-mortgage-teal/5" />
      <div className="absolute top-0 right-0 w-1/2 h-full bg-gradient-to-l from-mortgage-teal/10 to-transparent" />

      <div className="relative mx-auto max-w-7xl px-6">
        <div className="text-center max-w-4xl mx-auto">
          <Badge className="bg-gradient-to-r from-blue-600 to-blue-700 text-white border-0 px-4 py-2 text-sm mb-6">
            <Shield className="w-4 h-4 mr-2" />
            Enterprise-Grade Security
          </Badge>

          <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold text-mortgage-navy mb-6">
            Simple plans for{" "}
            <span className="bg-gradient-to-r from-mortgage-teal to-mortgage-teal/80 bg-clip-text text-transparent">
              every team
            </span>
          </h1>

          <p className="text-xl md:text-2xl text-muted-foreground mb-8 max-w-3xl mx-auto">
            One unified dashboard for your loan pipeline.
            <span className="text-mortgage-teal font-semibold"> Hours saved every week.</span>
          </p>

          <div className="flex flex-wrap justify-center gap-4 mb-8">
            <div className="flex items-center gap-2 bg-white/80 backdrop-blur-sm border border-border/50 rounded-full px-4 py-2 shadow-sm">
              <Lock className="w-4 h-4 text-blue-600" />
              <span className="text-sm font-medium">Row-Level Security</span>
            </div>
            <div className="flex items-center gap-2 bg-white/80 backdrop-blur-sm border border-border/50 rounded-full px-4 py-2 shadow-sm">
              <CheckCircle className="w-4 h-4 text-mortgage-success" />
              <span className="text-sm font-medium">FINRA Compliant</span>
            </div>
            <div className="flex items-center gap-2 bg-white/80 backdrop-blur-sm border border-border/50 rounded-full px-4 py-2 shadow-sm">
              <CheckCircle className="w-4 h-4 text-mortgage-success" />
              <span className="text-sm font-medium">HIPAA Ready</span>
            </div>
            <div className="flex items-center gap-2 bg-white/80 backdrop-blur-sm border border-border/50 rounded-full px-4 py-2 shadow-sm">
              <CheckCircle className="w-4 h-4 text-mortgage-success" />
              <span className="text-sm font-medium">GDPR Compliant</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

