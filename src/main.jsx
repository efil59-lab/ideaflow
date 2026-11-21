import { StrictMode, Component } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import { APP_VERSION } from './changelog.js'

// A render crash used to leave a blank white screen with nothing to report.
// Show what broke instead (so a screenshot tells us), plus a way back.
class CrashScreen extends Component {
  state = { err: null }
  static getDerivedStateFromError(err) { return { err } }
  componentDidCatch(err, info) { console.error('IdeaFlow crash', err, info?.componentStack) }
  render() {
    const { err } = this.state
    if (!err) return this.props.children
    const home = () => { location.href = '/' }
    return (
      <div dir="rtl" style={{ fontFamily: 'system-ui, sans-serif', padding: '32px 20px', maxWidth: 480, margin: '0 auto', color: '#222', background: '#fff', minHeight: '100vh', boxSizing: 'border-box' }}>
        <h2 style={{ margin: '0 0 10px', fontSize: 20 }}>משהו השתבש בטעינה</h2>
        <p style={{ margin: '0 0 16px', lineHeight: 1.6 }}>הפתקים שלך שמורים ולא נפגעו. צלם את המסך הזה ושלח, ואז חזור למסך הראשי.</p>
        <button onClick={home} style={{ padding: '11px 18px', borderRadius: 10, border: 'none', background: '#6d28d9', color: '#fff', fontSize: 15, fontWeight: 700 }}>חזרה למסך הראשי</button>
        <pre dir="ltr" style={{ marginTop: 22, fontSize: 11.5, whiteSpace: 'pre-wrap', wordBreak: 'break-word', color: '#555', background: '#f4f4f5', padding: 12, borderRadius: 8 }}>
          {`v${APP_VERSION} · ${location.pathname}${location.search}\n${String(err?.message || err)}\n${(err?.stack || '').split('\n').slice(0, 6).join('\n')}`}
        </pre>
      </div>
    )
  }
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <CrashScreen>
      <App />
    </CrashScreen>
  </StrictMode>,
)
