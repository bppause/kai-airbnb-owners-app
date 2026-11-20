// Unit inventory — styles for both screens (the owner's panel inside the
// app and the cleaning service's standalone page). Everything is scoped
// under .uinv so it neither depends on nor leaks into the app's global
// CSS; the standalone page has no app shell around it to borrow from.
// Sized for a phone first: the cleaning service counts on one.

export const UINV_CSS = `
.uinv{font-family:'DM Sans',system-ui,-apple-system,'Segoe UI',sans-serif;color:#17313a;font-size:15px;line-height:1.4}
.uinv *{box-sizing:border-box}
.uinv-overlay{position:fixed;inset:0;z-index:1000002;background:rgba(3,10,18,.72);display:flex;align-items:flex-start;justify-content:center;padding:16px;overflow-y:auto}
.uinv-panel{background:#fff;border-radius:18px;width:100%;max-width:980px;padding:20px;box-shadow:0 22px 70px rgba(20,32,26,.3);position:relative;margin:auto 0}
.uinv-page{min-height:100vh;background:#f7f3e9;padding:14px 12px 110px}
.uinv-page-inner{max-width:760px;margin:0 auto}
.uinv h1{font-family:'Playfair Display',Georgia,serif;font-size:1.35rem;margin:0 0 2px;color:#203f2b}
.uinv h2{font-size:1rem;margin:0;color:#203f2b}
.uinv-sub{color:#235f72;font-size:.86rem;margin:0 0 12px}
.uinv-x{position:absolute;top:12px;right:12px;border:0;background:#eef3f1;color:#33545d;width:36px;height:36px;border-radius:10px;cursor:pointer;font-size:1rem}
.uinv-row{display:flex;gap:8px;align-items:center;flex-wrap:wrap}
.uinv-btn{border:1px solid rgba(47,79,58,.24);background:#fff;color:#17313a;border-radius:12px;padding:9px 14px;font-weight:700;cursor:pointer;min-height:42px;font-size:.9rem}
.uinv-btn:disabled{opacity:.5;cursor:not-allowed}
.uinv-btn-p{background:linear-gradient(135deg,#0b7f4f,#0b7f8c);color:#fff;border-color:transparent}
.uinv-btn-warn{color:#8a5a00;border-color:#e2c27a;background:#fff8e6}
.uinv-btn-danger{color:#9d1f16;border-color:#f0b9b3;background:#fff5f3}
.uinv-btn-sm{padding:6px 10px;min-height:34px;font-size:.82rem}
.uinv-tabs{display:flex;gap:6px;margin:10px 0 14px}
.uinv-tab{border:1px solid rgba(47,79,58,.2);background:#fff;border-radius:999px;padding:7px 16px;font-weight:700;cursor:pointer;color:#17313a}
.uinv-tab-on{background:linear-gradient(135deg,#0b7f4f,#0b7f8c);color:#fff;border-color:transparent}
.uinv-box{border:1px solid rgba(47,79,58,.18);border-radius:14px;padding:12px 14px;background:#f8fbfa;margin-bottom:12px}
.uinv-help{font-size:.8rem;color:#48656d;margin:4px 0 8px}
.uinv-link{flex:1 1 220px;min-width:0;border:1px solid rgba(47,79,58,.24);border-radius:10px;padding:8px 10px;background:#fff;font-size:.8rem;color:#17313a}
.uinv-msg{border-radius:10px;padding:8px 12px;font-size:.86rem;margin-bottom:10px}
.uinv-msg-err{background:#fff0ee;color:#9d1f16;border:1px solid #f0b9b3}
.uinv-msg-ok{background:#eaf8f0;color:#0b5f3a;border:1px solid #b7e2c8}
.uinv-area{margin:16px 0 6px;display:flex;align-items:baseline;gap:8px;border-bottom:2px solid #d9e6e1;padding-bottom:4px;cursor:pointer;user-select:none}
.uinv-area small{color:#5d7a82;font-weight:400}
.uinv-item{border:1px solid rgba(47,79,58,.14);border-radius:12px;padding:10px 12px;margin-bottom:8px;background:#fff;display:grid;gap:8px}
.uinv-item-miss{border-color:#e39a92;border-left:6px solid #c0392b;background:#fff3f1}
.uinv-item-extra{border-color:#9dbfe6;border-left:6px solid #1c6fc4;background:#f0f6ff}
.uinv-item-miss .uinv-num{border:2px solid #c0392b;color:#9d1f16;background:#fff}
.uinv-item-extra .uinv-num{border:2px solid #1c6fc4;color:#1c4f8a;background:#fff}
.uinv-item-dirty{box-shadow:0 0 0 2px rgba(11,127,140,.35)}
.uinv-name{font-weight:700}
.uinv-other{font-size:.8rem;color:#5d7a82}
.uinv-area-other{font-size:.8rem;font-weight:400;color:#5d7a82}
.uinv-onote-other{font-style:normal;color:#6b8790}
.uinv-onote{font-size:.8rem;color:#48656d;font-style:italic}
.uinv-meta{font-size:.76rem;color:#6b8790}
.uinv-fields{display:flex;gap:10px;align-items:flex-end;flex-wrap:wrap}
.uinv-field{display:grid;gap:3px;font-size:.72rem;font-weight:700;color:#33545d;text-transform:uppercase;letter-spacing:.03em}
.uinv-field input,.uinv-field textarea,.uinv-input{border:1px solid rgba(47,79,58,.28);border-radius:10px;padding:8px 10px;font:inherit;font-size:.95rem;color:#102f3a;background:#fff;text-transform:none;letter-spacing:0;font-weight:400;width:100%}
.uinv-num{width:84px!important;text-align:center;font-weight:700!important;font-size:1.05rem!important}
.uinv-base{min-width:70px;text-align:center;font-size:1.05rem;font-weight:700;color:#33545d;padding:8px 6px;border-radius:10px;background:#eef3f1}
.uinv-step{display:flex;align-items:center;gap:4px}
.uinv-step button{width:42px;height:42px;border-radius:10px;border:1px solid rgba(47,79,58,.28);background:#fff;font-size:1.2rem;font-weight:700;cursor:pointer;color:#17313a}
.uinv-grow{flex:1 1 200px;min-width:0}
.uinv-badge{display:inline-block;border-radius:999px;padding:2px 10px;font-size:.74rem;font-weight:700}
.uinv-badge{white-space:nowrap}
.uinv-badge-miss{background:#c0392b;color:#fff}
.uinv-badge-extra{background:#1c6fc4;color:#fff}
.uinv-badge-chg{background:#fff1cc;color:#7a4f00;border:1px solid #e2c27a}
.uinv-sum{display:flex;gap:8px 12px;align-items:center;justify-content:space-between;flex-wrap:wrap;border:1px solid #e2c27a;background:#fff8e6;border-radius:12px;padding:10px 12px;margin:10px 0 4px}
.uinv-sum-ok{border-color:#b7e2c8;background:#eaf8f0;color:#0b5f3a;font-weight:700}
.uinv-form{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}
.uinv-form .uinv-full{grid-column:1/-1}
.uinv-bar{position:sticky;bottom:0;background:rgba(255,255,255,.96);border-top:1px solid #d9e6e1;padding:10px 0 2px;margin-top:12px;display:flex;gap:8px;justify-content:flex-end;flex-wrap:wrap}
.uinv-page .uinv-bar{position:fixed;left:0;right:0;bottom:0;padding:10px 12px calc(10px + env(safe-area-inset-bottom));justify-content:center;box-shadow:0 -8px 24px rgba(20,32,26,.12)}
.uinv-page .uinv-bar .uinv-btn{flex:1 1 auto;max-width:520px}
.uinv-hist{border-bottom:1px solid #e6eeeb;padding:8px 0;display:grid;gap:2px}
.uinv-hist-when{font-size:.76rem;color:#6b8790}
.uinv-lang{border:1px solid rgba(47,79,58,.24);border-radius:10px;padding:6px 8px;background:#fff;font:inherit;font-weight:700}
@media (max-width:640px){.uinv-form{grid-template-columns:1fr}.uinv-panel{padding:16px 12px;border-radius:14px}.uinv-overlay{padding:8px}}
`;
