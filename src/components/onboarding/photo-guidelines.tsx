"use client";

import { Card, CardContent } from "@/components/ui/card";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  Camera,
  CheckCircle2,
  XCircle,
} from "lucide-react";

export function PhotoGuidelines() {
  return (
    <Card className="border-neon/20 bg-neon/5 rounded-xl">
      <CardContent className="p-5">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-8 h-8 rounded-lg bg-neon/10 flex items-center justify-center shrink-0">
            <Camera className="w-4 h-4 text-neon" />
          </div>
          <div>
            <h3 className="font-semibold text-sm">Photo Guidelines for AI Training</h3>
            <p className="text-xs text-muted-foreground">
              Better photos = better AI model. Here&apos;s what works best.
            </p>
          </div>
        </div>

        <Accordion type="multiple" defaultValue={["what-to-include"]}>
          <AccordionItem value="what-to-include" className="border-border/30">
            <AccordionTrigger className="py-3 text-sm hover:no-underline">
              <span className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-green-500" />
                What we&apos;re looking for
              </span>
            </AccordionTrigger>
            <AccordionContent>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li className="flex gap-2">
                  <span className="text-green-500 shrink-0">&#x2022;</span>
                  <span><strong className="text-foreground">Shot variety</strong> — Close-up face shots (40-50%), full body (20-30%), waist-up (20-30%)</span>
                </li>
                <li className="flex gap-2">
                  <span className="text-green-500 shrink-0">&#x2022;</span>
                  <span><strong className="text-foreground">Minimum 25 photos</strong>, ideally 30+ for best results</span>
                </li>
                <li className="flex gap-2">
                  <span className="text-green-500 shrink-0">&#x2022;</span>
                  <span><strong className="text-foreground">Varied angles</strong> — Front-facing, 3/4 turn, slight profile (not just selfies)</span>
                </li>
                <li className="flex gap-2">
                  <span className="text-green-500 shrink-0">&#x2022;</span>
                  <span><strong className="text-foreground">Varied lighting</strong> — Indoor, outdoor, soft light, hard light. No heavy filters.</span>
                </li>
                <li className="flex gap-2">
                  <span className="text-green-500 shrink-0">&#x2022;</span>
                  <span><strong className="text-foreground">Varied backgrounds</strong> — Simple/plain backgrounds preferred. Avoid busy scenes.</span>
                </li>
                <li className="flex gap-2">
                  <span className="text-green-500 shrink-0">&#x2022;</span>
                  <span><strong className="text-foreground">Varied clothing/hairstyles</strong> — Helps the model learn YOU, not your outfit</span>
                </li>
                <li className="flex gap-2">
                  <span className="text-green-500 shrink-0">&#x2022;</span>
                  <span><strong className="text-foreground">Expressions</strong> — Mix of neutral, smiling, and serious</span>
                </li>
                <li className="flex gap-2">
                  <span className="text-green-500 shrink-0">&#x2022;</span>
                  <span><strong className="text-foreground">Quality</strong> — Sharp, well-exposed, high resolution (1024px+ on short side)</span>
                </li>
              </ul>
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="what-to-avoid" className="border-border/30">
            <AccordionTrigger className="py-3 text-sm hover:no-underline">
              <span className="flex items-center gap-2">
                <XCircle className="w-4 h-4 text-destructive" />
                What to avoid
              </span>
            </AccordionTrigger>
            <AccordionContent>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li className="flex gap-2">
                  <span className="text-destructive shrink-0">&#x2022;</span>
                  <span>Sunglasses or anything covering your face</span>
                </li>
                <li className="flex gap-2">
                  <span className="text-destructive shrink-0">&#x2022;</span>
                  <span>Group photos (unless tightly cropped to just you)</span>
                </li>
                <li className="flex gap-2">
                  <span className="text-destructive shrink-0">&#x2022;</span>
                  <span>Heavily filtered or facetuned images</span>
                </li>
                <li className="flex gap-2">
                  <span className="text-destructive shrink-0">&#x2022;</span>
                  <span>Duplicate or near-duplicate photos</span>
                </li>
                <li className="flex gap-2">
                  <span className="text-destructive shrink-0">&#x2022;</span>
                  <span>Watermarks or text overlays</span>
                </li>
                <li className="flex gap-2">
                  <span className="text-destructive shrink-0">&#x2022;</span>
                  <span>Heavy makeup that drastically changes your appearance</span>
                </li>
                <li className="flex gap-2">
                  <span className="text-destructive shrink-0">&#x2022;</span>
                  <span>Blurry, grainy, or poorly-lit photos</span>
                </li>
              </ul>
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      </CardContent>
    </Card>
  );
}
