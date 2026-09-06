// leveldb-harvest.mjs — BULK JWT refresh for accounts 6-25 (and any account).
// The UU Browser SPA auto-refreshes ALL Qwen session JWTs into LevelDB whenever
// a chat.qwen.ai tab is open. This script scans LevelDB for those tokens, matches
// them to accounts.json by user id, and updates the registry + .env.freecode
// when the found token has a HIGHER exp than the stored one.
//
// Extraction uses the proven segment-walk from qwen_mcp.py: LevelDB splices
// 0x01/0x02 control bytes INTO the base64url text, so a plain regex misses
// tokens — we walk char-by-char per dot-segment instead.
//
// Usage: node leveldb-harvest.mjs [--dry]
//   --dry  report only, do not write accounts.json / .env.freecode
import { readFileSync, writeFileSync, readdirSync, existsSync } from "node:fs"
import { join } from "node:path"

const LEVELDB = "C:\\Users\\hp\\AppData\\Local\\UUBrowser\\User Data\\Default\\Local Storage\\leveldb"
const ACCOUNTS_JSON = "F:\\qwenmesh\\accounts.json"
const ENV_FREECODE = "F:\\FREE CODE BY MOIZ\\.env.freecode"
const DRY = process.argv.includes("--dry")
const B64URL = new Set("ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789_-")

function decodeJwtPayload(token) {
  try {
    const p = token.split(".")[1]
    return JSON.parse(Buffer.from(p, "base64url").toString("utf8"))
  } catch { return null }
}

// segment-walk extractor (from qwen_mcp.py — handles control bytes in the stream)
function extractJwtAt(data, pos) {
  const segments = []
  let cur = []
  let i = pos
  while (i < data.length && segments.length < 3) {
    const b = data[i]
    if (b === 0x2e) { // '.'
      if (cur.length) { segments.push(cur.join("")); cur = [] }
      else break
    } else if (B64URL.has(String.fromCharCode(b))) {
      cur.push(String.fromCharCode(b))
    } else {
      break // control byte or unrelated char ends the token
    }
    i++
  }
  if (cur.length && segments.length < 3) segments.push(cur.join(""))
  if (segments.length !== 3) return null
  const tok = segments.join(".")
  return tok.length >= 120 ? tok : null
}

function scanLevelDb() {
  let files
  try { files = readdirSync(LEVELDB).filter((f) => f.endsWith(".ldb") || f.endsWith(".log")) }
  catch { return [] }
  const found = new Map()
  for (const f of files) {
    let buf
    try { buf = readFileSync(join(LEVELDB, f)) } catch { continue }
    let i = buf.indexOf(Buffer.from("eyJhbGciOiJIUzI1NiIs"))
    while (i >= 0) {
      const tok = extractJwtAt(buf, i)
      if (tok && !found.has(tok)) found.set(tok, f)
      i = buf.indexOf(Buffer.from("eyJhbGciOiJIUzI1NiIs"), i + 1)
    }
  }
  return [...found.keys()]
}

// --- main ---
console.log(`scanning ${LEVELDB} ...`)
const tokens = scanLevelDb()
console.log(`unique JWTs found: ${tokens.length}`)
if (!tokens.length) process.exit(0)

// registry
const rawAcc = readFileSync(ACCOUNTS_JSON, "utf8").replace(/^\uFEFF/, "")
const accJson = JSON.parse(rawAcc)
const accArr = Array.isArray(accJson.accounts) ? accJson.accounts : Array.isArray(accJson) ? accJson : Object.values(accJson.accounts || accJson)
const byId = new Map(accArr.map((a, i) => [a.id || (() => { try { return JSON.parse(Buffer.from((a.jwt || "").split(".")[1], "base64url").toString()).id } catch { return null } })(), i]))

// env accounts
const envRaw = readFileSync(ENV_FREECODE, "utf8")
const envMatch = envRaw.match(/FREECODE_BRIDGE_QWEN_ACCOUNTS=(.+)/)
if (!envMatch) { console.error("FREECODE_BRIDGE_QWEN_ACCOUNTS not found in .env.freecode"); process.exit(1) }
const envAccounts = JSON.parse(envMatch[1].trim())

let updated = 0, skippedOlder = 0, unknown = 0
for (const tok of tokens) {
  const payload = decodeJwtPayload(tok)
  if (!payload?.id || !payload?.exp) continue
  const idx = byId.get(payload.id)
  if (idx === undefined || !accArr[idx]) { console.log(`  unknown account id ${payload.id} — skipping`); unknown++; continue }
  const acct = accArr[idx]
  const cur = acct.jwt || ""
  let curExp = 0
  try { curExp = JSON.parse(Buffer.from(cur.split(".")[1], "base64url").toString()).exp || 0 } catch {}
  const days = Math.round((payload.exp - Date.now() / 1000) / 86400)
  if (payload.exp > curExp) {
    const oldDays = curExp ? Math.round((curExp - Date.now() / 1000) / 86400) : 0
    console.log(`  [acct ${idx + 1}] UPDATED: ${oldDays}d -> ${days}d`)
    acct.jwt = tok
    if (envAccounts[idx]) envAccounts[idx].ticket = tok
    updated++
  } else {
    skippedOlder++
    console.log(`  [acct ${idx + 1}] skipped (stored token is same/newer: ${days}d)`)
  }
}

console.log(`\nsummary: ${updated} updated, ${skippedOlder} already-fresh, ${unknown} unknown ids`)

if (DRY) { console.log("dry run — no files written"); process.exit(0) }
if (updated > 0) {
  writeFileSync(ACCOUNTS_JSON, JSON.stringify(accJson, null, 2), "utf8")
  const newEnv = envRaw.replace(/FREECODE_BRIDGE_QWEN_ACCOUNTS=.+/, () => "FREECODE_BRIDGE_QWEN_ACCOUNTS=" + JSON.stringify(envAccounts))
  writeFileSync(ENV_FREECODE, newEnv, "utf8")
  console.log("accounts.json + .env.freecode updated")
  console.log("NOTE: run 'gh secret set QWEN_JWT_N -R moizsiddiq443-lang/qwen-mesh' for each refreshed account to sync GitHub secrets")
} else {
  console.log("nothing to write")
}