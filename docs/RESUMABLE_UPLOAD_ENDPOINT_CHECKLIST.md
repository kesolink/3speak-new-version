# Resumable-Upload Checklist for Embed Endpoints

**Purpose:** make a 3Speak embed-upload host support **resumable** TUS uploads, so the
web client can ride out flaky/slow connections (retry + resume from the last byte
instead of restarting at 0%).

**Audience:** whoever operates an endpoint in the pool
(`VITE_EMBED_UPLOAD_URLS`). Today that pool is:

| Host | Resume status | Notes |
|---|---|---|
| `embed2.3speak.tv` | ✅ **Reference (good)** | `tusd` behind nginx on the prodops box. Use this as the template. |
| `embed.3speak.tv` | ❌ Not resumable | Legacy origin (51.81.209.112). Fails resume with `invalid or missing length value`. **Target of this checklist.** |
| `embed-okinoko.okinoko.io` | ❓ Unverified | Run the verification section before trusting it. |

The client currently **gates resume to known-good hosts** — see
`endpointSupportsResume()` / `NON_RESUMABLE_UPLOAD_RX` in
`src/context/EmbedUploadContext.jsx`. An endpoint only gets resume once it passes
the checks below **and** is removed from the exclusion regex (last section).

---

## 1. What resume actually requires (protocol level)

The client uses `tus-js-client` v4. For resume to work the server must implement
the TUS 1.0.0 core + these extensions, end to end:

- **Creation** — `POST` returns `201` + a `Location` (the upload URL).
- **`HEAD` returns the current `Upload-Offset`** ← *this is the heart of resume.*
  On reconnect the client `HEAD`s the stored URL, reads the offset, and `PATCH`es
  from there.
- **Termination** — `DELETE` removes a partial (the client calls this on
  "Replace Video" via `abort(true)`).
- **Concatenation** (`Upload-Concat`) — only needed if parallel chunks are used
  (the client uses `parallelUploads > 1` on fast connections).
- **Persistent partials** — the half-finished file must survive *between requests*
  and across a reconnect, for the upload's whole lifetime (see §3).
- **Stable URL** — the `Location` the client stores must be reachable again later
  and route back to the **same partial** (see §4 load balancing).
- **CORS** that lets a browser read the resume headers (see §5).

If any one of these is missing, the client stores a fingerprint but the resume
`HEAD` fails — which is exactly the `invalid or missing length value` symptom on
`embed.3speak.tv`.

---

## 2. Reference config (what `embed2.3speak.tv` does — copy this)

**Server: `tusd`** (don't hand-roll a TUS server). Invocation in use:

```
tusd --host 127.0.0.1 --port 1081 --base-path /uploads --behind-proxy \
     --upload-dir /.../embedvideos/uploads \
     --hooks-http http://127.0.0.1:3501/tusd-hooks \
     --hooks-enabled-events pre-create,pre-finish,post-finish \
     --cors-allow-origin ".*" \
     --cors-allow-headers X-API-Key,Authorization,Origin,X-Requested-With,Content-Type,Upload-Length,Upload-Offset,Tus-Resumable,Upload-Metadata,Upload-Defer-Length,Upload-Concat,X-HTTP-Method-Override \
     --cors-expose-headers X-Embed-URL,Upload-Offset,Location,Upload-Length,Tus-Version,Tus-Resumable,Tus-Max-Size,Tus-Extension,Upload-Metadata,Upload-Defer-Length,Upload-Concat \
     --max-size 0
```

Key points: `--behind-proxy` (trust `X-Forwarded-*`), a **persistent** `--upload-dir`,
and the CORS allow/expose lists that include the TUS headers.

**nginx fronting it** (the bits that matter for resume / large bodies):

```nginx
client_max_body_size 0;
location / {
    proxy_pass http://localhost:3501;     # → node app → tusd
    proxy_request_buffering off;           # MUST be off: stream body, don't buffer
    proxy_buffering off;
    proxy_read_timeout 600s;
    proxy_send_timeout 600s;
    # (recommended addition) tolerate brief client stalls before the client retries:
    # client_body_timeout 120s;
}
```

---

## 3. Storage / persistence

- [ ] Partial uploads are written to **durable disk** (not `tmpfs`, not memory).
- [ ] Partials are **not** cleaned up until the upload finishes or a TTL expires.
      If you run a temp-file reaper, make its TTL longer than a slow upload
      (hours, not minutes).
- [ ] Enough free disk for concurrent in-flight uploads at full size
      (`--max-size 0` = unlimited per upload).
- [ ] On restart, the service does **not** wipe `--upload-dir` (in-flight uploads
      must survive a service bounce).

## 4. Load balancing (the silent resume killer)

If the hostname fronts **more than one** backend node:

- [ ] Either use **shared storage** for partials (all nodes see the same
      `--upload-dir`), **or**
- [ ] Pin each upload to the node that holds its partial (**sticky routing by
      upload ID / path**, not round-robin).
- [ ] Any CDN/proxy in front must **not** load-balance a resume `HEAD`/`PATCH`
      away from the node holding the partial.

A round-robin LB with per-node local storage = resume randomly fails. This is the
most common reason a "tus" endpoint still can't resume.

## 5. Proxy / CDN / CORS

- [ ] `proxy_request_buffering off` (nginx) or equivalent — never buffer the
      request body, or large/slow uploads stall and time out.
- [ ] The proxy/CDN forwards `PATCH`, `HEAD`, `DELETE`, `OPTIONS` (some CDNs strip
      non-GET/POST by default).
- [ ] `Location` returned by creation is **absolute and correct for the public
      host** (rewrite it if the backend emits an internal URL — see how the
      prod vhosts handle `proxy_redirect` for the upload host).
- [ ] CORS **allow** headers include: `Tus-Resumable, Upload-Length,
      Upload-Offset, Upload-Metadata, Upload-Concat, Upload-Defer-Length,
      X-API-Key, Content-Type, X-HTTP-Method-Override`.
- [ ] CORS **expose** headers include: `Upload-Offset, Location, Upload-Length,
      Tus-Resumable, Tus-Version, Tus-Extension, Upload-Concat, X-Embed-URL`.
      (Browsers can't read a header that isn't exposed — resume needs to read
      `Upload-Offset`.)
- [ ] Preflight `OPTIONS` returns `204/200` with the above, for the real site
      origin(s) (`https://3speak.tv`, `https://preview.3speak.tv`).

---

## 6. Verify with curl (do this before trusting the host)

Replace `HOST` with e.g. `https://embed.3speak.tv`. The decisive test is that a
**second `HEAD` after a partial `PATCH` reports the advanced offset**.

```bash
HOST=https://embed.3speak.tv
KEY=...            # X-API-Key if the endpoint requires it

# (a) capabilities — expect Tus-Resumable + Tus-Extension: creation,termination,concatenation...
curl -sS -i -X OPTIONS "$HOST/uploads" -H "Tus-Resumable: 1.0.0" | grep -i '^Tus-'

# (b) create a 1 MB upload — expect 201 + Location
LOC=$(curl -sS -D - -o /dev/null -X POST "$HOST/uploads" \
  -H "Tus-Resumable: 1.0.0" -H "Upload-Length: 1048576" \
  -H "Upload-Metadata: filename dGVzdC5tcDQ=" \
  ${KEY:+-H "X-API-Key: $KEY"} | awk 'tolower($1)=="location:"{print $2}' | tr -d '\r')
echo "Location: $LOC"

# (c) HEAD the new upload — expect Upload-Offset: 0 and Upload-Length: 1048576
curl -sS -i -X HEAD "$LOC" -H "Tus-Resumable: 1.0.0" ${KEY:+-H "X-API-Key: $KEY"} | grep -i 'upload-offset\|upload-length'

# (d) PATCH the first 512 KB — expect 204 + Upload-Offset: 524288
head -c 524288 /dev/urandom > /tmp/part1.bin
curl -sS -i -X PATCH "$LOC" -H "Tus-Resumable: 1.0.0" \
  -H "Content-Type: application/offset+octet-stream" -H "Upload-Offset: 0" \
  ${KEY:+-H "X-API-Key: $KEY"} --data-binary @/tmp/part1.bin | grep -i 'upload-offset\|HTTP/'

# (e) THE RESUME TEST — HEAD again — expect Upload-Offset: 524288 (NOT 0)
curl -sS -i -X HEAD "$LOC" -H "Tus-Resumable: 1.0.0" ${KEY:+-H "X-API-Key: $KEY"} | grep -i 'upload-offset'

# (f) terminate — expect 204 (Replace Video / abort(true) relies on this)
curl -sS -i -X DELETE "$LOC" -H "Tus-Resumable: 1.0.0" ${KEY:+-H "X-API-Key: $KEY"} | grep -i 'HTTP/'
```

Pass criteria:
- [ ] (a) lists `creation`, `termination`, and (if parallel) `concatenation`.
- [ ] (c) `Upload-Offset: 0`, `Upload-Length: 1048576`.
- [ ] (d) `204` + `Upload-Offset: 524288`.
- [ ] **(e) `Upload-Offset: 524288` on the *second* HEAD** ← if this is `0`, `404`,
      or `invalid or missing length value`, the host is **not** resumable.
- [ ] (f) `204` on DELETE.
- [ ] Repeat (b)→(e) from a browser origin (devtools) to confirm CORS exposes
      `Upload-Offset` (header readable, not just present).

---

## 7. Common failure modes → cause

| Symptom | Likely cause |
|---|---|
| `invalid or missing length value` on resume | Not a real TUS server, or `HEAD` doesn't return `Upload-Offset`/`Upload-Length` (§1). |
| Second `HEAD` returns offset `0` | Partial not persisted, or request hit a different backend node (§3, §4). |
| Resume `HEAD`/`PATCH` 404s | LB routed away from the node with the partial; no sticky routing / shared storage (§4). |
| Works in curl, fails in browser | CORS doesn't **expose** `Upload-Offset` / missing preflight (§5). |
| Uploads stall then time out | Proxy is **buffering** the body (`proxy_request_buffering` on) (§5). |
| Large uploads die mid-way | Reaper TTL too short, or disk full (§3). |

---

## 8. Final step — turn it on in the client

Once a host passes §6, enable resume for it in
`src/context/EmbedUploadContext.jsx`:

- `endpointSupportsResume(endpoint)` returns `true` for any host **not** matched by
  `NON_RESUMABLE_UPLOAD_RX` (currently `/(^|\/\/)embed\.3speak\.tv\b/i`).
- To enable resume on `embed.3speak.tv`, remove it from that regex (or empty the
  regex once **every** pooled host is verified).
- No other client change is needed — retry/backoff and connection-adaptive
  chunking already apply to all hosts.

> Keep a host in the exclusion until it passes §6. A host that stores a resume
> fingerprint but can't actually resume is **worse** than no resume — every retry
> re-hits a broken `HEAD`.
