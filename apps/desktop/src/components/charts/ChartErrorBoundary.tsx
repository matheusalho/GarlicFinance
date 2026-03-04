import { Component, type ReactNode } from 'react'

interface ChartErrorBoundaryProps {
  children: ReactNode
  fallback: ReactNode
  resetKey?: string
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

  componentDidUpdate(prevProps: ChartErrorBoundaryProps) {
    if (this.state.hasError && prevProps.resetKey !== this.props.resetKey) {
      this.setState({ hasError: false })
    }
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback
    }
    return this.props.children
  }
}
