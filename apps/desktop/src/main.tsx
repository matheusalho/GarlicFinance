import { createRoot } from 'react-dom/client'
import './index.css'
import './styles/tokens.css'
import './styles/base.css'
import './styles/components.css'
import './styles/utilities.css'
import App from './App.tsx'
import { getGarlicPerfState, nowPerfMs } from './lib/perf'

const perfState = getGarlicPerfState()
if (perfState.entryBootstrapStartedAt === undefined) perfState.entryBootstrapStartedAt = nowPerfMs()

const root = createRoot(document.getElementById('root')!)
if (perfState.reactRootCreatedAt === undefined) perfState.reactRootCreatedAt = nowPerfMs()

root.render(<App />)
if (perfState.reactRenderScheduledAt === undefined) perfState.reactRenderScheduledAt = nowPerfMs()
