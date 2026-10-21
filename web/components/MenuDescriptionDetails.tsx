"use client"

import { useEffect, useRef, useState } from "react"
import { createPortal } from "react-dom"

type Props = {
  description: string
  name: string
  imageSrc?: string
  priceText: string
  showAdd: boolean
  onAdd: () => void
}

export default function MenuDescriptionDetails({
  description,
  name,
  imageSrc,
  priceText,
  showAdd,
  onAdd,
}: Props) {
  const previewRef = useRef<HTMLDivElement>(null)
  const [showMore, setShowMore] = useState(false)
  const [open, setOpen] = useState(false)

  useEffect(() => {
    const node = previewRef.current
    if (!node) return

    let cancelled = false

    const measure = () => {
      if (cancelled || !node.parentElement) return

      const width = node.getBoundingClientRect().width
      if (width <= 0) return

      const probe = node.cloneNode(true) as HTMLDivElement

      Object.assign(probe.style, {
        position: "absolute",
        visibility: "hidden",
        pointerEvents: "none",
        width: `${width}px`,
        height: "auto",
        maxHeight: "none",
        display: "block",
        overflow: "visible",
        webkitLineClamp: "unset",
      })

      node.parentElement.appendChild(probe)
      const fullHeight = probe.scrollHeight
      probe.remove()

      setShowMore(fullHeight > node.clientHeight + 2)
    }

    const frame = requestAnimationFrame(measure)

    const observer = new ResizeObserver(measure)
    observer.observe(node)
    if (node.parentElement) {
      observer.observe(node.parentElement)
    }

    document.fonts?.ready.then(() => {
      if (!cancelled) measure()
    })

    return () => {
      cancelled = true
      cancelAnimationFrame(frame)
      observer.disconnect()
    }
  }, [description])

  useEffect(() => {
    if (!open) return

    const previous = document.body.style.overflow
    document.body.style.overflow = "hidden"

    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false)
    }

    document.addEventListener("keydown", onKey)

    return () => {
      document.body.style.overflow = previous
      document.removeEventListener("keydown", onKey)
    }
  }, [open])

  return (
    <>
      <div
        ref={previewRef}
        style={{
          fontSize: 13,
          lineHeight: 1.5,
          color: "#666",
          marginTop: 4,
          marginBottom: 6,
          display: "-webkit-box",
          WebkitBoxOrient: "vertical",
          WebkitLineClamp: 2,
          overflow: "hidden",
          overflowWrap: "anywhere",
        }}
      >
        {description}
      </div>

      {showMore && (
        <button
          type="button"
          onClick={() => setOpen(true)}
          style={{
            background: "#fff",
            color: "#666",
            border: "1px solid #c9c9c9",
            borderRadius: 8,
            padding: "6px 10px",
            fontSize: 12,
            fontWeight: 600,
            cursor: "pointer",
            marginBottom: 9,
          }}
        >
          More Details
        </button>
      )}

      {open &&
        createPortal(
          <div
            onClick={(event) => {
              if (event.target === event.currentTarget) {
                setOpen(false)
              }
            }}
            style={{
              position: "fixed",
              inset: 0,
              zIndex: 10000,
              background: "rgba(0,0,0,0.60)",
              display: "flex",
              alignItems: "flex-end",
              justifyContent: "center",
            }}
          >
            <div
              role="dialog"
              aria-modal="true"
              aria-label={`Details for ${name}`}
              style={{
                position: "relative",
                width: "100%",
                maxWidth: 430,
                maxHeight: "90vh",
                background: "#fff",
                borderRadius: "24px 24px 0 0",
                overflowY: "auto",
                overscrollBehavior: "contain",
                color: "#191919",
                fontFamily: "'Plus Jakarta Sans', sans-serif",
                boxShadow: "0 -10px 35px rgba(0,0,0,0.14)",
              }}
            >
              {imageSrc && (
                <img
                  src={imageSrc}
                  alt={name}
                  style={{
                    display: "block",
                    width: "100%",
                    height: "min(38vh, 320px)",
                    objectFit: "cover",
                  }}
                />
              )}

              <button
                type="button"
                aria-label="Close details"
                onClick={() => setOpen(false)}
                style={{
                  position: "absolute",
                  top: 14,
                  right: 14,
                  width: 40,
                  height: 40,
                  border: "none",
                  borderRadius: "50%",
                  background: "#fff",
                  color: "#333",
                  fontSize: 26,
                  cursor: "pointer",
                  boxShadow: "0 2px 10px rgba(0,0,0,0.12)",
                }}
              >
                ×
              </button>

              <div
                style={{
                  padding: imageSrc
                    ? "22px 20px 32px"
                    : "66px 20px 32px",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: 14,
                  }}
                >
                  <div style={{ minWidth: 0 }}>
                    <div
                      style={{
                        fontSize: 20,
                        fontWeight: 800,
                        lineHeight: 1.3,
                      }}
                    >
                      {name}
                    </div>

                    <div
                      style={{
                        fontSize: 17,
                        fontWeight: 700,
                        marginTop: 8,
                      }}
                    >
                      {priceText}
                    </div>
                  </div>

                  {showAdd && (
                    <button
                      type="button"
                      onClick={() => {
                        setOpen(false)
                        onAdd()
                      }}
                      style={{
                        flexShrink: 0,
                        minWidth: 90,
                        padding: "10px 16px",
                        background: "#fff",
                        color: "#111",
                        border: "1px solid #dedede",
                        borderRadius: 10,
                        fontSize: 15,
                        fontWeight: 800,
                        cursor: "pointer",
                        boxShadow: "0 2px 8px rgba(0,0,0,0.08)",
                      }}
                    >
                      ADD
                    </button>
                  )}
                </div>

                <div
                  style={{
                    marginTop: 22,
                    fontSize: 15,
                    lineHeight: 1.65,
                    color: "#555",
                    whiteSpace: "pre-wrap",
                    overflowWrap: "anywhere",
                  }}
                >
                  {description}
                </div>
              </div>
            </div>
          </div>,
          document.body,
        )}
    </>
  )
}
