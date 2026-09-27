const PUBLISHED_URL = "https://volleystatss.lovable.app";

/** Base pública para enlaces compartibles: nunca la vista previa privada del editor. */
export function publicAppOrigin() {
  if (typeof window === "undefined") return PUBLISHED_URL;
  const { origin, hostname } = window.location;
  if (hostname.endsWith("lovableproject.com") || hostname.startsWith("id-preview--") || hostname === "localhost") {
    return PUBLISHED_URL;
  }
  return origin;
}
