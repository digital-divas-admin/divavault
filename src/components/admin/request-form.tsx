"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { createRequestSchema } from "@/lib/marketplace-validators";
import type { z } from "zod";

// Use z.input to get the form input type (before .refine transforms)
type CreateRequestFormData = z.input<typeof createRequestSchema>;
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2 } from "lucide-react";
import type { BountyRequest } from "@/types/marketplace";

const categories = [
  { value: "portrait", label: "Portrait" },
  { value: "full_body", label: "Full Body" },
  { value: "lifestyle", label: "Lifestyle" },
  { value: "fashion", label: "Fashion" },
  { value: "fitness", label: "Fitness" },
  { value: "artistic", label: "Artistic" },
  { value: "professional", label: "Professional" },
  { value: "casual", label: "Casual" },
  { value: "themed", label: "Themed" },
  { value: "other", label: "Other" },
];

const payTypes = [
  { value: "per_image", label: "Per Image" },
  { value: "per_set", label: "Per Set" },
];

interface RequestFormProps {
  existingRequest?: BountyRequest;
  mode: "create" | "edit";
}

export function RequestForm({ existingRequest, mode }: RequestFormProps) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const defaults: Partial<CreateRequestFormData> = existingRequest
    ? {
        title: existingRequest.title,
        description: existingRequest.description,
        modelContext: existingRequest.model_context || undefined,
        category: existingRequest.category,
        payType: existingRequest.pay_type,
        payAmountCents: existingRequest.pay_amount_cents,
        setSize: existingRequest.set_size || undefined,
        speedBonusCents: existingRequest.speed_bonus_cents,
        speedBonusDeadline: existingRequest.speed_bonus_deadline || undefined,
        qualityBonusCents: existingRequest.quality_bonus_cents,
        budgetTotalCents: existingRequest.budget_total_cents,
        quantityNeeded: existingRequest.quantity_needed,
        minResolutionWidth: existingRequest.min_resolution_width,
        minResolutionHeight: existingRequest.min_resolution_height,
        qualityGuidelines: existingRequest.quality_guidelines || undefined,
        estimatedEffort: existingRequest.estimated_effort || undefined,
        visibility: existingRequest.visibility,
        deadline: existingRequest.deadline
          ? existingRequest.deadline.slice(0, 16)
          : undefined,
        scenarioTags: existingRequest.scenario_tags,
        settingTags: existingRequest.setting_tags,
      }
    : {
        minResolutionWidth: 1024,
        minResolutionHeight: 1024,
        speedBonusCents: 0,
        qualityBonusCents: 0,
        visibility: "open",
        scenarioTags: [],
        settingTags: [],
      };

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm<CreateRequestFormData>({
    resolver: zodResolver(createRequestSchema),
    defaultValues: defaults,
  });

  const payType = watch("payType");
  const payAmountCents = watch("payAmountCents") || 0;
  const quantityNeeded = watch("quantityNeeded") || 0;
  const budgetTotalCents = watch("budgetTotalCents") || 0;
  const estimatedCost = payAmountCents * quantityNeeded;
  const budgetOk = budgetTotalCents >= estimatedCost;

  async function onSubmit(data: CreateRequestFormData, publishNow: boolean) {
    setLoading(true);
    setError(null);

    const payload = { ...data, status: publishNow ? "published" : "draft" };

    try {
      if (mode === "edit" && existingRequest) {
        const res = await fetch(
          `/api/admin/requests/${existingRequest.id}`,
          {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ action: "update", data: payload }),
          }
        );
        if (!res.ok) {
          const { error } = await res.json();
          throw new Error(error || "Update failed");
        }
        if (publishNow) {
          const pubRes = await fetch(
            `/api/admin/requests/${existingRequest.id}`,
            {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ action: "publish" }),
            }
          );
          if (!pubRes.ok) {
            const { error } = await pubRes.json();
            throw new Error(error || "Publish failed");
          }
        }
      } else {
        const res = await fetch("/api/admin/requests", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        const resData = await res.json();
        if (!res.ok) {
          throw new Error(resData.error || "Create failed");
        }
        // If "Publish Now", create as draft then publish via PATCH
        if (publishNow) {
          const pubRes = await fetch(
            `/api/admin/requests/${resData.request.id}`,
            {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ action: "publish" }),
            }
          );
          if (!pubRes.ok) {
            const pubData = await pubRes.json();
            throw new Error(pubData.error || "Created as draft but publish failed");
          }
        }
      }

      router.push("/admin/requests");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
      setLoading(false);
    }
  }

  return (
    <form className="space-y-6">
      {/* Basics */}
      <Card className="bg-card border-border/30">
        <CardHeader>
          <CardTitle className="text-base">Basics</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="title">Title</Label>
            <Input id="title" placeholder="e.g. Outdoor Lifestyle Portraits" {...register("title")} />
            {errors.title && <p className="text-sm text-destructive">{errors.title.message}</p>}
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea id="description" rows={4} placeholder="Describe what you need..." {...register("description")} />
            {errors.description && <p className="text-sm text-destructive">{errors.description.message}</p>}
          </div>

          <div className="space-y-2">
            <Label htmlFor="modelContext">Model Context (optional)</Label>
            <Textarea id="modelContext" rows={2} placeholder="Context about the AI model or use case..." {...register("modelContext")} />
          </div>

          <div className="space-y-2">
            <Label>Category</Label>
            <Select
              defaultValue={defaults.category}
              onValueChange={(v) => setValue("category", v as CreateRequestFormData["category"])}
            >
              <SelectTrigger><SelectValue placeholder="Select category" /></SelectTrigger>
              <SelectContent>
                {categories.map((c) => (
                  <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {errors.category && <p className="text-sm text-destructive">{errors.category.message}</p>}
          </div>
        </CardContent>
      </Card>

      {/* Requirements */}
      <Card className="bg-card border-border/30">
        <CardHeader>
          <CardTitle className="text-base">Requirements</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="quantityNeeded">Quantity Needed</Label>
              <Input id="quantityNeeded" type="number" min={1} {...register("quantityNeeded", { valueAsNumber: true })} />
              {errors.quantityNeeded && <p className="text-sm text-destructive">{errors.quantityNeeded.message}</p>}
            </div>
            <div className="space-y-2">
              <Label htmlFor="minResolutionWidth">Min Width (px)</Label>
              <Input id="minResolutionWidth" type="number" min={256} {...register("minResolutionWidth", { valueAsNumber: true })} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="minResolutionHeight">Min Height (px)</Label>
              <Input id="minResolutionHeight" type="number" min={256} {...register("minResolutionHeight", { valueAsNumber: true })} />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="qualityGuidelines">Quality Guidelines (optional)</Label>
            <Textarea id="qualityGuidelines" rows={3} placeholder="Specific quality requirements..." {...register("qualityGuidelines")} />
          </div>

          <div className="space-y-2">
            <Label htmlFor="estimatedEffort">Estimated Effort (optional)</Label>
            <Input id="estimatedEffort" placeholder="e.g. 30 minutes per set" {...register("estimatedEffort")} />
          </div>
        </CardContent>
      </Card>

      {/* Compensation */}
      <Card className="bg-card border-border/30">
        <CardHeader>
          <CardTitle className="text-base">Compensation</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Pay Type</Label>
              <Select
                defaultValue={defaults.payType}
                onValueChange={(v) => setValue("payType", v as CreateRequestFormData["payType"])}
              >
                <SelectTrigger><SelectValue placeholder="Select pay type" /></SelectTrigger>
                <SelectContent>
                  {payTypes.map((p) => (
                    <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.payType && <p className="text-sm text-destructive">{errors.payType.message}</p>}
            </div>

            <div className="space-y-2">
              <Label htmlFor="payAmountCents">Pay Amount (cents)</Label>
              <Input id="payAmountCents" type="number" min={100} placeholder="500 = $5.00" {...register("payAmountCents", { valueAsNumber: true })} />
              {errors.payAmountCents && <p className="text-sm text-destructive">{errors.payAmountCents.message}</p>}
            </div>
          </div>

          {payType === "per_set" && (
            <div className="space-y-2">
              <Label htmlFor="setSize">Set Size (images per set)</Label>
              <Input id="setSize" type="number" min={1} {...register("setSize", { valueAsNumber: true })} />
              {errors.setSize && <p className="text-sm text-destructive">{errors.setSize.message}</p>}
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="speedBonusCents">Speed Bonus (cents, optional)</Label>
              <Input id="speedBonusCents" type="number" min={0} {...register("speedBonusCents", { valueAsNumber: true })} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="speedBonusDeadline">Speed Bonus Deadline (optional)</Label>
              <Input id="speedBonusDeadline" type="datetime-local" {...register("speedBonusDeadline")} />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="qualityBonusCents">Quality Bonus (cents, optional)</Label>
            <Input id="qualityBonusCents" type="number" min={0} {...register("qualityBonusCents", { valueAsNumber: true })} />
          </div>

          <div className="space-y-2">
            <Label htmlFor="budgetTotalCents">Total Budget (cents)</Label>
            <Input id="budgetTotalCents" type="number" min={1000} placeholder="10000 = $100.00" {...register("budgetTotalCents", { valueAsNumber: true })} />
            {errors.budgetTotalCents && <p className="text-sm text-destructive">{errors.budgetTotalCents.message}</p>}
          </div>

          {payAmountCents > 0 && quantityNeeded > 0 && (
            <div className={`text-sm p-3 rounded-lg ${budgetOk ? "bg-green-500/10 text-green-400" : "bg-destructive/10 text-destructive"}`}>
              Estimated cost: ${(estimatedCost / 100).toFixed(2)} ({quantityNeeded} × ${(payAmountCents / 100).toFixed(2)})
              {!budgetOk && " — budget too low!"}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Schedule & Tags */}
      <Card className="bg-card border-border/30">
        <CardHeader>
          <CardTitle className="text-base">Schedule & Tags</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="deadline">Deadline (optional)</Label>
            <Input id="deadline" type="datetime-local" {...register("deadline")} />
          </div>

          <div className="space-y-2">
            <Label htmlFor="scenarioTags">Scenario Tags (comma-separated)</Label>
            <Input
              id="scenarioTags"
              placeholder="outdoor, natural light, candid"
              defaultValue={defaults.scenarioTags?.join(", ")}
              onChange={(e) => {
                const tags = e.target.value.split(",").map((t) => t.trim()).filter(Boolean);
                setValue("scenarioTags", tags);
              }}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="settingTags">Setting Tags (comma-separated)</Label>
            <Input
              id="settingTags"
              placeholder="beach, park, urban"
              defaultValue={defaults.settingTags?.join(", ")}
              onChange={(e) => {
                const tags = e.target.value.split(",").map((t) => t.trim()).filter(Boolean);
                setValue("settingTags", tags);
              }}
            />
          </div>
        </CardContent>
      </Card>

      {/* Error */}
      {error && (
        <div className="p-3 rounded-lg bg-destructive/10 text-sm text-destructive">
          {error}
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center gap-3">
        <Button
          type="button"
          variant="outline"
          disabled={loading}
          onClick={handleSubmit((data) => onSubmit(data, false))}
        >
          {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          {mode === "edit" ? "Update Draft" : "Save Draft"}
        </Button>
        <Button
          type="button"
          disabled={loading || !budgetOk}
          onClick={handleSubmit((data) => onSubmit(data, true))}
        >
          {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          {mode === "edit" ? "Update & Publish" : "Publish Now"}
        </Button>
      </div>
    </form>
  );
}
