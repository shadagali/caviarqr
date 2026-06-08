'use client'

import { useRouter } from 'next/navigation'

export default function Home() {
  const router = useRouter()

  const buttons = [
    { label: 'Owner Login', path: '/login', primary: true },
    { label: 'Register Tags', path: '/login/register' },
    { label: 'Kitchen Login', path: '/login' },
    { label: 'Maintenance', path: '/maintenance' },
  ]

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@200;300&family=Playfair+Display:wght@300;400&display=swap');

        *, *::before, *::after { margin: 0; padding: 0; box-sizing: border-box; }

        :root {
          --cream: #F5F4F0;
          --cream-light: #F8F7F3;
          --gold: #8B7355;
          --gold-light: #B09A78;
          --ink: #1C140A;
        }

        html, body { height: 100%; background: var(--cream); }

        .root {
          min-height: 100vh;
          width: 100%;
          display: flex;
          align-items: center;
          justify-content: center;
          background:
            radial-gradient(ellipse 120% 80% at 50% -5%, rgba(235,233,225,0.6) 0%, transparent 55%),
            radial-gradient(ellipse 70% 50% at 90% 110%, rgba(210,205,190,0.2) 0%, transparent 55%),
            radial-gradient(ellipse 60% 40% at 5% 95%, rgba(220,218,210,0.15) 0%, transparent 55%),
            linear-gradient(175deg, #F8F7F3 0%, #F5F4F0 50%, #F0EEE9 100%);
          position: relative;
          overflow: hidden;
          padding: 3rem;
          font-family: 'Cormorant Garamond', Georgia, serif;
        }

        .grain {
          position: fixed;
          inset: -100px;
          width: calc(100% + 200px);
          height: calc(100% + 200px);
          opacity: 0.045;
          pointer-events: none;
          z-index: 0;
          background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='300' height='300'%3E%3Cfilter id='f'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='4' stitchTiles='stitch'/%3E%3CfeColorMatrix type='saturate' values='0'/%3E%3C/filter%3E%3Crect width='300' height='300' filter='url(%23f)'/%3E%3C/svg%3E");
          animation: shiftGrain 12s steps(8) infinite;
        }

        @keyframes shiftGrain {
          0%   { transform: translate(0,0) }
          12%  { transform: translate(-3%,-4%) }
          25%  { transform: translate(4%, 2%) }
          37%  { transform: translate(-2%, 5%) }
          50%  { transform: translate(5%,-3%) }
          62%  { transform: translate(-4%, 2%) }
          75%  { transform: translate(2%,-5%) }
          87%  { transform: translate(-5%, 3%) }
          100% { transform: translate(0,0) }
        }

        .frame {
          position: absolute;
          inset: 20px;
          pointer-events: none;
          z-index: 2;
        }

        .frame-line-h {
          position: absolute;
          height: 0.5px;
          background: linear-gradient(90deg, transparent, rgba(139,115,85,0.35) 20%, rgba(196,168,130,0.55) 50%, rgba(139,115,85,0.35) 80%, transparent);
          left: 0; right: 0;
        }
        .frame-line-h.top { top: 0; }
        .frame-line-h.bot { bottom: 0; }

        .frame-line-v {
          position: absolute;
          width: 0.5px;
          background: linear-gradient(180deg, transparent, rgba(139,115,85,0.25) 20%, rgba(139,115,85,0.35) 50%, rgba(139,115,85,0.25) 80%, transparent);
          top: 0; bottom: 0;
        }
        .frame-line-v.left { left: 0; }
        .frame-line-v.right { right: 0; }

        .corner-dot {
          position: absolute;
          width: 3px;
          height: 3px;
          background: rgba(139,115,85,0.45);
          transform: rotate(45deg);
        }
        .corner-dot.tl { top: -1.5px; left: -1.5px; }
        .corner-dot.tr { top: -1.5px; right: -1.5px; }
        .corner-dot.bl { bottom: -1.5px; left: -1.5px; }
        .corner-dot.br { bottom: -1.5px; right: -1.5px; }

        .content {
          position: relative;
          z-index: 10;
          display: flex;
          flex-direction: column;
          align-items: center;
          width: 100%;
          max-width: 300px;
        }

        .logo-name {
          font-family: Georgia, 'Times New Roman', Times, serif;
          font-weight: 400;
          font-size: clamp(2.6rem, 7vw, 3.4rem);
          letter-spacing: 0.18em;
          color: var(--ink);
          line-height: 1;
          text-transform: uppercase;
          text-align: center;
          margin-bottom: 3rem;
          user-select: none;
        }

        .logo-qr {
          color: var(--gold);
          font-weight: 400;
        }

        .nav-panel {
          width: 100%;
          display: flex;
          flex-direction: column;
          gap: 0.6rem;
        }

        .btn-primary {
          width: 100%;
          padding: 0.9rem 1.4rem;
          background: var(--ink);
          border: none;
          display: flex;
          align-items: center;
          justify-content: space-between;
          border-radius: 2px;
          box-shadow: 0 4px 16px rgba(28,20,10,0.18), 0 1px 4px rgba(28,20,10,0.12);
          transition: box-shadow 0.15s ease, transform 0.15s ease, background 0.15s ease;
        }
        .btn-primary:hover {
          background: #2a1d0d;
          box-shadow: 0 8px 28px rgba(28,20,10,0.26), 0 2px 8px rgba(28,20,10,0.16);
          transform: translateY(-1px);
        }
        .btn-primary:active { transform: translateY(0); box-shadow: 0 2px 8px rgba(28,20,10,0.18); }

        .btn-primary .lbl {
          font-family: 'Cormorant Garamond', Georgia, serif;
          font-weight: 300;
          font-size: 0.82rem;
          letter-spacing: 0.32em;
          text-transform: uppercase;
          color: var(--cream-light);
        }

        .btn-ghost {
          width: 100%;
          padding: 0.85rem 1.4rem;
          background: rgba(245,244,240,0.7);
          border: 0.5px solid rgba(139,115,85,0.18);
          display: flex;
          align-items: center;
          justify-content: space-between;
          border-radius: 2px;
          box-shadow: 0 2px 8px rgba(139,115,85,0.08), 0 1px 3px rgba(139,115,85,0.06);
          transition: box-shadow 0.15s ease, transform 0.15s ease, background 0.15s ease, border-color 0.15s ease;
          backdrop-filter: blur(4px);
        }
        .btn-ghost:hover {
          background: rgba(248,247,243,0.85);
          border-color: rgba(139,115,85,0.3);
          box-shadow: 0 6px 20px rgba(139,115,85,0.13), 0 2px 6px rgba(139,115,85,0.09);
          transform: translateY(-1px);
        }
        .btn-ghost:active { transform: translateY(0); box-shadow: 0 1px 4px rgba(139,115,85,0.1); }

        .btn-ghost .lbl {
          font-family: 'Cormorant Garamond', Georgia, serif;
          font-weight: 300;
          font-size: 0.82rem;
          letter-spacing: 0.28em;
          text-transform: uppercase;
          color: var(--ink);
          opacity: 0.7;
          transition: opacity 0.15s ease;
        }
        .btn-ghost:hover .lbl { opacity: 1; }

        .arrow { opacity: 0.4; transition: opacity 0.15s ease, transform 0.15s ease; }
        .btn-ghost:hover .arrow,
        .btn-primary:hover .arrow { opacity: 1; transform: translateX(2px); }

        .footer {
          margin-top: 2.5rem;
          display: flex;
          align-items: center;
          gap: 10px;
        }

        .footer-dash { width: 18px; height: 0.5px; background: rgba(139,115,85,0.3); }
        .footer-dot { width: 2px; height: 2px; border-radius: 50%; background: rgba(139,115,85,0.35); }
      `}</style>

      <div className="root">
        <div className="grain" />

        <div className="frame">
          <div className="frame-line-h top" />
          <div className="frame-line-h bot" />
          <div className="frame-line-v left" />
          <div className="frame-line-v right" />
          <div className="corner-dot tl" />
          <div className="corner-dot tr" />
          <div className="corner-dot bl" />
          <div className="corner-dot br" />
        </div>

        <div className="content">

          <div className="logo-name">
            Caviar<span className="logo-qr">QR</span>
          </div>

          <nav className="nav-panel">
            {buttons.map(({ label, path, primary }) =>
              primary ? (
                <button key={label} className="btn-primary" onClick={() => router.push(path)}>
                  <span className="lbl">{label}</span>
                  <span className="arrow">
                    <svg width="16" height="8" viewBox="0 0 16 8" fill="none">
                      <path d="M0 4H14M10 1L14 4L10 7" stroke="#B09A78" strokeWidth="0.75" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </span>
                </button>
              ) : (
                <button key={label} className="btn-ghost" onClick={() => router.push(path)}>
                  <span className="lbl">{label}</span>
                  <span className="arrow">
                    <svg width="14" height="8" viewBox="0 0 14 8" fill="none">
                      <path d="M0 4H12M8 1L12 4L8 7" stroke="#8B7355" strokeWidth="0.75" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </span>
                </button>
              )
            )}
          </nav>

          <div className="footer">
            <div className="footer-dash" />
            <div className="footer-dot" />
            <div className="footer-dot" style={{ opacity: 0.5 }} />
            <div className="footer-dot" style={{ opacity: 0.25 }} />
            <div className="footer-dash" />
          </div>

        </div>
      </div>
    </>
  )
}