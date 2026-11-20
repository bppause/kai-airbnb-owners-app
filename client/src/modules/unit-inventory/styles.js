// Unit inventory — styles for both screens (the owner's panel inside the
// app and the cleaning service's standalone page). Everything is scoped
// under .uinv so it neither depends on nor leaks into the app's global
// CSS; the standalone page has no app shell around it to borrow from.
//
// Sized for a phone first: the cleaning service counts on one, and the
// owner often checks on one. The rules that follow from that:
//   - anything tapped is at least 44px tall;
//   - every text box is 16px, because iOS Safari zooms the page when a
//     smaller one takes focus;
//   - the header, the area being scrolled through and the save bar stay
//     pinned, so a 250-item list never strands you;
//   - below 640px an item folds its note and actions away until needed.
// --uinv-top is where pinned area headers stop (under the panel's header);
// --uinv-bg is the surface they sit on.

export const UINV_CSS = `
.uinv{font-family:'DM Sans',system-ui,-apple-system,'Segoe UI',sans-serif;color:#17313a;font-size:15px;line-height:1.4;-webkit-text-size-adjust:100%;--uinv-bg:#fff;--uinv-top:0px}
.uinv *{box-sizing:border-box}
.uinv button,.uinv select{font-family:inherit;touch-action:manipulation}
.uinv-overlay{position:fixed;inset:0;z-index:1000002;background:rgba(3,10,18,.72);display:flex;align-items:flex-start;justify-content:center;padding:16px;overflow-y:auto;overscroll-behavior:contain;-webkit-overflow-scrolling:touch}
.uinv-panel{background:#fff;border-radius:18px;width:100%;max-width:980px;padding:0 20px 20px;box-shadow:0 22px 70px rgba(20,32,26,.3);position:relative;margin:auto 0;--uinv-top:60px}
.uinv-head{position:sticky;top:0;z-index:6;height:60px;margin:0 -20px 12px;padding:0 10px 0 20px;display:flex;align-items:center;gap:10px;background:#fff;border-bottom:1px solid #e6eeeb;border-radius:18px 18px 0 0}
.uinv-head h1{flex:1;min-width:0;margin:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.uinv-page{min-height:100vh;background:#f7f3e9;padding:14px 12px 120px;--uinv-bg:#f7f3e9}
.uinv-page-inner{max-width:760px;margin:0 auto}
.uinv h1{font-family:'Playfair Display',Georgia,serif;font-size:1.3rem;line-height:1.2;margin:0 0 2px;color:#203f2b}
.uinv h2{font-size:1rem;margin:0;color:#203f2b}
.uinv-sub{color:#235f72;font-size:.86rem;margin:0 0 12px}
.uinv-x{flex:none;border:0;background:#eef3f1;color:#33545d;width:44px;height:44px;border-radius:12px;cursor:pointer;font-size:1.05rem}
.uinv-row{display:flex;gap:8px;align-items:center;flex-wrap:wrap}
.uinv-btn{border:1px solid rgba(47,79,58,.24);background:#fff;color:#17313a;border-radius:12px;padding:9px 14px;font-weight:700;cursor:pointer;min-height:44px;font-size:.9rem}
.uinv-btn:disabled{opacity:.5;cursor:not-allowed}
.uinv-btn-p{background:linear-gradient(135deg,#0b7f4f,#0b7f8c);color:#fff;border-color:transparent}
.uinv-btn-warn{color:#8a5a00;border-color:#e2c27a;background:#fff8e6}
.uinv-btn-danger{color:#9d1f16;border-color:#f0b9b3;background:#fff5f3}
.uinv-btn-sm{padding:6px 12px;min-height:36px;font-size:.82rem}
.uinv-tabs{display:flex;gap:6px;margin:0 0 14px}
.uinv-tab{border:1px solid rgba(47,79,58,.2);background:#fff;border-radius:999px;padding:7px 18px;min-height:40px;font-weight:700;font-size:.9rem;cursor:pointer;color:#17313a}
.uinv-tab-on{background:linear-gradient(135deg,#0b7f4f,#0b7f8c);color:#fff;border-color:transparent}
.uinv-box{border:1px solid rgba(47,79,58,.18);border-radius:14px;padding:12px 14px;background:#f8fbfa;margin-bottom:12px;scroll-margin-top:calc(var(--uinv-top) + 10px)}
.uinv-help{font-size:.8rem;color:#48656d;margin:4px 0 8px}
.uinv-link{flex:1 1 220px;min-width:0;border:1px solid rgba(47,79,58,.24);border-radius:10px;padding:8px 10px;min-height:44px;background:#fff;font-size:16px;color:#17313a;width:100%}
.uinv-msg{border-radius:10px;padding:8px 12px;font-size:.86rem;margin-bottom:10px}
.uinv-msg-err{background:#fff0ee;color:#9d1f16;border:1px solid #f0b9b3}
.uinv-msg-ok{background:#eaf8f0;color:#0b5f3a;border:1px solid #b7e2c8}
.uinv-toast{position:fixed;left:12px;right:12px;bottom:calc(14px + env(safe-area-inset-bottom));z-index:1000004;display:flex;justify-content:center;pointer-events:none}
.uinv-toast-raised{bottom:calc(88px + env(safe-area-inset-bottom))}
.uinv-toast .uinv-msg{pointer-events:auto;margin:0;max-width:520px;width:100%;display:flex;align-items:center;gap:8px;padding:10px 6px 10px 14px;font-size:.92rem;font-weight:600;box-shadow:0 10px 30px rgba(20,32,26,.25)}
.uinv-toast .uinv-msg span{flex:1}
.uinv-toast-x{flex:none;width:40px;height:40px;border:0;background:transparent;color:inherit;font-size:1rem;cursor:pointer;border-radius:10px}
.uinv-listbar{margin:12px 0 0;justify-content:flex-end}
.uinv-group{margin:0}
.uinv-area-h{margin:10px 0 6px;position:sticky;top:var(--uinv-top);z-index:3;background:var(--uinv-bg)}
.uinv-area{display:flex;align-items:center;gap:10px;width:100%;min-height:48px;padding:6px 2px;border:0;border-bottom:2px solid #d9e6e1;border-radius:0;box-shadow:none;background:transparent;color:#203f2b;font-size:1rem;font-weight:700;text-align:left;cursor:pointer}
.uinv-area-caret{flex:none;width:14px}
.uinv-area-text{flex:1;min-width:0;display:flex;flex-direction:column}
.uinv-area-name{overflow-wrap:anywhere}
.uinv-area-other{font-size:.8rem;font-weight:400;color:#5d7a82}
.uinv-area-count{flex:none;min-width:30px;text-align:center;border-radius:999px;padding:2px 8px;background:#eef3f1;color:#33545d;font-size:.8rem;font-weight:700}
.uinv-item{border:1px solid rgba(47,79,58,.14);border-radius:12px;padding:10px 12px;margin-bottom:8px;background:#fff;display:grid;gap:8px}
.uinv-item-miss{border-color:#e39a92;border-left:6px solid #c0392b;background:#fff3f1}
.uinv-item-extra{border-color:#9dbfe6;border-left:6px solid #1c6fc4;background:#f0f6ff}
.uinv-item-miss .uinv-num{border:2px solid #c0392b;color:#9d1f16;background:#fff}
.uinv-item-extra .uinv-num{border:2px solid #1c6fc4;color:#1c4f8a;background:#fff}
.uinv-item-dirty{box-shadow:0 0 0 2px rgba(11,127,140,.35)}
.uinv-name{font-weight:700;overflow-wrap:anywhere}
.uinv-other{font-size:.8rem;color:#5d7a82;overflow-wrap:anywhere}
.uinv-onote{font-size:.8rem;color:#48656d;font-style:italic;overflow-wrap:anywhere}
.uinv-onote-other{font-style:normal;color:#6b8790}
.uinv-meta{font-size:.76rem;color:#6b8790}
.uinv-body{display:flex;gap:10px 14px;align-items:flex-end;flex-wrap:wrap}
.uinv-fields{display:flex;gap:10px;align-items:flex-end}
.uinv-extra{flex:1 1 280px;min-width:0;display:grid;gap:8px}
.uinv-more{display:none}
.uinv-field{display:grid;gap:3px;font-size:.72rem;font-weight:700;color:#33545d;text-transform:uppercase;letter-spacing:.03em}
.uinv-field input,.uinv-field textarea,.uinv-input{border:1px solid rgba(47,79,58,.28);border-radius:10px;padding:8px 10px;min-height:44px;font:inherit;font-size:16px;color:#102f3a;background:#fff;text-transform:none;letter-spacing:0;font-weight:400;width:100%}
.uinv-num{width:68px!important;padding-left:2px!important;padding-right:2px!important;text-align:center;font-weight:700!important;font-size:17px!important}
.uinv-base{min-width:60px;min-height:44px;display:flex;align-items:center;justify-content:center;font-size:17px;font-weight:700;color:#33545d;padding:0 6px;border-radius:10px;background:#eef3f1}
.uinv-step{display:flex;align-items:center;gap:4px}
.uinv-step button{flex:none;width:44px;height:44px;border-radius:10px;border:1px solid rgba(47,79,58,.28);background:#fff;font-size:1.3rem;font-weight:700;line-height:1;cursor:pointer;color:#17313a}
.uinv-step button:active{background:#e6f1ee}
.uinv-grow{flex:1 1 200px;min-width:0}
.uinv-badge{display:inline-block;border-radius:999px;padding:2px 10px;font-size:.74rem;font-weight:700;white-space:nowrap}
.uinv-badge-miss{background:#c0392b;color:#fff}
.uinv-badge-extra{background:#1c6fc4;color:#fff}
.uinv-badge-chg{background:#fff1cc;color:#7a4f00;border:1px solid #e2c27a}
.uinv-badge-on{background:#eaf8f0;color:#0b5f3a;border:1px solid #b7e2c8}
.uinv-badge-off{background:#eef3f1;color:#48656d;border:1px solid #cfdcd8}
.uinv-sum{display:flex;gap:8px 12px;align-items:center;justify-content:space-between;flex-wrap:wrap;border:1px solid #e2c27a;background:#fff8e6;border-radius:12px;padding:10px 12px;margin:10px 0 4px}
.uinv-sum-ok{border-color:#b7e2c8;background:#eaf8f0;color:#0b5f3a;font-weight:700}
.uinv-form{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}
.uinv-form .uinv-full{grid-column:1/-1}
.uinv-bar{position:sticky;bottom:0;z-index:5;background:#fff;border-top:1px solid #d9e6e1;padding:10px 0;margin-top:12px;display:flex;gap:8px;justify-content:flex-end}
.uinv-bar .uinv-btn{min-height:48px;font-size:1rem}
.uinv-page .uinv-bar{position:fixed;left:0;right:0;bottom:0;margin:0;padding:10px 12px calc(10px + env(safe-area-inset-bottom));justify-content:center;box-shadow:0 -8px 24px rgba(20,32,26,.12)}
.uinv-bar .uinv-btn-p{flex:1 1 auto;max-width:520px}
.uinv-hist{border-bottom:1px solid #e6eeeb;padding:8px 0;display:grid;gap:2px;overflow-wrap:anywhere}
.uinv-hist-when{font-size:.76rem;color:#6b8790}
.uinv-hist-check{border:1px solid #b7e2c8;background:#eaf8f0;border-radius:10px;padding:8px 10px;margin:6px 0}
.uinv-last{font-size:.82rem;color:#48656d;margin:8px 0 0}
.uinv-last strong{color:#0b5f3a}
.uinv-done{margin-top:18px;background:#f1f8f4;border-color:#b7e2c8}
.uinv-done .uinv-btn{width:100%;min-height:48px;font-size:1rem}
.uinv-lang{border:1px solid rgba(47,79,58,.24);border-radius:10px;padding:6px 8px;min-height:44px;background:#fff;font:inherit;font-size:16px;font-weight:700}
@media (max-width:640px){
  .uinv-overlay{padding:0;background:#fff}
  .uinv-panel{border-radius:0;box-shadow:none;max-width:none;min-height:100vh;min-height:100dvh;margin:0;padding:0 12px 16px}
  .uinv-head{margin:0 -12px 10px;padding:0 8px 0 12px;border-radius:0}
  .uinv h1{font-size:1.15rem}
  .uinv-form{grid-template-columns:1fr}
  .uinv-btn-sm,.uinv-tab{min-height:44px}
  .uinv-fields{width:100%}
  .uinv-extra{display:none;flex-basis:100%}
  .uinv-item-open .uinv-extra{display:grid}
  .uinv-more{display:inline-flex;align-items:center;justify-content:center;margin-left:auto;min-width:44px;min-height:44px;padding:0 10px;border:1px solid rgba(47,79,58,.24);border-radius:10px;background:#fff;color:#235f72;font-size:.82rem;font-weight:700;cursor:pointer;white-space:nowrap}
  .uinv-sum{flex-direction:column;align-items:stretch}
  .uinv-bar{margin-left:-12px;margin-right:-12px;padding:10px 12px calc(10px + env(safe-area-inset-bottom));box-shadow:0 -8px 24px rgba(20,32,26,.12)}
  .uinv-page .uinv-bar{margin:0}
  .uinv-listbar{justify-content:stretch}
  .uinv-listbar .uinv-btn{flex:1}
}
@media (max-width:359px){
  .uinv-step button{width:40px}
  .uinv-num{width:56px!important}
  .uinv-base{min-width:48px}
}
`;
