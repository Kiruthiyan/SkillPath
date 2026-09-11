import { create } from "zustand";
import { persist } from "zustand/middleware";

export interface ProfileState {
  fullName: string;
  educationStage: string;
  stream: string;
  zscore: number | null;
  district: string;
  interests: string[];
  preferredCareers: string[];
  skills: string[];
  language: string;
  // User Preferences
  preferredUniversities: string[];
  preferredStudyAreas: string[];
  notifications: {
    universityUpdates: boolean;
    scholarshipAlerts: boolean;
    internshipAlerts: boolean;
    roadmapReminders: boolean;
  };
  theme: "light" | "dark" | "system";
  setFullName: (fullName: string) => void;
  setEducationStage: (educationStage: string) => void;
  setStream: (stream: string) => void;
  setZscore: (zscore: number | null) => void;
  setDistrict: (district: string) => void;
  setInterests: (interests: string[]) => void;
  setPreferredCareers: (preferredCareers: string[]) => void;
  setSkills: (skills: string[]) => void;
  setLanguage: (language: string) => void;
  setPreferredUniversities: (universities: string[]) => void;
  setPreferredStudyAreas: (studyAreas: string[]) => void;
  setNotification: (key: keyof ProfileState["notifications"], value: boolean) => void;
  setTheme: (theme: "light" | "dark" | "system") => void;
  isComplete: () => boolean;
  resetProfile: () => void;
}

// User-specific fields only — excludes `theme`/`language`, which are
// device-level preferences that should survive a logout/login switch.
const DEFAULT_PROFILE_FIELDS = {
  fullName: "",
  educationStage: "A/L Completed",
  stream: "",
  zscore: null,
  district: "Colombo",
  interests: [],
  preferredCareers: [],
  skills: [],
  preferredUniversities: [],
  preferredStudyAreas: [],
  notifications: {
    universityUpdates: true,
    scholarshipAlerts: true,
    internshipAlerts: true,
    roadmapReminders: true,
  },
} satisfies Partial<ProfileState>;

export const useProfileStore = create<ProfileState>()(
  persist(
    (set, get) => ({
      ...DEFAULT_PROFILE_FIELDS,
      language: "en",
      theme: "system",
      resetProfile: () => set({ ...DEFAULT_PROFILE_FIELDS }),
      setFullName: (fullName) => set({ fullName }),
      setEducationStage: (educationStage) => set({ educationStage }),
      setStream: (stream) => set({ stream }),
      setZscore: (zscore) => set({ zscore }),
      setDistrict: (district) => set({ district }),
      setInterests: (interests) => set({ interests }),
      setPreferredCareers: (preferredCareers) => set({ preferredCareers }),
      setSkills: (skills) => set({ skills }),
      setLanguage: (language) => set({ language }),
      setPreferredUniversities: (preferredUniversities) => set({ preferredUniversities }),
      setPreferredStudyAreas: (preferredStudyAreas) => set({ preferredStudyAreas }),
      setNotification: (key, value) =>
        set((state) => ({
          notifications: {
            ...state.notifications,
            [key]: value,
          },
        })),
      setTheme: (theme) => {
        set({ theme });
        applyTheme(theme);
      },
      isComplete: () =>
        !!get().stream && get().zscore !== null && !!get().district,
    }),
    {
      name: "skillpath-profile",
      onRehydrateStorage: () => (state) => {
        if (state?.theme) {
          applyTheme(state.theme);
        }
      },
    },
  ),
);

export function applyTheme(theme: "light" | "dark" | "system") {
  const root = document.documentElement;
  const isDark =
    theme === "dark" ||
    (theme === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches);

  if (isDark) {
    root.classList.add("dark");
  } else {
    root.classList.remove("dark");
  }
}

export const EDUCATION_STAGES = [
  "O/L Student",
  "A/L 1st Year",
  "A/L 2nd Year",
  "A/L Completed",
  "Undergraduate",
] as const;

export const UGC_DISTRICTS = [
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
  "Kilinochchi",
  "Mannar",
  "Mullaitivu",
  "Vavuniya",
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
