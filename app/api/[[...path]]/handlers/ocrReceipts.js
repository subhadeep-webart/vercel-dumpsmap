// P-next: AI Receipt Scanner (OCR) — Gemini 2.5 Flash via Emergent LLM key.
//
// Endpoint:
//   POST /api/receipts/scan        (multipart/form-data; field: 'file')
//     - Persists the original image to /data/db/uploads
//     - Sends inline base64 to Gemini 2.5 Flash with a strict receipt-extraction prompt
//     - Returns a normalized draft compatible with the existing dump_receipts schema:
//         { ok, draft, ocr: { provider, model, confidence, raw, photoUrl } }
//     - The frontend shows the draft for human review, then POSTs to existing
//       /api/receipts to persist (with ocr metadata attached).
//
// Feature gating: requires `ocrReceiptScanner` (additive on top of auth).
// Storage: /data/db/uploads (same persistent path used by /api/upload).

import { promises as fs } from 'fs'
import nodePath from 'path'

const { canAccessFeature } = require('../../../../lib/feature-control')
const { llmChat, getTextContent, safeParseJson, isLlmConfigured } = require('../../../../lib/llm')

const PERSIST_UPLOAD_DIR = nodePath.join('/data', 'db', 'uploads')
const MAX_BYTES = 8 * 1024 * 1024 // 8 MB
const ALLOWED_MIMES = new Set(['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/heic', 'image/heif'])
const MODEL = 'gemini/gemini-2.5-flash'

const SYSTEM_PROMPT = `You are an expert receipt OCR system for waste disposal, landfill, transfer station, recycling, and scrap facilities.

You will be given a photograph of a dump / disposal / scrap receipt. Extract the listed fields and return ONE compact JSON object — NO markdown, NO commentary, NO code fences.

Required JSON shape (use null when a field is not legible or not present):

{
  "facilityName": string | null,
  "facilityAddress": string | null,
  "facilityCity": string | null,
  "dateOf": string | null,              // ISO date "YYYY-MM-DD"
  "timeIn": string | null,              // "HH:MM" 24h
  "timeOut": string | null,             // "HH:MM" 24h
  "ticketNumber": string | null,
  "grossLb": number | null,             // pounds
  "tareLb": number | null,              // pounds
  "netLb": number | null,               // pounds
  "netTons": number | null,             // US tons (net pounds / 2000)
  "weightUnit": "lb" | "ton" | "kg" | null,
  "materialType": string | null,        // e.g. "MSW", "C&D", "Green Waste", "Mixed", "Metal", "Cardboard"
  "loadType": "mixed" | "clean" | "cnd" | "green" | "metal" | "other" | null,
  "totalCost": number | null,           // dollar amount the contractor PAID
  "recyclingPayout": number | null,     // dollar amount the contractor RECEIVED (scrap/recycle revenue)
  "paymentMethod": "card" | "cash" | "check" | "account" | "other" | null,
  "vehicleNumber": string | null,       // truck #, plate, or unit
  "confidence": number                  // 0-100 your overall confidence
}

Rules:
- Convert all weights to pounds in grossLb / tareLb / netLb when the receipt uses kg or tons. Always also fill netTons.
- If only net weight is shown, set grossLb/tareLb to null and fill netLb + netTons.
- totalCost: only when the contractor PAYS. recyclingPayout: only when the facility PAYS the contractor (scrap, recycling buyback). Never both for the same dollar amount.
- Dates: prefer ISO YYYY-MM-DD. If only the date is partly legible, set null.
- confidence reflects how confidently you read the receipt overall (0 = unreadable, 100 = perfect).
- Output a SINGLE JSON object. No prose. No markdown.`

function num(v) {
  if (v == null || v === '') return null
  const n = Number(v)
  return Number.isFinite(n) ? n : null
}
function str(v, max = 200) {
  if (v == null) return ''
  return String(v).slice(0, max)
}
function pickEnum(v, allowed) {
  const s = String(v || '').toLowerCase()
  return allowed.includes(s) ? s : null
}

// Map the raw LLM JSON into the shape /api/receipts expects (matches normalizeReceipt
// in handlers/receipts.js so the user can save the draft with no field translation).
function buildDraft(parsed) {
  const grossLb = num(parsed.grossLb)
  const tareLb = num(parsed.tareLb)
  let netLb = num(parsed.netLb)
  let netTons = num(parsed.netTons)
  if (netLb == null && grossLb != null && tareLb != null) netLb = Math.max(0, grossLb - tareLb)
  if (netTons == null && netLb != null) netTons = Number((netLb / 2000).toFixed(4))
  if (netLb == null && netTons != null) netLb = Math.round(netTons * 2000)

  const totalCost = num(parsed.totalCost)
  const recyclingPayout = num(parsed.recyclingPayout)
  const pm = pickEnum(parsed.paymentMethod, ['card', 'cash', 'check', 'account', 'other']) || 'card'
  const lt = pickEnum(parsed.loadType, ['mixed', 'clean', 'cnd', 'green', 'metal', 'other']) || 'mixed'

  return {
    facilityName: str(parsed.facilityName, 120),
    facilityAddress: str(parsed.facilityAddress, 200),
    facilityCity: str(parsed.facilityCity, 80),
    dateOf: str(parsed.dateOf || new Date().toISOString().slice(0, 10), 10),
    timeIn: str(parsed.timeIn, 5),
    timeOut: str(parsed.timeOut, 5),
    ticketNumber: str(parsed.ticketNumber, 60),
    grossLb: grossLb ?? 0,
    tareLb: tareLb ?? 0,
    netLb: netLb ?? 0,
    netTons: netTons ?? 0,
    weightUnit: pickEnum(parsed.weightUnit, ['lb', 'ton', 'kg']) || 'lb',
    materialType: str(parsed.materialType, 80),
    loadType: lt,
    totalCost: totalCost ?? 0,
    recyclingPayout: recyclingPayout ?? 0,
    paymentMethod: pm,
    vehicleNumber: str(parsed.vehicleNumber, 40),
    pricePerTon: 0, // user fills if known
  }
}

export async function handle(ctx) {
  const { route, method, request, db, getAuth, clean, uuidv4, NextResponse, handleCORS } = ctx

  if (route !== '/receipts/scan' || method !== 'POST') return null

  const auth = getAuth(request)
  if (!auth) return handleCORS(NextResponse.json({ error: 'Auth required' }, { status: 401 }))
  const userRow = await db.collection('users').findOne({ id: auth.id })
  if (!userRow) return handleCORS(NextResponse.json({ error: 'Auth required' }, { status: 401 }))

  // Additive feature gate
  const flag = await db.collection('feature_flags').findOne({ key: 'ocrReceiptScanner' })
  const grant = await db.collection('feature_grants').findOne({
    key: 'ocrReceiptScanner', scope: 'user', scopeId: userRow.id,
  })
  const access = canAccessFeature(userRow, 'ocrReceiptScanner', {}, flag, grant)
  if (!access.allowed) {
    return handleCORS(NextResponse.json({
      error: 'AI Receipt Scanner is not enabled for your account',
      reason: access.reason,
      lockedState: access.lockedState,
      requiresApply: !!access.requiresApply,
      requiresUpgrade: !!access.requiresUpgrade,
    }, { status: 403 }))
  }

  if (!isLlmConfigured()) {
    return handleCORS(NextResponse.json({
      error: 'OCR engine not configured (EMERGENT_LLM_KEY missing).',
    }, { status: 503 }))
  }

  // Parse multipart
  let file = null
  try {
    const fd = await request.formData()
    const f = fd.get('file')
    if (f && typeof f === 'object' && 'arrayBuffer' in f) file = f
  } catch (e) {
    return handleCORS(NextResponse.json({ error: 'Invalid multipart payload' }, { status: 400 }))
  }
  if (!file) return handleCORS(NextResponse.json({ error: 'No file uploaded (field name: "file")' }, { status: 400 }))

  if (file.size > MAX_BYTES) {
    return handleCORS(NextResponse.json({ error: 'File exceeds 8 MB limit' }, { status: 413 }))
  }
  const mime = (file.type || '').toLowerCase()
  if (!ALLOWED_MIMES.has(mime) && !mime.startsWith('image/')) {
    return handleCORS(NextResponse.json({ error: 'Unsupported image type. Use JPEG/PNG/WEBP/HEIC.' }, { status: 415 }))
  }
  const buf = Buffer.from(await file.arrayBuffer())

  // Save the original image to persistent storage (so the contractor can attach
  // it to the final receipt — same backing store as /api/upload).
  let photoUrl = null
  let storedFilename = null
  try {
    await fs.mkdir(PERSIST_UPLOAD_DIR, { recursive: true })
    const id = uuidv4()
    let ext = 'jpg'
    if (mime.includes('png')) ext = 'png'
    else if (mime.includes('webp')) ext = 'webp'
    else if (mime.includes('heic')) ext = 'heic'
    else if (mime.includes('heif')) ext = 'heif'
    storedFilename = `${id}.${ext}`
    await fs.writeFile(nodePath.join(PERSIST_UPLOAD_DIR, storedFilename), buf)
    photoUrl = `/api/files/${storedFilename}`
    await db.collection('uploads').insertOne({
      id, url: photoUrl, filename: storedFilename,
      originalName: file.name || '',
      mime: mime || 'image/jpeg',
      size: file.size, userId: userRow.id,
      source: 'ocr_scan', createdAt: new Date(),
    })
  } catch (e) {
    console.error('OCR save image failed:', e?.message)
    // Continue — OCR can still run on in-memory base64
  }

  // Build the multimodal message for Gemini via Emergent
  const dataUrl = `data:${mime || 'image/jpeg'};base64,${buf.toString('base64')}`
  const messages = [
    { role: 'system', content: SYSTEM_PROMPT },
    {
      role: 'user',
      content: [
        { type: 'text', text: 'Extract the receipt fields per the JSON schema in the system prompt. Output JSON only.' },
        { type: 'image_url', image_url: { url: dataUrl } },
      ],
    },
  ]

  let completion = null
  let text = null
  let parsed = null
  let llmError = null
  const t0 = Date.now()
  try {
    completion = await llmChat({
      model: MODEL,
      messages,
      temperature: 0,
      responseFormat: { type: 'json_object' },
      maxTokens: 2048,
      timeoutMs: 45000,
    })
    text = getTextContent(completion)
    parsed = safeParseJson(text)
  } catch (e) {
    llmError = e?.message || String(e)
  }
  const elapsedMs = Date.now() - t0

  // Log the scan attempt (auditable; small payload)
  try {
    await db.collection('ocr_scans').insertOne({
      id: uuidv4(),
      userId: userRow.id,
      photoUrl,
      filename: storedFilename,
      model: MODEL,
      provider: 'emergent/gemini',
      elapsedMs,
      ok: !!parsed,
      rawTextLen: text ? text.length : 0,
      raw: text ? text.slice(0, 6000) : null,
      error: llmError || (parsed ? null : 'parse_failed'),
      createdAt: new Date(),
    })
  } catch (_) {}

  if (llmError) {
    return handleCORS(NextResponse.json({
      error: 'OCR engine failed',
      detail: llmError,
      photoUrl,
    }, { status: 502 }))
  }
  if (!parsed) {
    return handleCORS(NextResponse.json({
      error: 'OCR result was not valid JSON',
      raw: text,
      photoUrl,
    }, { status: 502 }))
  }

  const draft = buildDraft(parsed)
  const confidence = Math.max(0, Math.min(100, num(parsed.confidence) ?? 60))

  return handleCORS(NextResponse.json({
    ok: true,
    draft,
    ocr: {
      provider: 'emergent/gemini',
      model: MODEL,
      confidence,
      elapsedMs,
      photoUrl,
      raw: parsed, // give the UI the raw structured output too for debugging
    },
  }))
}
