import {
  Banknote,
  ListTodo,
  BookOpen,
  UserPlus,
  Brain,
  Shield,
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

const features = [
  {
    icon: Banknote,
    title: "Loan pipeline",
    description:
      "Track your open loans, milestones, and conditions. Loan officers see what they own; managers see branch context where permissions allow.",
    badge: "Core",
    badgeVariant: "secondary" as const,
    color: "primary",
  },
  {
    icon: ListTodo,
    title: "Daily action items",
    description:
      "AI-assisted prioritization highlights follow-ups before they slip. Pair with tasks and notifications so nothing gets lost between systems.",
    badge: "AI-Powered",
    badgeVariant: "default" as const,
    color: "primary",
  },
  {
    icon: BookOpen,
    title: "Knowledge base + search",
    description:
      "Store SOPs, investor overlays, and training docs in one library. Semantic search helps the team find the right paragraph fast.",
    badge: "AI-Powered",
    badgeVariant: "default" as const,
    color: "success",
  },
  {
    icon: UserPlus,
    title: "Borrower portal",
    description:
      "Invite borrowers to a secure space for document uploads and condition status — fewer email threads, clearer handoffs.",
    badge: "Core",
    badgeVariant: "secondary" as const,
    color: "accent",
  },
  {
    icon: Brain,
    title: "AI chat",
    description:
      "Ask questions grounded in your knowledge base and safe loan context. Multi-provider routing behind the scenes.",
    badge: "AI-Powered",
    badgeVariant: "default" as const,
    color: "primary",
  },
  {
    icon: Shield,
    title: "Role-based workspace",
    description:
      "Admins, loan officers, branch managers, and support staff each see a tailored sidebar — minimal noise, right access.",
    badge: "Core",
    badgeVariant: "secondary" as const,
    color: "accent",
  },
];

const badgeStyles = {
  default: "bg-gradient-to-r from-primary to-secondary text-primary-foreground border-0",
  secondary: "bg-secondary text-secondary-foreground border-0",
  outline: "bg-mortgage-gold-light text-accent border-accent/30",
};

const iconBgColors = {
  primary: "bg-mortgage-teal-light border-primary/20",
  accent: "bg-mortgage-gold-light border-accent/20",
  success: "bg-mortgage-green-light border-success/20",
};

const iconColors = {
  primary: "text-primary",
  accent: "text-accent",
  success: "text-success",
};

export function FeatureGrid() {
  return (
    <section id="features" className="bg-gradient-to-b from-mortgage-cream to-background scroll-mt-20">
      <div className="mx-auto max-w-7xl px-6 py-20 lg:py-28">
        <div className="mx-auto max-w-3xl text-center">
          <h2 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
            What&apos;s in <span className="text-primary">Control Tower</span>
          </h2>
          <p className="mt-4 text-lg text-muted-foreground">
            A focused set of features for origination teams — pipeline, tasks, knowledge, AI, and
            borrower collaboration. No pretend “full LOS replacement” pitch.
          </p>
        </div>

        <div className="mx-auto mt-16 grid max-w-6xl gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {features.map((feature) => (
            <Card
              key={feature.title}
              className="group relative overflow-hidden border-border/50 bg-card transition-all hover:shadow-lg hover:border-primary/30"
            >
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div
                    className={`flex h-12 w-12 items-center justify-center rounded-xl border ${iconBgColors[feature.color as keyof typeof iconBgColors]}`}
                  >
                    <feature.icon className={`h-6 w-6 ${iconColors[feature.color as keyof typeof iconColors]}`} />
                  </div>
                  <Badge
                    variant={feature.badgeVariant}
                    className={`text-xs ${badgeStyles[feature.badgeVariant]}`}
                  >
                    {feature.badge}
                  </Badge>
                </div>
                <CardTitle className="text-lg mt-4 text-foreground group-hover:text-primary transition-colors">
                  {feature.title}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <CardDescription className="text-muted-foreground leading-relaxed">
                  {feature.description}
                </CardDescription>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
}
