"use client";

import { useState, useTransition } from "react";
import { Bookmark } from "lucide-react";
import { Button } from "@/components/ui/button";

interface BookmarkButtonProps {
  requestId: string;
  initialBookmarked: boolean;
}

export function BookmarkButton({ requestId, initialBookmarked }: BookmarkButtonProps) {
  const [bookmarked, setBookmarked] = useState(initialBookmarked);
  const [isPending, startTransition] = useTransition();

  const toggle = () => {
    const action = bookmarked ? "remove" : "add";
    setBookmarked(!bookmarked);

    startTransition(async () => {
      try {
        const res = await fetch("/api/marketplace/bookmarks", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ requestId, action }),
        });
        if (!res.ok) {
          setBookmarked(bookmarked); // revert on failure
        }
      } catch {
        setBookmarked(bookmarked); // revert on error
      }
    });
  };

  return (
    <Button
      variant="ghost"
      size="icon"
      className="h-8 w-8"
      aria-label={bookmarked ? "Remove bookmark" : "Add bookmark"}
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        toggle();
      }}
      disabled={isPending}
    >
      <Bookmark
        className={`h-4 w-4 transition-colors ${
          bookmarked ? "fill-primary text-primary" : "text-muted-foreground"
        }`}
      />
    </Button>
  );
}
