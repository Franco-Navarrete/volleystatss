import { useEffect, useState, useCallback } from "react";

export type DeviceMode = "auto" | "mobile" | "tablet" | "desktop";

const STORAGE_KEY = "rally.device-mode";
const DEVICE_CLASSES = ["device-mobile", "device-tablet", "device-desktop"] as const;

export function isTabletHardware(): boolean {
  if (typeof window === "undefined") return false;
  const ua = window.navigator.userAgent;
  const platform = window.navigator.platform;
  const maxTouchPoints = window.navigator.maxTouchPoints ?? 0;
  const dpr = window.devicePixelRatio || 1;
  const coarse = window.matchMedia?.("(pointer: coarse)").matches ?? false;
  const noFinePointer = window.matchMedia?.("(hover: none)").matches ?? false;
  const touch = coarse || maxTouchPoints > 0;
  const screenW = window.screen?.width || window.innerWidth;
  const screenH = window.screen?.height || window.innerHeight;
  const viewportW = window.innerWidth;
  const viewportH = window.innerHeight;
  const longSide = Math.max(screenW, screenH);
  const shortSide = Math.min(screenW, screenH);
  const physicalLongSide = Math.max(screenW * dpr, screenH * dpr, viewportW * dpr, viewportH * dpr);
  const cssShortSide = Math.min(shortSide, viewportW, viewportH);
  const physicalShortSide = cssShortSide * dpr;
  const iPadLike = /iPad/i.test(ua) || (platform === "MacIntel" && maxTouchPoints > 1);
  const androidTablet = /Android/i.test(ua) && (!/Mobile/i.test(ua) || /Lenovo|TB-|Tab|Tablet/i.test(ua));
  const largeTouchScreen = touch && longSide >= 900 && shortSide >= 560;
  const wuxgaTouchScreen = touch && noFinePointer && cssShortSide >= 560 && physicalLongSide >= 1600 && physicalShortSide >= 1000;

  return iPadLike || androidTablet || largeTouchScreen || wuxgaTouchScreen;
}

function detectAuto(): "mobile" | "tablet" | "desktop" {
  if (typeof window === "undefined") return "desktop";
  const w = window.innerWidth;
  const coarse = window.matchMedia?.("(pointer: coarse)").matches ?? false;
  if (isTabletHardware()) return "tablet";
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
