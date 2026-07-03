import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Check, Sparkles, Building2, Rocket } from "lucide-react";
import { cn } from "@/lib/utils";

const pricingTiers = [
  {
    name: "Starter",
    price: "$3,000",
    period: "per year",
    description: "Perfect for small brokers processing 5-15 loans/month",
    agents: "10 Advanced Agents",
    icon: Rocket,
    featured: false,
    features: [
      "10 Advanced AI Agents",
      "Email Intelligence Agent",
      "Document AI (Dual Engine)",
      "Real-time Dashboard",
      "Lock Expiry Alerts",
      "SLA Monitoring",
      "Enterprise-Grade Security",
      "Email Support",
    ],
    cta: "Get Started",
  },
  {
    name: "Professional",
    price: "$6,000",
    period: "per year",
    description: "For mid-size operations with 15-50 loans/month",
    agents: "25 Advanced Agents",
    icon: Sparkles,
    featured: true,
    features: [
      "25 Advanced AI Agents",
      "Everything in Starter",
      "Risk & Compliance Monitor",
      "Communication Center Agent",
      "Portfolio Analytics",
      "Custom Workflows",
      "Priority Support",
      "Quarterly Business Reviews",
    ],
    cta: "Start Free Trial",
  },
  {
    name: "Enterprise",
    price: "Custom",
    period: "contact sales",
    description: "For large operations processing 50+ loans/month",
    agents: "Unlimited Agents",
    icon: Building2,
    featured: false,
    features: [
      "Unlimited AI Agents",
      "Everything in Professional",
      "Dedicated Account Manager",
      "Custom Agent Training",
      "SSO & SAML Integration",
      "On-Premise Deployment Option",
      "24/7 Phone Support",
      "Custom SLA",
    ],
    cta: "Contact Sales",
  },
];

export function PricingCards() {
  return (
    <section className="py-20 bg-white">
      <div className="mx-auto max-w-7xl px-6">
        <div className="text-center mb-16">
          <h2 className="text-3xl md:text-4xl font-bold text-mortgage-navy mb-4">
            Simple, Transparent Pricing
          </h2>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Start with 10 agents and scale as your operation grows. All plans include enterprise-grade security.
          </p>
        </div>
        
        <div className="grid md:grid-cols-3 gap-8 max-w-6xl mx-auto">
          {pricingTiers.map((tier) => (
            <div
              key={tier.name}
              className={cn(
                "relative rounded-2xl border-2 p-8 transition-all duration-300",
                tier.featured
                  ? "border-mortgage-teal bg-gradient-to-b from-mortgage-teal/5 to-white shadow-xl scale-105 z-10"
                  : "border-border bg-white hover:border-mortgage-teal/50 hover:shadow-lg"
              )}
            >
              {tier.featured && (
                <Badge className="absolute -top-3 left-1/2 -translate-x-1/2 bg-gradient-to-r from-mortgage-gold to-amber-500 text-white border-0 px-4">
                  Most Popular
                </Badge>
              )}
              
              {/* Header */}
              <div className="text-center mb-6">
                <div className={cn(
                  "inline-flex items-center justify-center w-12 h-12 rounded-xl mb-4",
                  tier.featured 
                    ? "bg-gradient-to-br from-mortgage-teal to-mortgage-teal/80" 
                    : "bg-mortgage-navy/10"
                )}>
                  <tier.icon className={cn(
                    "w-6 h-6",
                    tier.featured ? "text-white" : "text-mortgage-navy"
                  )} />
                </div>
                <h3 className="text-xl font-bold text-mortgage-navy">{tier.name}</h3>
                <p className="text-sm text-muted-foreground mt-1">{tier.description}</p>
              </div>
              
              {/* Price */}
              <div className="text-center mb-6 pb-6 border-b border-border">
                <div className="flex items-baseline justify-center gap-1">
                  <span className={cn(
                    "text-4xl font-bold",
                    tier.featured ? "text-mortgage-teal" : "text-mortgage-navy"
                  )}>
                    {tier.price}
                  </span>
                </div>
                <span className="text-sm text-muted-foreground">{tier.period}</span>
                <div className="mt-2">
                  <Badge variant="secondary" className="bg-mortgage-teal/10 text-mortgage-teal border-0">
                    {tier.agents}
                  </Badge>
                </div>
              </div>
              
              {/* Features */}
              <ul className="space-y-3 mb-8">
                {tier.features.map((feature) => (
                  <li key={feature} className="flex items-start gap-3">
                    <Check className={cn(
                      "w-5 h-5 mt-0.5 flex-shrink-0",
                      tier.featured ? "text-mortgage-teal" : "text-mortgage-success"
                    )} />
                    <span className="text-sm text-foreground">{feature}</span>
                  </li>
                ))}
              </ul>
              
              {/* CTA */}
              <Button 
                className={cn(
                  "w-full",
                  tier.featured
                    ? "bg-gradient-to-r from-mortgage-teal to-mortgage-teal/90 hover:from-mortgage-teal/90 hover:to-mortgage-teal/80 text-white"
                    : "bg-mortgage-navy hover:bg-mortgage-navy/90 text-white"
                )}
                size="lg"
              >
                {tier.cta}
              </Button>
            </div>
          ))}
        </div>
        
        {/* Money-back guarantee */}
        <div className="text-center mt-12">
          <p className="text-sm text-muted-foreground">
            ✨ 30-day money-back guarantee • No credit card required for trial • Cancel anytime
          </p>
        </div>
      </div>
    </section>
  );
}
