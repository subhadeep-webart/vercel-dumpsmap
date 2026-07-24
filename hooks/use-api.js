'use client'

// useApi / useApiMutation — React bindings for the central api client.
// ---------------------------------------------------------------------------
// Most pages don't need a bespoke domain hook like useFacilityDetail; they just
// want "GET this path, give me { data, loading, error }" or "POST this on click,
// track loading". These two hooks cover that so callers never re-implement the
// loading/error/abort boilerplate on top of lib/api-client.
//
// useApi(path)          — declarative read: fetches on mount and whenever the
//                         path (or a dep in `deps`) changes; aborts on unmount.
// useApiMutation(fn)    — imperative write: returns run() that tracks loading
//                         and error and never setState after unmount.
//
// For anything with cross-request coordination (parallel fetches, fallbacks,
// derived state) write a domain hook that calls the `api` client directly —
// see hooks/use-facility-detail.js.

import { useCallback, useEffect, useRef, useState } from 'react'
import { api, apiFetch } from '@/lib/api-client'

/**
 * Declaratively GET a path and expose { data, loading, error, refetch }.
 *
 * @param {string|null} path   request path; pass null/'' to skip fetching
 *                             (e.g. while an id is undefined)
 * @param {object} [options]
 * @param {any[]}  [options.deps=[]]   extra deps that should trigger a refetch
 * @param {any}    [options.initialData=null]
 * @param {boolean}[options.enabled=true]  set false to defer the request
 * @param {object} [options.fetchOptions]  passed through to apiFetch (method,
 *                                          auth, timeout, headers…)
 */
export function useApi(path, options = {}) {
  const { deps = [], initialData = null, enabled = true, fetchOptions } = options
  const [data, setData] = useState(initialData)
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(Boolean(path) && enabled)

  const mounted = useRef(true)
  useEffect(() => {
    mounted.current = true
    return () => { mounted.current = false }
  }, [])

  // Keep the latest fetchOptions without making it a fetch trigger.
  const optsRef = useRef(fetchOptions)
  optsRef.current = fetchOptions

  const run = useCallback(async (signal) => {
    if (!path || !enabled) return
    setLoading(true)
    setError(null)
    try {
      const result = await apiFetch(path, { ...optsRef.current, method: 'GET', signal })
      if (mounted.current && !signal?.aborted) setData(result)
    } catch (e) {
      if (e?.code === 'aborted' || signal?.aborted || !mounted.current) return
      setError(e)
    } finally {
      if (mounted.current && !signal?.aborted) setLoading(false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [path, enabled])

  useEffect(() => {
    if (!path || !enabled) { setLoading(false); return }
    const ctrl = new AbortController()
    run(ctrl.signal)
    return () => ctrl.abort()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [path, enabled, run, ...deps])

  // Imperative refetch (button, post-mutation refresh). Not abort-linked to the
  // effect so it survives a re-render mid-flight.
  const refetch = useCallback(() => run(), [run])

  return { data, loading, error, refetch, setData }
}

/**
 * Wrap a write for imperative use (form submit, button click).
 *
 * @param {(vars:any, helpers:{signal:AbortSignal}) => Promise<any>} mutationFn
 * @param {object} [options]
 * @param {(data:any, vars:any) => void} [options.onSuccess]
 * @param {(error:any, vars:any) => void} [options.onError]
 * @returns {{ run:(vars?:any)=>Promise<{ok:boolean,data?:any,error?:any}>,
 *            loading:boolean, error:any, data:any, reset:()=>void }}
 *
 * run() resolves to { ok, data } or { ok:false, error } — it never throws, so
 * callers can branch without a try/catch.
 */
export function useApiMutation(mutationFn, options = {}) {
  const { onSuccess, onError } = options
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [data, setData] = useState(null)

  const mounted = useRef(true)
  useEffect(() => {
    mounted.current = true
    return () => { mounted.current = false }
  }, [])

  const fnRef = useRef(mutationFn)
  fnRef.current = mutationFn
  const cbRef = useRef({ onSuccess, onError })
  cbRef.current = { onSuccess, onError }

  const run = useCallback(async (vars) => {
    setLoading(true)
    setError(null)
    const ctrl = new AbortController()
    try {
      const result = await fnRef.current(vars, { signal: ctrl.signal })
      if (mounted.current) { setData(result); setLoading(false) }
      cbRef.current.onSuccess?.(result, vars)
      return { ok: true, data: result }
    } catch (e) {
      if (mounted.current) { setError(e); setLoading(false) }
      cbRef.current.onError?.(e, vars)
      return { ok: false, error: e }
    }
  }, [])

  const reset = useCallback(() => {
    setLoading(false); setError(null); setData(null)
  }, [])

  return { run, loading, error, data, reset }
}

// Re-export the client verbs so a caller can grab everything from one import:
//   import { useApi, api } from '@/hooks/use-api'
export { api }
