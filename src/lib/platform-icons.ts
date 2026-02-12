import { Boxes, Palette, MessageSquare, Globe, Search } from "lucide-react";
import type { LucideIcon } from "lucide-react";

const PLATFORMS: Record<
  string,
  { icon: LucideIcon; color: string; label: string }
> = {
  civitai: { icon: Boxes, color: "#3B82F6", label: "CivitAI" },
  deviantart: { icon: Palette, color: "#00CC6A", label: "DeviantArt" },
  reddit: { icon: MessageSquare, color: "#FF4500", label: "Reddit" },
  tineye: { icon: Search, color: "#0099CC", label: "TinEye" },
};

export function getPlatformConfig(
  platform: string | null
): { icon: LucideIcon; color: string; label: string } {
  if (!platform) return { icon: Globe, color: "#A1A1AA", label: "Unknown" };
  return (
    PLATFORMS[platform.toLowerCase()] || {
      icon: Globe,
      color: "#A1A1AA",
      label: platform,
    }
  );
}
