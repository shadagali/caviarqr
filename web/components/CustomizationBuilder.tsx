"use client"

type Props = {
  value: any[]
  onChange: (
    next: any[],
  ) => void
  currencySymbol: string
}

function makeId() {
  if (
    typeof crypto !==
      "undefined" &&
    crypto.randomUUID
  ) {
    return crypto.randomUUID()
  }

  return `${Date.now()}-${Math.random()}`
}

function newOption() {
  return {
    clientId: makeId(),
    name: "",
    priceDelta: "0",
  }
}

function newGroup() {
  return {
    clientId: makeId(),
    name: "",
    required: true,
    maxSelect: 1,
    multiple: false,
    options: [
      newOption(),
    ],
  }
}

export default function CustomizationBuilder({
  value,
  onChange,
  currencySymbol,
}: Props) {
  const groups =
    Array.isArray(value)
      ? value
      : []

  const updateGroup = (
    groupIndex: number,
    patch: Record<
      string,
      unknown
    >,
  ) => {
    onChange(
      groups.map(
        (
          group,
          index,
        ) =>
          index ===
          groupIndex
            ? {
                ...group,
                ...patch,
              }
            : group,
      ),
    )
  }

  const updateOption = (
    groupIndex: number,
    optionIndex: number,
    patch: Record<
      string,
      unknown
    >,
  ) => {
    const group =
      groups[groupIndex]

    if (!group) return

    const options =
      (
        Array.isArray(
          group.options,
        )
          ? group.options
          : []
      ).map(
        (
          option: any,
          index: number,
        ) =>
          index ===
          optionIndex
            ? {
                ...option,
                ...patch,
              }
            : option,
      )

    updateGroup(
      groupIndex,
      {
        options,
      },
    )
  }

  if (
    groups.length === 0
  ) {
    return (
      <div
        style={{
          marginTop: 18,
          paddingTop: 18,
          borderTop:
            "1px solid var(--border)",
        }}
      >
        <button
          type="button"
          className="btn btn-ghost"
          onClick={() =>
            onChange([
              newGroup(),
            ])
          }
        >
          ＋ Add Customizations
        </button>

        <div
          style={{
            fontSize: 11,
            color:
              "var(--muted)",
            marginTop: 8,
            lineHeight: 1.5,
          }}
        >
          Optional. Leave this
          blank for normal one-tap
          Add to Cart.
        </div>
      </div>
    )
  }

  return (
    <div
      style={{
        marginTop: 18,
        paddingTop: 18,
        borderTop:
          "1px solid var(--border)",
      }}
    >
      <div
        style={{
          fontSize: 13,
          fontWeight: 800,
          marginBottom: 5,
        }}
      >
        Customizations
      </div>

      <div
        style={{
          fontSize: 11,
          color:
            "var(--muted)",
          lineHeight: 1.5,
          marginBottom: 14,
        }}
      >
        Example: Choose your
        protein → Chicken, Tofu,
        Shrimp.
      </div>

      {groups.map(
        (
          group: any,
          groupIndex,
        ) => (
          <div
            key={
              group.clientId ||
              groupIndex
            }
            style={{
              border:
                "1px solid var(--border)",
              borderRadius: 12,
              padding: 14,
              marginBottom: 12,
              background: "#fafafa",
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent:
                  "space-between",
                gap: 10,
                alignItems:
                  "center",
                marginBottom: 12,
              }}
            >
              <strong
                style={{
                  fontSize: 12,
                }}
              >
                Customization{" "}
                {groupIndex + 1}
              </strong>

              <button
                type="button"
                className="btn btn-ghost"
                style={{
                  padding:
                    "6px 9px",
                  fontSize: 11,
                }}
                onClick={() =>
                  onChange(
                    groups.filter(
                      (
                        _,
                        index,
                      ) =>
                        index !==
                        groupIndex,
                    ),
                  )
                }
              >
                Remove
              </button>
            </div>

            <div
              className="field"
              style={{
                marginBottom: 12,
              }}
            >
              <div className="field-label">
                Name
              </div>

              <input
                className="inp"
                placeholder="e.g. Choose your protein"
                value={
                  group.name ||
                  ""
                }
                onChange={(
                  event,
                ) =>
                  updateGroup(
                    groupIndex,
                    {
                      name:
                        event
                          .target
                          .value,
                    },
                  )
                }
              />
            </div>

            <div
              style={{
                display: "flex",
                gap: 18,
                flexWrap: "wrap",
                marginBottom: 14,
                fontSize: 12,
              }}
            >
              <label
                style={{
                  display:
                    "flex",
                  alignItems:
                    "center",
                  gap: 6,
                }}
              >
                <input
                  type="checkbox"
                  checked={
                    group.required ===
                    true
                  }
                  onChange={(
                    event,
                  ) =>
                    updateGroup(
                      groupIndex,
                      {
                        required:
                          event
                            .target
                            .checked,
                      },
                    )
                  }
                />
                Required
              </label>

              <label
                style={{
                  display:
                    "flex",
                  alignItems:
                    "center",
                  gap: 6,
                }}
              >
                <input
                  type="checkbox"
                  checked={
                    group.multiple ===
                    true
                  }
                  onChange={(
                    event,
                  ) => {
                    const multiple =
                      event
                        .target
                        .checked

                    updateGroup(
                      groupIndex,
                      {
                        multiple,
                        maxSelect:
                          multiple
                            ? Math.max(
                                2,
                                Number(
                                  group
                                    .maxSelect ||
                                    2,
                                ),
                              )
                            : 1,
                      },
                    )
                  }}
                />
                Allow multiple
              </label>

              {group.multiple ===
                true && (
                <label
                  style={{
                    display:
                      "flex",
                    alignItems:
                      "center",
                    gap: 6,
                  }}
                >
                  Max choices
                  <input
                    type="number"
                    min={1}
                    max={50}
                    value={
                      group.maxSelect ||
                      2
                    }
                    onChange={(
                      event,
                    ) =>
                      updateGroup(
                        groupIndex,
                        {
                          maxSelect:
                            Math.max(
                              1,
                              Number(
                                event
                                  .target
                                  .value ||
                                  1,
                              ),
                            ),
                        },
                      )
                    }
                    style={{
                      width: 55,
                      padding: 5,
                    }}
                  />
                </label>
              )}
            </div>

            <div
              style={{
                fontSize: 11,
                fontWeight: 800,
                marginBottom: 8,
              }}
            >
              Options
            </div>

            {(
              Array.isArray(
                group.options,
              )
                ? group.options
                : []
            ).map(
              (
                option: any,
                optionIndex: number,
              ) => (
                <div
                  key={
                    option.clientId ||
                    optionIndex
                  }
                  style={{
                    display:
                      "grid",
                    gridTemplateColumns:
                      "1fr 105px auto",
                    gap: 8,
                    marginBottom: 8,
                    alignItems:
                      "center",
                  }}
                >
                  <input
                    className="inp"
                    placeholder="e.g. Chicken"
                    value={
                      option.name ||
                      ""
                    }
                    onChange={(
                      event,
                    ) =>
                      updateOption(
                        groupIndex,
                        optionIndex,
                        {
                          name:
                            event
                              .target
                              .value,
                        },
                      )
                    }
                  />

                  <input
                    className="inp"
                    type="number"
                    min="0"
                    step="0.01"
                    placeholder={`+${currencySymbol}0`}
                    value={
                      option.priceDelta ??
                      "0"
                    }
                    onChange={(
                      event,
                    ) =>
                      updateOption(
                        groupIndex,
                        optionIndex,
                        {
                          priceDelta:
                            event
                              .target
                              .value,
                        },
                      )
                    }
                  />

                  <button
                    type="button"
                    className="btn btn-ghost"
                    style={{
                      padding:
                        "8px",
                    }}
                    disabled={
                      group.options
                        ?.length <=
                      1
                    }
                    onClick={() => {
                      const next =
                        (
                          group.options ||
                          []
                        ).filter(
                          (
                            _: any,
                            index: number,
                          ) =>
                            index !==
                            optionIndex,
                        )

                      updateGroup(
                        groupIndex,
                        {
                          options:
                            next,
                        },
                      )
                    }}
                  >
                    ×
                  </button>
                </div>
              ),
            )}

            <button
              type="button"
              className="btn btn-ghost"
              style={{
                marginTop: 5,
                fontSize: 11,
              }}
              onClick={() =>
                updateGroup(
                  groupIndex,
                  {
                    options: [
                      ...(
                        group.options ||
                        []
                      ),
                      newOption(),
                    ],
                  },
                )
              }
            >
              ＋ Add option
            </button>
          </div>
        ),
      )}

      <button
        type="button"
        className="btn btn-ghost"
        onClick={() =>
          onChange([
            ...groups,
            newGroup(),
          ])
        }
      >
        ＋ Add another
        customization
      </button>
    </div>
  )
}
