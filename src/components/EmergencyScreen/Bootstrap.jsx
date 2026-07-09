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
  // 'checking' | 'ok' | 'down'
  const [phase, setPhase] = useState(() => {
    if (EMERGENCY_MODE) return 'down'; // hard override wins
    if (HEALTH_GATE_DISABLED) return 'ok'; // dev: skip probe, straight to app
    return 'checking';
  });

  useEffect(() => {
    if (EMERGENCY_MODE || HEALTH_GATE_DISABLED) return; // no probe needed
    let alive = true;
    checkPlatformHealth().then(({ healthy }) => {
      if (alive) setPhase(healthy ? 'ok' : 'down');
    });
    return () => {
      alive = false;
    };
  }, []);

  if (phase === 'checking') return <EmergencyScreen variant="checking" />;
  if (phase === 'down') return <EmergencyScreen />;
  return <App />;
}
