import { Component, type ReactNode } from 'react'

interface Props { fallback: ReactNode; children: ReactNode; label?: string }
interface State { error: Error | null }

/** Keeps a crash in one layer (e.g. WebGL) from blacking out the whole game. */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null }
  static getDerivedStateFromError(error: Error): State { return { error } }
  componentDidCatch(error: Error) { console.error(`[runway] ${this.props.label ?? 'boundary'} crashed:`, error) }
  render() { return this.state.error ? this.props.fallback : this.props.children }
}
