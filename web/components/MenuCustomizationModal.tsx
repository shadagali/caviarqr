"use client"

import {
  useMemo,
  useState,
} from "react"

type Props = {
  item: any
  currency?: string
  onClose: () => void
  onAdd: (result: {
    selections: Array<{
      groupId: string
      optionIds: string[]
    }>
    summary: string[]
    extraPrice: number
  }) => void
}

function formatMoney(
  amount: number,
  currency?: string,
) {
  const code =
    String(
      currency || "usd",
    ).toUpperCase() ===
    "INR"
      ? "INR"
      : "USD"

  return new Intl.NumberFormat(
    code === "INR"
      ? "en-IN"
      : "en-US",
    {
      style: "currency",
      currency: code,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    },
  ).format(
    Number(amount || 0),
  )
}

export default function MenuCustomizationModal({
  item,
  currency,
  onClose,
  onAdd,
}: Props) {
  const groups =
    Array.isArray(
      item?.customizations,
    )
      ? item.customizations
      : []

  const [
    selected,
    setSelected,
  ] = useState<
    Record<string, string[]>
  >({})

  const basePrice =
    Number(
      item?.discount || 0,
    ) > 0
      ? Number(
          item?.price || 0,
        ) *
        (
          1 -
          Number(
            item?.discount ||
              0,
          ) /
            100
        )
      : Number(
          item?.price || 0,
        )

  const extraPrice =
    useMemo(
      () =>
        groups.reduce(
          (
            total: number,
            group: any,
          ) => {
            const ids =
              selected[
                String(
                  group.id,
                )
              ] || []

            return (
              total +
              (
                group.options ||
                []
              )
                .filter(
                  (option: any) =>
                    ids.includes(
                      String(
                        option.id,
                      ),
                    ),
                )
                .reduce(
                  (
                    sum: number,
                    option: any,
                  ) =>
                    sum +
                    Number(
                      option
                        .priceDelta ||
                        0,
                    ),
                  0,
                )
            )
          },
          0,
        ),
      [
        groups,
        selected,
      ],
    )

  const complete =
    groups.every(
      (group: any) => {
        const ids =
          selected[
            String(group.id)
          ] || []

        const min =
          Number(
            group.minSelect ??
              (
                group.required
                  ? 1
                  : 0
              ),
          )

        const max =
          Number(
            group.maxSelect ||
              1,
          )

        return (
          ids.length >= min &&
          ids.length <= max
        )
      },
    )

  const toggleOption = (
    group: any,
    option: any,
  ) => {
    const groupId =
      String(group.id)

    const optionId =
      String(option.id)

    const current =
      selected[groupId] ||
      []

    const max =
      Number(
        group.maxSelect ||
          1,
      )

    if (max <= 1) {
      setSelected(
        (previous) => ({
          ...previous,
          [groupId]: [
            optionId,
          ],
        }),
      )

      return
    }

    const exists =
      current.includes(
        optionId,
      )

    if (exists) {
      setSelected(
        (previous) => ({
          ...previous,
          [groupId]:
            current.filter(
              (id) =>
                id !==
                optionId,
            ),
        }),
      )

      return
    }

    if (
      current.length >= max
    ) {
      return
    }

    setSelected(
      (previous) => ({
        ...previous,
        [groupId]: [
          ...current,
          optionId,
        ],
      }),
    )
  }

  const submit = () => {
    if (!complete) return

    const selections =
      groups
        .map(
          (group: any) => ({
            groupId:
              String(
                group.id,
              ),

            optionIds:
              [
                ...(
                  selected[
                    String(
                      group.id,
                    )
                  ] || []
                ),
              ].sort(),
          }),
        )
        .filter(
          (entry: any) =>
            entry
              .optionIds
              .length > 0,
        )

    const summary =
      groups
        .map(
          (group: any) => {
            const ids =
              selected[
                String(
                  group.id,
                )
              ] || []

            if (
              ids.length === 0
            ) {
              return ""
            }

            const names =
              (
                group.options ||
                []
              )
                .filter(
                  (option: any) =>
                    ids.includes(
                      String(
                        option.id,
                      ),
                    ),
                )
                .map(
                  (option: any) =>
                    String(
                      option.name,
                    ),
                )

            return `${group.name}: ${names.join(", ")}`
          },
        )
        .filter(Boolean)

    onAdd({
      selections,
      summary,
      extraPrice,
    })
  }

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 10000,
        background:
          "rgba(0,0,0,.48)",
        display: "flex",
        alignItems:
          "flex-end",
        justifyContent:
          "center",
        paddingTop: 30,
      }}
      onMouseDown={(
        event,
      ) => {
        if (
          event.target ===
          event.currentTarget
        ) {
          onClose()
        }
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: 430,
          maxHeight: "91vh",
          overflowY: "auto",
          background: "#fff",
          borderRadius:
            "24px 24px 0 0",
          padding:
            "18px 18px 28px",
          fontFamily:
            "'Plus Jakarta Sans', sans-serif",
            color: "#000",
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent:
              "space-between",
            gap: 12,
            alignItems:
              "flex-start",
            marginBottom: 18,
          }}
        >
          <div>
            <div
              style={{
                fontSize: 21,
                fontWeight: 800,
              }}
            >
              {item?.name}
            </div>

            <div
              style={{
                fontSize: 14,
                color: "#000",
                marginTop: 4,
              }}
            >
              {formatMoney(
                basePrice,
                currency,
              )}
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            style={{
              width: 34,
              height: 34,
              borderRadius: 17,
              border: 0,
              background:
                "#f1f1f1",
              fontSize: 20,
              cursor: "pointer",
            }}
          >
            ×
          </button>
        </div>

        {groups.map(
          (group: any) => {
            const ids =
              selected[
                String(
                  group.id,
                )
              ] || []

            const max =
              Number(
                group.maxSelect ||
                  1,
              )

            return (
              <div
                key={
                  group.id
                }
                style={{
                  padding:
                    "18px 0",
                  borderTop:
                    "1px solid #eee",
                }}
              >
                <div
                  style={{
                    display:
                      "flex",
                    justifyContent:
                      "space-between",
                    gap: 10,
                    marginBottom:
                      12,
                  }}
                >
                  <div>
                    <div
                      style={{
                        fontSize:
                          16,
                        fontWeight:
                          800,
                      }}
                    >
                      {group.name}
                    </div>

                    <div
                      style={{
                        fontSize:
                          12,
                        color:
                          "#000",
                        marginTop:
                          3,
                      }}
                    >
                      {group.required
                        ? "Required"
                        : "Optional"}
                      {" · "}
                      {max > 1
                        ? `Choose up to ${max}`
                        : "Choose 1"}
                    </div>
                  </div>
                </div>

                <div
                  style={{
                    display:
                      "flex",
                    flexDirection:
                      "column",
                    gap: 8,
                  }}
                >
                  {(
                    group.options ||
                    []
                  ).map(
                    (
                      option: any,
                    ) => {
                      const optionId =
                        String(
                          option.id,
                        )

                      const active =
                        ids.includes(
                          optionId,
                        )

                      return (
                        <button
                          key={
                            optionId
                          }
                          type="button"
                          onClick={() =>
                            toggleOption(
                              group,
                              option,
                            )
                          }
                          style={{
                            width:
                              "100%",
                            display:
                              "flex",
                            justifyContent:
                              "space-between",
                            alignItems:
                              "center",
                            padding:
                              "14px 12px",
                            borderRadius:
                              12,
                            border:
                              active
                                ? "2px solid #111"
                                : "1px solid #ddd",
                            background:
                              active
                                ? "#f7f7f7"
                                : "#fff",
                            cursor:
                              "pointer",
                            textAlign:
                              "left",
                            color: "#000",
                          }}
                        >
                          <span
                            style={{
                              display:
                                "flex",
                              alignItems:
                                "center",
                              gap: 10,
                            }}
                          >
                            <span
                              style={{
                                width: 20,
                                height:
                                  20,
                                borderRadius: "50%",
                                flexShrink: 0,
                                border:
                                  "1.5px solid #777",
                                background:
                                  active
                                    ? "#111"
                                    : "#fff",
                                boxShadow:
                                  active
                                    ? "inset 0 0 0 5px #fff"
                                    : "none",
                              }}
                            />

                            <span
                              style={{
                                fontSize:
                                  14,
                                fontWeight:
                                  600,
                              }}
                            >
                              {
                                option.name
                              }
                            </span>
                          </span>

                          <span
                            style={{
                              fontSize:
                                13,
                              color:
                                "#000",
                            }}
                          >
                            {Number(
                              option
                                .priceDelta ||
                                0,
                            ) > 0
                              ? `+${formatMoney(
                                  Number(
                                    option
                                      .priceDelta,
                                  ),
                                  currency,
                                )}`
                              : ""}
                          </span>
                        </button>
                      )
                    },
                  )}
                </div>
              </div>
            )
          },
        )}

        <button
          type="button"
          disabled={!complete}
          onClick={submit}
          style={{
            width: "100%",
            border: 0,
            borderRadius: 14,
            padding:
              "16px 18px",
            fontSize: 16,
            fontWeight: 800,
            cursor:
              complete
                ? "pointer"
                : "not-allowed",
            background:
              complete
                ? "#fff"
                : "#d5d5d5",
            color: complete ? "#111" : "#555",
            outline: complete ? "1px solid #111" : "none",
            outlineOffset: -1,
            marginTop: 8,
          }}
        >
          {complete
            ? `Add to Cart • ${formatMoney(
                basePrice +
                  extraPrice,
                currency,
              )}`
            : "Choose required options"}
        </button>
      </div>
    </div>
  )
}
