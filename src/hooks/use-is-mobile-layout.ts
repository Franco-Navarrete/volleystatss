import { useEffect, useState } from "react";

/**
 * Determina si debemos usar el layout móvil dedicado.
 * True cuando html.device-mobile o viewport <768px (portrait phone).
 */
export function useIsMobileLayout(): boolean {
  const [mobile, setMobile] = useState(false);
  useEffect(() => {
    if (typeof window === "undefined") return;
    const html = document.documentElement;
    const compute = () => {
      const w = window.innerWidth;
      const isSmall = w < 768;
      const forced = html.classList.contains("device-mobile");
      const notTablet = !html.classList.contains("device-tablet");
      setMobile(forced || (isSmall && notTablet));
    };
    compute();
    window.addEventListener("resize", compute);
    const obs = new MutationObserver(compute);
    obs.observe(html, { attributes: true, attributeFilter: ["class"] });
    return () => {
      window.removeEventListener("resize", compute);
      obs.disconnect();
    };
  }, []);
  return mobile;
}
