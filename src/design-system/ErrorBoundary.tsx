import { Component, type ErrorInfo, type ReactNode } from 'react'

export class ErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state = { error: null as Error | null }
  static getDerivedStateFromError(error: Error) { return { error } }
  componentDidCatch(error: Error, info: ErrorInfo) { console.error('Unhandled render error:', error, info.componentStack) }

  render() {
    if (!this.state.error) return this.props.children
    return (
      <div className="flex min-h-[100dvh] flex-col items-center justify-center gap-4 bg-canvas px-8 text-center">
        <div className="font-display text-[19px] font-bold text-ink">Something went wrong</div>
        <div className="max-w-[300px] text-[13px] text-muted">{this.state.error.message}</div>
        <button
          onClick={() => { this.setState({ error: null }); window.location.reload() }}
          className="rounded-pill bg-brand px-5 py-2.5 text-[14px] font-semibold text-white"
        >
          Restart app
        </button>
      </div>
    )
  }
}
