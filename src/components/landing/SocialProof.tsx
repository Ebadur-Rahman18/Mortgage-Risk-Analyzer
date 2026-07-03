import { Card, CardContent } from "@/components/ui/card";
import { Quote, TrendingUp, Clock, AlertTriangle, DollarSign } from "lucide-react";

const stats = [
  {
    icon: TrendingUp,
    value: "3×",
    label: "Faster morning standups",
    color: "text-primary",
    bgColor: "bg-mortgage-teal-light",
  },
  {
    icon: AlertTriangle,
    value: "9",
    label: "Avg. open action items cleared/week",
    color: "text-success",
    bgColor: "bg-mortgage-green-light",
  },
  {
    icon: Clock,
    value: "15m",
    label: "Saved finding policy answers",
    color: "text-accent",
    bgColor: "bg-mortgage-gold-light",
  },
  {
    icon: DollarSign,
    value: "1 hub",
    label: "Loans, tasks, knowledge together",
    color: "text-success",
    bgColor: "bg-mortgage-green-light",
  },
];

const testimonials = [
  {
    quote:
      "We stopped screenshotting LOS screens into Slack. The team sees the same action items and knowledge in Control Tower.",
    author: "Jordan K.",
    role: "Loan Officer, Independent broker",
    metric: "Less context switching",
    metricColor: "text-accent",
  },
  {
    quote:
      "Support staff finally has a home for assigned tasks and AI answers from our guidelines — without touching the full pipeline.",
    author: "Alex P.",
    role: "Processing lead, Regional lender",
    metric: "Clearer ownership",
    metricColor: "text-success",
  },
  {
    quote:
      "Borrower uploads through the portal cut 'did you get my PDF?' emails way down.",
    author: "Riley N.",
    role: "Branch manager, Credit union",
    metric: "Fewer chase emails",
    metricColor: "text-primary",
  },
];

export function SocialProof() {
  return (
    <section className="bg-gradient-to-b from-background to-mortgage-cream">
      <div className="mx-auto max-w-7xl px-6 py-20 lg:py-28">
        <div className="mx-auto max-w-3xl text-center">
          <h2 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
            Teams running files on <span className="text-primary">Control Tower</span>
          </h2>
          <p className="mt-4 text-lg text-muted-foreground">
            Loan officers, processors, and branch leads use a shared workspace for status, tasks,
            knowledge, and AI — without a heavyweight control-tower rollout.
          </p>
        </div>

        {/* Testimonials */}
        <div className="mx-auto mt-16 grid max-w-5xl gap-8 md:grid-cols-3">
          {testimonials.map((testimonial, index) => (
            <Card 
              key={index} 
              className="relative overflow-hidden border-2 border-primary/10 bg-card hover:border-primary/30 transition-all"
            >
              {/* Gradient accent */}
              <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-primary via-accent to-success" />
              
              <CardContent className="p-6">
                <Quote className="h-8 w-8 text-primary/30 mb-4" />
                <p className="text-foreground leading-relaxed mb-6 italic">
                  "{testimonial.quote}"
                </p>
                <div className="flex items-center justify-between border-t border-border pt-4">
                  <div>
                    <p className="font-semibold text-foreground">{testimonial.author}</p>
                    <p className="text-sm text-muted-foreground">{testimonial.role}</p>
                  </div>
                  <span className={`text-sm font-bold ${testimonial.metricColor}`}>
                    {testimonial.metric}
                  </span>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Stats Grid */}
        <div className="mx-auto mt-16 grid max-w-4xl grid-cols-2 gap-6 sm:grid-cols-4">
          {stats.map((stat) => (
            <div
              key={stat.label}
              className={`flex flex-col items-center rounded-xl ${stat.bgColor} border border-border/50 p-6 text-center transition-all hover:shadow-md`}
            >
              <stat.icon className={`h-8 w-8 ${stat.color} mb-3`} />
              <span className={`text-3xl font-bold ${stat.color}`}>{stat.value}</span>
              <span className="mt-1 text-sm text-muted-foreground">{stat.label}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
