import { Component } from 'react'

/** Shows a readable message (and the real error) instead of a blank screen when a page crashes or a script fails to load. */
export default class ErrorBoundary extends Component {
  state = { error: null }
  static getDerivedStateFromError(error) { return { error } }
  componentDidCatch(error) { console.error('Page crashed:', error) }
  render() {
    if (!this.state.error) return this.props.children
    return (
      <div role="alert" className="grid min-h-dvh place-items-center p-6 text-center text-[var(--text)]">
        <div className="max-w-md rounded-3xl border border-[var(--border)] bg-white p-6 shadow-[var(--shadow)]">
          <h1 className="m-0 text-lg font-bold">Something went wrong</h1>
          <p className="mb-1 mt-2 text-sm text-[var(--muted)]">The page could not be shown. Reloading usually fixes it.</p>
          <p className="mb-4 mt-0 break-words text-xs text-[var(--muted)]">{String(this.state.error?.message ?? this.state.error)}</p>
          <button type="button" onClick={() => window.location.reload()} className="min-h-12 rounded-2xl bg-gradient-to-r from-accent to-accent-2 px-6 font-bold text-white">Reload</button>
        </div>
      </div>
    )
  }
}
