"use client"

import {
  FormEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react"

import {
  useParams,
} from "next/navigation"

type SupportMessage = {
  id: number
  senderType:
    | "CUSTOMER"
    | "RESTAURANT"
    | "CAVIARQR"
    | "SYSTEM"
  senderName: string | null
  message: string
  metadata:
    | Record<string, unknown>
    | null
  createdAt: string
}

type OrderItem = {
  id?: string | number
  name: string
  qty: number
  price: number
  note?: string
}

type SupportThreadData = {
  id: string
  status:
    | "AVAILABLE"
    | "AWAITING_RESTAURANT"
    | "AWAITING_CUSTOMER"
    | "RESOLVED"
    | "REFUNDED"
  cafeName: string
  order: {
    id: number
    items: OrderItem[]
    total: number
    currency: string
    tableNumber: number | null
    status: string
    refundProcessed: boolean
    refundAmount: number | null
    createdAt: string
  }
  messages: SupportMessage[]
}

const API =
  String(
    process.env
      .NEXT_PUBLIC_API_URL ||
      "http://localhost:3001",
  ).replace(
    /\/+$/,
    "",
  )

function money(
  value: number,
  currency: string,
) {
  const normalized =
    String(
      currency || "usd",
    ).toLowerCase() === "inr"
      ? "INR"
      : "USD"

  return new Intl.NumberFormat(
    normalized === "INR"
      ? "en-IN"
      : "en-US",
    {
      style: "currency",
      currency: normalized,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    },
  ).format(
    Number(value || 0),
  )
}

function timeLabel(
  value: string,
) {
  const date =
    new Date(value)

  if (
    Number.isNaN(
      date.getTime(),
    )
  ) {
    return ""
  }

  return date.toLocaleString(
    [],
    {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    },
  )
}

function getErrorMessage(
  error: unknown,
) {
  if (
    error instanceof Error &&
    error.message
  ) {
    return error.message
  }

  return "Something went wrong. Please try again."
}

const styles = `
  :root {
    --accent: #ff3008;
    --ink: #191919;
    --muted: #747474;
    --line: #ececec;
    --soft: #f7f7f7;
    --soft-red: #fff6f3;
    --green: #18794e;
  }

  * {
    box-sizing: border-box;
  }

  body {
    margin: 0;
    background: #f5f5f3;
  }

  .help-shell {
    min-height: 100vh;
    padding: 20px 14px 40px;
    font-family:
      Inter,
      ui-sans-serif,
      system-ui,
      -apple-system,
      BlinkMacSystemFont,
      "Segoe UI",
      sans-serif;
    color: var(--ink);
  }

  .help-wrap {
    width: 100%;
    max-width: 620px;
    margin: 0 auto;
  }

  .brand {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 12px;
  }

  .brand-name {
    font-size: 15px;
    font-weight: 900;
    letter-spacing: .05em;
    color: var(--accent);
  }

  .secure-label {
    font-size: 11px;
    font-weight: 700;
    color: var(--muted);
  }

  .card {
    background: #fff;
    border: 1px solid var(--line);
    border-radius: 22px;
    box-shadow:
      0 14px 40px
      rgba(0,0,0,.055);
    overflow: hidden;
  }

  .order-head {
    padding: 22px;
    border-bottom:
      1px solid var(--line);
  }

  .eyebrow {
    margin: 0;
    font-size: 11px;
    font-weight: 800;
    letter-spacing: .09em;
    text-transform: uppercase;
    color: var(--muted);
  }

  .cafe-name {
    margin: 6px 0 2px;
    font-size: 26px;
    line-height: 1.15;
    font-weight: 900;
    letter-spacing: -.035em;
  }

  .order-meta {
    margin-top: 7px;
    font-size: 13px;
    font-weight: 600;
    color: var(--muted);
  }

  .total-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 16px;
    margin-top: 18px;
    padding-top: 16px;
    border-top:
      1px solid var(--line);
  }

  .total-label {
    font-size: 13px;
    font-weight: 700;
    color: var(--muted);
  }

  .total-value {
    font-size: 20px;
    font-weight: 900;
  }

  .status-pill {
    display: inline-flex;
    align-items: center;
    gap: 7px;
    margin-top: 14px;
    padding: 7px 10px;
    border-radius: 999px;
    background: var(--soft);
    font-size: 11px;
    font-weight: 800;
  }

  .status-dot {
    width: 7px;
    height: 7px;
    border-radius: 50%;
    background: var(--accent);
  }

  .items {
    padding: 8px 22px 18px;
  }

  .item {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 16px;
    padding: 12px 0;
    border-bottom:
      1px solid var(--line);
  }

  .item:last-child {
    border-bottom: none;
  }

  .item-name {
    font-size: 14px;
    font-weight: 800;
  }

  .item-note {
    margin-top: 3px;
    font-size: 12px;
    color: var(--muted);
  }

  .item-price {
    white-space: nowrap;
    font-size: 13px;
    font-weight: 800;
  }

  .section {
    margin-top: 14px;
    padding: 20px;
  }

  .section-title {
    margin: 0;
    font-size: 18px;
    font-weight: 900;
  }

  .section-sub {
    margin: 5px 0 0;
    font-size: 13px;
    line-height: 1.5;
    color: var(--muted);
  }

  .conversation {
    margin-top: 18px;
    display: flex;
    flex-direction: column;
    gap: 10px;
    max-height: 440px;
    overflow-y: auto;
    padding-right: 2px;
  }

  .empty-chat {
    border:
      1px dashed #d9d9d9;
    border-radius: 16px;
    padding: 22px 16px;
    text-align: center;
    font-size: 13px;
    line-height: 1.5;
    color: var(--muted);
    background: var(--soft);
  }

  .bubble-wrap {
    display: flex;
    flex-direction: column;
    max-width: 85%;
  }

  .bubble-wrap.customer {
    align-self: flex-end;
    align-items: flex-end;
  }

  .bubble-wrap.other {
    align-self: flex-start;
    align-items: flex-start;
  }

  .bubble {
    padding: 11px 13px;
    border-radius: 15px;
    font-size: 14px;
    line-height: 1.48;
    white-space: pre-wrap;
    overflow-wrap: anywhere;
  }

  .bubble.customer {
    color: #fff;
    background: var(--accent);
    border-bottom-right-radius: 5px;
  }

  .bubble.other {
    color: var(--ink);
    background: var(--soft);
    border:
      1px solid var(--line);
    border-bottom-left-radius: 5px;
  }

  .bubble-meta {
    margin-top: 4px;
    padding: 0 3px;
    font-size: 10px;
    font-weight: 650;
    color: #929292;
  }

  .composer {
    margin-top: 16px;
    border-top:
      1px solid var(--line);
    padding-top: 16px;
  }

  .textarea {
    width: 100%;
    min-height: 92px;
    resize: vertical;
    border:
      1px solid #d9d9d9;
    border-radius: 14px;
    padding: 13px 14px;
    outline: none;
    font: inherit;
    font-size: 14px;
    line-height: 1.45;
    color: var(--ink);
    background: #fff;
  }

  .textarea:focus {
    border-color:
      var(--accent);
    box-shadow:
      0 0 0 3px
      rgba(255,48,8,.09);
  }

  .composer-foot {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    margin-top: 10px;
  }

  .char-count {
    font-size: 11px;
    color: var(--muted);
  }

  .send-btn {
    min-width: 106px;
    border: none;
    border-radius: 12px;
    padding: 11px 16px;
    background: var(--accent);
    color: #fff;
    font: inherit;
    font-size: 13px;
    font-weight: 900;
    cursor: pointer;
  }

  .send-btn:disabled {
    opacity: .45;
    cursor: not-allowed;
  }

  .closed-box {
    margin-top: 16px;
    padding: 14px;
    border-radius: 14px;
    background: var(--soft);
    color: var(--muted);
    font-size: 13px;
    line-height: 1.5;
    text-align: center;
  }

  .refund-box {
    margin-top: 14px;
    padding: 14px;
    border:
      1px solid #cfe9dc;
    border-radius: 14px;
    background: #f2fbf6;
    color: var(--green);
    font-size: 13px;
    font-weight: 750;
  }

  .error-box {
    margin-bottom: 14px;
    padding: 12px 14px;
    border:
      1px solid #ffc8b9;
    border-radius: 12px;
    background:
      var(--soft-red);
    color: #a72e13;
    font-size: 13px;
    line-height: 1.45;
  }

  .loading-card {
    padding: 42px 20px;
    text-align: center;
    font-size: 14px;
    color: var(--muted);
  }

  .footer-note {
    margin-top: 18px;
    text-align: center;
    font-size: 11px;
    color: #969696;
  }

  @media (max-width: 560px) {
    .help-shell {
      padding:
        14px 10px 30px;
    }

    .order-head,
    .items,
    .section {
      padding-left: 17px;
      padding-right: 17px;
    }

    .cafe-name {
      font-size: 23px;
    }

    .bubble-wrap {
      max-width: 90%;
    }
  }
`

export default function CustomerHelpPage() {
  const params =
    useParams<{
      token: string
    }>()

  const token =
    useMemo(
      () =>
        String(
          params?.token ||
            "",
        ),
      [
        params?.token,
      ],
    )

  const [
    thread,
    setThread,
  ] =
    useState<
      SupportThreadData | null
    >(null)

  const [
    loading,
    setLoading,
  ] =
    useState(true)

  const [
    sending,
    setSending,
  ] =
    useState(false)

  const [
    message,
    setMessage,
  ] =
    useState("")

  const [
    error,
    setError,
  ] =
    useState("")

  const chatEndRef =
    useRef<HTMLDivElement | null>(
      null,
    )

  const loadThread =
    useCallback(
      async (
        quiet = false,
      ) => {
        if (!token) {
          return
        }

        if (!quiet) {
          setLoading(true)
        }

        try {
          const response =
            await fetch(
              `${API}/support/${encodeURIComponent(
                token,
              )}`,
              {
                method: "GET",
                cache:
                  "no-store",
              },
            )

          const data =
            await response
              .json()
              .catch(
                () => null,
              )

          if (!response.ok) {
            throw new Error(
              data?.message ||
                "This support conversation is unavailable.",
            )
          }

          setThread(
            data?.thread ||
              null,
          )

          setError("")
        } catch (err) {
          if (!quiet) {
            setError(
              getErrorMessage(
                err,
              ),
            )
          }
        } finally {
          if (!quiet) {
            setLoading(false)
          }
        }
      },
      [
        token,
      ],
    )

  useEffect(() => {
    void loadThread(
      false,
    )
  }, [
    loadThread,
  ])

  useEffect(() => {
    if (!token) {
      return
    }

    const interval =
      window.setInterval(
        () => {
          void loadThread(
            true,
          )
        },
        5_000,
      )

    return () =>
      window.clearInterval(
        interval,
      )
  }, [
    loadThread,
    token,
  ])

  useEffect(() => {
    if (
      !token ||
      !thread
    ) {
      return
    }

    void fetch(
      `${API}/support/${encodeURIComponent(
        token,
      )}/read`,
      {
        method:
          "POST",
      },
    ).catch(
      () => undefined,
    )
  }, [
    token,
    thread?.messages
      ?.length,
  ])

  useEffect(() => {
    chatEndRef
      .current
      ?.scrollIntoView({
        behavior:
          "smooth",
        block:
          "nearest",
      })
  }, [
    thread?.messages
      ?.length,
  ])

  async function submitMessage(
    event:
      FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault()

    const clean =
      message.trim()

    if (
      !clean ||
      sending ||
      !token
    ) {
      return
    }

    if (
      clean.length >
      2_000
    ) {
      setError(
        "Message must be 2,000 characters or less.",
      )
      return
    }

    try {
      setSending(true)
      setError("")

      const response =
        await fetch(
          `${API}/support/${encodeURIComponent(
            token,
          )}/messages`,
          {
            method:
              "POST",

            headers: {
              "Content-Type":
                "application/json",
            },

            body:
              JSON.stringify({
                message:
                  clean,
              }),
          },
        )

      const data =
        await response
          .json()
          .catch(
            () => null,
          )

      if (!response.ok) {
        throw new Error(
          data?.message ||
            "Could not send your message.",
        )
      }

      setMessage("")

      await loadThread(
        true,
      )
    } catch (err) {
      setError(
        getErrorMessage(
          err,
        ),
      )
    } finally {
      setSending(false)
    }
  }

  const isClosed =
    thread?.status ===
      "RESOLVED" ||
    thread?.status ===
      "REFUNDED"

  const statusText =
    thread?.status ===
      "AWAITING_RESTAURANT"
      ? "Waiting for restaurant response"
      : thread?.status ===
          "AWAITING_CUSTOMER"
        ? "Restaurant responded"
        : thread?.status ===
            "RESOLVED"
          ? "Conversation resolved"
          : thread?.status ===
              "REFUNDED"
            ? "Order refunded"
            : "Help available"

  return (
    <>
      <style>
        {styles}
      </style>

      <main className="help-shell">
        <div className="help-wrap">
          <div className="brand">
            <div className="brand-name">
              CAVIARQR
            </div>

            <div className="secure-label">
              Secure order support
            </div>
          </div>

          {error && (
            <div className="error-box">
              {error}
            </div>
          )}

          {loading ? (
            <div className="card loading-card">
              Loading your order…
            </div>
          ) : !thread ? (
            <div className="card loading-card">
              This support link is unavailable.
            </div>
          ) : (
            <>
              <section className="card">
                <div className="order-head">
                  <p className="eyebrow">
                    Order support
                  </p>

                  <h1 className="cafe-name">
                    {thread.cafeName}
                  </h1>

                  <div className="order-meta">
                    Order #{thread.order.id}
                    {thread.order
                      .tableNumber !==
                    null
                      ? ` · Table ${thread.order.tableNumber}`
                      : ""}
                    {" · "}
                    {timeLabel(
                      thread.order
                        .createdAt,
                    )}
                  </div>

                  <div className="status-pill">
                    <span className="status-dot" />
                    {statusText}
                  </div>

                  <div className="total-row">
                    <span className="total-label">
                      Order total
                    </span>

                    <span className="total-value">
                      {money(
                        thread.order
                          .total,
                        thread.order
                          .currency,
                      )}
                    </span>
                  </div>

                  {thread.order
                    .refundProcessed && (
                    <div className="refund-box">
                      Refund issued
                      {thread.order
                        .refundAmount !==
                      null
                        ? ` · ${money(
                            Number(
                              thread.order
                                .refundAmount,
                            ),
                            thread.order
                              .currency,
                          )}`
                        : ""}
                    </div>
                  )}
                </div>

                <div className="items">
                  {thread.order.items.map(
                    (
                      item,
                      index,
                    ) => {
                      const qty =
                        Math.max(
                          1,
                          Number(
                            item.qty ||
                              1,
                          ),
                        )

                      return (
                        <div
                          className="item"
                          key={`${String(
                            item.id ??
                              item.name,
                          )}-${index}`}
                        >
                          <div>
                            <div className="item-name">
                              {item.name}
                              {" × "}
                              {qty}
                            </div>

                            {item.note && (
                              <div className="item-note">
                                Note:{" "}
                                {item.note}
                              </div>
                            )}
                          </div>

                          <div className="item-price">
                            {money(
                              Number(
                                item.price ||
                                  0,
                              ) * qty,
                              thread.order
                                .currency,
                            )}
                          </div>
                        </div>
                      )
                    },
                  )}
                </div>
              </section>

              <section className="card section">
                <h2 className="section-title">
                  Need help?
                </h2>

                <p className="section-sub">
                  Send a message about this order.
                  The restaurant can reply here and
                  can issue a refund when appropriate.
                </p>

                <div className="conversation">
                  {thread.messages
                    .length === 0 ? (
                    <div className="empty-chat">
                      No messages yet.
                      <br />
                      Tell us what went wrong with
                      your order.
                    </div>
                  ) : (
                    thread.messages.map(
                      (item) => {
                        const fromCustomer =
                          item.senderType ===
                          "CUSTOMER"

                        const displayName =
                          fromCustomer
                            ? "You"
                            : item.senderName ||
                              (item.senderType ===
                              "SYSTEM"
                                ? "CaviarQR"
                                : "Restaurant")

                        return (
                          <div
                            className={`bubble-wrap ${
                              fromCustomer
                                ? "customer"
                                : "other"
                            }`}
                            key={item.id}
                          >
                            <div
                              className={`bubble ${
                                fromCustomer
                                  ? "customer"
                                  : "other"
                              }`}
                            >
                              {item.message}
                            </div>

                            <div className="bubble-meta">
                              {displayName}
                              {" · "}
                              {timeLabel(
                                item.createdAt,
                              )}
                            </div>
                          </div>
                        )
                      },
                    )
                  )}

                  <div
                    ref={
                      chatEndRef
                    }
                  />
                </div>

                {isClosed ? (
                  <div className="closed-box">
                    {thread.status ===
                    "REFUNDED"
                      ? "This support request is closed because the order was refunded."
                      : "This support request has been marked resolved."}
                  </div>
                ) : (
                  <form
                    className="composer"
                    onSubmit={
                      submitMessage
                    }
                  >
                    <textarea
                      className="textarea"
                      value={message}
                      onChange={(event) =>
                        setMessage(
                          event.target
                            .value,
                        )
                      }
                      maxLength={
                        2_000
                      }
                      placeholder="Describe the issue with your order…"
                      disabled={
                        sending
                      }
                    />

                    <div className="composer-foot">
                      <span className="char-count">
                        {message.length}/2000
                      </span>

                      <button
                        type="submit"
                        className="send-btn"
                        disabled={
                          sending ||
                          !message.trim()
                        }
                      >
                        {sending
                          ? "Sending…"
                          : "Send"}
                      </button>
                    </div>
                  </form>
                )}
              </section>
            </>
          )}

          <div className="footer-note">
            Powered by CaviarQR
          </div>
        </div>
      </main>
    </>
  )
}