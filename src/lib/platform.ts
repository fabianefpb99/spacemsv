// Detección de plataforma para aplicar optimizaciones específicas.
// SSR-safe: evalúa perezosamente al primer acceso y se cachea.

let _isAndroid: boolean | null = null;

export function isAndroid(): boolean {
  if (_isAndroid !== null) return _isAndroid;
  if (typeof navigator === "undefined") return false;
  _isAndroid = /Android/i.test(navigator.userAgent);
  return _isAndroid;
}
