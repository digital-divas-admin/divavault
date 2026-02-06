import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ImageIcon, Cpu, DollarSign, ArrowRight } from "lucide-react";

export function HowEarningsWork() {
  const steps = [
    {
      icon: ImageIcon,
      title: "Photos Train Models",
      description:
        "Your contributed photos are used to train AI models ethically and with consent.",
    },
    {
      icon: Cpu,
      title: "Models Are Licensed",
      description:
        "Trained models are licensed to businesses and platforms that use AI-generated content.",
    },
    {
      icon: DollarSign,
      title: "Revenue Flows Back",
      description:
        "A share of licensing revenue is distributed back to contributors based on their contribution.",
    },
  ];

  return (
    <Card className="border-border/50 bg-card/50 rounded-xl">
      <CardHeader>
        <CardTitle className="text-base">How Earnings Work</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid sm:grid-cols-3 gap-4">
          {steps.map((step, i) => (
            <div key={step.title} className="relative">
              <div className="flex flex-col items-center text-center p-4">
                <div className="rounded-full bg-muted/50 p-3 mb-3">
                  <step.icon className="h-5 w-5 text-neon" />
                </div>
                <h4 className="text-sm font-medium mb-1">{step.title}</h4>
                <p className="text-xs text-muted-foreground">
                  {step.description}
                </p>
              </div>
              {i < steps.length - 1 && (
                <ArrowRight className="hidden sm:block h-4 w-4 text-muted-foreground/40 absolute right-0 top-1/2 -translate-y-1/2 translate-x-1/2 z-10" />
              )}
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
