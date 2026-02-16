"use client";

import { ShieldCheck, Map, Landmark, Clock, Bell } from "lucide-react";
import {
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
} from "@/components/ui/tabs";
import { CheckProtection } from "./check-protection";
import { StateMap } from "./state-map";
import { FederalTracker } from "./federal-tracker";
import { DevelopmentsTimeline } from "./developments-timeline";
import { GetNotified } from "./get-notified";

export function LegalLandscapeTabs() {
  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6">
      {/* LIVE TRACKER indicator */}
      <div className="flex items-center gap-2 mb-4">
        <span className="relative flex size-2">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-green-400 opacity-75" />
          <span className="relative inline-flex size-2 rounded-full bg-green-500" />
        </span>
        <span className="text-xs font-mono text-primary tracking-wider">
          LIVE TRACKER
        </span>
        <span className="text-xs text-muted-foreground/60">
          UPDATED FEB 2026
        </span>
      </div>

      <Tabs defaultValue="check">
        <TabsList
          variant="line"
          className="w-full justify-start border-b border-border/50 overflow-x-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]"
        >
          <TabsTrigger value="check">
            <ShieldCheck className="size-4" />
            Check Your Protection
          </TabsTrigger>
          <TabsTrigger value="map">
            <Map className="size-4" />
            State Map
          </TabsTrigger>
          <TabsTrigger value="federal">
            <Landmark className="size-4" />
            Federal Tracker
          </TabsTrigger>
          <TabsTrigger value="timeline">
            <Clock className="size-4" />
            Developments
          </TabsTrigger>
          <TabsTrigger value="notify">
            <Bell className="size-4" />
            Get Notified
          </TabsTrigger>
        </TabsList>

        <TabsContent value="check" className="pt-6">
          <CheckProtection />
        </TabsContent>

        <TabsContent value="map" className="pt-6">
          <StateMap />
        </TabsContent>

        <TabsContent value="federal" className="pt-6">
          <FederalTracker />
        </TabsContent>

        <TabsContent value="timeline" className="pt-6">
          <DevelopmentsTimeline />
        </TabsContent>

        <TabsContent value="notify" id="get-notified" className="pt-6">
          <GetNotified />
        </TabsContent>
      </Tabs>
    </div>
  );
}
