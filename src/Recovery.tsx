import { Component, useEffect, type ErrorInfo, type ReactNode } from "react"
import { initializeAppearance } from "./appearance"

export function RecoveryPage({ notFound = false, onRetry }: { notFound?: boolean; onRetry?: () => void }) {
  useEffect(() => initializeAppearance(), [])
  const home = import.meta.env.BASE_URL || "/"
  return <main className="recovery-page"><section className="learn-panel recovery-card" aria-labelledby="recovery-title"><span className="recovery-mark" aria-hidden="true">{notFound ? "?" : "!"}</span><p className="eyebrow">{notFound ? "A SMALL DETOUR" : "LET’S TAKE A BREATH"}</p><h1 id="recovery-title">{notFound ? "Page not found" : "Something went wrong"}</h1><p>{notFound ? "We couldn’t find that page. Let’s get you back to learning." : "Manabu couldn’t display this page correctly. Your saved learning data has not been cleared."}</p><div><a className="wide-primary" href={home}>{notFound ? "Go Home" : "Return Home"}</a>{onRetry && <button className="secondary-button" onClick={onRetry}>Try Again</button>}</div></section></main>
}

export default class ApplicationBoundary extends Component<{ children: ReactNode; resetKey?: string; captureRuntime?: boolean }, { failed: boolean }> {
  state = { failed: false }
  private reloadOnRetry = false
  private handleRuntimeError = (event: ErrorEvent) => {
    if (!event.error) return
    console.error("Manabu runtime failure", event.error)
    this.setState({ failed: true })
  }
  private handleRejection = (event: PromiseRejectionEvent) => {
    console.error("Manabu asynchronous failure", event.reason)
    this.setState({ failed: true })
  }
  componentDidMount() {
    if (this.props.captureRuntime === false) return
    window.addEventListener("error", this.handleRuntimeError)
    window.addEventListener("unhandledrejection", this.handleRejection)
  }
  componentWillUnmount() {
    window.removeEventListener("error", this.handleRuntimeError)
    window.removeEventListener("unhandledrejection", this.handleRejection)
  }
  componentDidUpdate(previous: Readonly<{ children: ReactNode; resetKey?: string; captureRuntime?: boolean }>) {
    if (this.state.failed && previous.resetKey !== this.props.resetKey) {
      this.reloadOnRetry = false
      this.setState({ failed: false })
    }
  }
  static getDerivedStateFromError() { return { failed: true } }
  componentDidCatch(error: Error, info: ErrorInfo) {
    this.reloadOnRetry = /dynamically imported|module script|loading chunk/i.test(error.message)
    console.error("Manabu display failure", error, info.componentStack)
  }
  render() { return this.state.failed ? <RecoveryPage onRetry={() => this.reloadOnRetry ? window.location.reload() : this.setState({ failed: false })} /> : this.props.children }
}
export function ApplicationLoading() {
  return <main className="recovery-page" role="status"><div className="recovery-card"><span className="loading-dot" /><h1>Manabu</h1><p>Preparing your learning space…</p></div></main>
}
