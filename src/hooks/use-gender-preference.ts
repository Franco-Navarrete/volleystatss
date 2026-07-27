import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { Gender } from '@/lib/terminology';

interface GenderPreferenceState {
  globalGender: Gender;
  setGlobalGender: (gender: Gender) => void;
}

export const useGenderPreference = create<GenderPreferenceState>()(
  persist(
    (set) => ({
      globalGender: 'mixto',
      setGlobalGender: (globalGender: Gender) => set({ globalGender }),
    }),
    {
      name: 'rally-gender-preference',
    }
  )
);
