import { create } from "zustand";
import { persist } from "zustand/middleware";

interface OnboardingState {
  currentStep: number;
  trackType: "sfw" | "nsfw" | null;
  sumsubStatus: "pending" | "green" | "red" | null;
  instagramConnected: boolean;
  instagramMedia: Array<{
    id: string;
    media_url: string;
    thumbnail_url?: string;
  }>;
  selectedPhotoIds: string[];
  uploadedPhotos: string[]; // file paths in storage
  consentAge: boolean;
  consentAiTraining: boolean;
  consentLikeness: boolean;
  consentRevocation: boolean;
  consentPrivacy: boolean;
  consentNsfw: boolean;
  setStep: (step: number) => void;
  setTrackType: (track: "sfw" | "nsfw") => void;
  setSumsubStatus: (status: "pending" | "green" | "red") => void;
  setInstagramConnected: (connected: boolean) => void;
  setInstagramMedia: (
    media: Array<{ id: string; media_url: string; thumbnail_url?: string }>
  ) => void;
  togglePhotoSelection: (id: string) => void;
  addUploadedPhotos: (paths: string[]) => void;
  removeUploadedPhoto: (path: string) => void;
  setConsentAge: (v: boolean) => void;
  setConsentAiTraining: (v: boolean) => void;
  setConsentLikeness: (v: boolean) => void;
  setConsentRevocation: (v: boolean) => void;
  setConsentPrivacy: (v: boolean) => void;
  setConsentNsfw: (v: boolean) => void;
  allConsentsGiven: () => boolean;
  totalPhotoCount: () => number;
  reset: () => void;
}

const initialState = {
  currentStep: 1,
  trackType: null as "sfw" | "nsfw" | null,
  sumsubStatus: null as "pending" | "green" | "red" | null,
  instagramConnected: false,
  instagramMedia: [] as Array<{
    id: string;
    media_url: string;
    thumbnail_url?: string;
  }>,
  selectedPhotoIds: [] as string[],
  uploadedPhotos: [] as string[],
  consentAge: false,
  consentAiTraining: false,
  consentLikeness: false,
  consentRevocation: false,
  consentPrivacy: false,
  consentNsfw: false,
};

export const useOnboardingStore = create<OnboardingState>()(
  persist(
    (set, get) => ({
      ...initialState,

      setStep: (step) => set({ currentStep: step }),
      setTrackType: (track) => set({ trackType: track }),
      setSumsubStatus: (status) => set({ sumsubStatus: status }),
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

      setConsentAge: (v) => set({ consentAge: v }),
      setConsentAiTraining: (v) => set({ consentAiTraining: v }),
      setConsentLikeness: (v) => set({ consentLikeness: v }),
      setConsentRevocation: (v) => set({ consentRevocation: v }),
      setConsentPrivacy: (v) => set({ consentPrivacy: v }),
      setConsentNsfw: (v) => set({ consentNsfw: v }),

      allConsentsGiven: () => {
        const state = get();
        const base =
          state.consentAge &&
          state.consentAiTraining &&
          state.consentLikeness &&
          state.consentRevocation &&
          state.consentPrivacy;
        if (state.trackType === "nsfw") {
          return base && state.consentNsfw;
        }
        return base;
      },

      totalPhotoCount: () => {
        const state = get();
        return state.selectedPhotoIds.length + state.uploadedPhotos.length;
      },

      reset: () => set(initialState),
    }),
    {
      name: "diva-vault-onboarding",
    }
  )
);
