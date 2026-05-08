// CSS — single big string of app-wide stylesheet rules. Both App.jsx and
// the auth gates inline this via `<style>{CSS}</style>`; auth gates need
// it because they render before App's main shell does.
//
// Lifted byte-identical from App.jsx in stage F23.
//
// See docs/PLATFORM_ARCHITECTURE.md §11 frontend stage F23.

export const CSS = `
.workflow-card{background:rgba(255,255,255,.74);border:1px solid rgba(47,79,58,.12);border-radius:18px;padding:12px 16px;margin:8px 0 14px;box-shadow:0 8px 22px rgba(0,0,0,.045);overflow:visible;position:relative;z-index:2}
.workflow-card-compact{max-width:100%;}
.wf-head{display:flex;align-items:flex-start;justify-content:space-between;gap:10px;margin-bottom:8px}.wf-title{font-weight:800;color:#2F4F3A;margin-bottom:2px;letter-spacing:.04em;text-transform:uppercase;font-size:.78rem}.wf-subtitle{font-size:.74rem;color:#496674}.wf-steps{display:flex;align-items:center;gap:8px;flex-wrap:nowrap}.wf-step{flex:1;min-width:0;background:rgba(246,241,231,.65);border-radius:14px;padding:8px 10px}.wf-step-click{position:relative;display:flex;align-items:center;gap:10px;border:1px solid rgba(47,79,58,.14);cursor:pointer;text-align:left;transition:transform .16s ease,box-shadow .16s ease,border-color .16s ease,background .16s ease;overflow:visible}.wf-step-click:hover{background:#fff;transform:translateY(-1px);box-shadow:0 12px 28px rgba(32,46,38,.12);border-color:#19a66a}.wf-active{border-color:#0f9d63!important;background:rgba(15,157,99,.08)!important;box-shadow:inset 0 -3px 0 rgba(15,157,99,.45)}.wf-icon{width:36px;height:36px;border-radius:50%;display:flex!important;align-items:center;justify-content:center;flex:0 0 36px;font-weight:900}.wf-open{background:rgba(15,157,99,.14);color:#0f9d63}.wf-verified{background:rgba(23,63,77,.10);color:#173f4d}.wf-resolved{background:rgba(128,84,214,.14);color:#6b40c9;font-size:1.15rem}.wf-copy{display:block;min-width:0}.wf-step strong{display:block;color:#17313a;margin-bottom:1px;font-size:.9rem;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.wf-step small{display:block;color:#4d6b76;font-size:.72rem;line-height:1.2;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.wf-arrow{display:flex;align-items:center;justify-content:center;color:#2aa8ad;font-size:1.15rem;font-weight:800;flex:0 0 22px}.wf-arrow-line{opacity:.85}.wf-tip{display:none!important;position:absolute;left:50%;bottom:calc(100% + 10px);transform:translateX(-50%);z-index:999999;background:#263238;color:#fff!important;border-radius:8px;padding:8px 10px;font-size:.72rem;line-height:1.25;min-width:210px;max-width:260px;box-shadow:0 14px 34px rgba(0,0,0,.24);white-space:normal!important;overflow:visible!important;text-overflow:clip!important}.wf-tip:after{content:"";position:absolute;left:50%;top:100%;transform:translateX(-50%);border:7px solid transparent;border-top-color:#263238}.wf-step-click:hover .wf-tip,.wf-step-click:focus .wf-tip{display:block!important}.filter-group{margin:10px 0}.filter-label{font-weight:800;color:#2F4F3A;margin:0 0 6px 2px;font-size:.82rem;text-transform:uppercase;letter-spacing:.05em}
@media(max-width:760px){.wf-steps{flex-direction:column;align-items:stretch}.wf-arrow{display:none}.wf-step{min-width:100%}.wf-step strong,.wf-step small{white-space:normal}.wf-tip{left:12px;right:12px;transform:none;min-width:0}.wf-tip:after{left:24px}}
.divider{width:1px;background:rgba(255,255,255,.07);margin:0 3px}
.irow{background:rgba(255,255,255,.03);border:1px solid rgba(255,255,255,.06);border-radius:11px;padding:14px 18px;margin-bottom:10px;display:flex;gap:14px;align-items:flex-start;position:relative;overflow:hidden;transition:background .18s}.irow::before{content:'';position:absolute;left:0;top:0;bottom:0;width:3px;background:#d4634a}.irow-res::before{background:#2e7d32}.irow-naughty::before{background:#b71c1c}.irow:hover{background:rgba(255,255,255,.05)}.ir-l{min-width:150px;flex-shrink:0}.ir-apt{font-size:.72rem;font-weight:800;color:var(--kai-olive);text-transform:uppercase;letter-spacing:.07em;margin-bottom:3px;text-shadow:0 1px 2px rgba(0,0,0,.10)}.ir-guest{font-size:.88rem;font-weight:500;color:#dff0f5}.ir-loc{font-size:.72rem;color:#5a8090;margin-top:3px}.ir-date{font-size:.7rem;color:#2a4a5a;margin-top:3px}.ir-rep{font-size:.68rem;color:#1a3a4a;margin-top:3px;font-style:italic}.ir-c{flex:1}.ir-tags{display:flex;flex-wrap:wrap;gap:5px;margin-bottom:7px}.ir-type,.ir-cat,.ir-status{display:inline-flex;align-items:center;gap:3px;padding:3px 8px;border-radius:20px;font-size:.7rem;font-weight:600}.is-open{background:rgba(210,90,70,.2);color:#f08070}.is-verified{background:rgba(46,125,50,.2);color:#69c47a}.is-resolved,.is-res{background:rgba(42,154,170,.18);color:#1d7f8d}.ir-desc{font-size:.8rem;color:#3a6070;line-height:1.5}.ir-acts{display:flex;flex-direction:column;gap:5px;flex-shrink:0}.section-label{font-size:.72rem;text-transform:uppercase;letter-spacing:.1em;color:#2a4a5a;font-weight:600;margin-bottom:14px}
.cat-stats{display:grid;grid-template-columns:repeat(4,1fr);gap:13px;margin-bottom:26px}.catcard{border-radius:13px;padding:16px 18px;display:flex;flex-direction:column;gap:5px;background:rgba(255,255,255,.03);border:1px solid rgba(255,255,255,.05)}.ngcard{background:rgba(180,28,28,.07);border:1px solid rgba(180,28,28,.18);border-radius:11px;padding:14px 18px;display:flex;align-items:center;justify-content:space-between;gap:12px}.ngcard-l{display:flex;align-items:center;gap:14px}.ng-name{font-size:.95rem;font-weight:600;color:#ff6b6b}.ng-loc{font-size:.74rem;color:#5a8090;margin-top:3px}.ngcard-r{text-align:right}.ng-cnt{font-size:.82rem;font-weight:600;color:#f08070}.ng-apts{font-size:.7rem;color:#2a4a5a;margin-top:3px}
.overlay{position:fixed;inset:0;background:rgba(3,10,18,.82);backdrop-filter:blur(6px);z-index:200;display:flex;align-items:center;justify-content:center;padding:20px}.modal{background:linear-gradient(180deg,rgba(255,255,255,.96),rgba(248,244,235,.96));border:1px solid rgba(90,105,80,.18);box-shadow:0 22px 70px rgba(20,32,26,.22);border-radius:18px;padding:28px;width:100%;max-width:440px;position:relative;animation:mIn .25s ease;max-height:90vh;overflow-y:auto}.modal-w{max-width:560px}@keyframes mIn{from{opacity:0;transform:scale(.95) translateY(8px)}to{opacity:1;transform:scale(1) translateY(0)}}.modal-title{font-family:'Playfair Display',serif;font-size:1.2rem;color:#314433;margin-bottom:4px}.modal-sub{font-size:.76rem;color:#2a5a6a;margin-bottom:20px}.btn-x{position:absolute;top:14px;right:14px;background:rgba(255,255,255,.06);border:none;color:#5a8090;width:28px;height:28px;border-radius:7px;cursor:pointer;font-size:.85rem}.btn-x:hover{background:rgba(255,255,255,.14);color:white}.mact{display:flex;gap:9px;justify-content:flex-end;margin-top:20px;padding-top:16px;border-top:1px solid rgba(255,255,255,.06)}
.fg2{display:grid;grid-template-columns:1fr 1fr;gap:12px}.fg{display:flex;flex-direction:column;gap:5px}.fg.full{grid-column:1/-1}.fg label{font-size:.69rem;font-weight:500;color:#2a5a6a;text-transform:uppercase;letter-spacing:.06em}.fg input,.fg select,.fg textarea{background:rgba(255,255,255,.78);border:1px solid rgba(90,105,80,.22);color:#17313a;padding:8px 12px;border-radius:8px;font-size:.85rem;outline:none;transition:border .2s}.fg input:focus,.fg select:focus,.fg textarea:focus{border-color:var(--kai-aqua);background:rgba(94,215,198,.07)}.fg input.field-error,.fg select.field-error,.fg textarea.field-error{border-color:#ff6b6b;background:rgba(255,107,107,.10);box-shadow:0 0 0 2px rgba(255,107,107,.12)}.err-msg{font-size:.68rem;color:#ff8a80;font-weight:600}.help-msg{font-size:.66rem;color:#5a8a8f;margin-top:1px}.form-alert{font-size:.78rem;color:#1a4470;background:rgba(21,101,192,.06);border:1px solid rgba(21,101,192,.18);border-left:3px solid #1565c0;padding:9px 13px;border-radius:8px;margin-bottom:15px;line-height:1.45}.locked-field{opacity:.72;cursor:not-allowed;color:#496674!important;background:rgba(47,79,58,.05)!important;border-color:rgba(47,79,58,.15)!important}.fg select option{background:#fff;color:#17313a}.fg textarea{resize:vertical}.csel{display:flex;flex-wrap:wrap;gap:7px}.copt{padding:6px 13px;border-radius:20px;border:1px solid rgba(255,255,255,.09);background:rgba(255,255,255,.04);color:#3a6070;font-size:.75rem;cursor:pointer;transition:all .18s}.copt:hover{border-color:rgba(255,255,255,.2);color:#b0ccd8}.copt-on{font-weight:600}
.uavatar-img{width:32px;height:32px;border-radius:50%;object-fit:cover;flex-shrink:0}
.gu-btn{display:flex;align-items:center;gap:12px;padding:12px 14px;border-radius:11px;border:1px solid rgba(255,255,255,.08);background:rgba(255,255,255,.03);cursor:pointer;transition:all .18s;text-align:left;width:100%}.gu-btn:hover{background:rgba(255,255,255,.08);border-color:#1a8fa0}.gu-av{width:38px;height:38px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-weight:700;color:white;font-size:.95rem;flex-shrink:0}.gu-name{font-size:.88rem;font-weight:500;color:#dff0f5}.gu-email{font-size:.7rem;color:#2a5a6a;margin-top:2px}
.empty{text-align:center;padding:60px 28px;background:rgba(255,255,255,.02);border:1px solid rgba(255,255,255,.05);border-radius:14px}
.notice-list{display:flex;flex-direction:column;gap:12px}.notice-card{background:rgba(255,255,255,.86);border:1px solid rgba(90,105,80,.16);border-radius:13px;padding:15px 18px;display:flex;gap:12px;justify-content:space-between;align-items:flex-start;box-shadow:0 10px 28px rgba(62,75,55,.08)}.notice-new{border-left:4px solid #d9b45a}.notice-read{opacity:.72}.notice-title{font-family:'Playfair Display',serif;font-size:1rem;color:#2F4F3A;font-weight:700}.notice-msg{font-size:.84rem;color:#17313a;margin-top:5px}.notice-meta{font-size:.7rem;color:#5a8090;margin-top:6px}.notice-inc{font-size:.78rem;color:#3a6070;margin-top:9px;background:rgba(217,180,90,.10);border-radius:8px;padding:8px 10px}
.toast{position:fixed;bottom:24px;right:24px;background:#07141e;border:1px solid rgba(26,143,160,.35);color:#dff0f5;padding:12px 18px;border-radius:11px;font-size:.83rem;box-shadow:0 8px 28px rgba(0,0,0,.4);z-index:300;animation:tIn .3s ease}.toast-err{background:#150808;border-color:rgba(180,28,28,.4);color:#ff6b6b}@keyframes tIn{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:translateY(0)}}
.gate-shell{min-height:100vh;display:flex;align-items:center;justify-content:center;padding:28px}.gate-card{width:100%;max-width:520px;background:linear-gradient(180deg,rgba(255,255,255,.94),rgba(248,244,235,.94));border:1px solid rgba(90,105,80,.18);box-shadow:0 22px 70px rgba(20,32,26,.22);border-radius:20px;padding:30px;text-align:center}.gate-wide{max-width:760px;text-align:left}.gate-logo{margin:0 auto 16px}.gate-btn{margin-top:18px}.gate-top{display:flex;justify-content:space-between;align-items:center;margin-bottom:12px}.status-box{border-radius:13px;padding:18px;margin-top:18px;border:1px solid rgba(90,105,80,.18);background:rgba(255,255,255,.62)}.status-box h3{margin:0 0 8px;color:#2F4F3A}.status-box p{margin:6px 0;color:#17313a}.status-box.pending{border-left:4px solid #d9b45a}.status-box.declined{border-left:4px solid #d4634a}.reg-listing-box{border:1px solid rgba(90,105,80,.14);background:rgba(255,255,255,.60);border-radius:14px;padding:16px;margin:14px 0}.reg-card{align-items:stretch}.reg-card .ir-acts{min-width:100px}.reg-detail-card{gap:18px}.listing-detail-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(250px,1fr));gap:12px;margin-top:12px}.listing-detail-card{background:rgba(255,255,255,.72);border:1px solid rgba(90,105,80,.14);border-radius:14px;padding:12px}.ld-title{font-weight:900;color:#2F4F3A;margin-bottom:8px}.ld-row{font-size:13px;color:#17313a;margin:4px 0;line-height:1.35}.ld-row strong{color:#2F4F3A}

.welcome-card{max-width:920px;text-align:left;padding:34px}.welcome-brand{display:flex;align-items:center;gap:18px;margin-bottom:18px}.welcome-logo{width:92px;height:92px;object-fit:contain;border-radius:18px;background:rgba(255,255,255,.72);box-shadow:0 12px 28px rgba(47,79,58,.15);padding:8px}.welcome-logo.small{width:72px;height:72px}.welcome-hero{background:linear-gradient(135deg,rgba(94,215,198,.16),rgba(217,180,90,.14));border:1px solid rgba(90,105,80,.16);border-radius:16px;padding:16px 18px;margin-bottom:18px}.welcome-hero p{margin:0;color:#17313a;line-height:1.55;font-size:.98rem}.mission-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:13px;margin:18px 0}.mission-grid-compact{grid-template-columns:repeat(2,1fr)}.mission-card{background:rgba(255,255,255,.70);border:1px solid rgba(90,105,80,.15);border-radius:14px;padding:15px;display:flex;gap:11px;align-items:flex-start;box-shadow:0 8px 20px rgba(62,75,55,.06)}.mission-icon{font-size:1.45rem;line-height:1}.mission-card h3{font-size:.9rem;color:#2F4F3A;margin:0 0 5px;font-weight:800}.mission-card p{font-size:.76rem;color:#3a6070;line-height:1.45;margin:0}.login-rules,.first-access-box{background:rgba(255,255,255,.66);border:1px solid rgba(90,105,80,.14);border-radius:14px;padding:16px 18px;margin-top:16px}.login-rules h3{margin:0 0 10px;color:#2F4F3A;font-size:1rem}.login-rules ul,.rules-list{margin:0;padding-left:20px;color:#17313a}.login-rules li,.rules-list li{margin:7px 0;line-height:1.45;font-size:.86rem}.first-access-box{border-left:4px solid #d9b45a;color:#17313a;line-height:1.5}.secure-copy{text-align:center;color:#2a5a6a;font-size:.86rem;margin:20px 0 0}.google-switch-help{margin:14px 0 12px;padding:12px 14px;border-radius:14px;background:rgba(255,255,255,.72);border:1px solid rgba(42,90,106,.16);color:#17313a;font-size:.78rem;line-height:1.45}.google-switch-help span{color:#2a5a6a}.tip{display:inline-flex;align-items:center;justify-content:center;margin-left:5px;width:18px;height:18px;border-radius:50%;background:#e8f6f4;color:#0b7f8c;font-size:.72rem;font-weight:900;cursor:help}.role-guide{margin:12px 28px 0;padding:12px 16px;border-radius:18px;background:rgba(255,255,255,.82);border:1px solid rgba(42,90,106,.14);box-shadow:0 10px 28px rgba(20,40,45,.08);display:flex;align-items:center;gap:14px;justify-content:space-between;flex-wrap:wrap}.role-guide strong{display:block;color:#2F4F3A}.role-guide span{font-size:.78rem;color:#2a5a6a}.role-actions{display:flex;gap:8px;align-items:center;flex-wrap:wrap}.role-chip{border:1px solid rgba(11,127,140,.2);background:#eefbf9;color:#0b7f8c;border-radius:999px;padding:7px 10px;font-weight:800;cursor:pointer}.role-metrics{display:flex;gap:8px}.role-metrics span{background:#f6f1e7;border-radius:999px;padding:6px 9px;color:#17313a;font-weight:800}.inline-brand{align-items:flex-start}.mission-main h2{font-family:'Playfair Display',serif;color:#2F4F3A;margin:0 0 8px}.mission-main p{color:#17313a;line-height:1.55;margin:0}.mission-two{margin-top:18px}
.analytics-grid{display:grid;grid-template-columns:repeat(2,1fr);gap:16px}.bar-list{display:flex;flex-direction:column;gap:10px;margin-top:14px}.bar-row{display:grid;grid-template-columns:110px 1fr 34px;gap:10px;align-items:center;font-size:.78rem}.bar-label{white-space:nowrap;overflow:hidden;text-overflow:ellipsis;color:#314433}.bar-track{height:10px;background:rgba(11,127,140,.10);border-radius:999px;overflow:hidden}.bar-track span{display:block;height:100%;background:linear-gradient(90deg,var(--kai-ocean),var(--kai-aqua));border-radius:999px}.bar-count{text-align:right;font-weight:700;color:#2F4F3A}.table-wrap{overflow:auto;margin-top:12px}.admin-table{width:100%;border-collapse:collapse;font-size:.78rem}.admin-table th{text-align:left;background:rgba(11,127,140,.10);color:#314433;padding:10px;border-bottom:1px solid rgba(90,105,80,.15);white-space:nowrap}.admin-table td{padding:10px;border-bottom:1px solid rgba(90,105,80,.12);vertical-align:top}.admin-table small{color:#607063}.session-actions{display:none}.session-email{font-size:.72rem;color:#314433;max-width:210px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.codebox{background:#f6f1e7;border:1px solid rgba(90,105,80,.18);border-radius:10px;padding:12px;color:#17313a;overflow:auto}.admin-table small{color:#607063}

/* v77 contact card: React-controlled, position:fixed — escapes overflow containers */
.contact-hover-wrap{display:inline-flex;align-items:center;max-width:100%;vertical-align:middle}
.contact-name-btn{border:0;background:transparent;color:inherit;font:inherit;font-weight:inherit;padding:0;cursor:pointer;text-decoration:underline;text-decoration-style:dotted;text-underline-offset:3px}
.contact-card{min-width:280px;max-width:296px;background:rgba(255,255,255,.99);border:1px solid rgba(90,105,80,.22);border-radius:14px;box-shadow:0 18px 50px rgba(20,32,26,.26);padding:12px 14px;color:#17313a;font-family:'DM Sans',sans-serif;font-size:.78rem;line-height:1.4}
.contact-line{display:flex;align-items:center;gap:6px;flex-wrap:wrap;word-break:break-word}
.contact-line-val{flex:1;min-width:0;overflow-wrap:anywhere}
.contact-action-link,.contact-line button{border:1px solid rgba(11,127,140,.22);background:rgba(94,215,198,.14);color:#0b7f8c;border-radius:8px;padding:3px 8px;font-size:.68rem;text-decoration:none;cursor:pointer;white-space:nowrap;line-height:1.6}
.contact-action-link:hover,.contact-line button:hover{background:rgba(11,127,140,.18)}
.modal-sub{word-break:break-word}
@media(max-width:600px){.contact-card{min-width:calc(100vw - 24px);max-width:calc(100vw - 24px)}}

@media(max-width:1000px){.analytics-grid{grid-template-columns:1fr}.mission-grid{grid-template-columns:repeat(2,1fr)}.stats6{grid-template-columns:repeat(3,1fr)}.two-col{grid-template-columns:1fr}.cat-stats{grid-template-columns:repeat(2,1fr)}.nav{display:none}.mob-nav{display:flex}.compact-sync{display:none}.logo-title,.logo-sub{display:none}.hdr-inner{height:56px}.hdr-right{gap:6px}}
/* v36 header/menu mobile hardening */
.nav-dd-menu,.profile-menu{max-height:min(72vh,520px);overflow:auto;-webkit-overflow-scrolling:touch}.nav-dd-menu.menu-open,.profile-menu.menu-open{display:block!important}@media(max-width:1000px){.hdr-inner{height:auto;min-height:56px;align-items:center}.hdr-right{margin-left:auto}.nav-dd-menu{position:fixed;left:12px;right:12px;top:62px;min-width:auto}.profile-menu{position:fixed;left:12px;right:12px;top:62px;min-width:auto}.mob-nav{display:none!important}.nav{display:flex!important;justify-content:flex-start;gap:2px;overflow:visible}.nav .nb:nth-of-type(n+4){display:none}.nav-dd{display:block}.nb{font-size:.72rem;padding:6px 8px}.lang-switch{max-width:112px}.community-switch{max-width:130px}.icon-btn{width:32px;height:32px}.profile-head strong,.profile-head span,.profile-head small{max-width:none}}@media(max-width:600px){.hdr-inner{padding:7px 10px;gap:6px}.logo-mark{width:34px;height:34px}.nav .nb:nth-of-type(n+3){display:none}.nav-dd-menu,.profile-menu{top:56px}.main{padding-top:14px}.fg2{grid-template-columns:1fr}.card{padding:18px}.ptitle{font-size:1.55rem}}
@media(max-width:600px){.welcome-card{padding:24px}.welcome-brand{flex-direction:column;text-align:center}.mission-grid,.mission-grid-compact{grid-template-columns:1fr}.ac-num{font-size:1.45rem;padding:4px 10px}.ar-num{font-size:.95rem;width:66px}.stats6,.owner-stats{grid-template-columns:repeat(2,1fr)}.fg2{grid-template-columns:1fr}.ph{flex-direction:column}.main{padding:18px 14px 56px}.hdr-inner{padding:0 14px}.sync-pill{display:none}}


/* v53 readability: stronger glass panels and darker text over background image */
.app-shell{background:linear-gradient(180deg,rgba(255,255,255,.84),rgba(245,239,225,.90)),url('/morros-kai.png') center top/cover fixed;color:#102f3a;}
.card,.workflow-card,.acard,.notice-card,.gate-card,.modal,.catcard,.ngcard,.reg-listing-box,.listing-detail-card,.prof-section{background:rgba(255,255,255,.94)!important;border-color:rgba(47,79,58,.22)!important;box-shadow:0 14px 38px rgba(32,46,38,.14)!important;}
.irow{background:rgba(255,255,255,.88)!important;border-color:rgba(47,79,58,.18)!important;box-shadow:0 8px 22px rgba(32,46,38,.08);}
.irow:hover{background:rgba(255,255,255,.96)!important;}
.ptitle,.card-title,.wf-title,.filter-label,.ir-apt,.ar-num,.ac-num,.modal-title{color:#203f2b!important;text-shadow:none!important;}
.psub,.ir-desc,.ir-date,.ir-rep,.ar-owner,.ac-owner,.ac-tower,.ld-row,.empty,.fg label,.wf-step span{color:#173f4d!important;}
.ir-guest{color:#173f4d!important;font-weight:700;}
.ir-loc,.ng-loc,.np-loc,.help-msg,.modal-sub{color:#235f72!important;}
.fchip{background:rgba(255,255,255,.78)!important;border-color:rgba(47,79,58,.18)!important;color:#174b5a!important;font-weight:700;}
.fchip-on{background:#1193a5!important;color:white!important;border-color:#1193a5!important;}
.fchip-warn.fchip-on{background:#d9700e!important;border-color:#d9700e!important;}
.fchip-resolve.fchip-on{background:#0b7f4f!important;border-color:#0b7f4f!important;}
.ir-type,.ir-cat,.ir-status,.chip{font-weight:800!important;border:1px solid rgba(0,0,0,.06);}
.is-open{background:#ffe2d7!important;color:#b83215!important;}
.is-pending-res{background:#fff3e0!important;color:#e07b2a!important;}
.is-verified{background:#dff5e4!important;color:#1f7a35!important;}
.is-resolved,.is-res{background:#e8f5e9!important;color:#2e7d32!important;}
.bs-resolve{background:#dff5e4!important;color:#1f7a35!important;font-weight:800;}
.bs-del{background:#f7d6d2!important;color:#9d1f16!important;font-weight:800;}
.bs-edit{background:#f7edc8!important;color:#8a6a00!important;font-weight:800;}
.bs-rep{background:#d8f2f5!important;color:#0a6673!important;font-weight:800;}
.wf-step{background:#f8fbfb!important;border:1px solid rgba(47,79,58,.16);} .wf-step-click{overflow:visible!important;} .wf-step-click:hover .wf-tip,.wf-step-click:focus .wf-tip{display:block!important;}
.search,.fg input,.fg select,.fg textarea{background:rgba(255,255,255,.96)!important;color:#102f3a!important;border-color:rgba(47,79,58,.28)!important;}
/* v54 action banners, consistent report button, and registration filters */
.action-banner-wrap{position:sticky;top:64px;z-index:850;margin:0 auto 8px;max-width:calc(100% - 48px);display:flex;flex-direction:column;gap:8px;padding-top:8px}.action-banner{display:flex;align-items:center;justify-content:space-between;gap:14px;background:rgba(255,255,255,.96);border:1px solid rgba(47,79,58,.22);border-left:6px solid var(--kai-ocean);border-radius:16px;padding:12px 16px;box-shadow:0 14px 34px rgba(32,46,38,.16);color:#17313a}.action-banner strong{display:block;color:#203f2b;font-size:.92rem}.action-banner span{display:block;color:#25596a;font-size:.82rem;margin-top:3px}.resolve-action{border-left-color:#2f8f46}.owner-action{border-left-color:#d9b45a}.btn-action,.btn-report{background:linear-gradient(135deg,var(--kai-ocean),var(--kai-aqua));color:#fff;border:0;border-radius:14px;padding:10px 16px;font-weight:900;white-space:nowrap;box-shadow:0 10px 24px rgba(11,127,140,.22);cursor:pointer}.ph .btn-p{font-weight:900}.reg-filter-grid{display:grid;grid-template-columns:170px 1fr 180px 180px auto;gap:12px;align-items:end}.reg-clear{height:42px;white-space:nowrap}.filter-group{margin:12px 0 8px}.filter-label{letter-spacing:.08em;text-transform:uppercase;font-size:.76rem;font-weight:900;margin:8px 0;color:#203f2b!important}.filter-row{display:flex;gap:8px;flex-wrap:wrap}.fchip{padding:9px 14px!important;border-radius:999px!important}.fchip-on{box-shadow:0 10px 22px rgba(17,147,165,.22)}
@media(max-width:900px){.action-banner-wrap{top:58px;max-width:calc(100% - 24px)}.action-banner{align-items:flex-start;flex-direction:column}.reg-filter-grid{grid-template-columns:1fr}.reg-clear{width:100%}}

/* v58 UX fixes: banners below dropdowns and better spacing */
.action-banner-wrap{position:relative!important;top:auto!important;z-index:120!important;margin:10px auto 10px!important;max-width:1180px!important;display:grid!important;grid-template-columns:repeat(auto-fit,minmax(320px,1fr))!important;gap:10px!important;padding:8px 24px 0!important}.nav-dd-menu,.profile-menu{z-index:2000!important}.role-guide{position:relative;z-index:80;margin-top:4px}.main{position:relative;z-index:1}@media(max-width:900px){.action-banner-wrap{display:flex!important;flex-direction:column!important;max-width:calc(100% - 24px)!important;padding:8px 0 0!important}}
/* v59 admin readability, menu priority, and visible hover tooltips */
.hdr{position:sticky!important;top:0!important;z-index:90000!important;overflow:visible!important;}
.hdr-inner,.nav,.nav-dd,.profile-dd{overflow:visible!important;}
.nav-dd-menu,.profile-menu{position:fixed!important;top:62px!important;left:auto!important;right:auto!important;z-index:999999!important;max-height:calc(100vh - 82px)!important;overflow:auto!important;box-shadow:0 24px 70px rgba(0,0,0,.32)!important;}
.nav-dd-menu{min-width:240px!important;}
.profile-menu{right:16px!important;min-width:270px!important;}
@media(max-width:1000px){.nav-dd-menu,.profile-menu{left:10px!important;right:10px!important;top:58px!important;width:auto!important;min-width:0!important;}}
.action-banner-wrap,.role-guide,.main,.card{z-index:auto!important;}
/* .tip tooltip is now React-controlled (position:fixed span) — no ::after/::before needed */
.tip{position:relative;}
.admin-table input,.admin-table textarea,.fg textarea.admin-textarea,.admin-tooltip-textarea{width:100%!important;min-width:220px;box-sizing:border-box;line-height:1.35!important;white-space:pre-wrap!important;overflow:auto!important;text-overflow:clip!important;}
.admin-textarea,.admin-tooltip-textarea{resize:vertical!important;min-height:58px!important;padding:11px 12px!important;border:1px solid rgba(90,105,80,.2)!important;border-radius:12px!important;background:rgba(255,255,255,.9)!important;color:#17313a!important;font-family:inherit!important;font-size:.86rem!important;}
.admin-tooltip-textarea{min-height:78px!important;}
.admin-table td{vertical-align:top!important;}
.flex-grow{flex:1 1 auto!important;}


/* v61 emergency production layout reset: restores app styling, prevents overlap, and keeps menus on top */
:root{--kai-ink:#102f3a;--kai-green:#0b7f4f;--kai-olive:#2F4F3A;--kai-ocean:#0b7f8c;--kai-aqua:#17b7b5;--kai-gold:#d9b45a;--kai-soft:#f7f3e9;}
*{box-sizing:border-box}body{margin:0;font-family:'DM Sans',system-ui,-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#f7f3e9;color:var(--kai-ink)}button,input,select,textarea{font:inherit}.app-shell{min-height:100vh;padding-bottom:40px;background:linear-gradient(180deg,rgba(255,255,255,.88),rgba(245,239,225,.93)),url('/morros-kai.png') center top/cover fixed!important;color:var(--kai-ink)!important}.hdr{position:sticky!important;top:0!important;z-index:100000!important;background:rgba(255,255,255,.92)!important;backdrop-filter:blur(14px);border-bottom:1px solid rgba(47,79,58,.16);box-shadow:0 10px 28px rgba(32,46,38,.10);overflow:visible!important}.hdr-inner{min-height:62px;padding:8px 16px;display:flex;align-items:center;gap:12px;max-width:1440px;margin:0 auto;overflow:visible!important}.logo{display:flex;align-items:center;gap:10px;cursor:pointer;min-width:220px}.logo-mark{width:42px;height:42px;border-radius:14px;background:linear-gradient(135deg,#e7fff7,#d8f2f5);display:flex;align-items:center;justify-content:center;position:relative;box-shadow:0 8px 20px rgba(11,127,140,.13);color:#0b7f4f;font-family:'Playfair Display',serif;font-weight:900}.logo-k{font-size:1.22rem}.logo-wave{font-size:.7rem;position:absolute;right:7px;top:7px;color:#0b7f8c}.logo-title{font-family:'Playfair Display',serif;font-size:1.05rem;font-weight:900;color:#203f2b}.logo-sub{font-size:.76rem;color:#235f72}.nav{display:flex;align-items:center;gap:5px;flex:1;min-width:0;overflow:visible!important}.nb,.dd-item,.icon-btn,.profile-btn,.btn-google,.btn-p,.btn-ghost,.bsm,.fchip{border:1px solid rgba(47,79,58,.18);background:rgba(255,255,255,.84);color:#17313a;border-radius:12px;cursor:pointer;transition:.15s ease;text-decoration:none}.nb{padding:8px 10px;font-weight:800;white-space:nowrap;position:relative}.nb:hover,.dd-item:hover,.icon-btn:hover,.profile-btn:hover{background:#fff;box-shadow:0 8px 18px rgba(32,46,38,.10);transform:translateY(-1px)}.nb-active,.dd-active{background:linear-gradient(135deg,#0b7f4f,#0b7f8c)!important;color:#fff!important;border-color:transparent!important}.nb-badge,.icon-badge,.mbn-badge{display:inline-flex;min-width:18px;height:18px;align-items:center;justify-content:center;border-radius:999px;background:#e94235;color:#fff;font-size:.68rem;font-weight:900;margin-left:6px;padding:0 5px}.nav-dd,.profile-dd{position:relative;overflow:visible!important}.nav-dd-menu,.profile-menu{display:none;position:absolute;top:calc(100% + 8px);right:0;min-width:230px;background:rgba(255,255,255,.98);border:1px solid rgba(47,79,58,.18);border-radius:16px;padding:8px;box-shadow:0 24px 70px rgba(20,32,26,.25);z-index:1000000!important}.nav-dd-menu.menu-open,.profile-menu.menu-open{display:flex!important;flex-direction:column;gap:4px}.dd-item{width:100%;text-align:left;padding:10px 12px;font-weight:800;display:flex;align-items:center;justify-content:space-between;gap:8px}.dd-item.danger{color:#9d1f16;background:#fff5f3}.hdr-right{display:flex;align-items:center;gap:8px;margin-left:auto;overflow:visible!important}.lang-switch{height:38px;border-radius:12px;border:1px solid rgba(47,79,58,.18);background:#fff;color:#17313a;padding:0 9px;font-weight:800;max-width:130px}.community-switch{max-width:160px}.icon-btn,.profile-btn{width:42px;height:42px;display:flex;align-items:center;justify-content:center;position:relative}.icon-btn{font-size:1.15rem}.uavatar,.uavatar-img{width:34px;height:34px;border-radius:50%;display:flex;align-items:center;justify-content:center;background:#a84cc1;color:#fff;font-weight:900;object-fit:cover}.profile-menu{right:0;min-width:285px}.profile-head{padding:10px 12px;border-bottom:1px solid rgba(47,79,58,.12);margin-bottom:5px;display:flex;flex-direction:column;gap:2px}.profile-head strong{color:#203f2b}.profile-head span,.profile-head small{font-size:.78rem;color:#235f72;word-break:break-word}.profile-lang{padding:10px 12px;display:flex;align-items:center;gap:8px;justify-content:space-between}.sync-pill{font-size:.76rem;color:#235f72;background:rgba(255,255,255,.72);border:1px solid rgba(47,79,58,.14);border-radius:999px;padding:8px 10px;white-space:nowrap}.sync-dot{width:8px;height:8px;border-radius:50%;display:inline-block;margin-right:5px}.synced{background:#1eaa64}.syncing{background:#d9b45a}.mob-nav{display:none}.main{max-width:1360px;margin:0 auto;padding:20px 24px 70px;position:relative;z-index:1}.card,.welcome-card,.role-guide,.notice-card,.gate-card{background:rgba(255,255,255,.94)!important;border:1px solid rgba(47,79,58,.18)!important;border-radius:22px!important;box-shadow:0 14px 40px rgba(32,46,38,.13)!important;padding:22px}.ptitle{font-family:'Playfair Display',serif;color:#203f2b!important;font-size:2rem;margin:0 0 8px;font-weight:900}.psub{color:#235f72!important;margin:0 0 14px;line-height:1.45}.ph{display:flex;align-items:flex-start;justify-content:space-between;gap:16px;margin-bottom:16px}.btn-p,.btn-report,.btn-action{background:linear-gradient(135deg,#0b7f4f,#0b7f8c)!important;color:#fff!important;border:0!important;border-radius:16px!important;padding:11px 17px!important;font-weight:900!important;box-shadow:0 12px 26px rgba(11,127,140,.22)!important;cursor:pointer}.btn-ghost{background:rgba(255,255,255,.78)!important;color:#17313a!important;padding:10px 14px!important;font-weight:800!important}.btn-google{display:inline-flex;align-items:center;gap:9px;background:#fff!important;padding:12px 18px!important;font-weight:900!important}.stats6,.owner-stats,.mission-grid,.mission-grid-compact,.analytics-grid,.cat-stats,.reg-filter-grid{display:grid;gap:14px}.stats6{grid-template-columns:repeat(auto-fit,minmax(145px,1fr))}.owner-stats{grid-template-columns:repeat(auto-fit,minmax(160px,1fr))}.stat,.owner-stat,.acard,.catcard{background:rgba(255,255,255,.9)!important;border:1px solid rgba(47,79,58,.16)!important;border-radius:18px!important;padding:16px!important;box-shadow:0 10px 25px rgba(32,46,38,.08)!important}.stat-num,.ac-num,.ar-num{font-family:'Playfair Display',serif;font-size:1.55rem;font-weight:900;color:#203f2b}.stat-label,.ac-label{font-size:.78rem;color:#235f72;font-weight:800}.action-banner-wrap{position:relative!important;z-index:10!important;margin:12px auto 16px!important;max-width:1360px!important;display:grid!important;grid-template-columns:repeat(auto-fit,minmax(320px,1fr))!important;gap:12px!important;padding:0 24px!important}.action-banner{background:rgba(255,255,255,.96)!important;border:1px solid rgba(47,79,58,.18)!important;border-left:6px solid var(--kai-ocean)!important;border-radius:18px!important;padding:14px 16px!important;box-shadow:0 12px 30px rgba(32,46,38,.12)!important;display:flex!important;align-items:center!important;justify-content:space-between!important;gap:12px!important}.action-banner strong{color:#203f2b!important}.action-banner span{color:#235f72!important}.resolve-action{border-left-color:#2f8f46!important}.owner-action{border-left-color:#d9b45a!important}.fg,.fg2{display:grid;gap:10px}.fg2{grid-template-columns:repeat(2,minmax(0,1fr))}.fg label{font-size:.78rem;font-weight:900;color:#203f2b}.fg input,.fg select,.fg textarea,.search,.admin-textarea,.admin-tooltip-textarea{width:100%;border:1px solid rgba(47,79,58,.24)!important;border-radius:13px!important;background:rgba(255,255,255,.96)!important;color:#102f3a!important;padding:10px 12px!important;box-shadow:inset 0 1px 0 rgba(255,255,255,.7)}.fg textarea,.admin-textarea,.admin-tooltip-textarea{min-height:74px;resize:vertical;line-height:1.45}.admin-tooltip-textarea{min-height:92px}.irow{background:rgba(255,255,255,.92)!important;border:1px solid rgba(47,79,58,.16)!important;border-radius:16px!important;padding:14px 16px!important;margin-bottom:10px!important;display:flex;gap:14px;box-shadow:0 8px 22px rgba(32,46,38,.08)!important}.ir-guest,.ir-desc,.ir-date,.ir-rep,.ir-loc{color:#173f4d!important}.ir-guest{font-weight:900}.ir-acts{display:flex;flex-direction:column;gap:6px}.bsm{padding:8px 10px!important;font-weight:900!important;border-radius:12px!important}.filter-row{display:flex;gap:8px;flex-wrap:wrap}.fchip{padding:9px 14px!important;border-radius:999px!important;font-weight:900!important}.fchip-on{background:linear-gradient(135deg,#0b7f4f,#0b7f8c)!important;color:#fff!important;border-color:transparent!important}.workflow-card{background:rgba(255,255,255,.92)!important;border:1px solid rgba(47,79,58,.16)!important;border-radius:20px!important;padding:14px 18px!important;box-shadow:0 12px 28px rgba(32,46,38,.10)!important;overflow:visible!important}.wf-steps{display:grid!important;grid-template-columns:1fr 26px 1fr 26px 1fr;align-items:center;gap:8px}.wf-step{min-height:72px!important;background:#fff!important;border:1px solid rgba(47,79,58,.16)!important;border-radius:16px!important;padding:10px 12px!important}.wf-arrow{display:flex!important;justify-content:center;color:#2aa8ad;font-size:1.2rem}.wf-tip{z-index:1000001!important}.overlay{z-index:1000002!important}.modal{background:#fff!important}.toast{position:fixed;right:18px;bottom:18px;z-index:1000003;background:#17313a;color:#fff;padding:12px 16px;border-radius:14px;box-shadow:0 18px 45px rgba(0,0,0,.25)}.empty{padding:30px;text-align:center;color:#235f72}.admin-table{width:100%;border-collapse:separate;border-spacing:0 8px}.admin-table th{font-size:.72rem;text-transform:uppercase;letter-spacing:.08em;color:#203f2b;text-align:left}.admin-table td{background:rgba(255,255,255,.86);border-top:1px solid rgba(47,79,58,.12);border-bottom:1px solid rgba(47,79,58,.12);padding:10px;vertical-align:top}.admin-table td:first-child{border-left:1px solid rgba(47,79,58,.12);border-radius:12px 0 0 12px}.admin-table td:last-child{border-right:1px solid rgba(47,79,58,.12);border-radius:0 12px 12px 0}.nav-dd-menu,.profile-menu{position:fixed!important;top:64px!important;right:16px!important;max-height:calc(100vh - 78px)!important;overflow:auto!important}.nav-dd-menu{right:auto!important;left:320px!important}.profile-menu{right:16px!important}.nav-dd-menu.menu-open,.profile-menu.menu-open{display:flex!important}.role-guide,.action-banner-wrap,.workflow-card,.card,.main{overflow:visible!important}.action-banner-wrap,.role-guide{z-index:5!important}.main{z-index:1!important}
@media(max-width:1000px){.logo{min-width:auto}.logo-title,.logo-sub,.compact-sync{display:none}.hdr-inner{padding:8px 10px}.nav{gap:3px}.nav .nb:nth-of-type(n+4){display:none}.nb{padding:7px 8px;font-size:.72rem}.nav-dd-menu{left:10px!important;right:10px!important;top:60px!important}.profile-menu{left:10px!important;right:10px!important;top:60px!important}.main{padding:16px 12px 60px}.action-banner-wrap{padding:0 12px!important;grid-template-columns:1fr!important}.wf-steps{grid-template-columns:1fr!important}.wf-arrow{display:none!important}.fg2{grid-template-columns:1fr}.ph{flex-direction:column}.irow{flex-direction:column}.ir-acts{flex-direction:row;flex-wrap:wrap}.stats6{grid-template-columns:repeat(2,minmax(0,1fr))}}
@media(max-width:600px){.hdr-inner{gap:6px}.logo-mark{width:34px;height:34px}.nav .nb:nth-of-type(n+3){display:none}.lang-switch{max-width:110px}.community-switch{max-width:120px}.icon-btn,.profile-btn{width:34px;height:34px}.ptitle{font-size:1.55rem}.card,.welcome-card,.role-guide{padding:16px}.action-banner{flex-direction:column;align-items:flex-start!important}.stats6{grid-template-columns:1fr}.workflow-card{padding:12px!important}.wf-tip{left:8px!important;right:8px!important;transform:none!important;min-width:0!important}.wf-tip:after{left:22px!important}}

/* v62 responsive/device-aware layout patch */
:root{--safe-top:env(safe-area-inset-top,0px);--safe-bottom:env(safe-area-inset-bottom,0px)}
html{font-size:clamp(14px,1.1vw,16px);-webkit-text-size-adjust:100%}body{overflow-x:hidden}.app-shell{min-height:100svh;background-attachment:scroll!important}.hdr{top:0!important}.hdr-inner{width:100%;max-width:1440px}.main{width:100%;max-width:min(1360px,100%);padding-left:clamp(10px,2.5vw,24px)!important;padding-right:clamp(10px,2.5vw,24px)!important}.card,.welcome-card,.role-guide,.notice-card,.gate-card,.workflow-card{max-width:100%;overflow-wrap:anywhere}.ph{flex-wrap:wrap}.btn-p,.btn-report,.btn-action,.btn-ghost,.bsm,.fchip,.nb,.dd-item,.icon-btn,.profile-btn{min-height:44px;touch-action:manipulation}.nav{min-width:0;flex-wrap:nowrap}.nav .nb{max-width:160px;overflow:hidden;text-overflow:ellipsis}.hdr-right{flex-shrink:0}.sync-pill{max-width:190px;overflow:hidden;text-overflow:ellipsis}.stats6,.owner-stats,.analytics-grid,.cat-stats,.mission-grid,.mission-grid-compact,.reg-filter-grid{grid-template-columns:repeat(auto-fit,minmax(min(100%,170px),1fr))!important}.action-banner-wrap{grid-template-columns:repeat(auto-fit,minmax(min(100%,300px),1fr))!important}.action-banner{min-width:0}.workflow-card-compact{padding:12px 14px!important;margin:10px 0 14px!important}.wf-steps{grid-template-columns:minmax(0,1fr) 22px minmax(0,1fr) 22px minmax(0,1fr)!important}.wf-step{min-width:0!important;min-height:62px!important}.wf-copy strong,.wf-copy small{white-space:normal!important}.filter-row{overflow-x:auto;flex-wrap:nowrap;padding-bottom:4px;scrollbar-width:thin}.filter-row .fchip{flex:0 0 auto}.irow{min-width:0}.ir-l,.ir-c,.ir-acts{min-width:0}.admin-table{display:block;overflow-x:auto;white-space:nowrap;-webkit-overflow-scrolling:touch}.admin-table textarea,.admin-table input,.admin-table select{min-width:260px;white-space:normal}.modal{width:min(94vw,560px)!important;max-height:min(90svh,900px)!important}.overlay{padding:max(12px,var(--safe-top)) 12px max(12px,var(--safe-bottom))!important}.nav-dd-menu,.profile-menu{position:fixed!important;z-index:2147483000!important;max-height:calc(100svh - 74px)!important;overflow:auto!important;-webkit-overflow-scrolling:touch}.toast{max-width:calc(100vw - 24px);right:12px!important;bottom:max(12px,var(--safe-bottom))!important}
@media (pointer:coarse){.wf-step:hover .wf-tip{display:none!important}.wf-step:focus .wf-tip,.wf-step:active .wf-tip{display:block!important}}
@media (max-width:1180px){.hdr-inner{gap:8px}.logo{min-width:0}.logo-sub{display:none}.nav .nb{font-size:.78rem;padding:8px 9px}.nav .nb:nth-of-type(n+5){display:none}.nav-dd-menu{left:auto!important;right:72px!important;top:62px!important}.profile-menu{right:10px!important;top:62px!important}.main{padding-top:14px!important}.workflow-card{padding:12px!important}.wf-step{padding:9px!important}.wf-copy small{font-size:.72rem!important}}
@media (max-width:820px){.hdr{position:sticky!important}.hdr-inner{min-height:58px}.logo-title{font-size:.92rem}.logo-sub,.sync-pill{display:none!important}.nav .nb:nth-of-type(n+3){display:none}.nav-dd-menu,.profile-menu{left:8px!important;right:8px!important;top:58px!important;width:auto!important;min-width:0!important}.main{padding:12px 10px 92px!important}.ptitle{font-size:clamp(1.45rem,7vw,2rem)!important}.psub{font-size:.92rem}.ph{display:block}.ph .btn-p,.ph .btn-report,.ph .btn-action{margin-top:10px;width:100%}.card,.welcome-card,.role-guide,.notice-card,.gate-card{border-radius:18px!important;padding:16px!important}.action-banner-wrap{padding:0 10px!important;margin:10px auto!important}.action-banner{align-items:stretch!important}.action-banner .btn-p,.action-banner .btn-action,.action-banner .btn-ghost{width:100%;text-align:center;justify-content:center}.wf-steps{grid-template-columns:1fr!important;gap:8px!important}.wf-arrow{display:none!important}.wf-step{display:flex!important;align-items:center!important;gap:10px!important;width:100%;text-align:left}.wf-icon{flex:0 0 auto}.wf-tip{position:fixed!important;left:10px!important;right:10px!important;top:auto!important;bottom:max(14px,var(--safe-bottom))!important;transform:none!important;min-width:0!important;max-width:none!important;z-index:2147483001!important}.wf-tip:after{display:none!important}.fg2,.listing-detail-grid{grid-template-columns:1fr!important}.irow{flex-direction:column!important}.ir-acts{flex-direction:row!important;flex-wrap:wrap!important}.ir-acts .bsm{flex:1 1 140px}.notice-card{flex-direction:column}.mission-grid,.mission-grid-compact{grid-template-columns:1fr!important}.gate-shell{padding:12px!important}.welcome-brand{align-items:flex-start}.welcome-logo{width:64px;height:64px}.modal{border-radius:18px!important;padding:18px!important}}
@media (max-width:520px){.hdr-inner{padding:7px 8px!important}.logo-mark{width:36px!important;height:36px!important;border-radius:12px}.logo-title{display:none!important}.nav{flex:0 1 auto}.nav .nb{display:none!important}.hdr-right{gap:5px}.icon-btn,.profile-btn{width:38px!important;height:38px!important}.uavatar,.uavatar-img{width:30px!important;height:30px!important}.main{padding-left:8px!important;padding-right:8px!important}.stats6,.owner-stats,.analytics-grid,.cat-stats,.reg-filter-grid{grid-template-columns:1fr!important}.stat,.owner-stat,.acard,.catcard{padding:13px!important}.filter-row{margin-left:-2px;margin-right:-2px}.fchip{padding:9px 12px!important}.btn-p,.btn-report,.btn-action,.btn-ghost{width:100%;justify-content:center}.admin-table td,.admin-table th{font-size:.82rem;padding:8px}.admin-table textarea,.admin-table input,.admin-table select{min-width:220px}.toast{left:10px!important;right:10px!important}.profile-head span,.profile-head small{font-size:.72rem}.profile-lang{flex-direction:column;align-items:stretch}.profile-lang select{width:100%}.empty{padding:22px 12px!important}}
@media (min-width:1181px){.nav-dd-menu{left:auto!important;right:360px!important}.profile-menu{right:16px!important}.wf-step:hover,.wf-step:focus{transform:translateY(-1px);box-shadow:0 14px 30px rgba(32,46,38,.14)!important}.filter-row{overflow:visible;flex-wrap:wrap}}
@media (prefers-reduced-motion:reduce){*,*::before,*::after{animation-duration:.001ms!important;animation-iteration-count:1!important;scroll-behavior:auto!important;transition-duration:.001ms!important}}


/* v80 smart notifications – grid layout, text wraps, simple positioning */
.smart-dd{position:relative;display:inline-flex;z-index:2147482500}
.smart-menu{position:fixed!important;top:64px!important;right:8px!important;width:min(420px,calc(100vw - 16px))!important;max-height:calc(100svh - 78px);overflow-y:auto;background:rgba(255,255,255,.99);border:1px solid rgba(47,79,58,.18);border-radius:18px;box-shadow:0 28px 80px rgba(18,31,38,.32);padding:14px 16px;z-index:2147483500!important;color:#17313a}
.smart-head{display:flex;align-items:flex-start;justify-content:space-between;gap:10px;padding-bottom:10px;border-bottom:1px solid rgba(47,79,58,.10);margin-bottom:12px}
.smart-head>div>strong{display:block;font-size:.92rem;font-weight:900;color:#17313a}
.smart-head>div>span{display:block;font-size:.72rem;color:#607872;line-height:1.35;margin-top:2px}
.smart-live{flex-shrink:0;font-style:normal;background:#e7f8f0;color:#087346;border:1px solid #bdebd5;border-radius:999px;padding:3px 9px;font-size:.67rem;font-weight:900;white-space:nowrap;margin-top:2px}
.smart-list{display:flex;flex-direction:column;gap:8px}
/* 3-col grid: [badge 44px] [title+desc 1fr] [arrow 16px]; badge spans both rows */
.smart-item{width:100%;display:grid!important;grid-template-columns:44px 1fr 18px!important;grid-template-rows:auto auto!important;column-gap:10px!important;row-gap:3px!important;align-items:center!important;border:1px solid rgba(47,79,58,.10);background:#fff;border-radius:14px;padding:12px!important;text-align:left!important;cursor:pointer!important;transition:transform .14s,box-shadow .14s,border-color .14s;box-sizing:border-box}
.smart-item:hover,.smart-item:focus{transform:translateY(-2px);box-shadow:0 10px 28px rgba(32,46,38,.12);border-color:rgba(11,127,140,.28)!important}
.smart-count{grid-column:1!important;grid-row:1/3!important;align-self:center!important;justify-self:center!important;width:40px;height:40px;border-radius:10px;color:#fff;display:flex!important;align-items:center!important;justify-content:center!important;font-size:1.05rem;font-weight:900;line-height:1}
.smart-title{grid-column:2!important;grid-row:1!important;font-size:.87rem;font-weight:900;color:#17313a;line-height:1.3;word-break:break-word;overflow-wrap:anywhere}
.smart-icon-inline{font-size:.85rem;margin-right:4px}
.smart-arr{grid-column:3!important;grid-row:1!important;align-self:start!important;justify-self:end!important;color:#c4d0ce;font-size:1rem;line-height:1.4;margin-top:1px}
.smart-desc{grid-column:2/4!important;grid-row:2!important;font-size:.74rem;color:#607872;line-height:1.4;word-break:break-word;overflow-wrap:anywhere}
.smart-owner{border-left:3px solid #c49a14!important}
.smart-resolve{border-left:3px solid #d96c1a!important}
.smart-registration{border-left:3px solid #2f6fbf!important}
.smart-notice{border-left:3px solid #6b44b8!important}
.smart-serious{border-left:3px solid #c0281e!important;background:rgba(255,245,245,.5)!important}
.smart-empty{padding:20px 8px;text-align:center}
.smart-empty-icon{font-size:2rem;display:block;margin-bottom:8px}
.smart-empty strong{display:block;color:#17313a;font-size:.9rem;font-weight:900}
.smart-empty span{display:block;color:#607872;font-size:.77rem;margin-top:6px;line-height:1.45}
.smart-foot{display:flex;flex-direction:column;gap:6px;border-top:1px solid rgba(47,79,58,.10);margin-top:12px;padding-top:10px}
.smart-foot .dd-item{justify-content:center!important;background:#f5f9f8;border:1px solid rgba(47,79,58,.12);border-radius:11px;font-size:.84rem;min-height:40px;font-weight:800}
.smart-foot .dd-item:hover{background:#eaf4f2!important}
/* ── Personalised dashboard greeting ─────────────────────────────────── */
.dash-greeting{display:flex;align-items:center;gap:16px;padding:16px 20px;background:linear-gradient(135deg,rgba(47,79,58,.05),rgba(11,127,140,.05));border:1px solid rgba(47,79,58,.13);border-radius:18px;margin-bottom:14px;transition:background .2s}
.dg-all-clear{background:linear-gradient(135deg,rgba(31,122,53,.06),rgba(11,127,140,.04))!important;border-color:rgba(31,122,53,.18)!important}
.dg-avatar{width:52px;height:52px;border-radius:50%;object-fit:cover;flex-shrink:0;border:2px solid rgba(47,79,58,.16)}
.dg-initials{width:52px;height:52px;border-radius:50%;display:flex;align-items:center;justify-content:center;background:linear-gradient(135deg,#0b7f4f,#0b7f8c);color:#fff;font-weight:900;font-size:1.3rem;flex-shrink:0}
.dg-body{flex:1;min-width:0}
.dg-hello{font-family:'Playfair Display',serif;font-size:1.3rem;color:#203f2b;margin:0 0 4px;font-weight:900;line-height:1.2}
.dg-name{color:#0b7f8c}
.dg-msg{font-size:.86rem;color:#2a5a6a;margin:0 0 10px;line-height:1.45}
.dg-msg:last-child{margin-bottom:0}
.dg-pills{display:flex;flex-wrap:wrap;gap:7px}
.dg-pill{display:inline-flex;align-items:center;gap:5px;padding:7px 14px;border-radius:999px;font-size:.78rem;font-weight:800;cursor:pointer;transition:all .14s;white-space:nowrap}
.dg-pill-amber{background:rgba(217,180,90,.15);color:#8a6200;border:1px solid rgba(217,180,90,.35)}
.dg-pill-amber:hover{background:rgba(217,180,90,.28);transform:translateY(-1px)}
.dg-pill-green{background:rgba(47,143,70,.12);color:#1a6b30;border:1px solid rgba(47,143,70,.28)}
.dg-pill-green:hover{background:rgba(47,143,70,.22);transform:translateY(-1px)}
.dg-pill-blue{background:rgba(11,127,140,.10);color:#085f6a;border:1px solid rgba(11,127,140,.24)}
.dg-pill-blue:hover{background:rgba(11,127,140,.20);transform:translateY(-1px)}
.dg-pill-red{background:rgba(210,90,70,.10);color:#8c2a1a;border:1px solid rgba(210,90,70,.28)}
.dg-pill-red:hover{background:rgba(210,90,70,.20);transform:translateY(-1px)}
@media(max-width:640px){.dash-greeting{gap:12px;padding:14px 16px}.dg-hello{font-size:1.1rem}.dg-initials,.dg-avatar{width:44px;height:44px;font-size:1.1rem}}
/* ── Compact incident workflow stepper ────────────────────────────────── */
.inc-wf-bar{display:flex;align-items:center;gap:6px;padding:9px 14px;background:rgba(255,255,255,.78);border:1px solid rgba(47,79,58,.13);border-radius:14px;margin-bottom:10px;flex-wrap:wrap}
.inc-wf-label{font-size:.68rem;font-weight:900;color:#2a5a6a;text-transform:uppercase;letter-spacing:.08em;white-space:nowrap;flex-shrink:0}
.inc-wf-sep{width:1px;height:18px;background:rgba(47,79,58,.18);margin:0 4px;flex-shrink:0}
.inc-wf-group{display:flex;align-items:center;gap:4px}
.inc-wf-step{display:inline-flex;align-items:center;gap:5px;padding:6px 12px;border-radius:10px;border:1px solid rgba(47,79,58,.16);background:rgba(255,255,255,.85);font-size:.8rem;font-weight:700;color:#17313a;cursor:pointer;transition:all .14s;white-space:nowrap}
.inc-wf-step:hover{background:#fff;border-color:#0b7f8c;box-shadow:0 4px 12px rgba(32,46,38,.10);transform:translateY(-1px)}
.inc-wf-on{background:linear-gradient(135deg,#0b7f4f,#0b7f8c)!important;color:#fff!important;border-color:transparent!important;box-shadow:0 4px 12px rgba(11,127,140,.22)!important}
.inc-wf-arrow{color:#b0c4be;font-size:1rem;font-weight:900;line-height:1}
.inc-wf-clear{padding:4px 8px;border-radius:999px;border:1px solid rgba(233,66,53,.28);background:rgba(233,66,53,.06);color:#c62828;font-size:.72rem;cursor:pointer;font-weight:800;margin-left:auto;flex-shrink:0;transition:all .14s}
.inc-wf-clear:hover{background:rgba(233,66,53,.14)}
/* ── Incident search ─────────────────────────────────────────────────── */
.inc-search-wrap{position:relative;margin-bottom:10px}
.inc-search{width:100%;padding-right:36px!important}
.inc-search-clear{position:absolute;right:10px;top:50%;transform:translateY(-50%);background:none;border:none;color:#7a9aaa;font-size:.85rem;cursor:pointer;padding:4px 6px;border-radius:6px;line-height:1}
.inc-search-clear:hover{background:rgba(47,79,58,.08);color:#17313a}
/* ── Grouped filter bar ───────────────────────────────────────────────── */
.inc-filter-bar{display:flex;align-items:flex-end;gap:8px 16px;flex-wrap:wrap;margin-bottom:14px;padding:10px 14px;background:rgba(255,255,255,.65);border:1px solid rgba(47,79,58,.11);border-radius:14px}
.inc-fb-group{display:flex;flex-direction:column;gap:5px}
.inc-fb-lbl{font-size:.6rem;font-weight:900;text-transform:uppercase;letter-spacing:.1em;color:#2a5a6a;padding-left:2px}
.inc-fb-chips{display:flex;align-items:center;gap:4px;flex-wrap:wrap}
.inc-fb-div{width:1px;align-self:stretch;background:rgba(47,79,58,.15);margin:0 2px;flex-shrink:0}
.inc-fb-reset{align-self:flex-end;margin-bottom:0}
.fchip-sm{padding:6px 12px!important;font-size:.76rem!important;min-height:32px!important;border-radius:999px!important}
.fchip-reset{border-color:rgba(233,66,53,.28)!important;color:#c62828!important;background:rgba(233,66,53,.05)!important}
.fchip-reset:hover{background:rgba(233,66,53,.12)!important}
@media(max-width:600px){.inc-filter-bar{padding:8px 10px;gap:6px 10px}.inc-fb-div{display:none}}
@media(max-width:640px){.inc-wf-bar{gap:4px;padding:8px 10px}.inc-wf-label{display:none}.inc-wf-sep{display:none}.inc-wf-step{font-size:.74rem;padding:5px 9px}}
/* ── Form section headers ─────────────────────────────────────────────── */
.form-section-hdr{grid-column:1/-1;margin:14px 0 2px;padding:10px 0 6px;border-top:1px solid rgba(47,79,58,.14);font-size:.7rem;font-weight:900;color:#2F4F3A;text-transform:uppercase;letter-spacing:.09em;display:flex;align-items:center;gap:6px}
.form-section-hdr:first-child{margin-top:0;padding-top:0;border-top:none}
/* ── Email notification config table ──────────────────────────────────── */
.enc-legend{display:flex;flex-wrap:wrap;gap:8px 16px;font-size:.72rem;color:#2a5a6a;margin-bottom:12px;padding:8px 10px;background:rgba(11,127,140,.05);border-radius:10px}
.enc-legend strong{margin-right:3px}
.enc-table{border:1px solid rgba(47,79,58,.14);border-radius:12px;overflow:hidden;font-size:.78rem}
.enc-hdr{display:grid;grid-template-columns:1fr 58px repeat(4,52px);background:rgba(47,79,58,.07);padding:7px 10px;font-size:.68rem;font-weight:900;color:#2a5a6a;text-transform:uppercase;letter-spacing:.06em;align-items:end}
.enc-col-r-hdr{display:flex;flex-direction:column;align-items:center;gap:2px;font-size:.62rem;line-height:1.1;color:#2a5a6a;font-weight:900;padding-bottom:2px}
.enc-group{border-top:1px solid rgba(47,79,58,.10)}
.enc-group:first-child{border-top:none}
.enc-group-hdr{padding:7px 10px 4px;font-size:.7rem;font-weight:900;color:#2F4F3A;background:rgba(47,79,58,.04);text-transform:uppercase;letter-spacing:.08em}
.enc-row{display:grid;grid-template-columns:1fr 58px repeat(4,52px);padding:6px 10px;align-items:center;border-top:1px solid rgba(47,79,58,.07);transition:background .12s}
.enc-row:hover{background:rgba(255,255,255,.6)}
.enc-off{opacity:.55}
.enc-col-type{font-size:.78rem;color:#17313a;padding-right:8px}
.enc-col-on,.enc-col-r{display:flex;align-items:center;justify-content:center}
/* pill toggle */
.enc-pill-toggle{display:inline-flex;align-items:center;cursor:pointer;position:relative}
.enc-pill-toggle input{position:absolute;opacity:0;width:0;height:0}
.enc-pill{display:inline-block;width:32px;height:18px;border-radius:999px;background:#d0d8d4;border:1px solid rgba(0,0,0,.08);transition:background .2s;position:relative}
.enc-pill::after{content:'';position:absolute;top:2px;left:2px;width:12px;height:12px;border-radius:50%;background:#fff;box-shadow:0 1px 3px rgba(0,0,0,.18);transition:left .2s}
.enc-pill-on{background:#0b7f4f}
.enc-pill-on::after{left:16px}
/* checkbox */
.enc-cb-wrap{display:flex;align-items:center;justify-content:center;cursor:pointer}
.enc-cb-wrap input{width:16px;height:16px;accent-color:#0b7f8c;cursor:pointer}
.enc-cb-dim{opacity:.38}
.enc-cb-dim input{cursor:not-allowed}
.enc-na{color:#aec0be;font-size:.9rem;text-align:center;display:block}
@media(max-width:640px){.enc-hdr,.enc-row{grid-template-columns:1fr 46px repeat(4,40px)}.enc-hdr{font-size:.6rem}.enc-col-type{font-size:.72rem}}
.nav-help-btn{padding:8px 10px!important;font-size:1rem!important;flex-shrink:0!important}
/* Bell lives in nav so it stays adjacent to More ▾ */
.nav-bell{flex-shrink:0!important;margin-right:2px!important}
.icon-btn .icon-badge{position:absolute!important;top:-6px!important;right:-6px!important;margin-left:0!important;min-width:20px!important;height:20px!important;font-size:.72rem!important;padding:0 5px!important;box-shadow:0 2px 8px rgba(233,66,53,.45)!important}
.icon-badge{animation:smartPulse 1.8s infinite}
@keyframes smartPulse{0%,100%{transform:scale(1)}50%{transform:scale(1.14)}}
@media(max-width:860px){.smart-menu{right:8px!important;left:8px!important;width:auto!important;top:60px!important;max-height:calc(100svh - 72px)!important}}

/* --- spinners -------------------------------------------------------------- */
.spinner{width:40px;height:40px;border:3px solid rgba(255,255,255,.18);border-top-color:#17b7b5;border-radius:50%;animation:spin .8s linear infinite}
.spinner-sm{width:16px;height:16px;border:2px solid rgba(11,127,140,.22);border-top-color:#0b7f8c;border-radius:50%;animation:spin .8s linear infinite;display:inline-block;flex-shrink:0;vertical-align:middle}
@keyframes spin{to{transform:rotate(360deg)}}
.sync-overlay{position:fixed;bottom:18px;left:50%;transform:translateX(-50%);background:rgba(23,49,58,.94);color:#fff;border-radius:14px;padding:10px 18px;display:flex;align-items:center;gap:8px;font-size:.82rem;z-index:9999999;box-shadow:0 10px 30px rgba(0,0,0,.3);white-space:nowrap}

/* --- missing base layouts -------------------------------------------------- */
.two-col{display:grid;grid-template-columns:1fr 1fr;gap:18px;margin:18px 0}
.card-hdr{display:flex;align-items:center;justify-content:space-between;margin-bottom:14px;gap:10px;flex-wrap:wrap}
.lnk{background:transparent!important;border:0!important;color:#0b7f8c!important;font-weight:800;text-decoration:underline;text-underline-offset:3px;padding:4px 0!important;box-shadow:none!important;cursor:pointer;font-size:.84rem}
.lg{display:grid;grid-template-columns:repeat(auto-fill,minmax(300px,1fr));gap:16px;margin-top:14px}
.fade{animation:fadeIn .3s ease}
@keyframes fadeIn{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:translateY(0)}}

/* --- dashboard stat cards -------------------------------------------------- */
.scard{background:rgba(255,255,255,.9)!important;border:1px solid rgba(47,79,58,.16)!important;border-radius:18px!important;padding:16px!important;display:flex;flex-direction:column;gap:6px;box-shadow:0 8px 22px rgba(32,46,38,.08)!important;transition:transform .15s ease,box-shadow .15s ease;cursor:default}
.scard:hover{transform:translateY(-2px);box-shadow:0 14px 32px rgba(32,46,38,.14)!important}
.sval{font-family:'Playfair Display',serif;font-size:1.6rem;font-weight:900;line-height:1;color:#203f2b}
.slabel{font-size:.78rem;color:#235f72;font-weight:800}

/* --- dashboard listing rows ------------------------------------------------ */
.apt-row{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:11px 2px;border-bottom:1px solid rgba(47,79,58,.08);min-width:0}
.apt-row:last-child{border-bottom:0;padding-bottom:2px}
.apt-row:hover{background:rgba(11,127,140,.03);border-radius:10px;margin:0 -6px;padding-left:8px;padding-right:8px}
.ar-info{flex:1;min-width:0}
.ar-apt{font-family:'Playfair Display',serif;font-weight:900;font-size:1.05rem;color:#203f2b;line-height:1.2}
.ar-meta{display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-top:4px}
.ar-chips{display:flex;gap:5px;flex-wrap:wrap;align-items:center}
.ar-actions{display:flex;gap:6px;flex-shrink:0;align-items:center}
.ar-act{display:inline-flex;align-items:center;justify-content:center;width:34px;height:34px;border-radius:10px;background:rgba(255,255,255,.82);border:1px solid rgba(47,79,58,.16);color:#17313a;font-size:.9rem;text-decoration:none;transition:background .13s,box-shadow .13s,transform .13s;flex-shrink:0}
.ar-act:hover{background:#fff;transform:translateY(-2px);box-shadow:0 6px 14px rgba(32,46,38,.13)}
.ar-act-wa{color:#1aa361!important;border-color:rgba(26,163,97,.25)!important;background:rgba(26,163,97,.07)!important}
.ar-act-ab{color:#cc3035!important;border-color:rgba(255,90,95,.22)!important;background:rgba(255,90,95,.07)!important}
@media(max-width:500px){.ar-apt{font-size:.96rem}.ar-act{width:38px;height:38px;font-size:1rem}}

/* --- chip color variants --------------------------------------------------- */
.chip{display:inline-flex;align-items:center;gap:3px;padding:3px 9px;border-radius:999px;font-size:.72rem;font-weight:700;line-height:1.3}
.c-teal{background:rgba(11,127,140,.12)!important;color:#0b7f8c!important;border:1px solid rgba(11,127,140,.18)!important}
.c-blue{background:rgba(23,63,100,.1)!important;color:#174b70!important;border:1px solid rgba(23,63,100,.16)!important}
.c-gray{background:rgba(100,120,130,.1)!important;color:#3a5a6a!important;border:1px solid rgba(100,120,130,.16)!important}
.c-red{background:rgba(255,90,95,.12)!important;color:#cc3035!important;border:1px solid rgba(255,90,95,.2)!important}

/* --- header beta badge ----------------------------------------------------- */
.beta-badge{font-size:.58rem;font-weight:900;letter-spacing:.06em;background:rgba(11,127,140,.16);color:#0b7f8c;border-radius:999px;padding:2px 7px;vertical-align:middle;margin-left:5px;border:1px solid rgba(11,127,140,.22)}

/* --- BetaCommandCenter ----------------------------------------------------- */
.beta-command{background:rgba(255,255,255,.88);border:1px solid rgba(47,79,58,.14);border-radius:20px;padding:16px 18px;margin:0 0 16px;box-shadow:0 8px 22px rgba(32,46,38,.07)}
.beta-command-head{display:flex;align-items:flex-start;justify-content:space-between;gap:12px;margin-bottom:12px}
.beta-command-head strong{display:block;color:#203f2b;font-size:.95rem;font-weight:900}
.beta-kicker{display:block;font-size:.68rem;font-weight:900;color:#0b7f8c;text-transform:uppercase;letter-spacing:.1em;margin-bottom:2px}
.beta-health{font-size:.78rem;font-weight:900;border-radius:999px;padding:5px 10px;white-space:nowrap;flex-shrink:0}
.all-clear{background:#dff5e4;color:#1f7a35;border:1px solid rgba(31,122,53,.2)}
.needs-work{background:#fff0dc;color:#a06000;border:1px solid rgba(160,96,0,.2)}
.beta-command-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:10px}
.beta-action-card{display:grid!important;grid-template-columns:36px 1fr auto;align-items:center!important;gap:10px;background:rgba(255,255,255,.9);border:1px solid rgba(47,79,58,.12);border-radius:14px;padding:10px 12px;text-align:left;cursor:pointer;transition:transform .15s ease,box-shadow .15s ease,border-color .15s ease;justify-content:initial!important;width:100%}
.beta-action-card:hover{transform:translateY(-1px);box-shadow:0 10px 24px rgba(32,46,38,.12);border-color:#19a66a}
.beta-action-card.has-count{border-left:3px solid #d9b45a}
.beta-action-icon{width:32px;height:32px;border-radius:50%;background:#f1f6f4;display:flex!important;align-items:center!important;justify-content:center!important;font-size:.95rem;flex:0 0 32px}
.beta-action-copy{min-width:0;text-align:left}
.beta-action-copy strong{display:block;color:#203f2b;font-size:.84rem;font-weight:900}
.beta-action-copy small{display:block;color:#496674;font-size:.7rem;line-height:1.25;margin-top:1px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.beta-action-count{min-width:26px;height:26px;border-radius:999px;background:#edf5fe;color:#203f2b;display:flex!important;align-items:center!important;justify-content:center!important;font-size:.8rem;font-weight:900;border:1px solid rgba(47,79,58,.12);flex:0 0 26px}
.beta-action-card.has-count .beta-action-count{background:#fff0dc;color:#a06000;border-color:rgba(160,96,0,.22)}
@media(max-width:760px){.beta-command-grid{grid-template-columns:1fr}.two-col{grid-template-columns:1fr}}

/* --- DashboardFocus (unified action section) -------------------------------- */
.dash-focus{margin-bottom:16px}
.dash-focus-head{display:flex;align-items:flex-start;justify-content:space-between;gap:16px;margin-bottom:14px;flex-wrap:wrap}
.dash-focus-title strong{display:block;font-size:1rem;font-weight:900;color:#203f2b}
.dash-focus-title p{margin:4px 0 0;font-size:.84rem;color:#235f72;line-height:1.45}
.dash-focus-actions{display:flex;align-items:center;gap:8px;flex-wrap:wrap}
.dash-focus-actions>span{font-size:.78rem;font-weight:900;color:#235f72;white-space:nowrap}
.dash-focus-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}
.dash-focus-card{display:grid!important;grid-template-columns:36px 1fr auto;align-items:center!important;gap:10px;background:rgba(255,255,255,.9);border:1px solid rgba(47,79,58,.12);border-left:4px solid transparent;border-radius:14px;padding:12px 14px;text-align:left;cursor:pointer;transition:transform .15s ease,box-shadow .15s ease;width:100%;justify-content:initial!important}
.dash-focus-card:hover{transform:translateY(-1px);box-shadow:0 10px 24px rgba(32,46,38,.12)}
.dfc-icon{font-size:1.25rem;width:36px;text-align:center;flex-shrink:0}
.dfc-copy{min-width:0}
.dfc-copy strong{display:block;font-size:.88rem;font-weight:900;color:#203f2b}
.dfc-copy small{display:block;font-size:.76rem;color:#235f72;line-height:1.35;margin-top:2px;white-space:normal}
.dfc-count{min-width:28px;height:28px;border-radius:999px;background:#edf5fe;color:#203f2b;display:flex!important;align-items:center!important;justify-content:center!important;font-size:.82rem;font-weight:900;border:1px solid rgba(47,79,58,.12);flex-shrink:0}
.dfc-active .dfc-count{background:#fff0dc;color:#a06000;border-color:rgba(160,96,0,.22)}
.dfc-active.dfc-amber{border-left-color:#d9a030}
.dfc-active.dfc-green{border-left-color:#2a9a4a}
.dfc-active.dfc-blue{border-left-color:#3b82f6}
.role-chip{background:rgba(11,127,140,.1);color:#0b7f8c;border:1px solid rgba(11,127,140,.22);border-radius:999px;padding:6px 13px;font-size:.8rem;font-weight:900;cursor:pointer;white-space:nowrap;transition:.12s ease}
.role-chip:hover{background:rgba(11,127,140,.18);transform:translateY(-1px)}
@media(max-width:760px){.dash-focus-grid{grid-template-columns:1fr}.dash-focus-head{flex-direction:column}.dash-focus-actions{margin-top:4px}}

/* --- AptCard internals ----------------------------------------------------- */
.acard-top{display:flex;align-items:flex-start;justify-content:space-between;gap:10px;margin-bottom:8px}
.acard-body{margin-bottom:10px}
.acard-foot{display:flex;gap:8px;flex-wrap:wrap;padding-top:8px;border-top:1px solid rgba(47,79,58,.08)}
.ac-wave{font-size:1.2rem;opacity:.4;flex-shrink:0}
/* Stats row */
.ac-stats{display:flex;flex-wrap:wrap;gap:6px;margin-bottom:10px}
/* Owner / Operator sections */
.ac-party{padding:7px 0;border-top:1px solid rgba(47,79,58,.09)}
.ac-party-op{border-top-style:dashed}
.ac-party-lbl{font-size:.63rem;font-weight:900;text-transform:uppercase;letter-spacing:.09em;color:#2a5a6a;margin-bottom:4px}
.ac-party-row{display:flex;align-items:center;justify-content:space-between;gap:8px;min-width:0}
.ac-no-name{font-size:.8rem;color:#8a9fa5;font-style:italic}
/* Contact icon buttons — mirrors ar-act from dashboard for consistency */
.ac-cbtns{display:flex;align-items:center;gap:5px;flex-shrink:0}
.ac-cbtn{display:inline-flex;align-items:center;justify-content:center;width:34px;height:34px;border-radius:10px;border:1px solid rgba(47,79,58,.20);background:rgba(255,255,255,.92);color:#17313a;font-size:1rem;text-decoration:none;transition:all .14s;cursor:pointer;flex-shrink:0}
.ac-cbtn:hover{background:#fff;border-color:#0b7f8c;box-shadow:0 5px 14px rgba(32,46,38,.13);transform:translateY(-1px)}
.ac-cbtn-wa{color:#1aa361!important;border-color:rgba(26,163,97,.28)!important;background:rgba(26,163,97,.08)!important}
.ac-cbtn-wa:hover{background:rgba(26,163,97,.16)!important;border-color:#1aa361!important}
.airbnb-lnk{display:inline-flex;align-items:center;font-size:.78rem;color:#FF5A5F!important;text-decoration:none;font-weight:800;padding:4px 10px;border:1px solid rgba(255,90,95,.22);border-radius:999px;background:rgba(255,90,95,.08)}
.airbnb-lnk:hover{background:rgba(255,90,95,.16)}
.adp-airbnb-lnk{display:inline-flex;align-items:center;font-size:.9rem;opacity:.6;text-decoration:none;padding:2px 5px;border-radius:6px;transition:opacity .15s}
.adp-airbnb-lnk:hover{opacity:1}
.no-link{font-size:.74rem;color:#8a9fa5;margin-bottom:6px}
.inc-b{font-size:.76rem;font-weight:800;padding:5px 10px;border-radius:999px;cursor:pointer;margin-top:6px;display:inline-block;border:1px solid transparent}
.ib-open{background:rgba(210,90,70,.14);color:#b83215;border-color:rgba(210,90,70,.2)}
.ib-none{background:rgba(31,122,53,.1);color:#1f7a35;border-color:rgba(31,122,53,.16)}
.lock-tag{font-size:.74rem;color:#8a9fa5;background:rgba(100,120,130,.08);border-radius:999px;padding:3px 8px;border:1px solid rgba(100,120,130,.14)}

/* --- dashboard blacklist --------------------------------------------------- */
.ncard{border-left:4px solid #b71c1c!important}
.nrow{display:flex;flex-wrap:wrap;gap:10px;margin-top:8px}
.npill{display:flex;align-items:center;gap:10px;background:rgba(180,28,28,.06);border:1px solid rgba(180,28,28,.14);border-radius:12px;padding:10px 14px}
.np-name{font-size:.88rem;font-weight:700;color:#b83215}
.np-loc{font-size:.72rem;color:#5a8090;margin-top:2px}
.np-apt{font-size:.7rem;color:#2a4a5a;margin-top:2px}

/* --- guest display --------------------------------------------------------- */
.guest-display-list{font-size:.8rem;color:#235f72;line-height:1.55;padding:4px 0}

/* --- action strip (single compact row, replaces banner + guide + command center) */
.action-strip{display:flex;flex-wrap:wrap;gap:8px;padding:8px 24px;background:rgba(255,255,255,.86);border-bottom:1px solid rgba(47,79,58,.10)}
.action-pill{display:inline-flex;align-items:center;gap:10px;padding:8px 14px;border-radius:14px;font-size:.82rem;font-weight:700;cursor:pointer;border:1.5px solid;transition:transform .12s ease,box-shadow .12s ease;text-align:left;min-height:44px;touch-action:manipulation}
.action-pill:hover{transform:translateY(-1px);box-shadow:0 4px 12px rgba(0,0,0,.10)}
.ap-icon{font-size:1.05rem;line-height:1;flex-shrink:0}
.ap-body{display:flex;flex-direction:column;gap:1px}
.ap-body strong{font-size:.84rem;font-weight:900;line-height:1.15}
.ap-body span{font-size:.7rem;font-weight:600;opacity:.72;line-height:1}
.ap-owner{background:#fffbeb;color:#92400e;border-color:rgba(217,119,6,.3)}
.ap-resolve{background:#f0fdf4;color:#14532d;border-color:rgba(22,163,74,.28)}
.ap-reg{background:#eff6ff;color:#1e3a8a;border-color:rgba(59,130,246,.28)}
@media(max-width:600px){.action-strip{padding:8px 12px}.action-pill{padding:7px 11px}.ap-body span{display:none}}

/* --- role preview banner (Global Admin only) ------------------------------- */
.role-preview-banner{position:sticky;top:62px;z-index:89999;background:#fbbf24;color:#1a1200;display:flex;align-items:center;justify-content:space-between;gap:12px;padding:9px 24px;font-weight:700;font-size:.86rem;box-shadow:0 2px 8px rgba(0,0,0,.12)}
.role-preview-banner>span{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.role-preview-banner>button{flex-shrink:0;background:rgba(0,0,0,.14);border:1px solid rgba(0,0,0,.22);border-radius:8px;padding:5px 12px;font-weight:900;cursor:pointer;color:#1a1200;white-space:nowrap;font-size:.82rem}
.role-preview-banner>button:hover{background:rgba(0,0,0,.24)}
@media(max-width:600px){.role-preview-banner{padding:8px 12px;font-size:.78rem}.role-preview-banner>span{font-size:.72rem}}

/* --- view-as selector (Global Admin only) ---------------------------------- */
.view-as-wrap{display:flex;align-items:center;gap:5px;flex-shrink:0}
.view-as-label{font-size:.72rem;font-weight:900;color:#235f72;white-space:nowrap}
.view-as-select{height:34px;border-radius:10px;border:1px solid rgba(47,79,58,.22)!important;background:rgba(255,255,252,.96)!important;color:#17313a!important;padding:0 8px!important;font-weight:800;font-size:.76rem;cursor:pointer}
@media(max-width:1180px){.view-as-wrap{max-width:175px}.view-as-label{display:none}.view-as-select{font-size:.72rem}}
@media(max-width:1000px){.view-as-wrap{display:none}}
/* "View as" in profile dropdown (always accessible) */
.profile-view-as{padding:8px 12px;display:flex;align-items:center;gap:8px;border-top:1px solid rgba(47,79,58,.08);margin-top:2px}
.profile-view-as>span{font-size:.78rem;font-weight:900;color:#235f72;white-space:nowrap;flex-shrink:0}
/* Version badge at the bottom of profile dropdown */
.profile-version{font-size:.65rem;color:rgba(47,79,58,.4);text-align:center;padding:6px 12px 2px;letter-spacing:.04em;font-weight:600;border-top:1px solid rgba(47,79,58,.06);margin-top:2px}
.profile-view-as .view-as-select{flex:1;height:32px;font-size:.82rem}

/* --- FIX 1: nav overflow at 900-1200 px ----------------------------------- */
@media(max-width:1200px) and (min-width:1001px){
  .hdr-inner{gap:6px!important}
  .nav .nb{font-size:.76rem!important;padding:7px 8px!important}
  .nav-dd-menu{right:215px!important}
}

/* --- v76 nav layout: left|center|right — no overflow ----------------------- */
.hdr-inner{display:flex!important;flex-wrap:nowrap!important;gap:6px!important}
.logo{flex:0 0 auto!important}
.nav.nav-compact{flex:1 1 0!important;min-width:0!important;overflow:hidden!important;flex-wrap:nowrap!important;gap:3px!important}
.nav.nav-compact .nb{min-width:0!important;flex-shrink:1!important;white-space:nowrap!important;font-size:clamp(.7rem,1.4vw,.85rem)!important;padding:7px 8px!important}
.hdr-right{flex:0 0 auto!important;margin-left:auto!important}
/* More ▾ dropdown — View as role section */
.dd-sep{height:1px;background:rgba(47,79,58,.12);margin:5px 8px}
.dd-section-label{font-size:.69rem;font-weight:900;color:#235f72;padding:6px 12px 3px;text-transform:uppercase;letter-spacing:.07em;display:block}
.dd-radio{justify-content:flex-start!important;gap:8px!important}
.dd-radio-on{background:rgba(11,127,140,.1)!important;color:#0b7f8c!important;font-weight:900!important}
.dd-radio-dot{font-size:.88rem;width:14px;text-align:center;flex-shrink:0;font-family:monospace}
.nb-preview-dot{font-size:.72rem;margin-left:4px;vertical-align:middle;line-height:1}

/* ── Help view ─────────────────────────────────────────────────────────────── */
.help-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(272px,1fr));gap:12px}
.help-card{display:flex!important;align-items:center!important;gap:14px!important;background:rgba(255,255,255,.94)!important;border:1px solid rgba(47,79,58,.16)!important;border-radius:16px!important;padding:15px 16px!important;text-align:left!important;cursor:pointer!important;transition:transform .14s,box-shadow .14s,border-color .14s!important}
.help-card:hover,.help-card:focus{transform:translateY(-2px)!important;box-shadow:0 12px 32px rgba(32,46,38,.14)!important;border-color:rgba(11,127,140,.3)!important}
.help-card-icon{font-size:1.7rem;flex-shrink:0;line-height:1}
.help-card-body{flex:1;min-width:0}
.help-card-body strong{display:block;color:#203f2b;font-size:.9rem;font-weight:900;line-height:1.25}
.help-card-body span{display:block;color:#496674;font-size:.76rem;margin-top:3px;line-height:1.35}
.help-card-arr{color:#b0bfba;font-size:1.3rem;flex-shrink:0;line-height:1}
.help-topic-count{font-size:.78rem;color:#496674;font-weight:700;white-space:nowrap;padding-bottom:6px}
.help-article{max-width:760px}
.help-article-hdr{display:flex;align-items:flex-start;gap:16px;margin-bottom:22px;padding-bottom:18px;border-bottom:1px solid rgba(47,79,58,.12)}
.help-article-icon{font-size:2.4rem;line-height:1;flex-shrink:0;margin-top:3px}
.help-section{margin-top:22px;padding-top:18px;border-top:1px solid rgba(47,79,58,.09)}
.help-section-h{color:#203f2b;font-size:1rem;font-weight:900;margin:0 0 8px;line-height:1.3}
.help-section-b{color:#17313a;font-size:.9rem;line-height:1.7;margin:0}
.help-actions{margin-top:24px;padding:16px 18px;background:linear-gradient(135deg,rgba(11,127,79,.05),rgba(11,127,140,.06));border:1px solid rgba(11,127,140,.16);border-radius:14px}
.help-actions-label{display:block;font-size:.72rem;font-weight:900;text-transform:uppercase;letter-spacing:.07em;color:#235f72;margin-bottom:10px}
.help-actions-row{display:flex;gap:10px;flex-wrap:wrap}
.help-action-btn{flex-shrink:0}
.help-article-foot{margin-top:20px;padding-top:16px;border-top:1px solid rgba(47,79,58,.10)}
/* ── Notifications view: full-page smart alerts grid ─────────────────────────*/
.notif-alerts-section{margin-bottom:8px}
.notif-alerts-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:10px}
@media(max-width:600px){.notif-alerts-grid{grid-template-columns:1fr}}

/* ── Admin collapsible sections ─────────────────────────────────────────────── */
.admin-sec-hdr{display:flex;align-items:center;gap:12px;cursor:pointer;user-select:none;border-radius:12px;padding:4px 2px;margin:-4px -2px;transition:background .12s}
.admin-sec-hdr:hover{background:rgba(11,127,140,.05)}
.admin-sec-info{flex:1;min-width:0}
.admin-sec-action{flex-shrink:0}
.admin-sec-chevron{flex-shrink:0;width:22px;height:22px;display:flex;align-items:center;justify-content:center;border-radius:6px;background:rgba(47,79,58,.07);color:#496674;font-size:.68rem;transition:background .12s}
.admin-sec-hdr:hover .admin-sec-chevron{background:rgba(11,127,140,.12);color:#0b7f8c}
.admin-sec-body{margin-top:14px;padding-top:14px;border-top:1px solid rgba(47,79,58,.10)}
.admin-section.card:not(:has(.admin-sec-body)){padding-bottom:18px}
@media(max-width:600px){.admin-sec-hdr{flex-wrap:wrap;gap:8px}.admin-sec-action{width:100%}}
@media(max-width:600px){.help-grid{grid-template-columns:1fr}.help-article-hdr{flex-direction:column;gap:10px}.help-article-icon{font-size:2rem}}

/* ── Building view ───────────────────────────────────────────────────────── */
.fls-toolbar{display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:12px;flex-wrap:wrap}
.fls-vtoggle{display:flex;border:1px solid rgba(47,79,58,.2);border-radius:10px;overflow:hidden;flex-shrink:0}
.fls-vbtn{padding:7px 14px;font-size:.78rem;font-weight:800;color:#496674;background:rgba(255,255,255,.7);border:0;cursor:pointer;transition:background .12s,color .12s;white-space:nowrap}
.fls-vbtn:hover{background:rgba(255,255,255,.95);color:#17313a}
.fls-vbtn-on{background:#0b7f4f!important;color:#fff!important}
/* ── Building (floor bands + door grid) */
.bld-building{display:flex;flex-direction:column;gap:10px}
/* ── Building floors — light, on-theme */
.bld-floor{border-radius:16px;overflow:hidden;box-shadow:0 6px 18px rgba(32,46,38,.08);border:1px solid rgba(47,79,58,.16);background:rgba(255,255,255,.9)}
.bld-floor-hdr{width:100%;display:flex;align-items:center;gap:14px;padding:13px 18px;background:linear-gradient(90deg,rgba(11,127,79,.07),rgba(11,127,140,.04));border-left:5px solid #0b7f8c;border-top:0;border-right:0;border-bottom:0;cursor:pointer;text-align:left;transition:background .14s}
.bld-floor-hdr:hover{background:linear-gradient(90deg,rgba(11,127,79,.11),rgba(11,127,140,.07))}
.bld-floor-id{display:flex;flex-direction:column;gap:0;flex-shrink:0;min-width:38px}
.bld-floor-level{font-size:.52rem;font-weight:900;letter-spacing:.14em;color:#8a9fa5;text-transform:uppercase}
.bld-floor-num{font-family:'Playfair Display',serif;font-size:1.5rem;font-weight:900;line-height:1;color:#203f2b}
.bld-floor-stats{display:flex;gap:6px;flex:1;flex-wrap:wrap;align-items:center}
.bld-stat-pill{border-radius:999px;padding:4px 10px;font-size:.72rem;font-weight:800;white-space:nowrap}
.bld-stat-apts{background:rgba(47,79,58,.08);color:#496674;border:1px solid rgba(47,79,58,.14)}
.bld-stat-inc{background:rgba(160,80,0,.08);color:#a05000;border:1px solid rgba(160,80,0,.18)}
.bld-stat-ver{background:rgba(11,127,79,.08);color:#0b5f3a;border:1px solid rgba(11,127,79,.18)}
.bld-stat-res{background:rgba(100,150,120,.08);color:#4a7060;border:1px solid rgba(100,150,120,.18)}
.bld-stat-clear{background:rgba(31,160,100,.07);color:#1a7a50;border:1px solid rgba(31,160,100,.16)}
.bld-chev{color:#8a9fa5;font-size:1.1rem;font-weight:900;transition:transform .2s;display:inline-block;flex-shrink:0;margin-left:auto}
.bld-chev-up{transform:rotate(90deg)}
.bld-floor-body{background:rgba(245,248,244,.8);border-top:1px solid rgba(47,79,58,.08)}
/* ── Door grid — min 160px so 3-digit numbers and "Details" always fit */
.bld-door-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(160px,1fr));gap:10px;padding:14px}
/* ── Door card */
.apt-door{position:relative;border-radius:12px;overflow:hidden;cursor:pointer;background:rgba(255,255,255,.96);border:1.5px solid rgba(47,79,58,.16);box-shadow:0 4px 12px rgba(32,46,38,.08);transition:transform .15s,box-shadow .15s,border-color .18s,background .15s;user-select:none;display:flex;flex-direction:column}
.apt-door:hover{transform:translateY(-3px);box-shadow:0 10px 28px rgba(11,127,140,.18);background:rgba(11,127,140,.05);border-color:rgba(11,127,140,.35)!important}
.apt-door-clean{border-color:rgba(31,160,100,.3)!important}
.apt-door-warn{border-color:rgba(217,160,0,.45)!important;box-shadow:0 4px 12px rgba(32,46,38,.08),0 0 0 1px rgba(217,160,0,.18)!important}
.apt-door-alert{border-color:rgba(210,80,60,.45)!important;box-shadow:0 4px 12px rgba(32,46,38,.08),0 0 10px rgba(210,80,60,.18)!important}
.apt-door-sel{border-color:rgba(11,127,140,.55)!important;box-shadow:0 0 0 3px rgba(11,127,140,.14),0 6px 16px rgba(32,46,38,.12)!important;transform:translateY(-1px)}
/* Status bar */
.door-status-bar{height:3px;width:100%;flex-shrink:0}
.door-sb-clean{background:linear-gradient(90deg,#1fa862,#2dda80)}
.door-sb-warn{background:linear-gradient(90deg,#d9a030,#f0c040)}
.door-sb-alert{background:linear-gradient(90deg,#d43028,#f05040)}
/* Full-width number plate — always shows the complete 3-digit apt number */
.door-num-plate{display:flex;align-items:center;justify-content:space-between;margin:10px 10px 4px;background:linear-gradient(135deg,#17313a,#243c30);border-radius:8px;padding:7px 10px;flex-shrink:0}
.door-num{font-family:'Playfair Display',serif;font-size:1.15rem;font-weight:900;color:#c8d8a0;letter-spacing:.05em;line-height:1}
/* Incident badge — inline inside the plate, no absolute positioning */
.door-inc-badge{background:#d9a030;color:#1a0800;border-radius:999px;font-size:.6rem;font-weight:900;padding:2px 7px;white-space:nowrap;flex-shrink:0}
/* Card body */
.door-body{padding:6px 10px 4px;flex:1}
.door-owner{font-size:.74rem;font-weight:700;color:#203f2b;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;margin-bottom:2px}
.door-op{font-size:.64rem;color:#496674;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;margin-bottom:5px}
.door-chips{display:flex;gap:4px;flex-wrap:wrap}
.door-chip{font-size:.62rem;font-weight:700;padding:2px 6px;border-radius:999px;background:rgba(47,79,58,.08);color:#496674;border:1px solid rgba(47,79,58,.1)}
/* Footer */
.door-footer{text-align:center;font-size:.62rem;font-weight:800;color:#0b7f8c;padding:5px 8px 7px;border-top:1px solid rgba(47,79,58,.06);margin-top:4px;white-space:nowrap;flex-shrink:0}
/* ── Door hover overlay — shows contact links on hover without blocking card click */
.door-hover-overlay{
  position:absolute;inset:0;border-radius:12px;
  background:rgba(5,22,30,.86);backdrop-filter:blur(3px);
  display:flex;flex-direction:column;justify-content:center;align-items:flex-start;
  padding:10px 12px;gap:7px;
  opacity:0;pointer-events:none;
  transition:opacity .18s ease;
}
.apt-door:hover:not(.apt-door-sel) .door-hover-overlay{opacity:1}
.door-hover-cta{font-size:.6rem;font-weight:800;color:rgba(255,255,255,.5);margin-top:4px;letter-spacing:.03em}
/* ── Apt detail panel */
.adp-wrap{margin:0 16px 16px;background:rgba(255,255,255,.96);border-radius:14px;border:1px solid rgba(47,79,58,.18);box-shadow:0 8px 24px rgba(0,0,0,.12);overflow:hidden;animation:fadeIn .18s ease}
.adp-header{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:14px 16px;background:linear-gradient(90deg,rgba(11,127,79,.07),rgba(11,127,140,.05));border-bottom:1px solid rgba(47,79,58,.1);flex-wrap:wrap}
.adp-apt-id{display:flex;align-items:center;gap:8px;flex-wrap:wrap}
.adp-apt-num{font-family:'Playfair Display',serif;font-size:1.1rem;font-weight:900;color:#203f2b}
.adp-close-btn{width:28px;height:28px;border-radius:8px;border:1px solid rgba(47,79,58,.2);background:rgba(255,255,255,.7);color:#496674;font-size:.8rem;cursor:pointer;display:flex;align-items:center;justify-content:center;flex-shrink:0}
.adp-close-btn:hover{background:#fff;color:#17313a}
.adp-contacts{display:flex;gap:0;flex-direction:column;border-bottom:1px solid rgba(47,79,58,.08)}
.adp-party{display:flex;align-items:center;gap:10px;padding:10px 16px;flex-wrap:wrap;border-bottom:1px solid rgba(47,79,58,.06)}
.adp-party:last-child{border-bottom:none}
.adp-party-lbl{font-size:.65rem;font-weight:900;text-transform:uppercase;letter-spacing:.09em;color:#2a5a6a;min-width:72px;flex-shrink:0}
.adp-party-row{display:flex;align-items:center;gap:8px;flex:1;flex-wrap:wrap}
.adp-incidents{padding:14px 16px}
.adp-inc-hdr{font-size:.78rem;font-weight:900;color:#2a5a6a;text-transform:uppercase;letter-spacing:.07em;margin-bottom:10px;display:flex;align-items:center;gap:8px}
.adp-inc-count{background:rgba(47,79,58,.1);border-radius:999px;padding:2px 9px;font-size:.72rem;color:#17313a}
.adp-inc-empty{font-size:.84rem;color:#6a9a7a;padding:8px 0;font-weight:700}
.adp-inc-group{margin-bottom:12px}
.adp-inc-group-lbl{font-size:.72rem;font-weight:900;text-transform:uppercase;letter-spacing:.08em;margin-bottom:6px}
.adp-inc-card{background:rgba(247,243,234,.8);border:1px solid rgba(47,79,58,.1);border-radius:10px;padding:10px 12px;margin-bottom:6px}
.adp-inc-top{display:flex;align-items:center;gap:6px;flex-wrap:wrap;margin-bottom:6px}
.adp-inc-date{font-size:.7rem;color:#8a9fa5;margin-left:auto}
.adp-inc-desc{font-size:.82rem;color:#17313a;line-height:1.45;margin-bottom:4px}
.adp-inc-guest{font-size:.76rem;color:#496674;margin-top:4px}
.adp-inc-comments{font-size:.76rem;color:#203f2b;margin-top:5px;background:rgba(47,79,58,.06);border-radius:7px;padding:6px 10px;border:1px solid rgba(47,79,58,.1);line-height:1.45}
.adp-comment-action{background:rgba(21,101,192,.06)!important;border-color:rgba(21,101,192,.15)!important;color:#1a3a6a!important}
.adp-comment-resolution{background:rgba(11,127,79,.06)!important;border-color:rgba(11,127,79,.15)!important;color:#0b4f32!important}
.adp-comment-closed{background:rgba(47,79,58,.08)!important;border-color:rgba(47,79,58,.2)!important;color:#203f2b!important}
.adp-comment-lbl{font-size:.65rem;font-weight:900;text-transform:uppercase;letter-spacing:.06em;opacity:.7;margin-right:5px;display:inline-block}
.adp-inc-reporter-name{font-size:.68rem;color:#6a8a9a;white-space:nowrap}
/* ── Verify resolution hint + warning */
.verify-resolution-hint{font-size:.75rem;color:#1a4470;background:rgba(21,101,192,.06);border:1px solid rgba(21,101,192,.18);border-radius:6px;padding:6px 10px;margin-bottom:6px;line-height:1.4}
.inc-res-warn{font-size:.74rem;color:#7f1500;background:#fff5f0;border:1.5px solid #e65100;border-left:4px solid #e65100;border-radius:7px;padding:7px 11px;margin:6px 0;line-height:1.45;font-weight:600}
/* ── Incident context tags — shown in IRow and AptDetailPanel */
.ir-ctx-tags{display:flex;gap:4px;flex-wrap:wrap;margin:4px 0 2px}
.inc-ctx-tag{display:inline-flex;align-items:center;border-radius:999px;font-size:.62rem;font-weight:900;padding:2px 8px;white-space:nowrap;letter-spacing:.02em}
.inc-ctx-reporter{background:rgba(21,101,192,.1);color:#1565c0;border:1px solid rgba(21,101,192,.22)}
.inc-ctx-mine{background:rgba(11,127,140,.09);color:#0b5f72;border:1px solid rgba(11,127,140,.22)}
/* ── List-mode floor groups (kept for ≡ view) */
.fls-list{display:flex;flex-direction:column;gap:12px}
.fls-floor{background:rgba(255,255,255,.88);border:1px solid rgba(47,79,58,.16);border-radius:16px;overflow:hidden;box-shadow:0 6px 18px rgba(32,46,38,.07)}
.fls-floor-hdr{width:100%;display:flex;align-items:center;gap:10px;padding:13px 16px;background:none;border:0;border-left:5px solid #0b7f8c;cursor:pointer;text-align:left;transition:background .14s}
.fls-floor-hdr:hover{background:rgba(11,127,140,.04)}
.fls-floor-badge{display:inline-flex;align-items:center;justify-content:center;width:32px;height:32px;border-radius:10px;color:#fff;font-size:.78rem;font-weight:900;flex-shrink:0}
.fls-floor-label{font-family:'Playfair Display',serif;font-size:1rem;font-weight:900;color:#203f2b;flex-shrink:0}
.fls-floor-meta{display:flex;align-items:center;gap:8px;margin-left:4px;flex:1;flex-wrap:wrap}
.fls-floor-units{font-size:.78rem;color:#496674;font-weight:700;background:rgba(47,79,58,.07);border-radius:999px;padding:3px 9px}
.fls-floor-open{font-size:.76rem;color:#a05000;font-weight:800;background:rgba(160,80,0,.1);border-radius:999px;padding:3px 9px;border:1px solid rgba(160,80,0,.18)}
.fls-chev{font-size:1.1rem;color:#8a9fa5;font-weight:900;transition:transform .18s;display:inline-block;flex-shrink:0}
.fls-chev-up{transform:rotate(90deg)}
.fls-floor-body{border-top:1px solid rgba(47,79,58,.1)}
.fls-row{border-bottom:1px solid rgba(47,79,58,.07);transition:background .12s}
.fls-row:last-child{border-bottom:none}
.fls-row:hover{background:rgba(11,127,140,.03)}
.fls-row-open{background:rgba(11,127,140,.04)!important}
.fls-row-main{display:flex;align-items:center;gap:10px;padding:11px 16px;cursor:pointer;flex-wrap:wrap;min-width:0}
.fls-apt-num{font-family:'Playfair Display',serif;font-weight:900;font-size:.96rem;color:#203f2b;white-space:nowrap;flex-shrink:0;min-width:62px}
.fls-owner-wrap{flex:1;min-width:110px}
.fls-op-pill{font-size:.72rem;font-weight:700;color:#496674;background:rgba(47,79,58,.08);border-radius:999px;padding:3px 8px;white-space:nowrap;flex-shrink:0;max-width:120px;overflow:hidden;text-overflow:ellipsis}
.fls-row-chips{display:flex;gap:5px;flex-shrink:0}
.fls-row-acts{display:flex;gap:5px;flex-shrink:0}
.fls-inc-pill{font-size:.72rem;font-weight:800;color:#a05000;background:rgba(160,80,0,.10);border:1px solid rgba(160,80,0,.20);border-radius:999px;padding:3px 8px;white-space:nowrap;flex-shrink:0}
.fls-row-detail{padding:12px 16px 14px 78px;background:rgba(245,248,244,.7);border-top:1px solid rgba(47,79,58,.08);display:flex;flex-direction:column;gap:9px}
.fls-det-row{display:flex;align-items:center;gap:10px;font-size:.84rem;flex-wrap:wrap}
.fls-det-lbl{font-weight:800;color:#2a5a6a;min-width:72px;font-size:.76rem;text-transform:uppercase;letter-spacing:.05em;flex-shrink:0}
.fls-det-val{display:flex;align-items:center;gap:6px;flex:1;flex-wrap:wrap}
.fls-det-acts{display:flex;gap:5px}
.fls-det-acts-row{display:flex;align-items:center;gap:8px;flex-wrap:wrap;padding-top:6px;border-top:1px solid rgba(47,79,58,.08)}
/* ── Workflow groups (incidents) */
.wfg-list{display:flex;flex-direction:column;gap:10px}
.wfg-section{background:rgba(255,255,255,.9);border:1px solid rgba(47,79,58,.14);border-radius:16px;overflow:hidden;box-shadow:0 6px 18px rgba(32,46,38,.07)}
.wfg-hdr{width:100%;display:flex;align-items:center;gap:10px;padding:14px 18px;background:none;border:0;border-left:5px solid;cursor:pointer;text-align:left;transition:background .14s}
.wfg-hdr:hover{background:rgba(47,79,58,.03)}
.wfg-icon{font-size:1.15rem;flex-shrink:0;line-height:1}
.wfg-hdr-body{flex:1;min-width:0;display:flex;flex-direction:column;gap:1px}
.wfg-label{font-family:'Playfair Display',serif;font-size:.98rem;font-weight:900;color:#203f2b;line-height:1.2}
.wfg-sublabel{font-size:.72rem;color:#496674}
.wfg-badge{border-radius:999px;padding:4px 12px;font-size:.78rem;font-weight:900;flex-shrink:0}
.wfg-body{border-top:1px solid rgba(47,79,58,.08)}
.wfg-empty{padding:14px 18px;font-size:.84rem;color:#6a9a7a;font-weight:700}
.wfg-filters{display:flex;align-items:flex-start;gap:10px;flex-wrap:wrap;margin-bottom:12px;justify-content:space-between}
/* IRow apt context */
.ir-apt-context{display:flex;flex-direction:column;gap:2px}
.ir-apt-sub{font-size:.7rem;color:#6a8a9a;line-height:1.3}
@media(max-width:640px){.bld-door-grid{grid-template-columns:repeat(auto-fill,minmax(120px,1fr));gap:8px;padding:12px}.bld-floor-hdr{padding:12px 14px;gap:10px}.bld-floor-num{font-size:1.3rem}.door-plate{width:46px;height:46px;font-size:.88rem}.fls-row-main{gap:7px;padding:10px 12px}.fls-row-detail{padding:10px 12px 12px}.fls-op-pill{display:none}.wfg-hdr{padding:12px 14px}}
@media(max-width:480px){.bld-door-grid{grid-template-columns:repeat(auto-fill,minmax(100px,1fr))}}
/* ── Analytics date range controls ──────────────────────────────────────── */
.an-range-bar{display:flex;flex-wrap:wrap;align-items:center;gap:8px;justify-content:flex-end}
.an-mode-toggle{display:flex;border:1px solid rgba(47,79,58,.2);border-radius:10px;overflow:hidden;flex-shrink:0}
.an-mode-btn{padding:7px 14px;font-size:.78rem;font-weight:800;color:#496674;background:rgba(255,255,255,.7);border:0;cursor:pointer;transition:background .12s,color .12s;white-space:nowrap}
.an-mode-btn:hover{background:rgba(255,255,255,.95);color:#17313a}
.an-mode-on{background:#0b7f4f!important;color:#fff!important}
.an-preset-pills{display:flex;gap:5px;flex-wrap:wrap}
.an-preset-pill{padding:6px 13px;border-radius:999px;font-size:.78rem;font-weight:800;border:1px solid rgba(47,79,58,.18);background:rgba(255,255,255,.8);color:#496674;cursor:pointer;transition:all .12s;white-space:nowrap}
.an-preset-pill:hover{background:#fff;border-color:#0b7f8c;color:#0b5f72}
.an-preset-on{background:linear-gradient(135deg,#0b7f4f,#0b7f8c)!important;color:#fff!important;border-color:transparent!important;box-shadow:0 3px 10px rgba(11,127,140,.22)}
.an-custom-range{display:flex;align-items:flex-end;gap:10px;flex-wrap:wrap}
.an-date-group{display:flex;flex-direction:column;gap:4px}
.an-date-lbl{font-size:.68rem;font-weight:900;text-transform:uppercase;letter-spacing:.07em;color:#2a5a6a}
.an-date-input{height:36px;border-radius:10px;border:1px solid rgba(47,79,58,.22)!important;background:rgba(255,255,255,.96)!important;color:#17313a!important;padding:0 10px!important;font-size:.84rem;cursor:pointer;min-width:140px}
.an-date-sep{font-size:1.1rem;color:#8a9fa5;font-weight:900;padding-bottom:4px;flex-shrink:0}
.an-window-desc{font-size:.72rem;font-weight:700;color:#496674;background:rgba(47,79,58,.07);border-radius:999px;padding:4px 12px;white-space:nowrap}
@media(max-width:640px){.an-range-bar{justify-content:flex-start}.an-custom-range{flex-direction:column;align-items:flex-start}.an-date-sep{display:none}}
/* ── My listings & incidents ─────────────────────────────────────────────── */
.ml-stats{display:grid;grid-template-columns:repeat(5,1fr);gap:10px;margin-bottom:18px}
.ml-stat{background:rgba(255,255,255,.92);border:1px solid rgba(47,79,58,.14);border-radius:14px;padding:12px 10px;text-align:center;display:flex;flex-direction:column;gap:4px;box-shadow:0 4px 10px rgba(32,46,38,.06)}
.ml-stat-val{font-family:'Playfair Display',serif;font-size:1.6rem;font-weight:900;color:#203f2b;line-height:1}
.ml-stat-lbl{font-size:.68rem;font-weight:700;color:#496674}
.ml-stat-warn .ml-stat-val{color:#a05000}
.ml-stat-ver .ml-stat-val{color:#0b5f3a}
.ml-stat-res .ml-stat-val{color:#4a7060}
.ml-stat-active{border-color:rgba(11,127,140,.4)!important;box-shadow:0 0 0 2px rgba(11,127,140,.14),0 4px 10px rgba(32,46,38,.06)!important;background:rgba(11,127,140,.05)!important}
.ml-section{background:rgba(255,255,255,.9);border:1px solid rgba(47,79,58,.14);border-radius:16px;overflow:hidden;box-shadow:0 6px 16px rgba(32,46,38,.07)}
.ml-section-hdr{padding:12px 16px;font-size:.72rem;font-weight:900;text-transform:uppercase;letter-spacing:.09em;color:#2a5a6a;background:linear-gradient(90deg,rgba(11,127,79,.06),rgba(11,127,140,.03));border-bottom:1px solid rgba(47,79,58,.1)}
.ml-listing{border-bottom:1px solid rgba(47,79,58,.07)}
.ml-listing:last-child{border-bottom:none}
.ml-listing-sel{background:rgba(11,127,140,.04)}
.ml-listing-row{display:flex;align-items:center;gap:10px;padding:12px 16px;cursor:pointer;flex-wrap:wrap;transition:background .12s}
.ml-listing-row:hover{background:rgba(11,127,140,.04)}
.ml-listing-apt{font-family:'Playfair Display',serif;font-weight:900;font-size:1rem;color:#203f2b;flex-shrink:0;min-width:64px}
.ml-listing-chips{display:flex;gap:5px;flex-shrink:0}
.ml-listing-inc-pills{display:flex;gap:5px;flex-wrap:wrap;flex-shrink:0}
.ml-listing-acts{display:flex;gap:5px;flex-shrink:0;margin-left:auto}
.ml-pill{border-radius:999px;padding:3px 9px;font-size:.7rem;font-weight:800;white-space:nowrap}
.ml-pill-open{background:rgba(160,80,0,.1);color:#a05000;border:1px solid rgba(160,80,0,.2)}
.ml-pill-ver{background:rgba(11,127,79,.08);color:#0b5f3a;border:1px solid rgba(11,127,79,.18)}
.ml-pill-res{background:rgba(100,150,120,.08);color:#4a7060;border:1px solid rgba(100,150,120,.18)}
.ml-pill-clear{background:rgba(31,160,100,.07);color:#1a7a50;border:1px solid rgba(31,160,100,.16)}
@media(max-width:640px){.ml-stats{grid-template-columns:repeat(3,1fr)}.ml-listing-row{gap:7px;padding:10px 12px}.ml-listing-acts{margin-left:0;width:100%}}
@media(max-width:400px){.ml-stats{grid-template-columns:repeat(2,1fr)}}
/* ── Profile view ────────────────────────────────────────────────────────── */
.prof-card{max-width:640px;display:flex;flex-direction:column;gap:16px}
.prof-section{background:rgba(255,255,255,.94);border:1px solid rgba(47,79,58,.16);border-radius:18px;padding:20px 22px;box-shadow:0 8px 22px rgba(32,46,38,.08)}
.prof-section-hdr{font-size:.7rem;font-weight:900;text-transform:uppercase;letter-spacing:.09em;color:#235f72;margin-bottom:14px;padding-bottom:10px;border-bottom:1px solid rgba(47,79,58,.10);display:flex;align-items:center;gap:6px}
.prof-ro-grid{display:flex;flex-direction:column;gap:9px}
.prof-ro-row{display:grid;grid-template-columns:160px 1fr;gap:10px;align-items:baseline;padding:5px 0;border-bottom:1px solid rgba(47,79,58,.06);font-size:.87rem}
.prof-ro-row:last-child{border-bottom:none}
.prof-ro-lbl{font-weight:700;color:#2a5a6a;font-size:.8rem}
.prof-ro-val{color:#17313a;word-break:break-all}
.prof-ro-val-hi{color:#0b7f4f;font-weight:800}
.prof-footer{padding-top:4px}
/* Registration profile box: slightly highlighted to distinguish from listing boxes */
.reg-profile-box{background:linear-gradient(135deg,rgba(11,127,79,.04),rgba(11,127,140,.03))!important;border-color:rgba(11,127,140,.22)!important}
@media(max-width:600px){.prof-ro-row{grid-template-columns:1fr;gap:2px}.prof-ro-lbl{font-size:.74rem;color:#5a8090}}

/* ── v80 — 8 new features ────────────────────────────────────────────────── */

/* Feature 3: Draft restored banner */
.draft-restored-banner{background:rgba(217,160,48,.1);border:1px solid rgba(217,160,48,.35);border-left:4px solid #d9a030;border-radius:8px;padding:8px 12px;margin-bottom:14px;font-size:.8rem;color:#7a4a00;display:flex;align-items:center;flex-wrap:wrap;gap:6px;line-height:1.4}

/* Feature 1: Profile completeness warning banner */
.profile-warn-banner{background:rgba(220,100,0,.07);border:1px solid rgba(220,100,0,.28);border-left:4px solid #d9700e;border-radius:10px;padding:10px 14px;margin-bottom:14px;font-size:.8rem;color:#6a3000;line-height:1.45}

/* Feature 2: Action guide banner */
.action-guide-banner{background:rgba(11,127,79,.06);border:1px solid rgba(11,127,79,.2);border-radius:12px;padding:12px 14px;margin-bottom:14px}
.agb-title{font-size:.78rem;font-weight:900;color:#0b4f32;text-transform:uppercase;letter-spacing:.07em;margin-bottom:8px}
.agb-items{display:flex;flex-direction:column;gap:6px}
.agb-item{display:flex;align-items:center;gap:10px;background:rgba(255,255,255,.9);border:1px solid rgba(47,79,58,.18);border-radius:9px;padding:8px 12px;cursor:pointer;text-align:left;font-size:.82rem;color:#17313a;transition:all .14s;width:100%}
.agb-item:hover{background:#fff;box-shadow:0 4px 12px rgba(32,46,38,.1);border-color:#0b7f4f}
.agb-item-warn{border-left:3px solid #d9700e}
.agb-item-res{border-left:3px solid #0b7f4f}
.agb-badge{background:#d9700e;color:#fff;border-radius:999px;font-size:.7rem;font-weight:900;padding:2px 8px;flex-shrink:0;min-width:24px;text-align:center}
.agb-badge-res{background:#0b7f4f}
.agb-arr{margin-left:auto;color:#8a9fa5;font-size:1rem;flex-shrink:0}

/* Feature 6: Dashboard attention section */
.attn-card{border-left:4px solid #d4634a!important}
.attn-badge{background:#d4634a;color:#fff;border-radius:999px;font-size:.7rem;font-weight:900;padding:2px 9px;min-width:24px;text-align:center;flex-shrink:0}
.attn-sub{font-size:.76rem;color:#6a3000;background:rgba(212,99,74,.06);border-radius:7px;padding:6px 10px;margin-bottom:10px;line-height:1.4}
.attn-group-lbl{font-size:.7rem;font-weight:900;text-transform:uppercase;letter-spacing:.08em;color:#2a5a6a;margin:4px 0 4px;padding-bottom:4px;border-bottom:1px solid rgba(47,79,58,.08)}

/* Feature 7: Incident date filter bar */
.inc-filters-bar{display:flex;align-items:center;gap:8px;margin-bottom:10px;flex-wrap:wrap}
.inc-date-range{display:flex;align-items:center;gap:6px;flex-shrink:0;flex-wrap:wrap}
.inc-date-lbl{font-size:.68rem;font-weight:800;text-transform:uppercase;letter-spacing:.07em;color:#2a5a6a;white-space:nowrap}
.inc-date-input{height:36px;border-radius:9px;border:1px solid rgba(47,79,58,.22)!important;background:rgba(255,255,255,.95)!important;color:#17313a!important;padding:0 9px!important;font-size:.82rem;min-width:136px;cursor:pointer}
@media(max-width:600px){.inc-filters-bar{flex-direction:column;align-items:stretch}.inc-date-range{flex-wrap:wrap}}

/* Feature 5: Notification grouping */
.notice-groups{display:flex;flex-direction:column;gap:10px}
.notif-group{background:rgba(255,255,255,.92);border:1px solid rgba(47,79,58,.16);border-radius:14px;overflow:hidden;box-shadow:0 6px 16px rgba(32,46,38,.07)}
.notif-group-open{border-color:rgba(11,127,140,.3)}
.notif-group-hdr{width:100%;display:flex;align-items:center;gap:8px;padding:12px 14px;background:none;border:0;border-left:4px solid rgba(47,79,58,.15);cursor:pointer;text-align:left;transition:background .14s}
.notif-group-open .notif-group-hdr{border-left-color:#0b7f8c;background:rgba(11,127,140,.04)}
.notif-group-hdr:hover{background:rgba(11,127,140,.04)}
.notif-group-icon{font-size:1rem;flex-shrink:0}
.notif-group-label{font-size:.84rem;font-weight:700;color:#17313a;flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.notif-group-badge{background:#d4634a;color:#fff;border-radius:999px;font-size:.65rem;font-weight:900;padding:2px 7px;flex-shrink:0}
.notif-group-count{font-size:.72rem;color:#496674;white-space:nowrap;flex-shrink:0}
.notif-group-chev{font-size:1.1rem;color:#8a9fa5;font-weight:900;transition:transform .18s;display:inline-block;flex-shrink:0}
.notif-group-chev-open{transform:rotate(90deg)}

/* Feature 4: Mobile bottom navigation */
.mob-bottom-nav{display:none;position:fixed;bottom:0;left:0;right:0;z-index:9500;background:rgba(255,255,255,.97);backdrop-filter:blur(14px);border-top:1px solid rgba(47,79,58,.12);box-shadow:0 -4px 18px rgba(32,46,38,.1);padding:0;padding-bottom:env(safe-area-inset-bottom,0)}
@media(max-width:768px){.mob-bottom-nav{display:flex;justify-content:space-around;align-items:stretch}}
.mbn-bottom{flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:2px;padding:8px 4px 10px;background:none;border:0;cursor:pointer;color:#496674;min-height:56px;position:relative;transition:color .14s}
.mbn-bottom:active{background:rgba(11,127,140,.06)}
.mbn-bottom-active{color:#0b7f8c!important}
.mbn-bottom-active .mbn-bottom-icon::after{content:'';position:absolute;bottom:-2px;left:50%;transform:translateX(-50%);width:20px;height:3px;background:#0b7f8c;border-radius:999px}
.mbn-bottom-icon{font-size:1.2rem;position:relative;line-height:1}
.mbn-bottom-lbl{font-size:.58rem;font-weight:800;letter-spacing:.03em;text-transform:uppercase}
.mbn-bottom-badge{position:absolute;top:-4px;right:-6px;background:#d4634a;color:#fff;border-radius:999px;font-size:.54rem;font-weight:900;padding:1px 5px;min-width:16px;text-align:center;line-height:1.4}
/* Shift main content up so bottom nav doesn't cover it on mobile */
@media(max-width:768px){.main{padding-bottom:70px!important}}

/* Feature 8: Audit log viewer */
.audit-wrap{display:flex;flex-direction:column;gap:12px}
.audit-filters{display:flex;align-items:center;gap:8px;flex-wrap:wrap}
.audit-select{height:36px;border-radius:9px;border:1px solid rgba(47,79,58,.22)!important;background:rgba(255,255,255,.95)!important;color:#17313a!important;padding:0 10px!important;font-size:.82rem;min-width:160px;cursor:pointer}
.audit-input{height:36px;border-radius:9px;border:1px solid rgba(47,79,58,.22)!important;background:rgba(255,255,255,.95)!important;color:#17313a!important;padding:0 10px!important;font-size:.82rem;min-width:130px}
.audit-date{min-width:138px!important;cursor:pointer}
.audit-stats-bar{font-size:.74rem;color:#496674;display:flex;gap:12px;align-items:center;padding:4px 0;border-bottom:1px solid rgba(47,79,58,.08)}
.audit-table{font-size:.78rem}
.audit-entity-chip{background:rgba(11,127,140,.1);color:#0b5f72;border-radius:999px;padding:2px 8px;font-size:.68rem;font-weight:800;white-space:nowrap}
.audit-id{background:rgba(47,79,58,.07);border-radius:5px;padding:1px 5px;font-size:.65rem;color:#496674;margin-left:5px}
.audit-action{font-weight:800;color:#17313a;font-size:.76rem}
.audit-detail{cursor:pointer}
.audit-detail-toggle{font-size:.7rem;color:#0b7f8c;cursor:pointer;list-style:none;border:1px solid rgba(11,127,140,.2);border-radius:6px;padding:2px 8px;background:rgba(11,127,140,.06)}
.audit-detail-body{padding:8px;background:rgba(245,248,244,.9);border-radius:8px;margin-top:6px;border:1px solid rgba(47,79,58,.1)}
.audit-json{font-size:.65rem;color:#17313a;white-space:pre-wrap;word-break:break-word;max-height:200px;overflow:auto;margin:4px 0 0;background:rgba(255,255,255,.8);border-radius:6px;padding:6px 8px}
.audit-pagination{display:flex;align-items:center;justify-content:center;gap:12px;padding-top:8px;border-top:1px solid rgba(47,79,58,.08)}
@media(max-width:640px){.audit-filters{flex-direction:column;align-items:stretch}.audit-filters .btn-p{width:100%}}
/* On mobile, push toast above the bottom nav */
@media(max-width:768px){.toast{bottom:80px!important}}

/* Email routing individual/group tags */
.enc-tag{display:inline-block;border-radius:999px;font-size:.55rem;font-weight:800;padding:1px 6px;margin-left:4px;text-transform:uppercase;letter-spacing:.04em;vertical-align:middle}
.enc-tag-individual,.enc-tag-individual{background:rgba(11,127,140,.12);color:#0b5f72;border:1px solid rgba(11,127,140,.2)}
.enc-tag-group,.enc-tag-grupo{background:rgba(106,27,154,.1);color:#4a1a7a;border:1px solid rgba(106,27,154,.15)}

/* ── v81 — Photos + General Incidents ───────────────────────────────────── */

/* Photo thumbnails in IRow / GeneralIncidentsView */
.inc-photo-row{display:flex;gap:6px;flex-wrap:wrap;margin:6px 0 2px}
.inc-photo-thumb{width:56px;height:56px;object-fit:cover;border-radius:8px;cursor:pointer;border:1.5px solid rgba(47,79,58,.18);transition:transform .14s,box-shadow .14s}
.inc-photo-thumb:hover{transform:scale(1.06);box-shadow:0 4px 14px rgba(32,46,38,.18)}

/* Photo upload UI in IncidentModal */
.inc-photo-upload-area{display:flex;gap:8px;flex-wrap:wrap;align-items:flex-start;margin-top:6px}
.inc-photo-preview{position:relative;width:72px;height:72px;flex-shrink:0}
.inc-photo-preview-img{width:72px;height:72px;object-fit:cover;border-radius:10px;border:1.5px solid rgba(47,79,58,.18);display:block}
.inc-photo-remove{position:absolute;top:-6px;right:-6px;width:20px;height:20px;border-radius:50%;background:#d4634a;color:#fff;border:2px solid #fff;font-size:.62rem;font-weight:900;cursor:pointer;display:flex;align-items:center;justify-content:center;line-height:1}
.inc-photo-size{position:absolute;bottom:2px;left:0;right:0;text-align:center;font-size:.55rem;color:rgba(255,255,255,.9);background:rgba(0,0,0,.4);border-radius:0 0 8px 8px;padding:1px 3px}
.inc-photo-add-btn{width:72px;height:72px;border-radius:10px;border:2px dashed rgba(11,127,140,.35);background:rgba(11,127,140,.06);color:#0b7f8c;font-size:.72rem;font-weight:800;cursor:pointer;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:3px;transition:all .14s}
.inc-photo-add-btn:hover{background:rgba(11,127,140,.12);border-color:#0b7f8c}

/* General incident toggle in IncidentModal */
.gen-toggle-wrap{background:rgba(11,127,140,.06);border:1px solid rgba(11,127,140,.2);border-radius:10px;padding:10px 14px;margin-bottom:14px;display:flex;flex-direction:column;gap:6px}
.gen-toggle-label{display:flex;align-items:center;gap:10px;cursor:pointer;font-size:.84rem;color:#17313a;font-weight:600}
.gen-toggle-label input[type="checkbox"]{width:16px;height:16px;flex-shrink:0;accent-color:#0b7f8c;cursor:pointer}
.gen-toggle-box{display:none}
.gen-toggle-hint{font-size:.74rem;color:#0b5f72;background:rgba(11,127,140,.07);border-radius:7px;padding:5px 10px;line-height:1.4}

/* GeneralIncidentsView */
.gen-info-banner{background:rgba(11,127,140,.07);border:1px solid rgba(11,127,140,.22);border-left:4px solid #0b7f8c;border-radius:10px;padding:10px 14px;margin-bottom:16px;font-size:.8rem;color:#0b4f5e;line-height:1.5}
.gen-list{display:flex;flex-direction:column;gap:12px}
.gen-card{background:rgba(255,255,255,.94);border:1px solid rgba(47,79,58,.18);border-left:4px solid #d4634a;border-radius:14px;padding:14px 16px;box-shadow:0 6px 16px rgba(32,46,38,.08);display:flex;flex-direction:column;gap:8px}
.gen-card-closed{border-left-color:rgba(47,79,58,.25)!important;opacity:.8}
.gen-card-header{display:flex;align-items:center;gap:8px;flex-wrap:wrap}
.gen-card-status-dot{width:9px;height:9px;border-radius:50%;flex-shrink:0}
.gen-dot-open{background:#d4634a}
.gen-dot-wait{background:#d9a030}
.gen-dot-closed{background:#4a7060}
.gen-card-type{font-size:.72rem;font-weight:800;color:#496674;background:rgba(47,79,58,.08);border-radius:999px;padding:2px 8px}
.gen-card-cat{font-size:.7rem;color:#6a8a9a;background:rgba(47,79,58,.06);border-radius:999px;padding:2px 7px}
.gen-card-date{font-size:.7rem;color:#8a9fa5;margin-left:auto}
.gen-card-sla{font-size:.68rem;font-weight:800;color:#e65100;background:#fff3e0;border-radius:999px;padding:2px 7px}
.gen-card-desc{font-size:.86rem;color:#17313a;line-height:1.5;margin:0}
.gen-card-reporter{font-size:.72rem;color:#496674}
.gen-card-resolution{font-size:.78rem;color:#0b4f32;background:rgba(11,127,79,.07);border-radius:7px;padding:6px 10px;border-left:3px solid #0b7f4f}
.gen-card-acts{display:flex;gap:8px;flex-wrap:wrap;padding-top:6px;border-top:1px solid rgba(47,79,58,.08)}
/* General incident preview in modals */
.gen-inc-preview{background:rgba(47,79,58,.05);border-radius:8px;padding:8px 10px;border:1px solid rgba(47,79,58,.1)}

/* ── v82 — Responsible Parties panels ───────────────────────────────────────*/

/* Incident detail (UnitDetailCard step=incident) parties panel */
.idd-parties{background:rgba(11,127,79,.04);border:1px solid rgba(11,127,79,.16);border-radius:12px;padding:12px 14px;margin-bottom:12px}
.idd-parties-hdr{font-size:.67rem;font-weight:900;text-transform:uppercase;letter-spacing:.09em;color:#0b5f3a;margin-bottom:10px;padding-bottom:6px;border-bottom:1px solid rgba(11,127,79,.12);display:flex;align-items:center;gap:6px}
.idd-parties-grid{display:flex;flex-direction:column;gap:6px}
.idd-pi-item{display:flex;flex-direction:column;gap:3px;padding:8px 10px;border-radius:8px;background:rgba(255,255,255,.85);border:1px solid rgba(47,79,58,.1)}
.idd-pi-owner{border-color:rgba(11,127,79,.25)!important;background:rgba(11,127,79,.04)!important}
.idd-pi-role{font-size:.67rem;font-weight:900;text-transform:uppercase;letter-spacing:.07em;color:#2a5a6a;display:flex;align-items:center;gap:6px;flex-wrap:wrap;margin-bottom:1px}
.idd-pi-resp-badge{background:rgba(11,127,79,.15);color:#0b5f3a;border-radius:999px;font-size:.6rem;font-weight:900;padding:2px 8px;text-transform:none;letter-spacing:0;white-space:nowrap}
.idd-pi-name{font-size:.88rem;font-weight:700;color:#17313a}
.idd-pi-contacts{display:flex;gap:7px;flex-wrap:wrap;margin-top:4px}
.idd-pi-link{font-size:.73rem;color:#0b5f72;text-decoration:none;background:rgba(11,127,140,.08);border:1px solid rgba(11,127,140,.2);border-radius:6px;padding:3px 9px;white-space:nowrap;display:inline-flex;align-items:center;gap:3px;transition:background .12s}
.idd-pi-link:hover{background:rgba(11,127,140,.18);color:#083f4f}
.idd-pi-wa{background:rgba(37,211,102,.07)!important;border-color:rgba(37,211,102,.22)!important;color:#1a6b34!important}
.idd-pi-wa:hover{background:rgba(37,211,102,.14)!important}
.idd-pi-none{font-size:.8rem;color:#8a9fa5;font-style:italic}

/* IRow parties strip (non-compact) */
.ir-body-parties{display:flex;flex-wrap:wrap;gap:4px 16px;margin-top:8px;padding-top:7px;border-top:1px solid rgba(47,79,58,.09)}
.ir-bparty{display:inline-flex;align-items:center;gap:5px;font-size:.78rem;color:#496674}
.ir-bparty-lbl{font-weight:900;color:#2a5a6a;font-size:.64rem;text-transform:uppercase;letter-spacing:.07em;white-space:nowrap;flex-shrink:0}
/* IRow parties strip (compact / dashboard) */
.ir-bparty-compact{display:flex;flex-wrap:wrap;gap:3px 10px;margin-top:5px;padding-top:5px;border-top:1px solid rgba(47,79,58,.08)}
.ir-bpc-item{font-size:.69rem;color:#6a8a9a;white-space:nowrap}

/* Incidents tab bar */
.inc-tab-bar{display:flex;gap:0;border-bottom:2px solid rgba(47,79,58,.12);margin-bottom:18px}
.inc-tab{flex:1;padding:11px 14px;background:transparent;border:0;border-bottom:3px solid transparent;margin-bottom:-2px;cursor:pointer;font-size:.88rem;font-weight:700;color:#496674;display:flex;align-items:center;justify-content:center;gap:7px;transition:color .14s,border-color .14s}
.inc-tab:hover{color:#17313a;background:rgba(47,79,58,.04)}
.inc-tab-on{color:#0b7f8c!important;border-bottom-color:#0b7f8c!important;background:rgba(11,127,140,.05)!important}
.inc-tab-badge{display:inline-flex;min-width:20px;height:20px;align-items:center;justify-content:center;border-radius:999px;background:#d4634a;color:#fff;font-size:.68rem;font-weight:900;padding:0 5px}
.inc-tab-on .inc-tab-badge{background:#0b7f8c}

/* GeneralListingsSection — "General" category at top of Inventory/Listings */
.gen-ls-section{background:rgba(255,255,255,.94);border:1px solid rgba(217,112,14,.28);border-left:5px solid #d9700e;border-radius:16px;overflow:hidden;box-shadow:0 6px 18px rgba(32,46,38,.07);margin-bottom:16px}
.gen-ls-hdr{width:100%;display:flex;align-items:center;gap:10px;padding:13px 16px;background:linear-gradient(90deg,rgba(217,112,14,.06),rgba(217,112,14,.02));border:0;cursor:pointer;text-align:left;transition:background .14s}
.gen-ls-hdr:hover{background:rgba(217,112,14,.08)}
.gen-ls-icon{font-size:1.25rem;flex-shrink:0}
.gen-ls-hdr-body{display:flex;flex-direction:column;gap:2px;flex:1;min-width:0}
.gen-ls-label{font-family:'Playfair Display',serif;font-size:1rem;font-weight:900;color:#203f2b}
.gen-ls-sublabel{font-size:.74rem;color:#8a5000;font-weight:700}
.gen-ls-sublabel-ok{color:#2e7d32!important}
.gen-ls-badge{display:inline-flex;min-width:24px;height:24px;align-items:center;justify-content:center;border-radius:999px;background:#d9700e;color:#fff;font-size:.72rem;font-weight:900;padding:0 6px;flex-shrink:0}
.gen-ls-body{padding:12px 16px 16px;border-top:1px solid rgba(217,112,14,.14)}
.gen-ls-admin-banner{background:rgba(217,112,14,.09);border:1px solid rgba(217,112,14,.28);border-left:4px solid #d9700e;border-radius:10px;padding:10px 14px;font-size:.8rem;color:#7a3a00;line-height:1.5;font-weight:700}
.gen-ls-empty{padding:8px 4px;font-size:.8rem;color:#4a7060;font-weight:600}

/* Dashboard general incidents attention card */
.gen-attn-card{border-left:5px solid #d9700e!important}
.gen-attn-list{display:flex;flex-direction:column;gap:8px;margin-top:10px}
.gen-attn-item{display:flex;gap:10px;align-items:flex-start;padding:8px 10px;background:rgba(217,112,14,.05);border:1px solid rgba(217,112,14,.14);border-radius:10px}
.gen-attn-body{display:flex;flex-direction:column;gap:2px;min-width:0;flex:1}
.gen-attn-type{font-size:.72rem;font-weight:800;color:#496674}
.gen-attn-desc{font-size:.84rem;color:#17313a;line-height:1.4}
.gen-attn-meta{font-size:.7rem;color:#8a9fa5}

/* DashboardFocus orange accent card */
.dfc-orange .dfc-count{background:rgba(217,112,14,.12);color:#d9700e}
.dfc-orange.dfc-active{border-color:#d9700e!important;box-shadow:0 8px 22px rgba(217,112,14,.18)!important}
.dfc-orange.dfc-active .dfc-count{background:#d9700e;color:#fff}

`;