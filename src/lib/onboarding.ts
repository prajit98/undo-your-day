import { Category } from "./undo-data";

const KEY = "undo.onboarded.v1";
const PREFS_KEY = "undo.prefs.categories.v1";
const FIRST_CAPTURE_KEY = "undo.first.capture.v1";

export const onboarding = {
  isComplete(): boolean {
    if (typeof window === "undefined") return true;
    return window.localStorage.getItem(KEY) === "1";
  },
  complete() {
    window.localStorage.setItem(KEY, "1");
  },
  reset() {
    window.localStorage.removeItem(KEY);
    window.localStorage.removeItem(PREFS_KEY);
    window.localStorage.removeItem(FIRST_CAPTURE_KEY);
  },
  savePrefs(cats: Category[]) {
    window.localStorage.setItem(PREFS_KEY, JSON.stringify(cats));
  },
  getPrefs(): Category[] {
    if (typeof window === "undefined") return [];
    try {
      return JSON.parse(window.localStorage.getItem(PREFS_KEY) ?? "[]");
    } catch {
      return [];
    }
  },
  hasFirstCapture(): boolean {
    if (typeof window === "undefined") return true;
    return window.localStorage.getItem(FIRST_CAPTURE_KEY) === "1";
  },
  markFirstCapture() {
    window.localStorage.setItem(FIRST_CAPTURE_KEY, "1");
  },
};
