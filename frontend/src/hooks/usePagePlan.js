import { useState } from 'react'
import { commit, fromPageEdits, identityPlan, newHistory, redo, toPageEdits, undo } from '../utils/pagePlan'

/**
 * The customer's list of output pages (order, rotation, position) with undo/redo and the page that is selected.
 * Every change is reported through `onEdits` in the shape the server takes (null when nothing differs from the original).
 */
export function usePagePlan(edits, sourcePages, onEdits) {
  const [h, setH] = useState(() => newHistory(fromPageEdits(edits, sourcePages)))
  const [sel, setSel] = useState(0)
  const [note, setNote] = useState('')
  const plan = h.present
  const cur = Math.min(sel, plan.length - 1)
  // A stamp set elsewhere (older orders) is carried along untouched.
  const publish = (next) => onEdits(toPageEdits(next, sourcePages, edits?.stamp ?? null))

  const apply = (fn, message, nextSel) => {
    const next = fn(plan)
    if (next === plan) return
    setH(commit(h, next)); publish(next); setNote(message)
    if (nextSel !== undefined) setSel(Math.max(0, Math.min(nextSel, next.length - 1)))
  }
  const doUndo = () => { const u = undo(h); setH(u); publish(u.present); setNote('Undone'); setSel((s) => Math.min(s, u.present.length - 1)) }
  const doRedo = () => { const r = redo(h); setH(r); publish(r.present); setNote('Redone') }
  const reset = () => { const p = identityPlan(sourcePages); setH(commit(h, p)); publish(p); setNote('All changes cleared'); setSel(0) }

  return { plan, cur, setSel, note, apply, undo: doUndo, redo: doRedo, reset, canUndo: h.past.length > 0, canRedo: h.future.length > 0 }
}
