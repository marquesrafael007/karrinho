/** Settle even when a network implementation ignores AbortSignal. */
export function withDeadline<T>(
  task: (signal: AbortSignal) => Promise<T>,
  signal: AbortSignal,
  timeoutMs: number,
  timeoutError: Error,
): Promise<T> {
  return new Promise((resolve, reject) => {
    const controller = new AbortController();
    let settled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    function finish(result: { value: T } | { error: unknown }) {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      signal.removeEventListener("abort", cancel);
      if ("error" in result) reject(result.error);
      else resolve(result.value);
    }
    function cancel() {
      finish({ error: new Error("Consulta interrompida.") });
      controller.abort();
    }
    if (signal.aborted) {
      cancel();
      return;
    }
    signal.addEventListener("abort", cancel, { once: true });
    timer = setTimeout(() => {
      finish({ error: timeoutError });
      controller.abort();
    }, timeoutMs);
    Promise.resolve()
      .then(() => {
        if (controller.signal.aborted)
          throw new Error("Consulta interrompida.");
        return task(controller.signal);
      })
      .then(
        (value) => finish({ value }),
        (error) => finish({ error }),
      );
  });
}
