import { create } from "zustand";

interface SwipeStore {
  currentIndex: number;
  direction: "left" | "right" | null;
  dragX: number;
  setCurrentIndex: (index: number) => void;
  advance: () => void;
  setDirection: (direction: "left" | "right" | null) => void;
  setDragX: (dragX: number) => void;
  reset: () => void;
}

export const useSwipeStore = create<SwipeStore>((set) => ({
  currentIndex: 0,
  direction: null,
  dragX: 0,
  setCurrentIndex: (index) => set({ currentIndex: index }),
  advance: () => set((state) => ({ currentIndex: state.currentIndex + 1, direction: null, dragX: 0 })),
  setDirection: (direction) => set({ direction }),
  setDragX: (dragX) => set({ dragX }),
  reset: () => set({ currentIndex: 0, direction: null, dragX: 0 }),
}));
