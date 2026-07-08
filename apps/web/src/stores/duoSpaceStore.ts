import { create } from "zustand";
import type { DuoSpace } from "@duoquest/shared";

interface DuoSpaceState {
  activeDuoSpace: DuoSpace | null;
  setActiveDuoSpace: (duoSpace: DuoSpace | null) => void;
}

export const useDuoSpaceStore = create<DuoSpaceState>()((set) => ({
  activeDuoSpace: null,
  setActiveDuoSpace: (duoSpace) => set({ activeDuoSpace: duoSpace }),
}));
