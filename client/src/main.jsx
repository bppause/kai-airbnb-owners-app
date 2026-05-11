import React from 'react'
import ReactDOM from 'react-dom/client'

// Path-based vertical routing: /tax/* renders the tax module (its own React tree,
// own i18n, own CSS scope). Everything else stays on the Airbnb owners app.
//
// Both apps and the Airbnb-only `production-ui.css` are loaded via dynamic
// import so the tax landing skips ~3000 lines of Kai-specific layout CSS that
// would otherwise override `.tax-app` styling (header sticky/white, button
// max-width clamps, etc).
const isTaxRoute = window.location.pathname === '/tax' ||
                   window.location.pathname.startsWith('/tax/');

class RootErrorBoundary extends React.Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false, message: '', stack: '' }
  }
  static getDerivedStateFromError(error) {
    return { hasError: true, message: error?.message || String(error), stack: error?.stack || '' }
  }
  componentDidCatch(error, info) {
    const payload = {
      section: 'root',
      message: error?.message || String(error),
      stack: error?.stack || '',
      componentStack: info?.componentStack || '',
      ts: new Date().toISOString()
    }
    console.error('[KAI_ROOT_ERROR]', payload)
    try { localStorage.setItem('kai_last_ui_error', JSON.stringify(payload, null, 2)) } catch (e) {}
    try { fetch('/api/client-log', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(payload) }).catch(()=>{}) } catch (e) {}
  }
  render() {
    if (this.state.hasError) {
      return (
        <div style={{minHeight:'100vh',display:'flex',alignItems:'center',justifyContent:'center',background:'#07141e',color:'#dff0f5',fontFamily:'Arial, sans-serif',padding:24}}>
          <div style={{maxWidth:760,background:'rgba(255,255,255,.08)',border:'1px solid rgba(255,255,255,.18)',borderRadius:18,padding:24}}>
            <h1 style={{marginTop:0}}>⚠️ App could not load / La aplicación no pudo cargar</h1>
            <p>This is a frontend runtime error. The details were saved to browser localStorage as <code>kai_last_ui_error</code> and sent to Render logs.</p>
            <pre style={{whiteSpace:'pre-wrap',background:'rgba(0,0,0,.25)',padding:12,borderRadius:12}}>{this.state.message}\n\n{this.state.stack}</pre>
            <button onClick={()=>location.reload()} style={{background:'#1a9aa5',color:'white',border:0,borderRadius:12,padding:'12px 18px',fontWeight:700}}>Reload / Recargar</button>
          </div>
        </div>
      )
    }
    return this.props.children
  }
}

const root = ReactDOM.createRoot(document.getElementById('root'));

async function boot() {
  if (isTaxRoute) {
    const { default: TaxApp } = await import('./tax/TaxApp.jsx');
    root.render(
      <React.StrictMode><RootErrorBoundary><TaxApp /></RootErrorBoundary></React.StrictMode>
    );
    return;
  }

  // Airbnb owners app path — load global CSS, App, and the v72 enhancer.
  await import('./production-ui.css');
  const [{ default: App }, { installAdminRegistrationAwareness }] = await Promise.all([
    import('./App.jsx'),
    import('./enhancers/adminRegistrationAwareness'),
  ]);
  root.render(
    <React.StrictMode><RootErrorBoundary><App /></RootErrorBoundary></React.StrictMode>
  );
  try {
    installAdminRegistrationAwareness()
  } catch (e) {
    console.warn('[KAI_V72_INIT_ERROR]', e)
  }
}

boot().catch(err => {
  console.error('[KAI_BOOT_ERROR]', err);
  root.render(
    <React.StrictMode>
      <RootErrorBoundary>
        <div />
      </RootErrorBoundary>
    </React.StrictMode>
  );
});
