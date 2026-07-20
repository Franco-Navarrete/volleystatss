// Paleta oficial de 20 colores para equipos y clubes.
// Nombres en español; valores HEX.
export const TEAM_COLOR_PALETTE: { name: string; hex: string }[] = [
  { name: "Negro", hex: "#111111" },
  { name: "Blanco", hex: "#f8f8f8" },
  { name: "Gris", hex: "#8a8f98" },
  { name: "Rojo", hex: "#e63946" },
  { name: "Bordó", hex: "#7a1f2b" },
  { name: "Naranja", hex: "#ff7a3d" },
  { name: "Amarillo", hex: "#ffd23f" },
  { name: "Dorado", hex: "#d4a017" },
  { name: "Verde", hex: "#43d27a" },
  { name: "Verde oscuro", hex: "#1f6f3c" },
  { name: "Turquesa", hex: "#3ec1d3" },
  { name: "Celeste", hex: "#5d9cec" },
  { name: "Azul", hex: "#1d4ed8" },
  { name: "Azul marino", hex: "#0b2447" },
  { name: "Violeta", hex: "#9b5de5" },
  { name: "Púrpura", hex: "#5b21b6" },
  { name: "Rosa", hex: "#ff5d8f" },
  { name: "Fucsia", hex: "#d63384" },
  { name: "Marrón", hex: "#8b4513" },
  { name: "Beige", hex: "#e6d3a3" },
];

export const TEAM_COLORS_HEX: string[] = TEAM_COLOR_PALETTE.map((c) => c.hex);

export function colorName(hex: string): string | undefined {
  return TEAM_COLOR_PALETTE.find((c) => c.hex.toLowerCase() === hex.toLowerCase())?.name;
}
