import { useEffect, useRef } from "react"
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

  const code = params.get("code")
  const username = params.get("username")
  const state = params.get("state")

  useEffect(() => {
    const handleAuth = async () => {
      if (hasRun.current) return
      hasRun.current = true

      // Also guard at the module level against StrictMode re-mounts reusing the same code
      if (code && processedCodes.has(code)) return
      if (code) processedCodes.add(code)

      if (!code || !username) {
        toast.error("Butter Auth login failed")
        navigate("/")
        return
      }

      try {
        // Exchange the code via our backend. The PKCE verifier is read from a
        // server-side httpOnly cookie. The backend sets a 3speak session cookie
        // (also httpOnly) holding the access token — the frontend never sees it.
        const res = await fetch("/api/manteauth/exchange", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({
            code,
            redirect_uri: window.location.origin + "/callback"
          })
        })
        const data = await res.json()
        if (!res.ok || !data.username) {
          throw new Error(data.error || "Token exchange failed")
        }

        // Local marker that we're in a ManteAuth-backed session.
        // Username is read from the threespeak_user cookie (also non-sensitive).
        localStorage.setItem("user_id", data.username)
        localStorage.setItem("manteauth_login", "true")
        setUser(data.username)
        toast.success(`Logged in as @${data.username} via Butter Auth`)
        navigate(state || "/")
      } catch (err) {
        toast.error("Butter Auth login failed: " + err.message)
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
    }}>
      <h2 style={{ marginBottom: "20px", color: "var(--accent-primary)" }}>
        Logging in via Butter Auth...
      </h2>
    </div>
  )
}

export default ManteAuthCallback
