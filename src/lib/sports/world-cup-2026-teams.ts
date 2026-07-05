/**
 * Librería de selecciones nacionales para la Copa Mundial FIFA 2026.
 *
 * Cada entrada usa el código ISO 3166-1 alpha-2 en MAYÚSCULAS (`code`) como
 * identificador único que se persiste en `sports_matches.{home,away}_flag_code`.
 * Las banderas se renderizan como SVG desde el CDN público `flagcdn.com`, que
 * sirve todas las banderas ISO como SVG optimizado con cache agresivo.
 *
 * Todos los datos son estáticos — no hay entradas dinámicas de usuario en esta
 * lista, lo que la hace segura para usar como allowlist tanto en cliente como
 * en servidor.
 */

export type Confederation = "CONMEBOL" | "CONCACAF" | "UEFA" | "AFC" | "CAF" | "OFC";

export type WorldCupTeam = {
  /** ISO 3166-1 alpha-2 en MAYÚSCULAS. Identificador único. */
  code: string;
  /** Nombre en español (para UI y auto-fill del `home_name`/`away_name`). */
  name: string;
  confederation: Confederation;
  /** true = anfitrión confirmado de Mundial 2026. */
  isHost?: boolean;
};

export const WORLD_CUP_2026_TEAMS: readonly WorldCupTeam[] = [
  // Anfitriones
  { code: "US", name: "Estados Unidos", confederation: "CONCACAF", isHost: true },
  { code: "MX", name: "México", confederation: "CONCACAF", isHost: true },
  { code: "CA", name: "Canadá", confederation: "CONCACAF", isHost: true },

  // CONMEBOL
  { code: "AR", name: "Argentina", confederation: "CONMEBOL" },
  { code: "BR", name: "Brasil", confederation: "CONMEBOL" },
  { code: "UY", name: "Uruguay", confederation: "CONMEBOL" },
  { code: "CO", name: "Colombia", confederation: "CONMEBOL" },
  { code: "CL", name: "Chile", confederation: "CONMEBOL" },
  { code: "PE", name: "Perú", confederation: "CONMEBOL" },
  { code: "EC", name: "Ecuador", confederation: "CONMEBOL" },
  { code: "PY", name: "Paraguay", confederation: "CONMEBOL" },
  { code: "BO", name: "Bolivia", confederation: "CONMEBOL" },
  { code: "VE", name: "Venezuela", confederation: "CONMEBOL" },

  // CONCACAF
  { code: "CR", name: "Costa Rica", confederation: "CONCACAF" },
  { code: "PA", name: "Panamá", confederation: "CONCACAF" },
  { code: "HN", name: "Honduras", confederation: "CONCACAF" },
  { code: "JM", name: "Jamaica", confederation: "CONCACAF" },
  { code: "SV", name: "El Salvador", confederation: "CONCACAF" },
  { code: "GT", name: "Guatemala", confederation: "CONCACAF" },
  { code: "TT", name: "Trinidad y Tobago", confederation: "CONCACAF" },
  { code: "HT", name: "Haití", confederation: "CONCACAF" },

  // UEFA
  { code: "ES", name: "España", confederation: "UEFA" },
  { code: "FR", name: "Francia", confederation: "UEFA" },
  { code: "DE", name: "Alemania", confederation: "UEFA" },
  { code: "IT", name: "Italia", confederation: "UEFA" },
  { code: "PT", name: "Portugal", confederation: "UEFA" },
  { code: "GB", name: "Inglaterra", confederation: "UEFA" },
  { code: "NL", name: "Países Bajos", confederation: "UEFA" },
  { code: "BE", name: "Bélgica", confederation: "UEFA" },
  { code: "HR", name: "Croacia", confederation: "UEFA" },
  { code: "CH", name: "Suiza", confederation: "UEFA" },
  { code: "AT", name: "Austria", confederation: "UEFA" },
  { code: "DK", name: "Dinamarca", confederation: "UEFA" },
  { code: "SE", name: "Suecia", confederation: "UEFA" },
  { code: "NO", name: "Noruega", confederation: "UEFA" },
  { code: "PL", name: "Polonia", confederation: "UEFA" },
  { code: "TR", name: "Turquía", confederation: "UEFA" },
  { code: "RS", name: "Serbia", confederation: "UEFA" },
  { code: "UA", name: "Ucrania", confederation: "UEFA" },
  { code: "CZ", name: "República Checa", confederation: "UEFA" },
  { code: "HU", name: "Hungría", confederation: "UEFA" },
  { code: "RO", name: "Rumania", confederation: "UEFA" },
  { code: "GR", name: "Grecia", confederation: "UEFA" },
  { code: "IE", name: "Irlanda", confederation: "UEFA" },
  { code: "IS", name: "Islandia", confederation: "UEFA" },
  { code: "SK", name: "Eslovaquia", confederation: "UEFA" },
  { code: "SI", name: "Eslovenia", confederation: "UEFA" },
  { code: "AL", name: "Albania", confederation: "UEFA" },

  // AFC
  { code: "JP", name: "Japón", confederation: "AFC" },
  { code: "KR", name: "Corea del Sur", confederation: "AFC" },
  { code: "AU", name: "Australia", confederation: "AFC" },
  { code: "IR", name: "Irán", confederation: "AFC" },
  { code: "SA", name: "Arabia Saudita", confederation: "AFC" },
  { code: "QA", name: "Catar", confederation: "AFC" },
  { code: "IQ", name: "Irak", confederation: "AFC" },
  { code: "AE", name: "Emiratos Árabes Unidos", confederation: "AFC" },
  { code: "UZ", name: "Uzbekistán", confederation: "AFC" },
  { code: "JO", name: "Jordania", confederation: "AFC" },

  // CAF
  { code: "MA", name: "Marruecos", confederation: "CAF" },
  { code: "SN", name: "Senegal", confederation: "CAF" },
  { code: "TN", name: "Túnez", confederation: "CAF" },
  { code: "GH", name: "Ghana", confederation: "CAF" },
  { code: "EG", name: "Egipto", confederation: "CAF" },
  { code: "CM", name: "Camerún", confederation: "CAF" },
  { code: "CI", name: "Costa de Marfil", confederation: "CAF" },
  { code: "NG", name: "Nigeria", confederation: "CAF" },
  { code: "DZ", name: "Argelia", confederation: "CAF" },
  { code: "ZA", name: "Sudáfrica", confederation: "CAF" },
  { code: "ML", name: "Malí", confederation: "CAF" },
  { code: "CV", name: "Cabo Verde", confederation: "CAF" },

  // OFC
  { code: "NZ", name: "Nueva Zelanda", confederation: "OFC" },
] as const;

/** Allowlist inmutable de códigos válidos. Se usa en cliente y servidor. */
export const WORLD_CUP_2026_TEAM_CODES: ReadonlySet<string> = new Set(
  WORLD_CUP_2026_TEAMS.map((t) => t.code),
);

/** Diccionario `code -> team` para lookups O(1). */
export const WORLD_CUP_2026_TEAMS_BY_CODE: Readonly<Record<string, WorldCupTeam>> =
  Object.fromEntries(WORLD_CUP_2026_TEAMS.map((t) => [t.code, t]));

/** Convierte código alpha-2 en la URL del SVG en flagcdn. */
export function flagSvgUrl(code: string): string {
  const c = code.toLowerCase();
  // Caso especial: "GB" representa a Inglaterra en nuestra lista del Mundial
  // (no al Reino Unido). Usamos la bandera de la subdivisión inglesa
  // (cruz de San Jorge) para diferenciarla de la Union Jack y evitar
  // confusión con banderas similares (p. ej. Australia).
  if (c === "gb") return "https://flagcdn.com/gb-eng.svg";
  return `https://flagcdn.com/${c}.svg`;
}

/** Devuelve el nombre en español o el propio código si no está registrado. */
export function teamName(code: string): string {
  return WORLD_CUP_2026_TEAMS_BY_CODE[code]?.name ?? code;
}

export const CONFEDERATION_LABELS: Record<Confederation, string> = {
  CONMEBOL: "Conmebol · Sudamérica",
  CONCACAF: "Concacaf · Norte y Centroamérica",
  UEFA: "UEFA · Europa",
  AFC: "AFC · Asia",
  CAF: "CAF · África",
  OFC: "OFC · Oceanía",
};