import { create } from 'zustand';

interface ApiPathState {
  apiPath: string;
  setApiPath: (path: string) => void;
}

export const useApiPathStore = create<ApiPathState>((set) => ({
  apiPath: '',
  setApiPath: (path) => set({ apiPath: path }),
})); 