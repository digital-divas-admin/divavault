"use client";

import { useState, useCallback } from "react";
import { PhotoCard } from "./photo-card";
import { PhotoFilters } from "./photo-filters";
import { EmptyState } from "@/components/dashboard/empty-state";
import { ImageIcon } from "lucide-react";
import type { DashboardUpload } from "@/types/dashboard";

interface PhotoGridProps {
  initialUploads: DashboardUpload[];
}

export function PhotoGrid({ initialUploads }: PhotoGridProps) {
  const [uploads, setUploads] = useState<DashboardUpload[]>(initialUploads);
  const [filter, setFilter] = useState("all");

  const counts = {
    all: initialUploads.length,
    active: initialUploads.filter((u) => u.status === "active").length,
    processing: initialUploads.filter((u) => u.status === "processing").length,
    removed: initialUploads.filter((u) => u.status === "removed").length,
  };

  const filteredUploads =
    filter === "all" ? uploads : uploads.filter((u) => u.status === filter);

  const handleRemove = useCallback(async (id: string) => {
    const res = await fetch(`/api/dashboard/uploads/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "removed" }),
    });

    if (res.ok) {
      setUploads((prev) =>
        prev.map((u) =>
          u.id === id
            ? {
                ...u,
                status: "removed" as const,
                removed_at: new Date().toISOString(),
              }
            : u
        )
      );
    }
  }, []);

  return (
    <div>
      <div className="mb-6">
        <PhotoFilters
          currentFilter={filter}
          onFilterChange={setFilter}
          counts={counts}
        />
      </div>

      {filteredUploads.length === 0 ? (
        <EmptyState
          icon={ImageIcon}
          heading="No photos found"
          message={
            filter === "all"
              ? "You haven't contributed any photos yet."
              : `No ${filter} photos.`
          }
        />
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
          {filteredUploads.map((upload) => (
            <PhotoCard
              key={upload.id}
              upload={upload}
              onRemove={handleRemove}
            />
          ))}
        </div>
      )}
    </div>
  );
}
