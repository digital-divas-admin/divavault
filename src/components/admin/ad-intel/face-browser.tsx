"use client";

import { useEffect, useState, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  ChevronDown,
  ChevronRight,
  Search,
  Loader2,
  CheckCircle2,
  User,
} from "lucide-react";

interface Ad {
  id: string;
  platform: string;
  advertiser_name: string | null;
  processing_status: string;
  face_count: number | null;
  created_at: string;
}

interface Face {
  id: string;
  face_index: number;
  description: string | null;
  described: boolean;
  searched: boolean;
  matched: boolean;
}

export function FaceBrowser() {
  const [ads, setAds] = useState<Ad[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedAd, setExpandedAd] = useState<string | null>(null);
  const [faces, setFaces] = useState<Record<string, Face[]>>({});
  const [facesLoading, setFacesLoading] = useState<string | null>(null);
  const [searchLoading, setSearchLoading] = useState<string | null>(null);
  const [searchSuccess, setSearchSuccess] = useState<string | null>(null);

  const fetchAds = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/ad-intel/ads?status=processed");
      if (res.ok) {
        const data = await res.json();
        setAds(data.ads || []);
      }
    } catch {
      // silently fail
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAds();
  }, [fetchAds]);

  const toggleAd = async (adId: string) => {
    if (expandedAd === adId) {
      setExpandedAd(null);
      return;
    }

    setExpandedAd(adId);

    if (!faces[adId]) {
      setFacesLoading(adId);
      try {
        const res = await fetch(`/api/admin/ad-intel/ads/${adId}/faces`);
        if (res.ok) {
          const data = await res.json();
          setFaces((prev) => ({ ...prev, [adId]: data.faces || [] }));
        }
      } catch {
        // silently fail
      } finally {
        setFacesLoading(null);
      }
    }
  };

  const triggerSearch = async (faceId: string) => {
    setSearchLoading(faceId);
    setSearchSuccess(null);

    try {
      const res = await fetch(`/api/admin/ad-intel/faces/${faceId}/search`, {
        method: "POST",
      });

      if (res.ok) {
        setSearchSuccess(faceId);
        // Update local face state
        setFaces((prev) => {
          const updated = { ...prev };
          for (const adId of Object.keys(updated)) {
            updated[adId] = updated[adId].map((f) =>
              f.id === faceId ? { ...f, searched: false, matched: false } : f
            );
          }
          return updated;
        });
        setTimeout(() => setSearchSuccess(null), 3000);
      }
    } catch {
      // silently fail
    } finally {
      setSearchLoading(null);
    }
  };

  return (
    <Card className="bg-card border-border/30">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-medium">
          Browse Faces
        </CardTitle>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex justify-center py-4">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : ads.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">
            No processed ads yet
          </p>
        ) : (
          <div className="space-y-1 max-h-[400px] overflow-y-auto">
            {ads.map((ad) => (
              <div key={ad.id}>
                <button
                  onClick={() => toggleAd(ad.id)}
                  className="w-full flex items-center gap-2 p-2 rounded-md hover:bg-accent/30 transition-colors text-left"
                >
                  {expandedAd === ad.id ? (
                    <ChevronDown className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                  ) : (
                    <ChevronRight className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">
                      {ad.advertiser_name || "Unknown advertiser"}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {ad.platform} &middot; {ad.face_count ?? 0} face
                      {ad.face_count !== 1 ? "s" : ""}
                    </p>
                  </div>
                  <Badge variant="secondary" className="text-[10px] shrink-0">
                    {ad.processing_status}
                  </Badge>
                </button>

                {expandedAd === ad.id && (
                  <div className="ml-6 pl-3 border-l border-border/30 space-y-2 py-2">
                    {facesLoading === ad.id ? (
                      <div className="flex items-center gap-2 py-2">
                        <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />
                        <span className="text-xs text-muted-foreground">
                          Loading faces...
                        </span>
                      </div>
                    ) : (faces[ad.id] || []).length === 0 ? (
                      <p className="text-xs text-muted-foreground py-2">
                        No faces found
                      </p>
                    ) : (
                      (faces[ad.id] || []).map((face) => (
                        <div
                          key={face.id}
                          className="flex items-center gap-2 p-2 rounded-md bg-card border border-border/20"
                        >
                          <div className="rounded-full bg-primary/10 p-1.5">
                            <User className="h-3 w-3 text-primary" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-medium">
                              Face #{face.face_index + 1}
                            </p>
                            {face.description && (
                              <p className="text-[10px] text-muted-foreground truncate">
                                {face.description}
                              </p>
                            )}
                            <div className="flex gap-1 mt-1">
                              <Badge
                                variant={face.described ? "success" : "secondary"}
                                className="text-[9px] px-1 py-0"
                              >
                                {face.described ? "described" : "pending"}
                              </Badge>
                              <Badge
                                variant={face.searched ? "success" : "secondary"}
                                className="text-[9px] px-1 py-0"
                              >
                                {face.searched ? "searched" : "unsearched"}
                              </Badge>
                              <Badge
                                variant={face.matched ? "success" : "secondary"}
                                className="text-[9px] px-1 py-0"
                              >
                                {face.matched ? "matched" : "unmatched"}
                              </Badge>
                            </div>
                          </div>
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-7 text-xs shrink-0"
                            onClick={() => triggerSearch(face.id)}
                            disabled={
                              searchLoading === face.id || !face.described
                            }
                          >
                            {searchLoading === face.id ? (
                              <Loader2 className="h-3 w-3 animate-spin mr-1" />
                            ) : searchSuccess === face.id ? (
                              <CheckCircle2 className="h-3 w-3 mr-1 text-green-400" />
                            ) : (
                              <Search className="h-3 w-3 mr-1" />
                            )}
                            {searchSuccess === face.id
                              ? "Queued"
                              : "Search Stock"}
                          </Button>
                        </div>
                      ))
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
