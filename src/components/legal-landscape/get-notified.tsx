"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Bell, CheckCircle2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { statesData } from "@/data/legal-landscape/states";

const notifySchema = z.object({
  email: z.string().email({ message: "Please enter a valid email" }),
  state: z.string().optional(),
  categories: z
    .array(z.string())
    .min(1, { message: "Select at least one category" }),
});

type NotifyFormValues = z.infer<typeof notifySchema>;

const CATEGORY_OPTIONS = [
  { id: "state-laws", label: "My State's Laws" },
  { id: "federal-bills", label: "Federal Bills" },
  { id: "enforcement", label: "Enforcement Actions" },
  { id: "industry", label: "Industry Changes" },
];

export function GetNotified() {
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
    reset,
  } = useForm<NotifyFormValues>({
    resolver: zodResolver(notifySchema),
    defaultValues: {
      email: "",
      state: undefined,
      categories: ["state-laws"],
    },
  });

  const categories = watch("categories");

  const sortedStates = [...statesData].sort((a, b) =>
    a.name.localeCompare(b.name)
  );

  const toggleCategory = (categoryId: string) => {
    const current = categories || [];
    const updated = current.includes(categoryId)
      ? current.filter((c) => c !== categoryId)
      : [...current, categoryId];
    setValue("categories", updated, { shouldValidate: true });
  };

  const onSubmit = async (data: NotifyFormValues) => {
    setSubmitting(true);
    setError(null);

    try {
      const response = await fetch("/api/legal-landscape/notify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        throw new Error("Failed to subscribe. Please try again.");
      }

      setSubmitted(true);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Something went wrong."
      );
    } finally {
      setSubmitting(false);
    }
  };

  if (submitted) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-12 text-center space-y-4">
          <CheckCircle2 className="size-12 text-green-500" />
          <h3 className="text-xl font-[family-name:var(--font-heading)]">
            You&apos;re all set!
          </h3>
          <p className="text-muted-foreground max-w-md">
            We&apos;ll notify you about important updates to AI likeness
            protection laws and developments.
          </p>
          <Button
            variant="outline"
            onClick={() => {
              setSubmitted(false);
              reset();
            }}
          >
            Edit preferences
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-xl font-[family-name:var(--font-heading)] mb-2">
          Stay informed about AI likeness rights
        </h3>
        <p className="text-muted-foreground">
          Get notified when laws change, new bills are introduced, or
          enforcement actions affect your protections.
        </p>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
        {/* Email */}
        <div className="space-y-2">
          <label
            htmlFor="notify-email"
            className="text-sm font-medium text-foreground"
          >
            Email address
          </label>
          <Input
            id="notify-email"
            type="email"
            placeholder="you@example.com"
            {...register("email")}
          />
          {errors.email && (
            <p className="text-xs text-destructive">{errors.email.message}</p>
          )}
        </div>

        {/* State selector */}
        <div className="space-y-2">
          <label className="text-sm font-medium text-foreground">
            State{" "}
            <span className="text-muted-foreground font-normal">
              (optional)
            </span>
          </label>
          <Select
            onValueChange={(value) =>
              setValue("state", value === "__all__" ? undefined : value)
            }
          >
            <SelectTrigger className="w-full">
              <SelectValue placeholder="All States" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">All States</SelectItem>
              {sortedStates.map((s) => (
                <SelectItem key={s.abbreviation} value={s.abbreviation}>
                  {s.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Category toggles */}
        <div className="space-y-2">
          <label className="text-sm font-medium text-foreground">
            What to track
          </label>
          <div className="flex flex-wrap gap-2">
            {CATEGORY_OPTIONS.map((option) => {
              const isActive = categories?.includes(option.id);
              return (
                <Badge
                  key={option.id}
                  variant={isActive ? "default" : "outline"}
                  className="cursor-pointer select-none px-3 py-1.5 text-sm"
                  onClick={() => toggleCategory(option.id)}
                >
                  {option.label}
                </Badge>
              );
            })}
          </div>
          {errors.categories && (
            <p className="text-xs text-destructive">
              {errors.categories.message}
            </p>
          )}
        </div>

        {/* Error message */}
        {error && (
          <p className="text-sm text-destructive bg-destructive/10 rounded-lg px-3 py-2">
            {error}
          </p>
        )}

        {/* Submit */}
        <Button type="submit" disabled={submitting} className="w-full">
          <Bell className="size-4" />
          {submitting ? "Subscribing..." : "Get Notified"}
        </Button>
      </form>
    </div>
  );
}
