import { useEffect, useRef, useState } from "react"
import { useNavigate, useSearchParams } from "react-router-dom"
import { toast } from "sonner"
import { useAppStore } from "../../lib/store"

// Module-level guard: survives React StrictMode double-invokes and component re-mounts.
// Keyed by the OAuth code so a different flow can still run.
const processedCodes = new Set()

const ManteAuthCallback = () => {
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const { setUser } = useAppStore()
  const hasRun = useRef(false)
  const [closeable, setCloseable] = useState(false)

  const code = params.get("code")
  const username = params.get("username")
  const state = params.get("state")
  const isPopup = state === "popup"

  // Popup flow: write the result for the opener (picked up via a 'storage'
  // event), then try to close. The opener also closes us from its side, which
  // is more reliable — some browsers refuse window.close() after the
  // cross-origin auth hop. If we're still here, show a "you can close this"
  // message instead of an endless spinner; the opener has already logged in.
  const finishPopup = (result) => {
    try {
      localStorage.setItem("butrauth_login_result", JSON.stringify({ ...result, ts: Date.now() }))
    } catch { /* ignore */ }
    try { window.close() } catch { /* ignore */ }
    setCloseable(true)
  }

  useEffect(() => {
    const handleAuth = async () => {
      if (hasRun.current) return
      hasRun.current = true

      // Also guard at the module level against StrictMode re-mounts reusing the same code
      if (code && processedCodes.has(code)) return
      if (code) processedCodes.add(code)

      if (!code || !username) {
        if (isPopup) return finishPopup({ error: "login failed" })
        toast.error("Butter Auth login failed")
        navigate("/")
        return
      }

      try {
        // Exchange the code via our backend. Bounded with a timeout so a hung
        // or slow backend can't leave the popup spinning indefinitely.
        const ctrl = new AbortController()
        const timer = setTimeout(() => ctrl.abort(), 25000)
        let res
        try {
          res = await fetch("/api/manteauth/exchange", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            credentials: "include",
            body: JSON.stringify({
              code,
              redirect_uri: window.location.origin + "/callback"
            }),
            signal: ctrl.signal
          })
        } finally {
          clearTimeout(timer)
        }

        // A gateway timeout/5xx returns HTML, not JSON — read defensively so a
        // parse error doesn't mask the real status.
        let data = {}
        try { data = await res.json() } catch { /* non-JSON error body */ }
        if (!res.ok || !data.username) {
          throw new Error(data.error || `Token exchange failed (${res.status})`)
        }

        // Local marker that we're in a ManteAuth-backed session. Username is
        // also in the threespeak_user cookie (non-sensitive). localStorage is
        // shared with the opener, so this also keeps a later reload logged in.
        localStorage.setItem("user_id", data.username)
        localStorage.setItem("manteauth_login", "true")

        if (isPopup) return finishPopup({ username: data.username })

        setUser(data.username)
        toast.success(`Logged in as @${data.username} via Butter Auth`)
        navigate(state || "/")
      } catch (err) {
        const msg = err?.name === "AbortError"
          ? "Login timed out — please try again"
          : (err?.message || "Token exchange failed")
        if (isPopup) return finishPopup({ error: msg })
        toast.error("Butter Auth login failed: " + msg)
        navigate("/")
      }
    }

    handleAuth()
  }, [])

  return (
    <div style={{
      display: "flex",
      flexDirection: "column",
      justifyContent: "center",
      alignItems: "center",
      height: "87vh",
      textAlign: "center",
      padding: "0 20px",
    }}>
      {closeable ? (
        <>
          <h2 style={{ marginBottom: "12px", color: "var(--accent-primary)" }}>✓ All set</h2>
          <p style={{ color: "var(--text-secondary, #888)" }}>
            You can close this window and return to 3Speak.
          </p>
        </>
      ) : (
        <h2 style={{ marginBottom: "20px", color: "var(--accent-primary)" }}>
          Logging in via Butter Auth...
        </h2>
      )}
    </div>
  )
}

export default ManteAuthCallback
