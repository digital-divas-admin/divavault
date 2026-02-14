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
      <div className="flex items-center gap-2 mb-6">
        <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
        <span className="text-xs font-mono text-primary tracking-wider">
          LIVE TRACKER
        </span>
        <span className="text-xs text-muted-foreground">UPDATED FEB 2025</span>
      </div>

      <Tabs defaultValue="check">
        <TabsList
          variant="line"
          className="w-full overflow-x-auto justify-start"
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

        <TabsContent value="check">
          <CheckProtection />
        </TabsContent>

        <TabsContent value="map">
          <StateMap />
        </TabsContent>

        <TabsContent value="federal">
          <FederalTracker />
        </TabsContent>

        <TabsContent value="timeline">
          <DevelopmentsTimeline />
        </TabsContent>

        <TabsContent value="notify" id="get-notified">
          <GetNotified />
        </TabsContent>
      </Tabs>
    </div>
  );
}
