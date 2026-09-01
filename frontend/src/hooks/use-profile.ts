import { create } from "zustand";
import { persist } from "zustand/middleware";

interface ProfileState {
  stream: string;
  zscore: number | null;
  district: string;
  language: string;
  setStream: (stream: string) => void;
  setZscore: (zscore: number | null) => void;
  setDistrict: (district: string) => void;
  setLanguage: (language: string) => void;
  isComplete: () => boolean;
}

export const useProfileStore = create<ProfileState>()(
  persist(
    (set, get) => ({
      stream: "",
      zscore: null,
      district: "Colombo",
      language: "en",
      setStream: (stream) => set({ stream }),
      setZscore: (zscore) => set({ zscore }),
      setDistrict: (district) => set({ district }),
      setLanguage: (language) => set({ language }),
      isComplete: () =>
        !!get().stream && get().zscore !== null && !!get().district,
    }),
    { name: "skillpath-profile" },
  ),
);

export const UGC_DISTRICTS = [
  "All Island",
  "Colombo",
  "Gampaha",
  "Kalutara",
  "Kandy",
  "Matale",
  "Nuwara Eliya",
  "Galle",
  "Matara",
  "Hambantota",
  "Jaffna",
  "Vanni",
  "Batticaloa",
  "Ampara",
  "Trincomalee",
  "Kurunegala",
  "Puttalam",
  "Anuradhapura",
  "Polonnaruwa",
  "Badulla",
  "Monaragala",
  "Ratnapura",
  "Kegalle",
] as const;
