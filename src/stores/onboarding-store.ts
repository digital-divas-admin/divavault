import { create } from "zustand";
import { persist } from "zustand/middleware";
import type {
  GeoRestriction,
  ContentExclusion,
  CaptureStep,
} from "@/types/capture";

interface OnboardingState {
  currentStep: number;
  // Step 1: Identity verification
  verificationStatus: "pending" | "green" | "red" | null;
  // Step 2: Profile builder
  profileData: {
    hairColor: string | null;
    eyeColor: string | null;
    skinTone: string | null;
    bodyType: string | null;
    ageRange: string | null;
    gender: string | null;
    ethnicity: string | null;
    selfDescription: string | null;
  };
  profileCompleted: boolean;
  // Step 3: Consent
  consentAge: boolean;
  consentAiTraining: boolean;
  consentLikeness: boolean;
  consentRevocation: boolean;
  consentPrivacy: boolean;
  // Granular consent
  allowCommercial: boolean;
  allowEditorial: boolean;
  allowEntertainment: boolean;
  allowELearning: boolean;
  geoRestrictions: GeoRestriction[];
  contentExclusions: ContentExclusion[];
  // Step 4: Guided capture
  captureSessionId: string | null;
  capturedSteps: CaptureStep[];
  captureCompleted: boolean;
  // Legacy: Data contribution (kept as fallback for upload)
  instagramConnected: boolean;
  instagramMedia: Array<{
    id: string;
    media_url: string;
    thumbnail_url?: string;
  }>;
  selectedPhotoIds: string[];
  uploadedPhotos: string[]; // file paths in storage
  useFallbackUpload: boolean;

  // Actions
  setStep: (step: number) => void;
  setVerificationStatus: (status: "pending" | "green" | "red") => void;
  // Profile actions
  setProfileData: (data: Partial<OnboardingState["profileData"]>) => void;
  setProfileCompleted: (v: boolean) => void;
  // Consent actions
  setConsentAge: (v: boolean) => void;
  setConsentAiTraining: (v: boolean) => void;
  setConsentLikeness: (v: boolean) => void;
  setConsentRevocation: (v: boolean) => void;
  setConsentPrivacy: (v: boolean) => void;
  setAllowCommercial: (v: boolean) => void;
  setAllowEditorial: (v: boolean) => void;
  setAllowEntertainment: (v: boolean) => void;
  setAllowELearning: (v: boolean) => void;
  setGeoRestrictions: (v: GeoRestriction[]) => void;
  toggleContentExclusion: (v: ContentExclusion) => void;
  // Capture actions
  setCaptureSessionId: (id: string | null) => void;
  addCapturedStep: (step: CaptureStep) => void;
  setCaptureCompleted: (v: boolean) => void;
  // Legacy upload actions
  setInstagramConnected: (connected: boolean) => void;
  setInstagramMedia: (
    media: Array<{ id: string; media_url: string; thumbnail_url?: string }>
  ) => void;
  togglePhotoSelection: (id: string) => void;
  addUploadedPhotos: (paths: string[]) => void;
  removeUploadedPhoto: (path: string) => void;
  setUseFallbackUpload: (v: boolean) => void;
  // Computed
  allConsentsGiven: () => boolean;
  totalPhotoCount: () => number;
  reset: () => void;
}

const initialState = {
  currentStep: 1,
  verificationStatus: null as "pending" | "green" | "red" | null,
  // Profile
  profileData: {
    hairColor: null as string | null,
    eyeColor: null as string | null,
    skinTone: null as string | null,
    bodyType: null as string | null,
    ageRange: null as string | null,
    gender: null as string | null,
    ethnicity: null as string | null,
    selfDescription: null as string | null,
  },
  profileCompleted: false,
  // Consent
  consentAge: false,
  consentAiTraining: false,
  consentLikeness: false,
  consentRevocation: false,
  consentPrivacy: false,
  allowCommercial: true,
  allowEditorial: true,
  allowEntertainment: true,
  allowELearning: true,
  geoRestrictions: ["global"] as GeoRestriction[],
  contentExclusions: [] as ContentExclusion[],
  // Capture
  captureSessionId: null as string | null,
  capturedSteps: [] as CaptureStep[],
  captureCompleted: false,
  // Legacy upload
  instagramConnected: false,
  instagramMedia: [] as Array<{
    id: string;
    media_url: string;
    thumbnail_url?: string;
  }>,
  selectedPhotoIds: [] as string[],
  uploadedPhotos: [] as string[],
  useFallbackUpload: false,
};

export const useOnboardingStore = create<OnboardingState>()(
  persist(
    (set, get) => ({
      ...initialState,

      setStep: (step) => set({ currentStep: step }),
      setVerificationStatus: (status) => set({ verificationStatus: status }),

      // Profile
      setProfileData: (data) =>
        set((state) => ({
          profileData: { ...state.profileData, ...data },
        })),
      setProfileCompleted: (v) => set({ profileCompleted: v }),

      // Consent
      setConsentAge: (v) => set({ consentAge: v }),
      setConsentAiTraining: (v) => set({ consentAiTraining: v }),
      setConsentLikeness: (v) => set({ consentLikeness: v }),
      setConsentRevocation: (v) => set({ consentRevocation: v }),
      setConsentPrivacy: (v) => set({ consentPrivacy: v }),
      setAllowCommercial: (v) => set({ allowCommercial: v }),
      setAllowEditorial: (v) => set({ allowEditorial: v }),
      setAllowEntertainment: (v) => set({ allowEntertainment: v }),
      setAllowELearning: (v) => set({ allowELearning: v }),
      setGeoRestrictions: (v) => set({ geoRestrictions: v }),
      toggleContentExclusion: (exclusion) =>
        set((state) => ({
          contentExclusions: state.contentExclusions.includes(exclusion)
            ? state.contentExclusions.filter((e) => e !== exclusion)
            : [...state.contentExclusions, exclusion],
        })),

      // Capture
      setCaptureSessionId: (id) => set({ captureSessionId: id }),
      addCapturedStep: (step) =>
        set((state) => ({
          capturedSteps: state.capturedSteps.includes(step)
            ? state.capturedSteps
            : [...state.capturedSteps, step],
        })),
      setCaptureCompleted: (v) => set({ captureCompleted: v }),

      // Legacy upload
      setInstagramConnected: (connected) =>
        set({ instagramConnected: connected }),
      setInstagramMedia: (media) => set({ instagramMedia: media }),
      togglePhotoSelection: (id) =>
        set((state) => {
          const exists = state.selectedPhotoIds.includes(id);
          return {
            selectedPhotoIds: exists
              ? state.selectedPhotoIds.filter((pid) => pid !== id)
              : [...state.selectedPhotoIds, id],
          };
        }),
      addUploadedPhotos: (paths) =>
        set((state) => ({
          uploadedPhotos: [...state.uploadedPhotos, ...paths],
        })),
      removeUploadedPhoto: (path) =>
        set((state) => ({
          uploadedPhotos: state.uploadedPhotos.filter((p) => p !== path),
        })),
      setUseFallbackUpload: (v) => set({ useFallbackUpload: v }),

      allConsentsGiven: () => {
        const state = get();
        return (
          state.consentAge &&
          state.consentAiTraining &&
          state.consentLikeness &&
          state.consentRevocation &&
          state.consentPrivacy
        );
      },

      totalPhotoCount: () => {
        const state = get();
        return state.selectedPhotoIds.length + state.uploadedPhotos.length;
      },

      reset: () => set(initialState),
    }),
    {
      name: "madeofus-onboarding",
      version: 4,
      migrate: (persistedState: unknown, version: number) => {
        if (!persistedState || typeof persistedState !== "object") return initialState;
        const state = persistedState as Record<string, unknown>;
        if (version < 2) {
          // Migrate from v0/v1 (old 3-step flow) to v2 (5-step flow)
          const oldStep = (state.currentStep as number) || 1;
          const hadSumsub = (state.sumsubStatus ?? state.verificationStatus) === "green";
          const hadProfile = state.profileCompleted === true;
          const hadConsent = state.consentAge === true && state.consentAiTraining === true;
          const hadCapture = state.captureCompleted === true;

          let newStep = 1;
          if (hadCapture) newStep = 5;
          else if (hadConsent) newStep = 4;
          else if (hadProfile) newStep = 3;
          else if (hadSumsub) newStep = 2;
          else newStep = Math.min(oldStep, 5);

          return {
            ...initialState,
            ...state,
            currentStep: newStep,
            verificationStatus: (state.sumsubStatus ?? state.verificationStatus ?? null) as string | null,
            consentAge: state.consentAge ?? false,
            consentAiTraining: state.consentAiTraining ?? false,
            consentLikeness: state.consentLikeness ?? false,
            consentRevocation: state.consentRevocation ?? false,
            consentPrivacy: state.consentPrivacy ?? false,
          };
        }
        if (version < 3) {
          // v2→v3: strip removed trackType field
          // eslint-disable-next-line @typescript-eslint/no-unused-vars
          const { trackType: _, ...rest } = state as Record<string, unknown> & { trackType?: unknown };
          return { ...initialState, ...rest };
        }
        if (version < 4) {
          // v3→v4: rename sumsubStatus → verificationStatus
          // eslint-disable-next-line @typescript-eslint/no-unused-vars
          const { sumsubStatus, ...rest } = state as Record<string, unknown> & { sumsubStatus?: unknown };
          return { ...initialState, ...rest, verificationStatus: (sumsubStatus ?? null) as string | null };
        }
        return state;
      },
    }
  )
);
