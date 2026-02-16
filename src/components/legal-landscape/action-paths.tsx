"use client";

import Link from "next/link";
import { AlertTriangle, ShieldCheck, Building2 } from "lucide-react";
import {
  Accordion,
  AccordionItem,
  AccordionTrigger,
  AccordionContent,
} from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { ProtectionLevel } from "@/data/legal-landscape/types";

interface ActionPathsProps {
  protectionLevel: ProtectionLevel;
  stateName: string;
  className?: string;
}

function getSteps(
  protectionLevel: ProtectionLevel,
  stateName: string
): Array<{
  id: string;
  title: string;
  icon: typeof AlertTriangle;
  steps: string[];
  ctaLabel: string;
  ctaHref: string;
}> {
  const hasStrongLaw = protectionLevel === "strong";
  const hasModerateLaw = protectionLevel === "moderate";
  const hasBasicLaw = protectionLevel === "basic";

  return [
    {
      id: "unauthorized",
      title: "I found unauthorized AI content of me",
      icon: AlertTriangle,
      steps: hasStrongLaw
        ? [
            `Document the unauthorized use \u2014 ${stateName} law requires evidence of commercial exploitation.`,
            "Capture screenshots, URLs, and timestamps of the infringing content.",
            `File a complaint under ${stateName}'s digital likeness statute for statutory damages.`,
            "Submit a DMCA takedown request to the hosting platform.",
            "Use Consented AI to automate detection and takedowns across 247+ platforms.",
          ]
        : hasModerateLaw
          ? [
              "Document the unauthorized content with screenshots and URLs.",
              `Review ${stateName}'s applicable likeness or publicity rights statutes.`,
              "File a DMCA takedown request with the hosting platform.",
              "Consult an attorney about pursuing damages under state law.",
              "Use Consented AI to continuously monitor for future unauthorized use.",
            ]
          : hasBasicLaw
            ? [
                "Gather evidence of the unauthorized use including screenshots and links.",
                `${stateName} has limited statutory protections \u2014 consider consulting an attorney about common law claims.`,
                "File a DMCA takedown request with the hosting platform.",
                "Report the content to the platform's trust and safety team.",
                "Use Consented AI to establish a verified likeness record and automate future takedowns.",
              ]
            : [
                "Collect all evidence of the unauthorized use.",
                `${stateName} currently lacks specific AI likeness protections \u2014 legal options may be limited.`,
                "File a DMCA takedown request with the hosting platform as a first step.",
                "Consult an attorney about potential common law or privacy claims.",
                "Use Consented AI to create a verifiable likeness record that strengthens any legal action.",
              ],
      ctaLabel: "Start Protecting Now",
      ctaHref: "/signup",
    },
    {
      id: "proactive",
      title: "I want to protect myself proactively",
      icon: ShieldCheck,
      steps: hasStrongLaw
        ? [
            "Create a verified likeness record with Consented AI to establish proof of identity.",
            `Register your likeness under ${stateName}'s digital replica protections.`,
            "Enable continuous monitoring across 247+ AI platforms and marketplaces.",
            "Set up automated DMCA takedowns for any unauthorized matches.",
            "Configure consent preferences to control how your likeness may be used.",
          ]
        : hasModerateLaw
          ? [
              "Create a verified likeness record with Consented AI before unauthorized use occurs.",
              "Enable proactive scanning across AI model platforms and image marketplaces.",
              "Set up automated takedown workflows to respond quickly to violations.",
              `Document your likeness to strengthen any claims under ${stateName} law.`,
              "Stay informed about pending legislation that may expand your protections.",
            ]
          : [
              "Establish a verified likeness record with Consented AI as your first line of defense.",
              "Enable continuous AI platform monitoring to catch unauthorized use early.",
              "Build a documented history of your likeness for potential legal claims.",
              `Since ${stateName} has limited protections, a strong evidence record is especially important.`,
              "Advocate for stronger AI likeness protections in your state.",
            ],
      ctaLabel: "Get Protected",
      ctaHref: "/signup",
    },
    {
      id: "business",
      title: "I'm a business using AI-generated faces",
      icon: Building2,
      steps: hasStrongLaw
        ? [
            `Audit your AI content pipeline for compliance with ${stateName}'s digital likeness laws.`,
            "Obtain verifiable consent before using any real person's likeness in AI-generated content.",
            "Implement opt-out mechanisms to allow individuals to remove their likenesses.",
            "Maintain records of consent and licensing for all AI-generated content featuring real faces.",
            "Partner with Consented AI to verify that your AI content does not infringe on protected likenesses.",
          ]
        : hasModerateLaw
          ? [
              `Review ${stateName}'s publicity rights and likeness statutes for compliance requirements.`,
              "Establish a consent framework for any AI-generated content featuring real faces.",
              "Conduct regular audits of your AI training data for unauthorized likenesses.",
              "Implement processes to respond to takedown requests promptly.",
              "Use Consented AI to verify AI-generated faces against our protected likeness database.",
            ]
          : [
              "Even without strong state laws, best practices require consent for likeness use.",
              "Develop internal policies for responsible AI-generated content creation.",
              "Monitor evolving federal and state legislation that may impose new requirements.",
              "Prepare for stricter regulations by implementing consent and opt-out frameworks now.",
              "Partner with Consented AI to proactively verify your content against protected likenesses.",
            ],
      ctaLabel: "Learn More",
      ctaHref: "/signup",
    },
  ];
}

export function ActionPaths({
  protectionLevel,
  stateName,
  className,
}: ActionPathsProps) {
  const paths = getSteps(protectionLevel, stateName);

  return (
    <Accordion type="single" collapsible className={cn(className)}>
      {paths.map((path) => {
        const Icon = path.icon;

        return (
          <AccordionItem key={path.id} value={path.id}>
            <AccordionTrigger className="text-sm">
              <span className="flex items-center gap-2">
                <Icon className="size-4 shrink-0 text-muted-foreground" />
                {path.title}
              </span>
            </AccordionTrigger>
            <AccordionContent>
              <ol className="list-decimal list-inside space-y-2 text-muted-foreground mb-4">
                {path.steps.map((step, i) => (
                  <li key={i} className="leading-relaxed">
                    {step}
                  </li>
                ))}
              </ol>
              <Button asChild size="sm">
                <Link href={path.ctaHref}>{path.ctaLabel}</Link>
              </Button>
            </AccordionContent>
          </AccordionItem>
        );
      })}
    </Accordion>
  );
}
