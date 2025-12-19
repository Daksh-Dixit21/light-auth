/**
 * Safely calls a hook function with given context.
 * Logs errors inside the hook itself without breaking main flow.
 * @param {Function} fn - Hook function.
 * @param {Object} context - Context to pass to hook.
 */
export async function callHook(fn, context) {
  try {
    if (typeof fn === "function") {
      await fn(context);
    }
  } catch (hookError) {
    console.error("[Hook Error]", hookError);
  }
}