import { Component, type ReactNode } from 'react'

interface ChartErrorBoundaryProps {
  children: ReactNode
  fallback: ReactNode
}

interface ChartErrorBoundaryState {
  hasError: boolean
}

export class ChartErrorBoundary extends Component<
  ChartErrorBoundaryProps,
  ChartErrorBoundaryState
> {
  state: ChartErrorBoundaryState = {
    hasError: false,
  }

  static getDerivedStateFromError(): ChartErrorBoundaryState {
    return { hasError: true }
  }

  componentDidCatch() {
    // Intentionally empty: the fallback UI avoids blank-screen regressions
    // when a chart library throws during render.
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback
    }
    return this.props.children
  }
}
