import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface WorkspaceState {
  leftPanelOpen: boolean;
  rightPanelOpen: boolean;
  bottomPanelOpen: boolean;
  leftPanelSize: number;
  rightPanelSize: number;
  bottomPanelSize: number;
  theaterMode: boolean;
  analysisMode: boolean;
  
  setLeftPanelOpen: (open: boolean) => void;
  setRightPanelOpen: (open: boolean) => void;
  setBottomPanelOpen: (open: boolean) => void;
  setLeftPanelSize: (size: number) => void;
  setRightPanelSize: (size: number) => void;
  setBottomPanelSize: (size: number) => void;
  setTheaterMode: (enabled: boolean) => void;
  setAnalysisMode: (enabled: boolean) => void;
}

export const useWorkspaceStore = create<WorkspaceState>()(
  persist(
    (set) => ({
      leftPanelOpen: true,
      rightPanelOpen: true,
      bottomPanelOpen: true,
      leftPanelSize: 20,
      rightPanelSize: 20,
      bottomPanelSize: 30,
      theaterMode: false,
      analysisMode: false,

      setLeftPanelOpen: (leftPanelOpen) => set({ leftPanelOpen }),
      setRightPanelOpen: (rightPanelOpen) => set({ rightPanelOpen }),
      setBottomPanelOpen: (bottomPanelOpen) => set({ bottomPanelOpen }),
      setLeftPanelSize: (leftPanelSize) => set({ leftPanelSize }),
      setRightPanelSize: (rightPanelSize) => set({ rightPanelSize }),
      setBottomPanelSize: (bottomPanelSize) => set({ bottomPanelSize }),
      setTheaterMode: (theaterMode) => set({ theaterMode }),
      setAnalysisMode: (analysisMode) => set({ analysisMode }),
    }),
    {
      name: 'rally-workspace-storage',
    }
  )
);
