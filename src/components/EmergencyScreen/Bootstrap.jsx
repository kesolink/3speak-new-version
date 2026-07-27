import { useEffect, useState } from 'react';
import App from '../../App';
import EmergencyScreen, { EMERGENCY_MODE } from './EmergencyScreen';
import { checkPlatformHealth } from '../../utils/healthGate';

// Dev escape hatch: set VITE_DISABLE_HEALTH_GATE=true in .env to skip the
// /healthz probe entirely and always render the app. Use it for local/dev work
// so a flaky or unreachable checker never blocks the app behind the maintenance
// screen. Leave it unset (or false) in the deployed .env.
const HEALTH_GATE_DISABLED =
  String(import.meta.env.VITE_DISABLE_HEALTH_GATE).toLowerCase() === 'true';

/**
 * Load-time maintenance gate. Decides — on the fly, per visit — whether to render
 * the app or the maintenance takeover:
 *
 *   1. EMERGENCY_MODE (compile-time const) → hard override, straight to takeover.
 *   2. Otherwise ask the checker's /healthz once. While the probe is in flight we
 *      show a neutral branded splash (no scary copy). Then render <App/> when it
 *      reports healthy, or the full maintenance screen when it reports down.
 *
 * The probe fails OPEN (see healthGate.js): a health-endpoint hiccup shows the
 * app, never a false outage screen.
 */
export default function Bootstrap() {
  // 'ok' | 'down'
  //
  // Start OPTIMISTIC and render the app straight away, then switch to the
  // maintenance screen only if the probe explicitly reports "down". This used to
  // start at 'checking' and hold a splash until /healthz answered — but the probe
  // already fails OPEN (healthGate.js returns healthy on any error), so blocking
  // bought nothing: an unreachable checker showed the app anyway, just later. The
  // only cost of not waiting is that a real outage takeover lands one probe late
  // (~50ms + RTT) instead of every visitor paying that wait on every cold load.
  const [phase, setPhase] = useState(() => (EMERGENCY_MODE ? 'down' : 'ok'));

  useEffect(() => {
    if (EMERGENCY_MODE || HEALTH_GATE_DISABLED) return; // no probe needed
    let alive = true;
    checkPlatformHealth().then(({ healthy }) => {
      if (alive && !healthy) setPhase('down');
    });
    return () => {
      alive = false;
    };
  }, []);

  if (phase === 'down') return <EmergencyScreen />;
  return <App />;
}
