import {
  BadRequestException,
} from '@nestjs/common'

import {
  randomUUID,
} from 'crypto'

export type MenuCustomizationOption = {
  id: string
  name: string
  priceDelta: number
  enabled: boolean
}

export type MenuCustomizationGroup = {
  id: string
  name: string
  required: boolean
  minSelect: number
  maxSelect: number
  options: MenuCustomizationOption[]
}

export type RequestedCustomizationSelection = {
  groupId: string
  optionIds: string[]
}

export type SelectedCustomizationSnapshot = {
  groupId: string
  groupName: string
  options: Array<{
    optionId: string
    name: string
    priceDelta: number
  }>
}

function safeText(
  value: unknown,
  maxLength: number,
) {
  if (typeof value !== 'string') {
    return ''
  }

  return value
    .trim()
    .slice(0, maxLength)
}

function safePrice(
  value: unknown,
) {
  const amount =
    Number(value || 0)

  if (
    !Number.isFinite(amount) ||
    amount < 0 ||
    amount > 100000
  ) {
    throw new BadRequestException(
      'Customization price must be a valid non-negative amount.',
    )
  }

  return Number(
    amount.toFixed(2),
  )
}

/*
 * Used when the restaurant creates a menu item.
 *
 * Empty / missing customizations intentionally become [].
 * That preserves the old one-tap Add to Cart behavior.
 */
export function normalizeCustomizationsForSave(
  value: unknown,
): MenuCustomizationGroup[] {
  if (
    value === undefined ||
    value === null ||
    (
      Array.isArray(value) &&
      value.length === 0
    )
  ) {
    return []
  }

  if (!Array.isArray(value)) {
    throw new BadRequestException(
      'Customizations must be a list.',
    )
  }

  if (value.length > 20) {
    throw new BadRequestException(
      'A menu item can have at most 20 customization groups.',
    )
  }

  return value.map(
    (
      rawGroup: any,
      groupIndex,
    ) => {
      const name =
        safeText(
          rawGroup?.name,
          100,
        )

      if (!name) {
        throw new BadRequestException(
          `Customization group ${groupIndex + 1} needs a name.`,
        )
      }

      const rawOptions =
        Array.isArray(
          rawGroup?.options,
        )
          ? rawGroup.options
          : []

      if (
        rawOptions.length < 1 ||
        rawOptions.length > 50
      ) {
        throw new BadRequestException(
          `${name} must have between 1 and 50 options.`,
        )
      }

      const seenNames =
        new Set<string>()

      const options:
        MenuCustomizationOption[] =
        rawOptions.map(
          (
            rawOption: any,
            optionIndex: number,
          ) => {
            const optionName =
              safeText(
                rawOption?.name,
                100,
              )

            if (!optionName) {
              throw new BadRequestException(
                `${name}: option ${optionIndex + 1} needs a name.`,
              )
            }

            const duplicateKey =
              optionName.toLowerCase()

            if (
              seenNames.has(
                duplicateKey,
              )
            ) {
              throw new BadRequestException(
                `${name} contains duplicate option "${optionName}".`,
              )
            }

            seenNames.add(
              duplicateKey,
            )

            return {
              id:
                randomUUID(),

              name:
                optionName,

              priceDelta:
                safePrice(
                  rawOption
                    ?.priceDelta,
                ),

              enabled:
                true,
            }
          },
        )

      const required =
        rawGroup?.required ===
        true

      let maxSelect =
        Number(
          rawGroup?.maxSelect ||
            1,
        )

      if (
        !Number.isInteger(
          maxSelect,
        ) ||
        maxSelect < 1
      ) {
        maxSelect = 1
      }

      if (
        maxSelect >
        options.length
      ) {
        maxSelect =
          options.length
      }

      return {
        id:
          randomUUID(),

        name,

        required,

        minSelect:
          required
            ? 1
            : 0,

        maxSelect,

        options,
      }
    },
  )
}

export function normalizeRequestedSelections(
  value: unknown,
): RequestedCustomizationSelection[] {
  if (
    value === undefined ||
    value === null
  ) {
    return []
  }

  if (!Array.isArray(value)) {
    throw new BadRequestException(
      'Item customizations are invalid.',
    )
  }

  if (value.length > 20) {
    throw new BadRequestException(
      'Too many customization groups were selected.',
    )
  }

  const seenGroups =
    new Set<string>()

  const normalized =
    value.map(
      (entry: any) => {
        const groupId =
          safeText(
            entry?.groupId,
            100,
          )

        if (!groupId) {
          throw new BadRequestException(
            'A customization group ID is invalid.',
          )
        }

        if (
          seenGroups.has(groupId)
        ) {
          throw new BadRequestException(
            'The same customization group was submitted more than once.',
          )
        }

        seenGroups.add(groupId)

        if (
          !Array.isArray(
            entry?.optionIds,
          )
        ) {
          throw new BadRequestException(
            'Customization options are invalid.',
          )
        }

        if (
          entry.optionIds.length >
          50
        ) {
          throw new BadRequestException(
            'Too many customization options were selected.',
          )
        }

        const optionIds =
          Array.from(
            new Set<string>(
              entry.optionIds.map(
                (optionId: unknown) => {
                  const normalizedId =
                    safeText(
                      optionId,
                      100,
                    )

                  if (
                    !normalizedId
                  ) {
                    throw new BadRequestException(
                      'A customization option ID is invalid.',
                    )
                  }

                  return normalizedId
                },
              ),
            ),
          ).sort()

        if (
          optionIds.length !==
          entry.optionIds.length
        ) {
          throw new BadRequestException(
            'The same customization option was submitted more than once.',
          )
        }

        return {
          groupId,
          optionIds,
        }
      },
    )

  return normalized.sort(
    (left, right) =>
      left.groupId.localeCompare(
        right.groupId,
      ),
  )
}

export function validateCustomizationSelections(
  menuItemName: string,
  groups:
    | MenuCustomizationGroup[]
    | null
    | undefined,
  selections:
    RequestedCustomizationSelection[],
) {
  const safeGroups =
    Array.isArray(groups)
      ? groups
      : []

  if (
    safeGroups.length === 0
  ) {
    if (
      selections.length > 0
    ) {
      throw new BadRequestException(
        `${menuItemName} does not have customizations.`,
      )
    }

    return {
      extraPriceCents: 0,
      snapshot:
        [] as SelectedCustomizationSnapshot[],
    }
  }

  const groupById =
    new Map(
      safeGroups.map(
        (group) => [
          String(group.id),
          group,
        ],
      ),
    )

  const selectionByGroup =
    new Map(
      selections.map(
        (selection) => [
          selection.groupId,
          selection.optionIds,
        ],
      ),
    )

  for (
    const selection
    of selections
  ) {
    if (
      !groupById.has(
        selection.groupId,
      )
    ) {
      throw new BadRequestException(
        `${menuItemName} contains an invalid customization selection.`,
      )
    }
  }

  let extraPriceCents =
    0

  const snapshot:
    SelectedCustomizationSnapshot[] =
    []

  for (
    const group
    of safeGroups
  ) {
    const optionIds =
      selectionByGroup.get(
        String(group.id),
      ) || []

    const minSelect =
      Number.isInteger(
        Number(
          group.minSelect,
        ),
      )
        ? Number(
            group.minSelect,
          )
        : group.required
          ? 1
          : 0

    const maxSelect =
      Number.isInteger(
        Number(
          group.maxSelect,
        ),
      ) &&
      Number(
        group.maxSelect,
      ) > 0
        ? Number(
            group.maxSelect,
          )
        : 1

    if (
      optionIds.length <
      minSelect
    ) {
      throw new BadRequestException(
        `${menuItemName}: choose an option for ${group.name}.`,
      )
    }

    if (
      optionIds.length >
      maxSelect
    ) {
      throw new BadRequestException(
        `${menuItemName}: too many options were selected for ${group.name}.`,
      )
    }

    if (
      optionIds.length === 0
    ) {
      continue
    }

    const optionById =
      new Map(
        (
          Array.isArray(
            group.options,
          )
            ? group.options
            : []
        ).map(
          (option) => [
            String(
              option.id,
            ),
            option,
          ],
        ),
      )

    const selectedOptions:
      SelectedCustomizationSnapshot['options'] =
      []

    for (
      const optionId
      of optionIds
    ) {
      const option =
        optionById.get(
          optionId,
        )

      if (
        !option ||
        option.enabled ===
          false
      ) {
        throw new BadRequestException(
          `${menuItemName}: one of the selected options for ${group.name} is no longer available. Please choose again.`,
        )
      }

      const priceDelta =
        safePrice(
          option.priceDelta,
        )

      extraPriceCents +=
        Math.round(
          priceDelta *
            100,
        )

      selectedOptions.push({
        optionId:
          String(
            option.id,
          ),

        name:
          String(
            option.name,
          ),

        priceDelta,
      })
    }

    snapshot.push({
      groupId:
        String(
          group.id,
        ),

      groupName:
        String(
          group.name,
        ),

      options:
        selectedOptions,
    })
  }

  return {
    extraPriceCents,
    snapshot,
  }
}
