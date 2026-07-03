import { Banknote, ListTodo, BookOpen } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

const valueProps = [
  {
    icon: Banknote,
    title: "Loan pipeline control",
    description:
      "See your loans, status, and conditions in one place. Loan officers stay focused on files that need movement; branch leads keep context without extra spreadsheets.",
    highlights: ["Status and conditions", "Scoped access by role", "Borrower portal handoffs"],
    color: "primary",
    bgColor: "bg-mortgage-teal-light",
    borderColor: "border-primary/20",
  },
  {
    icon: ListTodo,
    title: "AI action items",
    description:
      "Start the day with prioritized follow-ups. AI surfaces loans and tasks that deserve attention first — so the team spends less time deciding and more time closing.",
    highlights: ["Daily prioritization", "Assigned ownership", "Works with your notifications"],
    color: "accent",
    bgColor: "bg-mortgage-gold-light",
    borderColor: "border-accent/20",
  },
  {
    icon: BookOpen,
    title: "Shared knowledge + AI chat",
    description:
      "Upload guidelines, checklists, and product notes once. Everyone searches the same library, and AI chat answers from what your team actually published.",
    highlights: ["Central doc library", "Semantic search", "Grounded AI answers"],
    color: "success",
    bgColor: "bg-mortgage-green-light",
    borderColor: "border-success/20",
  },
];

const colorMap = {
  primary: {
    icon: "text-primary",
    badge: "bg-primary/10 text-primary border-primary/20",
  },
  accent: {
    icon: "text-accent",
    badge: "bg-accent/10 text-accent border-accent/20",
  },
  success: {
    icon: "text-success",
    badge: "bg-success/10 text-success border-success/20",
  },
};

export function ValueProps() {
  return (
    <section className="border-y border-border/50 bg-card">
      <div className="mx-auto max-w-7xl px-6 py-20 lg:py-28">
        <div className="mx-auto max-w-3xl text-center">
          <h2 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
            Built for <span className="text-primary">Loan Teams</span>, Not Spreadsheets
          </h2>
          <p className="mt-4 text-lg text-muted-foreground">
            Control Tower does not replace your LOS. It gives loan officers, processors, and leads a
            lightweight layer for status, tasks, knowledge, and AI — without enterprise bloat.
          </p>
        </div>

        {/* Value Proposition Cards */}
        <div className="mx-auto mt-16 grid max-w-5xl gap-8 md:grid-cols-3">
          {valueProps.map((prop) => {
            const colors = colorMap[prop.color as keyof typeof colorMap];
            return (
              <Card 
                key={prop.title} 
                className={`relative overflow-hidden ${prop.bgColor} ${prop.borderColor} border-2 transition-all hover:shadow-lg hover:-translate-y-1`}
              >
                <CardHeader>
                  <div className={`mb-4 flex h-14 w-14 items-center justify-center rounded-xl bg-card shadow-sm ${prop.borderColor} border`}>
                    <prop.icon className={`h-7 w-7 ${colors.icon}`} />
                  </div>
                  <CardTitle className="text-xl text-foreground">{prop.title}</CardTitle>
                  <CardDescription className="text-muted-foreground leading-relaxed">
                    {prop.description}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-wrap gap-2">
                    {prop.highlights.map((highlight) => (
                      <span
                        key={highlight}
                        className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-medium ${colors.badge}`}
                      >
                        {highlight}
                      </span>
                    ))}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>
    </section>
  );
}
