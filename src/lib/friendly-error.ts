/**
 * Translate technical/server error codes into user-friendly Spanish
 * messages. Use in all game UI catch blocks so the player never sees
 * raw codes like `bj_insert_failed: duplicate key value...`.
 */
export function toFriendlyError(err: unknown, fallback = "Algo salió mal. Intenta de nuevo."): string {
  const raw = err instanceof Error ? err.message : typeof err === "string" ? err : "";
  const msg = raw.toLowerCase();

  // Network / fetch failures (Safari shows "Load failed", Chrome "Failed to fetch")
  if (
    msg.includes("load failed") ||
    msg.includes("failed to fetch") ||
    msg.includes("networkerror") ||
    msg.includes("network request failed") ||
    msg.includes("err_network") ||
    msg.includes("request_timeout") ||
    msg.includes("auth_get_session_timeout") ||
    msg.includes("auth_get_user_timeout") ||
    msg.includes("timeout") ||
    msg.includes("aborted")
  ) {
    return "Conexión inestable. Revisa tu internet e intenta de nuevo.";
  }

  // Saldo
  if (msg.includes("insufficient_funds") || msg.includes("saldo insuficiente")) {
    return "Saldo insuficiente.";
  }

  // Deportes
  if (msg.includes("bets_closed")) {
    return "Las apuestas para este partido ya están cerradas.";
  }
  if (msg.includes("match_not_available")) {
    return "Este partido ya no está disponible para apostar.";
  }
  if (msg.includes("match_not_found")) {
    return "No encontramos este partido. Vuelve a la lista.";
  }
  if (msg.includes("invalid_stake")) {
    return "El monto de la apuesta no es válido.";
  }
  if (msg.includes("not_authenticated")) {
    return "Tu sesión expiró. Vuelve a iniciar sesión.";
  }
  if (msg.includes("balance_not_found")) {
    return "No pudimos leer tu saldo. Intenta de nuevo.";
  }

  // Blackjack
  if (msg.includes("bj_insert_failed") && msg.includes("duplicate")) {
    return "Detectamos una acción duplicada. Tu saldo está a salvo, intenta de nuevo.";
  }
  if (msg.includes("bj_session_closed")) {
    return "Esta partida ya había terminado. Inicia una nueva mano.";
  }
  if (msg.includes("bj_stale_nonce")) {
    return "La acción anterior aún se está procesando. Espera un momento.";
  }
  if (msg.includes("bj_not_playing")) {
    return "Esta mano ya no permite más acciones.";
  }
  if (msg.includes("bj_double_not_allowed") || msg.includes("bj_already_doubled")) {
    return "No puedes doblar en este momento.";
  }
  if (msg.includes("bj_session_not_found")) {
    return "No encontramos tu partida. Inicia una nueva.";
  }
  if (msg.startsWith("bj_") || msg.startsWith("bj_insert_failed")) {
    return "Hubo un problema con la mano. Intenta de nuevo.";
  }

  // Mines / Slot / Dice / Spaceman shared patterns
  if (msg.includes("session_closed") || msg.includes("session_not_found")) {
    return "La partida ya no está activa. Empieza una nueva.";
  }
  if (msg.includes("stale_nonce") || msg.includes("concurrent")) {
    return "Acción en proceso. Espera un instante.";
  }
  if (msg.includes("rate") && msg.includes("limit")) {
    return "Demasiadas acciones seguidas. Espera unos segundos.";
  }
  if (msg.includes("unauthorized") || msg.includes("not authenticated")) {
    return "Tu sesión expiró. Vuelve a iniciar sesión.";
  }

  // Anything starting with a snake_case code → hide it
  if (/^[a-z]+_[a-z_]+/.test(msg)) {
    return fallback;
  }

  return raw || fallback;
}