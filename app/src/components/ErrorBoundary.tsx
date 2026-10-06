import { Component, type ErrorInfo, type ReactNode } from 'react'
import { Brand } from './ui'

export class ErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false }

  static getDerivedStateFromError() { return { failed: true } }
  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Flexa rendering failed', { name: error.name, component: info.componentStack })
  }
  render() {
    if (this.state.failed) return <main className="fatal-error">
      <Brand /><h1>Nie udało się wyświetlić Flexa</h1>
      <p>Twoje dane nie zostały nadpisane. Odśwież stronę i sprawdź połączenie.
        Jeśli problem dotyczy demo, możesz usunąć tylko jego lokalny zapis.</p>
      <div className="button-row"><button className="button button-primary" onClick={() => location.reload()}>Odśwież stronę</button>
        <button className="button button-secondary" onClick={() => {
          if (window.confirm('Usunąć wyłącznie lokalne dane demonstracyjne Flexa?')) {
            localStorage.removeItem('flexa:demo:v1')
            location.reload()
          }
        }}>Wyzeruj demo</button></div>
    </main>
    return this.props.children
  }
}
