import { useEffect, useState, useCallback } from "react";

export type DeviceMode = "auto" | "mobile" | "tablet" | "desktop";

const STORAGE_KEY = "rally.device-mode";
const DEVICE_CLASSES = ["device-mobile", "device-tablet", "device-desktop"] as const;

function detectAuto(): "mobile" | "tablet" | "desktop" {
  if (typeof window === "undefined") return "desktop";
  const w = window.innerWidth;
  const coarse = window.matchMedia?.("(pointer: coarse)").matches ?? false;
  if (w < 768) return "mobile";
  if (coarse && w < 1600) return "tablet";
  if (coarse && w >= 1600) return "tablet"; // tablet grande (ej. 1920x1200)
  return "desktop";
}

export function readDeviceMode(): DeviceMode {
  if (typeof window === "undefined") return "auto";
  const v = window.localStorage.getItem(STORAGE_KEY) as DeviceMode | null;
  return v === "mobile" || v === "tablet" || v === "desktop" || v === "auto" ? v : "auto";
}

export function applyDeviceMode(mode: DeviceMode) {
  if (typeof document === "undefined") return;
  const html = document.documentElement;
  html.classList.remove(...DEVICE_CLASSES);
  const resolved = mode === "auto" ? detectAuto() : mode;
  html.classList.add(`device-${resolved}`);
  html.dataset.deviceMode = mode;
  html.dataset.deviceResolved = resolved;
}

/** Init on app mount — apply saved mode and listen to viewport changes for auto. */
export function initDeviceMode() {
  if (typeof window === "undefined") return () => {};
  const mode = readDeviceMode();
  applyDeviceMode(mode);
  const onResize = () => {
    if (readDeviceMode() === "auto") applyDeviceMode("auto");
  };
  window.addEventListener("resize", onResize);
  return () => window.removeEventListener("resize", onResize);
}

export function useDeviceMode() {
  const [mode, setModeState] = useState<DeviceMode>(() => readDeviceMode());

  useEffect(() => {
    applyDeviceMode(mode);
  }, [mode]);

  const setMode = useCallback((m: DeviceMode) => {
    window.localStorage.setItem(STORAGE_KEY, m);
    setModeState(m);
  }, []);

  return { mode, setMode };
}
