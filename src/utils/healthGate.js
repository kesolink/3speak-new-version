// Runtime maintenance gate. On load the app asks the checker's /healthz whether
// the platform is healthy enough to serve; Bootstrap uses the answer to decide
// between rendering <App/> and the maintenance <EmergencyScreen/>.
//
// Fail-OPEN: any network error, timeout, or non-JSON response resolves to
// healthy, so a hiccup in the health endpoint itself can never lock users out.
// We only take over the page when the checker is reachable AND explicitly
// reports the platform is down (Mongo unreachable, or ops set MAINTENANCE_MODE).
import { CHECKER_URL } from './config';

export async function checkPlatformHealth(timeoutMs = 2500) {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    const res = await fetch(`${CHECKER_URL}/healthz`, {
      signal: controller.signal,
      cache: 'no-store',
    });
    clearTimeout(timer);

    // /healthz always answers 200; a 5xx here means the checker/proxy itself is
    // sick, not a deliberate maintenance signal — fail open.
    if (!res.ok) return { healthy: true, reason: `http ${res.status}` };

    const data = await res.json();
    return { healthy: data.ok !== false, data };
  } catch (err) {
    return { healthy: true, reason: 'unreachable' };
  }
}
