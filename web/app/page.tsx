'use client'

import {
  FormEvent,
  useEffect,
  useState,
} from 'react'

import {
  useRouter,
} from 'next/navigation'

import HardwareShop from './_components/HardwareShop'

const API = (
  process.env.NEXT_PUBLIC_API_URL?.trim() ||
  (process.env.NODE_ENV === 'development'
    ? 'http://localhost:3001'
    : '')
).replace(/\/+$/, '')

export default function Home() {
  const router = useRouter()

  const [demoOpen, setDemoOpen] =
    useState(false)

  const [email, setEmail] =
    useState('')

  const [phone, setPhone] =
    useState('')

  const [message, setMessage] =
    useState('')

  const [submitting, setSubmitting] =
    useState(false)

  const [formError, setFormError] =
    useState('')

  const [submitted, setSubmitted] =
    useState(false)

  useEffect(() => {
    if (!demoOpen) {
      return
    }

    const onKeyDown = (
      event: KeyboardEvent,
    ) => {
      if (event.key === 'Escape') {
        setDemoOpen(false)
      }
    }

    document.addEventListener(
      'keydown',
      onKeyDown,
    )

    return () =>
      document.removeEventListener(
        'keydown',
        onKeyDown,
      )
  }, [demoOpen])

  function openDemo() {
    setFormError('')
    setSubmitted(false)
    setDemoOpen(true)
  }

  async function submitDemo(
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault()

    const cleanEmail =
      email.trim()

    const cleanPhone =
      phone.trim()

    const cleanMessage =
      message.trim()

    if (
      !cleanEmail ||
      !cleanPhone ||
      !cleanMessage
    ) {
      setFormError(
        'Please complete all three fields.',
      )
      return
    }

    if (!API) {
      setFormError(
        'Demo requests are temporarily unavailable. Please email caviarqr@gmail.com.',
      )
      return
    }

    try {
      setSubmitting(true)
      setFormError('')

      const response =
        await fetch(
          `${API}/demo-requests`,
          {
            method: 'POST',
            headers: {
              'Content-Type':
                'application/json',
            },
            body: JSON.stringify({
              email: cleanEmail,
              phone: cleanPhone,
              message:
                cleanMessage,
            }),
          },
        )

      const data =
        await response
          .json()
          .catch(() => ({}))

      if (!response.ok) {
        throw new Error(
          Array.isArray(data?.message)
            ? data.message[0]
            : data?.message ||
                'Your request could not be submitted.',
        )
      }

      setSubmitted(true)
      setEmail('')
      setPhone('')
      setMessage('')
    } catch (error) {
      setFormError(
        error instanceof Error
          ? error.message
          : 'Your request could not be submitted.',
      )
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <>
      <main className="home-shell">
        <div className="ambient ambient-one" />
        <div className="ambient ambient-two" />
        <div className="grid-glow" />

        <header className="site-header">
          <button
            type="button"
            className="brand"
            onClick={() =>
              window.scrollTo({
                top: 0,
                behavior: 'smooth',
              })
            }
            aria-label="CaviarQR home"
          >
            <span>Caviar</span>
            <strong>QR</strong>
          </button>

          <div className="header-actions">
            <button
              type="button"
              className="text-button"
              onClick={() =>
                router.push('/login-register')
              }
            >
              Login/Register
            </button>

            <button
              type="button"
              className="solid-button compact"
              onClick={openDemo}
            >
              Book demo
            </button>
          </div>
        </header>

        <section className="hero">
          <div className="hero-copy">
            <div className="eyebrow">
              <span className="eyebrow-dot" />
              QR/NFC solutions
            </div>

            <h1>
              Power your business
              <br />
              with <span>CaviarQR</span>
            </h1>

            <p className="hero-subtitle">
              One modern layer for ordering,
              payments, customer engagement,
              and restaurant operations.
            </p>

            <div className="hero-actions">
              <button
                type="button"
                className="solid-button"
                onClick={openDemo}
              >
                Book demo
                <span aria-hidden="true">
                  →
                </span>
              </button>

              <button
                type="button"
                className="outline-button"
                onClick={() =>
                  router.push('/login-register')
                }
              >
                Login/Register
              </button>
            </div>

            <div className="trust-row">
              <div>
                <span className="trust-icon">
                  ✓
                </span>
                No app download
              </div>
              <div>
                <span className="trust-icon">
                  ✓
                </span>
                QR + NFC ready
              </div>
              <div>
                <span className="trust-icon">
                  ✓
                </span>
                Built for restaurants
              </div>
            </div>
          </div>

          <div className="hero-visual" aria-hidden="true">
            <div className="orbit orbit-one" />
            <div className="orbit orbit-two" />

            <div className="visual-card">
              <div className="card-top">
                <div className="mini-brand">
                  Caviar<span>QR</span>
                </div>
                <div className="status-pill">
                  Live
                </div>
              </div>

              <div className="device-panel">
                <div className="qr-box">
                  <div className="qr-corner a" />
                  <div className="qr-corner b" />
                  <div className="qr-corner c" />
                  <div className="qr-pixels">
                    {Array.from({
                      length: 42,
                    }).map((_, index) => (
                      <i
                        key={index}
                        className={
                          [
                            0, 1, 3, 4, 6, 8,
                            10, 11, 12, 15, 17,
                            20, 22, 23, 25, 27,
                            29, 31, 33, 34, 36,
                            38, 39, 41,
                          ].includes(index)
                            ? 'on'
                            : ''
                        }
                      />
                    ))}
                  </div>
                </div>

                <div className="tap-mark">
                  <div className="tap-wave one" />
                  <div className="tap-wave two" />
                  <div className="tap-wave three" />
                  <div className="tap-core" />
                  <span>Tap</span>
                </div>
              </div>

              <div className="flow-line">
                <span>Scan or tap</span>
                <b>→</b>
                <span>Order</span>
                <b>→</b>
                <span>Pay</span>
              </div>
            </div>

            <div className="floating-note note-one">
              <span className="note-icon">⚡</span>
              <div>
                <small>Fast checkout</small>
                <strong>Ready in seconds</strong>
              </div>
            </div>

            <div className="floating-note note-two">
              <span className="note-icon">◎</span>
              <div>
                <small>Direct to table</small>
                <strong>QR + NFC</strong>
              </div>
            </div>
          </div>
        </section>


        {/* CAVIARQR_HOME_SHOP_V1 */}
        <section
          id="shop"
          className="home-shop-section"
        >
          <div className="home-shop-heading">
            <div className="modal-eyebrow">
              CaviarQR shop
            </div>

            <h2>
              Shop
            </h2>

            <p>
              Order CaviarQR hardware and QR/NFC
              products directly from CaviarQR.
            </p>
          </div>

          <div className="embedded-shop">
            <HardwareShop />
          </div>
        </section>

        <footer className="home-footer">
          <span>© {new Date().getFullYear()} CaviarQR, Inc.</span>
          <a href="mailto:caviarqr@gmail.com">
            caviarqr@gmail.com
          </a>
        </footer>
      </main>

      {demoOpen && (
        <div
          className="modal-backdrop"
          role="presentation"
          onMouseDown={(event) => {
            if (
              event.target ===
              event.currentTarget
            ) {
              setDemoOpen(false)
            }
          }}
        >
          <section
            className="demo-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="demo-title"
          >
            <button
              type="button"
              className="close-button"
              aria-label="Close demo request"
              onClick={() =>
                setDemoOpen(false)
              }
            >
              ×
            </button>

            {!submitted ? (
              <>
                <div className="modal-eyebrow">
                  CaviarQR demo
                </div>
                <h2 id="demo-title">
                  See CaviarQR in action.
                </h2>
                <p>
                  Tell us how to reach you and
                  what you want to solve. Your
                  request goes directly to the
                  CaviarQR team.
                </p>

                <form
                  className="demo-form"
                  onSubmit={submitDemo}
                >
                  <label>
                    <span>Email</span>
                    <input
                      type="email"
                      autoComplete="email"
                      required
                      maxLength={320}
                      value={email}
                      onChange={(event) =>
                        setEmail(
                          event.target.value,
                        )
                      }
                      placeholder="you@restaurant.com"
                    />
                  </label>

                  <label>
                    <span>Phone number</span>
                    <input
                      type="tel"
                      autoComplete="tel"
                      required
                      minLength={7}
                      maxLength={40}
                      value={phone}
                      onChange={(event) =>
                        setPhone(
                          event.target.value,
                        )
                      }
                      placeholder="+1 555 000 0000"
                    />
                  </label>

                  <label>
                    <span>Message</span>
                    <textarea
                      required
                      minLength={2}
                      maxLength={2000}
                      value={message}
                      onChange={(event) =>
                        setMessage(
                          event.target.value,
                        )
                      }
                      placeholder="Tell us about your restaurant or what you'd like to see."
                    />
                  </label>

                  {formError && (
                    <div
                      className="form-error"
                      role="alert"
                    >
                      {formError}
                    </div>
                  )}

                  <button
                    type="submit"
                    className="solid-button submit-button"
                    disabled={submitting}
                  >
                    {submitting
                      ? 'Sending…'
                      : 'Request demo'}
                    {!submitting && (
                      <span aria-hidden="true">
                        →
                      </span>
                    )}
                  </button>
                </form>
              </>
            ) : (
              <div className="success-state">
                <div className="success-check">
                  ✓
                </div>
                <div className="modal-eyebrow">
                  Request received
                </div>
                <h2 id="demo-title">
                  We have your details.
                </h2>
                <p>
                  Your demo request is now in
                  the CaviarQR Maintenance
                  console for follow-up.
                </p>
                <button
                  type="button"
                  className="solid-button submit-button"
                  onClick={() =>
                    setDemoOpen(false)
                  }
                >
                  Done
                </button>
              </div>
            )}
          </section>
        </div>
      )}

      <style jsx>{`
        :global(*) {
          box-sizing: border-box;
        }

        :global(html),
        :global(body) {
          margin: 0;
          min-height: 100%;
          background: #f7f5ef;
        }

        :global(body) {
          color: #17140f;
        }

        button,
        input,
        textarea {
          font: inherit;
        }

        button {
          cursor: pointer;
        }


        .home-shop-section {
          position: relative;
          z-index: 4;
          width: min(1240px, 100%);
          margin: 0 auto;
          padding: 80px 0 70px;
          border-top: 1px solid rgba(23, 20, 15, 0.10);
        }

        .home-shop-heading {
          max-width: 650px;
          margin: 0 auto 36px;
          text-align: center;
        }

        .home-shop-heading h2 {
          margin: 12px 0 12px;
          color: var(--ink);
          font-family: Georgia, "Times New Roman", serif;
          font-size: clamp(42px, 5vw, 68px);
          font-weight: 400;
          letter-spacing: -0.04em;
        }

        .home-shop-heading p {
          margin: 0;
          color: var(--muted);
          font-size: 16px;
          line-height: 1.65;
        }

        .embedded-shop {
          position: relative;
          width: 100%;
          overflow: hidden;
          border-radius: 28px;
        }

        .home-shell {
          --ink: #17140f;
          --muted: #6d675e;
          --cream: #f7f5ef;
          --paper: #fffefa;
          --gold: #9c7a43;
          --gold-soft: #d8c39c;
          position: relative;
          min-height: 100vh;
          overflow: hidden;
          padding: 28px clamp(22px, 5vw, 72px) 24px;
          background:
            radial-gradient(circle at 72% 28%, rgba(202, 177, 132, 0.16), transparent 28%),
            radial-gradient(circle at 10% 90%, rgba(173, 150, 111, 0.10), transparent 26%),
            linear-gradient(135deg, #fbfaf6 0%, #f7f5ef 52%, #f1ede4 100%);
          font-family: Inter, ui-sans-serif, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
        }

        .ambient {
          position: absolute;
          border-radius: 999px;
          filter: blur(1px);
          pointer-events: none;
        }

        .ambient-one {
          width: 440px;
          height: 440px;
          right: -180px;
          top: 4%;
          border: 1px solid rgba(156, 122, 67, 0.13);
          box-shadow:
            0 0 0 70px rgba(156, 122, 67, 0.025),
            0 0 0 140px rgba(156, 122, 67, 0.02);
        }

        .ambient-two {
          width: 360px;
          height: 360px;
          left: -210px;
          bottom: -120px;
          border: 1px solid rgba(156, 122, 67, 0.11);
          box-shadow:
            0 0 0 60px rgba(156, 122, 67, 0.022),
            0 0 0 120px rgba(156, 122, 67, 0.018);
        }

        .grid-glow {
          position: absolute;
          inset: 0;
          opacity: 0.16;
          pointer-events: none;
          background-image:
            linear-gradient(rgba(83, 72, 55, 0.055) 1px, transparent 1px),
            linear-gradient(90deg, rgba(83, 72, 55, 0.055) 1px, transparent 1px);
          background-size: 42px 42px;
          mask-image: linear-gradient(to bottom, transparent 0%, #000 38%, transparent 88%);
        }

        .site-header {
          position: relative;
          z-index: 5;
          width: min(1240px, 100%);
          margin: 0 auto;
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 4px 0 20px;
        }

        .brand {
          border: 0;
          padding: 0;
          background: transparent;
          color: var(--ink);
          font-family: Georgia, "Times New Roman", serif;
          font-size: 21px;
          letter-spacing: 0.03em;
        }

        .brand strong {
          color: var(--gold);
          font-weight: 600;
        }

        .header-actions,
        .hero-actions {
          display: flex;
          align-items: center;
          gap: 10px;
        }

        .text-button {
          border: 0;
          background: transparent;
          color: var(--ink);
          padding: 10px 15px;
          font-size: 14px;
          font-weight: 650;
        }

        .solid-button,
        .outline-button {
          min-height: 48px;
          border-radius: 999px;
          padding: 0 22px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 14px;
          border: 1px solid transparent;
          transition:
            transform 150ms ease,
            box-shadow 150ms ease,
            background 150ms ease;
          font-weight: 700;
          font-size: 14px;
        }

        .solid-button {
          color: #fffdf8;
          background: var(--ink);
          box-shadow: 0 12px 30px rgba(23, 20, 15, 0.16);
        }

        .solid-button:hover {
          transform: translateY(-1px);
          background: #2a241b;
          box-shadow: 0 16px 36px rgba(23, 20, 15, 0.20);
        }

        .solid-button:disabled {
          opacity: 0.6;
          cursor: wait;
          transform: none;
        }

        .solid-button.compact {
          min-height: 40px;
          padding: 0 18px;
          box-shadow: none;
        }

        .outline-button {
          color: var(--ink);
          background: rgba(255, 254, 250, 0.58);
          border-color: rgba(23, 20, 15, 0.16);
        }

        .outline-button:hover {
          transform: translateY(-1px);
          background: rgba(255, 254, 250, 0.92);
        }

        .hero {
          position: relative;
          z-index: 4;
          width: min(1240px, 100%);
          min-height: calc(100vh - 148px);
          margin: 0 auto;
          display: grid;
          grid-template-columns: minmax(0, 1.05fr) minmax(390px, 0.95fr);
          align-items: center;
          gap: clamp(48px, 8vw, 120px);
          padding: 68px 0 86px;
        }

        .hero-copy {
          max-width: 700px;
        }

        .eyebrow,
        .modal-eyebrow {
          display: inline-flex;
          align-items: center;
          gap: 9px;
          color: var(--gold);
          font-size: 12px;
          font-weight: 800;
          letter-spacing: 0.16em;
          text-transform: uppercase;
        }

        .eyebrow-dot {
          width: 7px;
          height: 7px;
          border-radius: 50%;
          background: var(--gold);
          box-shadow: 0 0 0 5px rgba(156, 122, 67, 0.10);
        }

        h1 {
          margin: 24px 0 22px;
          max-width: 760px;
          color: var(--ink);
          font-family: Georgia, "Times New Roman", serif;
          font-size: clamp(52px, 6.6vw, 92px);
          font-weight: 400;
          letter-spacing: -0.055em;
          line-height: 0.98;
        }

        h1 span {
          color: var(--gold);
        }

        .hero-subtitle {
          max-width: 585px;
          margin: 0;
          color: var(--muted);
          font-size: clamp(16px, 1.6vw, 19px);
          line-height: 1.65;
        }

        .hero-actions {
          margin-top: 34px;
        }

        .trust-row {
          display: flex;
          flex-wrap: wrap;
          gap: 13px 22px;
          margin-top: 30px;
          color: #716b62;
          font-size: 12px;
          font-weight: 650;
        }

        .trust-row > div {
          display: flex;
          align-items: center;
          gap: 7px;
        }

        .trust-icon {
          color: var(--gold);
          font-size: 11px;
        }

        .hero-visual {
          position: relative;
          min-height: 520px;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .orbit {
          position: absolute;
          border: 1px solid rgba(156, 122, 67, 0.13);
          border-radius: 50%;
        }

        .orbit-one {
          width: 470px;
          height: 470px;
        }

        .orbit-two {
          width: 355px;
          height: 355px;
          border-style: dashed;
          opacity: 0.62;
        }

        .visual-card {
          position: relative;
          z-index: 3;
          width: min(390px, 90%);
          border: 1px solid rgba(66, 55, 39, 0.12);
          border-radius: 30px;
          padding: 24px;
          background: rgba(255, 254, 250, 0.82);
          box-shadow:
            0 40px 90px rgba(61, 49, 31, 0.14),
            inset 0 1px 0 rgba(255, 255, 255, 0.8);
          backdrop-filter: blur(18px);
          transform: rotate(-2deg);
        }

        .card-top {
          display: flex;
          align-items: center;
          justify-content: space-between;
        }

        .mini-brand {
          font-family: Georgia, "Times New Roman", serif;
          font-size: 18px;
        }

        .mini-brand span {
          color: var(--gold);
        }

        .status-pill {
          border-radius: 999px;
          padding: 7px 10px;
          background: #eff8ee;
          color: #2f6e35;
          font-size: 10px;
          font-weight: 800;
          letter-spacing: 0.08em;
          text-transform: uppercase;
        }

        .device-panel {
          margin-top: 22px;
          min-height: 290px;
          border-radius: 23px;
          display: grid;
          grid-template-columns: 1fr 0.78fr;
          align-items: center;
          gap: 18px;
          padding: 24px;
          background:
            radial-gradient(circle at 70% 15%, rgba(190, 158, 103, 0.16), transparent 32%),
            #191711;
        }

        .qr-box {
          position: relative;
          aspect-ratio: 1;
          border-radius: 18px;
          background: #fffef9;
          padding: 19px;
          box-shadow: 0 14px 30px rgba(0, 0, 0, 0.18);
        }

        .qr-pixels {
          width: 100%;
          height: 100%;
          display: grid;
          grid-template-columns: repeat(7, 1fr);
          grid-template-rows: repeat(6, 1fr);
          gap: 3px;
        }

        .qr-pixels i {
          border-radius: 2px;
          background: transparent;
        }

        .qr-pixels i.on {
          background: #191711;
        }

        .qr-corner {
          position: absolute;
          width: 36px;
          height: 36px;
          border: 6px solid #191711;
          border-radius: 3px;
          background: #fffef9;
          z-index: 2;
        }

        .qr-corner::after {
          content: '';
          position: absolute;
          inset: 6px;
          background: #191711;
        }

        .qr-corner.a {
          top: 15px;
          left: 15px;
        }

        .qr-corner.b {
          top: 15px;
          right: 15px;
        }

        .qr-corner.c {
          bottom: 15px;
          left: 15px;
        }

        .tap-mark {
          position: relative;
          height: 150px;
          display: flex;
          align-items: flex-end;
          justify-content: center;
          padding-bottom: 4px;
          color: #e9dbc1;
          font-size: 12px;
          font-weight: 750;
          letter-spacing: 0.12em;
          text-transform: uppercase;
        }

        .tap-core {
          position: absolute;
          left: 50%;
          top: 43%;
          width: 13px;
          height: 13px;
          border-radius: 50%;
          background: #d5b77e;
          transform: translate(-50%, -50%);
          box-shadow: 0 0 0 8px rgba(213, 183, 126, 0.08);
        }

        .tap-wave {
          position: absolute;
          left: 50%;
          top: 43%;
          border: 2px solid rgba(213, 183, 126, 0.82);
          border-left-color: transparent;
          border-bottom-color: transparent;
          border-radius: 50%;
          transform: translate(-50%, -50%) rotate(45deg);
        }

        .tap-wave.one {
          width: 48px;
          height: 48px;
        }

        .tap-wave.two {
          width: 78px;
          height: 78px;
          opacity: 0.68;
        }

        .tap-wave.three {
          width: 108px;
          height: 108px;
          opacity: 0.36;
        }

        .flow-line {
          margin-top: 20px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 10px;
          color: #6d675e;
          font-size: 11px;
          font-weight: 700;
        }

        .flow-line b {
          color: var(--gold);
          font-weight: 500;
        }

        .floating-note {
          position: absolute;
          z-index: 4;
          display: flex;
          align-items: center;
          gap: 10px;
          min-width: 174px;
          border: 1px solid rgba(68, 57, 40, 0.10);
          border-radius: 16px;
          padding: 12px 14px;
          background: rgba(255, 254, 250, 0.88);
          box-shadow: 0 18px 46px rgba(61, 49, 31, 0.13);
          backdrop-filter: blur(14px);
        }

        .note-one {
          top: 66px;
          right: -14px;
        }

        .note-two {
          left: -28px;
          bottom: 76px;
        }

        .note-icon {
          width: 32px;
          height: 32px;
          border-radius: 10px;
          display: grid;
          place-items: center;
          background: #f3ecdf;
          color: var(--gold);
          font-size: 14px;
        }

        .floating-note small,
        .floating-note strong {
          display: block;
        }

        .floating-note small {
          color: #81796e;
          font-size: 9px;
          margin-bottom: 2px;
        }

        .floating-note strong {
          color: #302a22;
          font-size: 11px;
        }

        .home-footer {
          position: relative;
          z-index: 4;
          width: min(1240px, 100%);
          margin: 0 auto;
          min-height: 46px;
          border-top: 1px solid rgba(23, 20, 15, 0.10);
          display: flex;
          align-items: flex-end;
          justify-content: space-between;
          gap: 20px;
          padding-top: 18px;
          color: #888075;
          font-size: 11px;
        }

        .home-footer a {
          color: inherit;
          text-decoration: none;
        }

        .home-footer a:hover {
          color: var(--ink);
        }

        .modal-backdrop {
          position: fixed;
          z-index: 50;
          inset: 0;
          display: grid;
          place-items: center;
          padding: 20px;
          background: rgba(22, 18, 13, 0.56);
          backdrop-filter: blur(10px);
          font-family: Inter, ui-sans-serif, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
        }

        .demo-modal {
          position: relative;
          width: min(540px, 100%);
          max-height: calc(100vh - 40px);
          overflow-y: auto;
          border: 1px solid rgba(23, 20, 15, 0.10);
          border-radius: 28px;
          padding: clamp(26px, 5vw, 42px);
          background: #fffefa;
          box-shadow: 0 28px 90px rgba(0, 0, 0, 0.24);
        }

        .close-button {
          position: absolute;
          top: 17px;
          right: 17px;
          width: 38px;
          height: 38px;
          border: 1px solid rgba(23, 20, 15, 0.10);
          border-radius: 50%;
          background: #f7f4ed;
          color: #554f46;
          font-size: 24px;
          line-height: 1;
        }

        .demo-modal h2 {
          margin: 14px 36px 10px 0;
          color: #17140f;
          font-family: Georgia, "Times New Roman", serif;
          font-size: clamp(31px, 5vw, 42px);
          font-weight: 400;
          letter-spacing: -0.035em;
          line-height: 1.05;
        }

        .demo-modal > p,
        .success-state > p {
          margin: 0;
          color: #6d675e;
          font-size: 14px;
          line-height: 1.65;
        }

        .demo-form {
          display: grid;
          gap: 15px;
          margin-top: 26px;
        }

        .demo-form label {
          display: grid;
          gap: 7px;
        }

        .demo-form label > span {
          color: #554f46;
          font-size: 11px;
          font-weight: 800;
        }

        .demo-form input,
        .demo-form textarea {
          width: 100%;
          border: 1px solid rgba(23, 20, 15, 0.13);
          border-radius: 13px;
          outline: none;
          background: #fbfaf6;
          color: #17140f;
          padding: 13px 14px;
          transition:
            border-color 120ms ease,
            box-shadow 120ms ease,
            background 120ms ease;
          font-size: 14px;
        }

        .demo-form textarea {
          min-height: 120px;
          resize: vertical;
          line-height: 1.5;
        }

        .demo-form input:focus,
        .demo-form textarea:focus {
          border-color: rgba(156, 122, 67, 0.55);
          background: #fffefa;
          box-shadow: 0 0 0 4px rgba(156, 122, 67, 0.09);
        }

        .form-error {
          border: 1px solid #f0c8c2;
          border-radius: 12px;
          padding: 10px 12px;
          background: #fff5f3;
          color: #a33a2e;
          font-size: 12px;
          line-height: 1.4;
        }

        .submit-button {
          width: 100%;
          margin-top: 2px;
        }

        .success-state {
          text-align: center;
          padding: 22px 4px 6px;
        }

        .success-check {
          width: 58px;
          height: 58px;
          margin: 0 auto 18px;
          border-radius: 50%;
          display: grid;
          place-items: center;
          background: #eef6ea;
          color: #3a7338;
          font-size: 24px;
          font-weight: 800;
        }

        .success-state .submit-button {
          margin-top: 24px;
        }

        @media (max-width: 980px) {
          .hero {
            grid-template-columns: 1fr;
            padding-top: 72px;
          }

          .hero-copy {
            max-width: 760px;
          }

          .hero-visual {
            width: min(620px, 100%);
            margin: 0 auto;
          }
        }

        @media (max-width: 640px) {
          .home-shell {
            padding: 19px 18px 20px;
          }

          .site-header {
            padding-bottom: 10px;
          }

          .header-actions {
            gap: 2px;
          }

          .text-button {
            padding: 9px 10px;
          }

          .solid-button.compact {
            min-height: 38px;
            padding: 0 14px;
          }

          .hero {
            min-height: auto;
            padding: 74px 0 54px;
            gap: 46px;
          }

          h1 {
            font-size: clamp(46px, 15vw, 65px);
          }

          .hero-actions {
            align-items: stretch;
            flex-direction: column;
          }

          .hero-actions .solid-button,
          .hero-actions .outline-button {
            width: 100%;
          }

          .trust-row {
            display: grid;
            grid-template-columns: 1fr;
          }

          .hero-visual {
            min-height: 420px;
          }

          .orbit-one {
            width: 360px;
            height: 360px;
          }

          .orbit-two {
            width: 280px;
            height: 280px;
          }

          .visual-card {
            width: min(340px, 95%);
            padding: 18px;
          }

          .device-panel {
            min-height: 245px;
            padding: 18px;
          }

          .note-one {
            top: 18px;
            right: -5px;
          }

          .note-two {
            left: -4px;
            bottom: 28px;
          }

          .floating-note {
            min-width: 148px;
            padding: 10px 11px;
          }

          .home-footer {
            align-items: flex-start;
            flex-direction: column;
            gap: 7px;
          }
        }
      `}</style>
    </>
  )
}
