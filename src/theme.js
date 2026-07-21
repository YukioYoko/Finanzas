import { createContext, useContext } from "react";

// ---------- Temas ----------
export const THEMES = {
  dark: {
    bg: "#171D22",
    surface: "#1F262C",
    surface2: "#273037",
    border: "#37424B",
    borderSoft: "#2C353D",
    text: "#E9EDF0",
    muted: "#9DAAB3",
    faint: "#6E7A83",
    accent: "#5AC79C",        // menta amigable
    accentText: "#0E1B16",    // texto sobre botones de acento
    accentSoft: "rgba(90,199,156,0.12)",
    amber: "#E8C171",         // deuda / a meses
    amberSoft: "rgba(232,193,113,0.10)",
    red: "#F09083",
    green: "#74D3A6",
    blue: "#82BEE6",
    chipBg: "rgba(255,255,255,0.06)",
    // Colores de serie para gráficas, validados para daltonismo sobre `surface`
    chartGasto: "#C64A39",
    chartIngreso: "#44A778",
  },
  light: {
    bg: "#F5F7F4",
    surface: "#FFFFFF",
    surface2: "#EFF3EE",
    border: "#D8DFD6",
    borderSoft: "#E5EAE2",
    text: "#2B3431",
    muted: "#68766F",
    faint: "#9AA69E",
    accent: "#2E9E77",
    accentText: "#FFFFFF",
    accentSoft: "rgba(46,158,119,0.10)",
    amber: "#B8862F",
    amberSoft: "rgba(184,134,47,0.10)",
    red: "#D65F4E",
    green: "#2E9E77",
    blue: "#3E7FB8",
    chipBg: "rgba(0,0,0,0.04)",
    chartGasto: "#A63E30",
    chartIngreso: "#3EA373",
  },
};

export const ThemeContext = createContext(THEMES.dark);
export const useTheme = () => useContext(ThemeContext);
