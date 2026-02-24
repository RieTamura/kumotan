/**
 * Tutorial Target Store
 * Shares UI element positions across components for tutorial highlighting.
 */

import { create } from 'zustand';

interface TargetPosition {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface TutorialTargetState {
  settingsTabPosition?: TargetPosition;
  setSettingsTabPosition: (pos: TargetPosition) => void;
}

export const useTutorialTargetStore = create<TutorialTargetState>((set) => ({
  settingsTabPosition: undefined,
  setSettingsTabPosition: (pos) => set({ settingsTabPosition: pos }),
}));
