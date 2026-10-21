"use client"

import {
  useEffect,
  useRef,
  useState,
} from "react"
import axios from "axios"
import { io } from "socket.io-client"
import { useRouter } from "next/navigation"
import CustomizationBuilder from "../../../components/CustomizationBuilder"

export default function KitchenPage() {
  const router = useRouter()

  const [orders, setOrders] =
    useState<any[]>([])

  const [pastOrders, setPastOrders] =
    useState<any[]>([])

  const [showHistory, setShowHistory] = useState(false)

  const [tab, setTab] =
    useState<'orders' | 'menu'>(
      'orders',
    )

  const [menuItems, setMenuItems] =
    useState<any[]>([])

  const [isOpen, setIsOpen] =
    useState<boolean | null>(
      null,
    )

  const [refundOrderId, setRefundOrderId] = useState<number | null>(null)
  const [refundSubmitting, setRefundSubmitting] = useState(false)

  const [search, setSearch] =
    useState('')

  const [showAddModal,
    setShowAddModal] =
    useState(false)

  const [newName,
    setNewName] =
    useState('')

  const [newPrice,
    setNewPrice] =
    useState('')

  const [newDiscount,
    setNewDiscount] =
    useState('0')

  const [
    editingDiscountItem,
    setEditingDiscountItem,
  ] = useState<any | null>(null)

  const [
    editDiscount,
    setEditDiscount,
  ] = useState('0')

  const [
    isSavingDiscount,
    setIsSavingDiscount,
  ] = useState(false)

  const [newCategory,
    setNewCategory] =
    useState('food')

  const [newImage,
    setNewImage] =
    useState<File | null>(
      null,
    )

  const [newDescription,
    setNewDescription] =
    useState('')

  const [newCustomizations, setNewCustomizations] =
    useState<any[]>([])

  const [editingMenuItem, setEditingMenuItem] =
    useState<any | null>(null)
  const [editName, setEditName] = useState('')
  const [editPrice, setEditPrice] = useState('')
  const [editItemDiscount, setEditItemDiscount] = useState('0')
  const [editCategory, setEditCategory] = useState('')
  const [editDescription, setEditDescription] = useState('')
  const [editCustomizations, setEditCustomizations] =
    useState<any[]>([])
  const [editImage, setEditImage] = useState<File | null>(null)
  const [removeEditImage, setRemoveEditImage] = useState(false)
  const [isSavingMenuItem, setIsSavingMenuItem] = useState(false)
  const editMenuItemLockRef = useRef(false)

  const [isCreatingItem,
    setIsCreatingItem] =
    useState(false)

  const createItemLockRef =
    useRef(false)

  const [ordersLoadError, setOrdersLoadError] = useState(false)
  const kitchenJoinedRef = useRef(false)
  const activeRefreshInFlightRef = useRef(false)
  const orderEventSequenceRef = useRef(0)

  const socketRef = useRef<any>(null)

  const ackedOrdersRef =
    useRef<Map<number, number>>(
      new Map(),
    )

  const [storeCode, setStoreCode] =
    useState('')

  const [businessId, setBusinessId] =
    useState<number | null>(null)

  const [sessionReady, setSessionReady] =
    useState(false)

  const [sessionToken, setSessionToken] =
    useState('')

  useEffect(() => {
    const savedRole =
      localStorage.getItem('role')

    const savedToken =
      String(
        localStorage.getItem('token') ||
          '',
      ).trim()

    const clearSession = () => {
      localStorage.removeItem('businessId')
      localStorage.removeItem('storeCode')
      localStorage.removeItem('role')
      localStorage.removeItem('token')
    }

    if (
      savedRole !== 'kitchen' ||
      !savedToken
    ) {
      clearSession()
      router.replace('/login/kitchen')
      return
    }

    let cancelled = false
    let retryTimer: ReturnType<typeof setTimeout> | null = null

    const initialize = async () => {
      try {
        /*
         * The server is authoritative. Never trust a stale
         * storeCode/businessId left in localStorage.
         */
        const response =
          await axios.get(
            `${process.env.NEXT_PUBLIC_API_URL}/kitchen-auth/me`,
            {
              headers: {
                Authorization:
                  `Bearer ${savedToken}`,
              },
            },
          )

        if (cancelled) return

        const authoritativeStoreCode =
          String(
            response.data?.storeCode ||
              '',
          ).trim()

        const authoritativeBusinessId =
          Number(
            response.data?.businessId,
          )

        if (
          !authoritativeStoreCode ||
          !Number.isInteger(
            authoritativeBusinessId,
          ) ||
          authoritativeBusinessId < 1
        ) {
          throw new Error(
            'Invalid kitchen session response.',
          )
        }

        localStorage.setItem(
          'storeCode',
          authoritativeStoreCode,
        )
        localStorage.setItem(
          'businessId',
          String(
            authoritativeBusinessId,
          ),
        )
        localStorage.setItem(
          'role',
          'kitchen',
        )

        setStoreCode(
          authoritativeStoreCode,
        )
        setBusinessId(
          authoritativeBusinessId,
        )
        setSessionToken(
          savedToken,
        )
        setIsOpen(
          response.data?.isOpen ===
            true,
        )
        setOrdersLoadError(false)
        setSessionReady(true)
      } catch (error) {
        if (cancelled) return
        console.error(
          'KITCHEN SESSION ERROR',
          error,
        )
        const status = axios.isAxiosError(error)
          ? error.response?.status
          : undefined

        const invalidResponse =
          error instanceof Error &&
          error.message === 'Invalid kitchen session response.'

        if (status === 401 || status === 403 || invalidResponse) {
          clearSession()
          router.replace('/login/kitchen')
          return
        }

        // Temporary network/server failure: preserve credentials and retry.
        setOrdersLoadError(true)
        retryTimer = setTimeout(() => {
          void initialize()
        }, 5000)
      }
    }

    void initialize()
    return () => {
      cancelled = true
      if (retryTimer !== null) clearTimeout(retryTimer)
    }
  }, [router])

  const authConfig = () => {
    const token =
      typeof window !== 'undefined'
        ? sessionToken || localStorage.getItem('token')
        : null

    return token
      ? {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      : {}
  }

  const acknowledgeOrder = (
    order: any,
  ) => {
    if (!order?.id || order?.status === "PENDING_PAYMENT") return

    if (
      order.status === "DONE" ||
      order.status === "REFUNDED"
    ) {
      return
    }

    if (
      order.kitchenAcknowledged === true
    ) {
      return
    }

    // KITCHEN_RETRY_AND_STALE_LOAD_GUARD_V2
    // Avoid ACK floods, but retry if the server response is lost.
    const lastAckAttempt = ackedOrdersRef.current.get(order.id)
    if (
      lastAckAttempt !== undefined &&
      Date.now() - lastAckAttempt < 20000
    ) {
      return
    }

    const socket =
      socketRef.current

    if (
      !socket ||
      socket.connected !== true ||
      kitchenJoinedRef.current !== true
    ) {
      return
    }

    ackedOrdersRef.current.set(
      order.id,
      Date.now(),
    )

    console.log(
      "SENDING KITCHEN ACK:",
      order.id,
    )

    socket.emit(
      "kitchenAck",
      {
        orderId: order.id,
      },
    )
  }

  const handleOrderLoadFailure = (err: unknown) => {
    console.error(
      "KITCHEN_ORDER_LOAD_FAILED",
      err instanceof Error ? err.message : "Unknown request failure",
    )
    const status = axios.isAxiosError(err)
      ? err.response?.status
      : undefined

    // An invalid kitchen session is not a transient network failure.
    if (status === 401 || status === 403) {
      localStorage.removeItem('businessId')
      localStorage.removeItem('storeCode')
      localStorage.removeItem('role')
      localStorage.removeItem('token')
      setOrders([])
      setPastOrders([])
      router.replace('/login/kitchen')
      return
    }

    // Keep previously loaded orders on temporary connectivity failures.
    setOrdersLoadError(true)
  }

  const refreshActiveOrders = async () => {
    if (activeRefreshInFlightRef.current) return
    activeRefreshInFlightRef.current = true

    try {
      const eventSequenceBefore = orderEventSequenceRef.current
      const response = await axios.get(
        `${process.env.NEXT_PUBLIC_API_URL}/kitchen-auth/orders`,
        { ...authConfig(), timeout: 8000 },
      )

      const data = Array.isArray(response.data)
        ? response.data
        : response.data?.orders

      if (!Array.isArray(data)) {
        throw new Error('Invalid active orders response')
      }

      const activeData = data
        .filter((order: any) =>
          Number(order?.businessId) === businessId &&
          String(order?.storeCode || '') === storeCode &&
          order?.status !== 'PENDING_PAYMENT',
        )
        .sort((a: any, b: any) => b.id - a.id)

      // Discard a stale REST result if a newer socket or REST update arrived.
      if (orderEventSequenceRef.current !== eventSequenceBefore) return
      orderEventSequenceRef.current += 1

      setOrders(activeData)
      setOrdersLoadError(false)
      activeData.forEach((order: any) => acknowledgeOrder(order))
    } catch (err) {
      handleOrderLoadFailure(err)
    } finally {
      activeRefreshInFlightRef.current = false
    }
  }

  const load = async () => {
    const eventSequenceAtLoadStart = orderEventSequenceRef.current
    try {
      const activeRes =
        await axios.get(
          `${process.env.NEXT_PUBLIC_API_URL}/kitchen-auth/orders`,
          authConfig(),
        )

      const historyRes =
        await axios.get(
          `${process.env.NEXT_PUBLIC_API_URL}/kitchen-auth/orders/history`,
          authConfig(),
        )

      let activeData: any[] = []
      let historyData: any[] = []

      if (
        Array.isArray(
          activeRes.data,
        )
      ) {
        activeData =
          activeRes.data
      } else if (
        Array.isArray(
          activeRes.data.orders,
        )
      ) {
        activeData =
          activeRes.data.orders
      }

      if (
        Array.isArray(
          historyRes.data,
        )
      ) {
        historyData =
          historyRes.data
      } else if (
        Array.isArray(
          historyRes.data.orders,
        )
      ) {
        historyData =
          historyRes.data.orders
      }

      // Defense in depth: even if a server regression ever
      // returned the wrong tenant, never render it here.
      activeData = activeData.filter(
        (order) =>
          Number(order?.businessId) === businessId &&
          String(order?.storeCode || '') === storeCode &&
          order?.status !== 'PENDING_PAYMENT',
      )

      historyData = historyData.filter(
        (order) =>
          Number(order?.businessId) === businessId &&
          String(order?.storeCode || '') === storeCode &&
          order?.status !== 'PENDING_PAYMENT',
      )

      activeData.sort(
        (a, b) =>
          b.id - a.id,
      )

      historyData.sort(
        (a, b) =>
          b.id - a.id,
      )

      const businessRes =
        await axios.get(
          `${process.env.NEXT_PUBLIC_API_URL}/kitchen-auth/me`,
          authConfig(),
        )

      const latestOpen =
        businessRes.data
          ?.isOpen === true

      setIsOpen(
        latestOpen,
      )

      // Discard outdated full loads when a socket event or a newer
      // accepted REST refresh changed the displayed orders in the meantime.
      if (eventSequenceAtLoadStart === orderEventSequenceRef.current) {
        orderEventSequenceRef.current += 1
        setOrders(
          activeData,
        )
        setOrdersLoadError(false)

        setPastOrders(
          historyData,
        )

        activeData.forEach(
          (order) => {
            acknowledgeOrder(order)
          },
        )
      }
    } catch (err) {
      handleOrderLoadFailure(err)
    }
  }

  const loadMenu =
    async () => {
      try {
        const res =
          await axios.get(
            `${process.env.NEXT_PUBLIC_API_URL}/menu/${businessId}`,
            authConfig(),
          )

        console.log(
          "MENU ITEMS",
          res.data,
        )

        setMenuItems(
          res.data || [],
        )
      } catch (err) {
        console.log(err)
      }
    }

  const toggleKitchen = async () => {
    try {
      const res = await axios.patch(
        `${process.env.NEXT_PUBLIC_API_URL}/kitchen-auth/toggle-open`,
        {},
        authConfig(),
      )

      setIsOpen(
        res.data?.isOpen === true,
      )
    } catch (err) {
      console.log(err)
    }
  }

  useEffect(() => {
    if (
      !sessionReady ||
      !storeCode ||
      !businessId
    ) {
      return
    }

    // One lightweight active-orders query per 10 seconds, including while
    // Socket.IO is connected. No overlapping refresh requests.
    let poll: ReturnType<typeof setInterval> | null = null

    const startPolling = () => {
      if (poll !== null) return
      poll = setInterval(() => {
        void refreshActiveOrders()
      }, 10000)
    }

    const stopPolling = () => {
      if (poll !== null) {
        clearInterval(poll)
        poll = null
      }
    }

    const socket = io(
      process.env.NEXT_PUBLIC_API_URL!,
      {
        transports: [
          "websocket",
          "polling",
        ],

        reconnection: true,

        reconnectionAttempts:
          Infinity,

        reconnectionDelay: 1000,

        auth: {
          token:
            localStorage.getItem('token') ||
            '',
        },
      },
    )

    socketRef.current = socket

    socket.on("connect", () => {
      // `connect` fires on first connection and all successful reconnects.
      kitchenJoinedRef.current = false
      ackedOrdersRef.current.clear()
      socket.emit("join")
    })

    socket.on("kitchenJoined", (data: any) => {
      if (
        Number(data?.businessId) !== businessId ||
        String(data?.storeCode || '') !== storeCode
      ) {
        console.error("KITCHEN_JOIN_TENANT_MISMATCH")
        kitchenJoinedRef.current = false
        setOrdersLoadError(true)
        socket.disconnect()
        return
      }

      kitchenJoinedRef.current = true
      void load()
    })

    socket.on(
      "disconnect",
      () => {
        console.log(
        "SOCKET DISCONNECTED",
      )

      kitchenJoinedRef.current = false
      startPolling()
      },
    )

    socket.on(
      "connect_error",
      () => {
        console.log(
          "SOCKET ERROR",
        )

        startPolling()
      },
    )

    socket.on(
      "kitchenAuthFailed",
      () => {
        localStorage.removeItem('businessId')
        localStorage.removeItem('storeCode')
        localStorage.removeItem('role')
        localStorage.removeItem('token')
        router.replace('/login/kitchen')
      },
    )

    socket.on(
      "kitchenAckSuccess",
      (data: any) => {
        console.log(
          "KITCHEN ACK SUCCESS",
          data,
        )

        const confirmedOrderId = Number(data?.orderId)
        if (!Number.isInteger(confirmedOrderId) || confirmedOrderId < 1) return
        ackedOrdersRef.current.delete(confirmedOrderId)
        // A late REST response must not overwrite a confirmed ACK.
        orderEventSequenceRef.current += 1
        setOrders((prev) =>
          prev.map((o) =>
            o.id === data.orderId
              ? {
                  ...o,
                  kitchenAcknowledged:
                    true,
                  kitchenAcknowledgedAt:
                    new Date().toISOString(),
                }
              : o,
          ),
        )
      },
    )

    socket.on(
      "kitchenAckFailed",
      (data: any) => {
        console.log(
          "KITCHEN ACK FAILED",
          data,
        )

        if (data?.orderId) {
          ackedOrdersRef.current.delete(
            data.orderId,
          )
        }
      },
    )

    socket.on(
      "newOrder",
      (order: any) => {
        console.log(
          "NEW ORDER",
          order,
        )

        if (
          Number(order?.businessId) !== businessId ||
          String(order?.storeCode || '') !== storeCode
        ) {
          console.error(
            'BLOCKED CROSS-TENANT SOCKET ORDER',
            order?.id,
          )
          return
        }

        if (order?.status === "PENDING_PAYMENT") return

        orderEventSequenceRef.current += 1
        acknowledgeOrder(order)

        setOrders((prev) => {
          const exists =
            prev.find(
              (o) =>
                o.id ===
                order.id,
            )

          if (exists) {
            return prev
          }

          return [
            order,
            ...prev,
          ]
        })

        setTimeout(() => {
          load()
          loadMenu()
        }, 500)
      },
    )

    socket.on(
      "orderUpdate",
      (order: any) => {
        console.log(
          "ORDER UPDATE",
          order,
        )

        if (
          Number(order?.businessId) !== businessId ||
          String(order?.storeCode || '') !== storeCode
        ) {
          console.error(
            'BLOCKED CROSS-TENANT SOCKET UPDATE',
            order?.id,
          )
          return
        }

        if (order?.status === "PENDING_PAYMENT") return

        orderEventSequenceRef.current += 1
        acknowledgeOrder(order)

        setOrders((prev) =>
          prev.map((o) =>
            o.id === order.id
              ? order
              : o,
          ),
        )

        setTimeout(() => {
          load()
          loadMenu()
        }, 500)
      },
    )

    // Initial order load waits for authenticated `kitchenJoined`.
    // The periodic REST fallback remains active regardless of socket state.
    loadMenu()
    startPolling()

    return () => {
      stopPolling()

      socket.off("connect")
      socket.off("kitchenJoined")
      socket.off("disconnect")
      socket.off("connect_error")
      socket.off("kitchenAuthFailed")
      socket.off("kitchenAckSuccess")
      socket.off("kitchenAckFailed")
      socket.off("newOrder")
      socket.off(
        "orderUpdate",
      )

      socket.disconnect()
    }
  }, [sessionReady, storeCode, businessId, sessionToken, router])

  const completeOrder = async (
    id: number,
  ) => {
    if (
      !confirm(
        "Mark order as completed?",
      )
    )
      return

    try {
      await axios.patch(
        `${process.env.NEXT_PUBLIC_API_URL}/kitchen-auth/orders/${id}/status`,
        {
          status: "DONE",
        },
        authConfig(),
      )

      load()
    } catch (err) {
      console.log(err)
    }
  }

  const toggleHide =
    async (id: number) => {
      try {
        await axios.patch(
          `${process.env.NEXT_PUBLIC_API_URL}/menu/hide/${id}`,
          {},
          authConfig(),
        )

        loadMenu()
      } catch (err) {
        console.log(err)
      }
    }

  const prepareMenuImage =
    async (
      file: File,
    ): Promise<File> => {
      if (
        !file.type.startsWith(
          'image/',
        )
      ) {
        throw new Error(
          'Please choose an image file.',
        )
      }

      const objectUrl =
        URL.createObjectURL(file)

      try {
        const image =
          await new Promise<HTMLImageElement>(
            (
              resolve,
              reject,
            ) => {
              const img =
                new Image()

              img.onload = () =>
                resolve(img)

              img.onerror = () =>
                reject(
                  new Error(
                    'This photo format could not be opened.',
                  ),
                )

              img.src =
                objectUrl
            },
          )

        const maxDimension =
          1600

        const scale =
          Math.min(
            1,
            maxDimension /
              Math.max(
                image.width,
                image.height,
              ),
          )

        const width =
          Math.max(
            1,
            Math.round(
              image.width *
                scale,
            ),
          )

        const height =
          Math.max(
            1,
            Math.round(
              image.height *
                scale,
            ),
          )

        const canvas =
          document.createElement(
            'canvas',
          )

        canvas.width =
          width

        canvas.height =
          height

        const context =
          canvas.getContext(
            '2d',
          )

        if (!context) {
          throw new Error(
            'Could not prepare photo.',
          )
        }

        context.drawImage(
          image,
          0,
          0,
          width,
          height,
        )

        const blob =
          await new Promise<Blob | null>(
            (resolve) => {
              canvas.toBlob(
                resolve,
                'image/jpeg',
                0.82,
              )
            },
          )

        if (!blob) {
          throw new Error(
            'Could not prepare photo.',
          )
        }

        const baseName =
          file.name
            .replace(
              /\.[^.]+$/,
              '',
            )
            .replace(
              /[^a-zA-Z0-9_-]/g,
              '-',
            ) ||
          'menu-image'

        return new File(
          [blob],
          `${baseName}.jpg`,
          {
            type:
              'image/jpeg',
            lastModified:
              Date.now(),
          },
        )
      } catch (error) {
        /*
         * Some mobile browsers may not decode
         * every camera format in Canvas.
         * Smaller originals can still be sent
         * directly because the backend accepts them.
         */
        if (
          file.size <=
          8 * 1024 * 1024
        ) {
          return file
        }

        throw new Error(
          'This photo is too large and could not be optimized. Try a smaller photo or a screenshot.',
        )
      } finally {
        URL.revokeObjectURL(
          objectUrl,
        )
      }
    }

  const prepareMenuCustomizations = (value: any[]): any[] => {
    if (!Array.isArray(value)) return []

    return value.map((group: any) => {
      const name = String(group?.name || '').trim()
      const options = Array.isArray(group?.options)
        ? group.options
        : []

      if (!name || options.length === 0) {
        throw new Error('Each customization needs a group name and at least one option.')
      }

      const cleanedOptions = options.map((option: any) => {
        const optionName = String(option?.name || '').trim()
        const priceDelta = Number(option?.priceDelta ?? 0)

        if (!optionName || !Number.isFinite(priceDelta) || priceDelta < 0) {
          throw new Error('Every customization option needs a name and a valid non-negative price.')
        }

        return { ...option, name: optionName, priceDelta }
      })

      const multiple = group?.multiple === true
      const maxSelect = multiple ? Number(group?.maxSelect) : 1
      if (!Number.isInteger(maxSelect) || maxSelect < 1 || maxSelect > cleanedOptions.length) {
        throw new Error(`Invalid maximum selections for "${name}".`)
      }

      return {
        ...group,
        name,
        required: group?.required === true,
        multiple,
        maxSelect,
        options: cleanedOptions,
      }
    })
  }

  const uploadKitchenMenuImage = async (file: File): Promise<string> => {
    const fd = new FormData()
    const imageForUpload = await prepareMenuImage(file)
    fd.append('file', imageForUpload)

    const uploaded = await axios.post(
      `${process.env.NEXT_PUBLIC_API_URL}/menu/upload`,
      fd,
      authConfig(),
    )
    if (!uploaded.data?.url) throw new Error('Menu image upload failed.')
    return uploaded.data.url
  }

  const openEditMenuItem = (item: any) => {
    setEditingMenuItem(item)
    setEditName(String(item.name || ''))
    setEditPrice(String(item.price ?? ''))
    setEditItemDiscount(String(item.discount ?? 0))
    setEditCategory(String(item.category || ''))
    setEditDescription(String(item.description || ''))
    setEditCustomizations(
      Array.isArray(item.customizations)
        ? item.customizations.map((group: any) => ({
            ...group,
            options: Array.isArray(group.options)
              ? group.options.map((option: any) => ({ ...option }))
              : [],
          }))
        : [],
    )
    setEditImage(null)
    setRemoveEditImage(false)
  }

  const saveEditedMenuItem = async () => {
    if (!editingMenuItem || editMenuItemLockRef.current) return

    const name = editName.trim()
    const price = Number(editPrice)
    const discount = Number(editItemDiscount)

    if (!name || !Number.isFinite(price) || price <= 0) {
      alert('Enter an item name and a valid price greater than zero.')
      return
    }
    if (!Number.isFinite(discount) || discount < 0 || discount >= 100) {
      alert('Discount must be between 0 and less than 100.')
      return
    }

    let customizations: any[]
    try {
      customizations = prepareMenuCustomizations(editCustomizations)
    } catch (error: any) {
      alert(error?.message || 'Invalid customizations.')
      return
    }

    editMenuItemLockRef.current = true
    setIsSavingMenuItem(true)

    try {
      const changes: Record<string, any> = {
        name,
        price,
        discount,
        category: editCategory.trim(),
        description: editDescription.trim(),
        customizations,
      }

      // Omit imageUrl to preserve the current image when no photo is selected.
      if (editImage) {
        changes.imageUrl = await uploadKitchenMenuImage(editImage)
      } else if (removeEditImage) {
        changes.imageUrl = ''
      }

      await axios.patch(
        `${process.env.NEXT_PUBLIC_API_URL}/menu/edit/${editingMenuItem.id}`,
        changes,
        authConfig(),
      )

      setEditingMenuItem(null)
      setEditImage(null)
      await loadMenu()
    } catch (error: any) {
      console.error('UPDATE MENU ITEM ERROR', error)
      const message =
        error?.response?.data?.message ||
        error?.response?.data?.error ||
        error?.message ||
        'Failed to update item'
      alert(`Failed to update item: ${Array.isArray(message) ? message.join(', ') : message}`)
    } finally {
      editMenuItemLockRef.current = false
      setIsSavingMenuItem(false)
    }
  }

  const createItem =
    async () => {
      if (
        createItemLockRef.current
      ) {
        return
      }

      if (!newName.trim()) {
        alert("Name required")
        return
      }

      if (
        !newPrice ||
        !Number.isFinite(Number(newPrice)) ||
        Number(newPrice) <= 0
      ) {
        alert("Valid price required")
        return
      }

      const discount = Number(newDiscount)
      if (!Number.isFinite(discount) || discount < 0 || discount >= 100) {
        alert('Discount must be between 0 and less than 100.')
        return
      }

      let customizations: any[]
      try {
        customizations = prepareMenuCustomizations(newCustomizations)
      } catch (error: any) {
        alert(error?.message || 'Invalid customizations.')
        return
      }

      createItemLockRef.current =
        true
      setIsCreatingItem(true)

      try {
        let imageUrl = ''

        if (newImage) {
          imageUrl = await uploadKitchenMenuImage(newImage)
        }

        await axios.post(
          `${process.env.NEXT_PUBLIC_API_URL}/menu/create`,
          {
            businessId,
            name: newName,
            price:
              Number(
                newPrice,
              ),
            category:
              newCategory,
            discount:
              Number(
                newDiscount,
              ),
            description:
              newDescription,
            imageUrl,
            customizations,
          },
          authConfig(),
        )

        setShowAddModal(
          false,
        )

        setNewName('')
        setNewPrice('')
        setNewDiscount('0')
        setNewDescription('')
        setNewCategory('food')
        setNewImage(null)
        setNewCustomizations([])

        await Promise.all([
          loadMenu(),
          load(),
        ])
      } catch (err: any) {
        console.error(
          'CREATE MENU ITEM ERROR',
          err,
        )

        const message =
          err?.response?.data?.message ||
          err?.response?.data?.error ||
          err?.message ||
          'Failed to create item'

        alert(
          `Failed to create item: ${message}`,
        )
      } finally {
        createItemLockRef.current =
          false
        setIsCreatingItem(false)
      }
    }

  const saveMenuDiscount =
    async (
      overrideValue?: number,
    ) => {
      if (
        !editingDiscountItem ||
        isSavingDiscount
      ) {
        return
      }

      const value =
        overrideValue ??
        Number(editDiscount)

      if (
        !Number.isFinite(value) ||
        value < 0 ||
        value >= 100
      ) {
        alert(
          'Discount must be between 0 and less than 100.',
        )
        return
      }

      setIsSavingDiscount(true)

      try {
        await axios.patch(
          `${process.env.NEXT_PUBLIC_API_URL}/menu/discount/${editingDiscountItem.id}`,
          {
            discount: value,
          },
          authConfig(),
        )

        setEditingDiscountItem(null)
        setEditDiscount('0')

        await loadMenu()
      } catch (err: any) {
        console.error(
          'UPDATE MENU DISCOUNT ERROR',
          err,
        )

        const message =
          err?.response?.data?.message ||
          err?.response?.data?.error ||
          err?.message ||
          'Failed to update discount'

        alert(
          `Failed to update discount: ${message}`,
        )
      } finally {
        setIsSavingDiscount(false)
      }
    }



  const openRefund = (
    id: number,
  ) => {
    setRefundOrderId(id)
  }

  const submitRefund = async () => {
    if (
      !refundOrderId ||
      refundSubmitting
    ) {
      return
    }

    setRefundSubmitting(true)

    try {
      const response =
        await axios.patch(
          `${process.env.NEXT_PUBLIC_API_URL}/kitchen-auth/orders/${refundOrderId}/refund`,
          {},
          authConfig(),
        )

      const result =
        response.data

      if (result?.pending) {
        alert(
          'Refund is processing. CaviarQR will reconcile the final Stripe result automatically.',
        )
      } else if (result?.success) {
        alert(
          'Refund issued successfully.',
        )
      } else {
        throw new Error(
          result?.message ||
            'Refund could not be completed.',
        )
      }

      setRefundOrderId(null)

      await load()
    } catch (err: any) {
      console.error(
        'KITCHEN REFUND ERROR',
        err,
      )

      const message =
        err?.response?.data?.message ||
        err?.response?.data?.error ||
        err?.message ||
        'Refund could not be completed.'

      alert(message)
    } finally {
      setRefundSubmitting(false)
    }
  }

  const currentOrders =
    orders.filter(
      (o) =>
        o.status !== "DONE" &&
        o.status !== "REFUNDED",
    )

  const historyOrders =
    pastOrders

  const visible = showHistory
    ? historyOrders
    : currentOrders

  const refundOrder = orders.find(
    (o) => o.id === refundOrderId,
  )

  const elapsed = (
    iso: string,
  ) => {
    const created =
      new Date(iso)

    const local =
      new Date(
        created.toLocaleString(
          "en-US",
          {
            timeZone:
              "Asia/Kolkata",
          },
        ),
      )

    const mins = Math.max(
      0,
      Math.floor(
        (Date.now() -
          local.getTime()) /
          60000,
      ),
    )

    if (mins < 1)
      return "just now"

    if (mins === 1)
      return "1 min ago"

    if (mins < 60)
      return `${mins} mins ago`

    const hours =
      Math.floor(mins / 60)

    if (hours === 1)
      return "1 hour ago"

    return `${hours} hours ago`
  }

  const statusConfig: Record<
    string,
    {
      dot: string
      label: string
    }
  > = {
    NEW: {
      dot: "#EF9F27",
      label: "New",
    },

    PREPARING: {
      dot: "#378ADD",
      label: "Preparing",
    },

    READY: {
      dot: "#7B61FF",
      label: "Ready",
    },

    DONE: {
      dot: "#639922",
      label: "Completed",
    },

    REFUNDED: {
      dot: "#A32D2D",
      label: "Refunded",
    },
  }

  if (
    !sessionReady ||
    !storeCode ||
    !businessId
  ) {
    return (
      <div
        style={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#f4f2ed',
          color: '#666',
          fontSize: 14,
        }}
      >
        Loading kitchen…
      </div>
    )
  }

  return (
    <div
      style={{
        padding: 20,
        minHeight: "100vh",
        background: "#f4f2ed",
      }}
    >
      {ordersLoadError && (
        <div
          role="alert"
          style={{
            padding: "12px 14px",
            marginBottom: 16,
            border: "1px solid #d39e36",
            background: "#fff7e5",
            color: "#6b4700",
            borderRadius: 8,
            fontSize: 13,
          }}
        >
          Connection warning: Kitchen orders could not be refreshed.
          Existing orders remain visible; retrying automatically.
        </div>
      )}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent:
            "space-between",
          marginBottom: 20,
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
          }}
        >
          <h1
            style={{
              fontSize: 18,
              fontWeight: 500,
              letterSpacing:
                "-0.3px",
            }}
          >
            Kitchen
          </h1>

          <div
            style={{
              display: 'flex',
              gap: 8,
              marginTop: 10,
            }}
          >
            <button
              onClick={() =>
                setTab('orders')
              }
            >
              Orders
            </button>

            <button
              onClick={() =>
                setTab('menu')
              }
            >
              Menu
            </button>
          </div>

          <span
            style={{
              fontSize: 12,
              fontWeight: 500,
              padding: "3px 10px",
              borderRadius: 20,
              background:
                showHistory
                  ? "#E6F1FB"
                  : "#EAF3DE",
              color:
                showHistory
                  ? "#185FA5"
                  : "#3B6D11",
            }}
          >
            {showHistory
              ? `${visible.length} past`
              : `${currentOrders.length} active`}
          </span>
        </div>

        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
          }}
        >
          <span
            style={{
              fontSize: 12,
              color: "#888",
              letterSpacing:
                "0.3px",
            }}
          >
            {showHistory
              ? "Past orders (24h)"
              : "Current orders"}
          </span>

          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
            }}
          >
            <span
              style={{
                fontSize: 12,
                fontWeight: 600,
                color: isOpen
                  ? "#4D7A19"
                  : "#A32D2D",
                minWidth: 52,
                textAlign: "right",
              }}
            >
              {isOpen
                ? "OPEN"
                : "CLOSED"}
            </span>

            <button
              onClick={toggleKitchen}
              style={{
                width: 48,
                height: 28,
                borderRadius: 999,
                border: "none",
                background: isOpen
                  ? "#7BC043"
                  : "#D6D3CD",
                position: "relative",
                cursor: "pointer",
                transition:
                  "background 0.18s ease",
                padding: 0,
              }}
            >
              <div
                style={{
                  width: 22,
                  height: 22,
                  borderRadius: "50%",
                  background: "white",
                  position: "absolute",
                  top: 3,
                  left: isOpen
                    ? 23
                    : 3,
                  transition:
                    "left 0.18s ease",
                  boxShadow:
                    "0 1px 4px rgba(0,0,0,0.18)",
                }}
              />
            </button>
          </div>

          <button
            onClick={() =>
              setShowHistory(
                !showHistory,
              )
            }
            style={{
              fontSize: 13,
              padding:
                "7px 16px",
              borderRadius: 8,
              border:
                "0.5px solid #d0cec8",
              background: "white",
              color: "#222",
              cursor: "pointer",
              fontFamily:
                "inherit",
            }}
          >
            {showHistory
              ? "View current"
              : "View past"}
          </button>
        </div>
      </div>

      {tab === 'orders' && (
        <>
          <div
            style={{
              maxHeight: "80vh",
              overflowY: "auto",
            }}
          >
            {visible.length === 0 ? (
              <p
                style={{
                  textAlign: "center",
                  color: "#aaa",
                  fontSize: 14,
                  padding:
                    "60px 0",
                }}
              >
                {showHistory
                  ? "No completed orders in the last 24 hours."
                  : "No active orders right now."}
              </p>
            ) : (
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns:
                    "repeat(auto-fill, minmax(210px, 1fr))",
                  gap: 12,
                }}
              >
                {visible.map((o) => {
                  console.log(
                    "ORDER TIME",
                    o.createdAt,
                  )

                  const sc =
                    statusConfig[
                      o.status
                    ] ?? {
                      dot: "#aaa",
                      label:
                        o.status,
                    }

                  return (
                    <div
                      key={o.id}
                      style={{
                        background:
                          "white",
                        borderRadius: 12,
                        border:
                          "0.5px solid #e0ddd7",
                        padding:
                          "14px 16px",
                        display: "flex",
                        flexDirection:
                          "column",
                        gap: 10,
                        opacity:
                          o.status ===
                            "DONE" ||
                          o.status ===
                            "REFUNDED"
                            ? 0.7
                            : 1,
                      }}
                    >
                      <div
                        style={{
                          display:
                            "flex",
                          alignItems:
                            "center",
                          justifyContent:
                            "space-between",
                        }}
                      >
                        <span
                          style={{
                            fontSize: 13,
                            fontWeight: 500,
                          }}
                        >
                          #{o.id}
                        </span>

                        <span
                          style={{
                            fontSize: 11,
                            padding:
                              "2px 8px",
                            borderRadius: 20,
                            background:
                              "#f4f2ed",
                            color: "#666",
                            border:
                              "0.5px solid #e0ddd7",
                          }}
                        >
                          Table{" "}
                          {o.tableNumber ??
                            "?"}
                        </span>
                      </div>

                      {o.createdAt && (
                        <span
                          style={{
                            fontSize: 11,
                            color: "#aaa",
                          }}
                        >
                          {elapsed(
                            o.createdAt,
                          )}
                        </span>
                      )}

                      <div
                        style={{
                          borderTop:
                            "0.5px solid #f0ede8",
                          paddingTop: 10,
                          display: "flex",
                          flexDirection:
                            "column",
                          gap: 5,
                        }}
                      >
                        {o.items?.map(
                          (
                            item: any,
                            idx: number,
                          ) => {
                            const customerNote =
                              String(
                                item.note ||
                                  item.notes ||
                                  '',
                              ).trim()

                            const selectedCustomizations =
                              Array.isArray(
                                item.customizations,
                              )
                                ? item.customizations
                                : []

                            return (
                              <div
                                key={idx}
                                style={{
                                  display: 'flex',
                                  flexDirection:
                                    'column',
                                  gap: 5,
                                }}
                              >
                                <div
                                  style={{
                                    display: 'flex',
                                    justifyContent:
                                      'space-between',
                                    alignItems:
                                      'center',
                                  }}
                                >
                                  <span
                                    style={{
                                      fontSize: 13,
                                    }}
                                  >
                                    {item.name}
                                  </span>

                                  <span
                                    style={{
                                      fontSize: 11,
                                      padding:
                                        '1px 7px',
                                      borderRadius: 20,
                                      background:
                                        '#f4f2ed',
                                      color: '#888',
                                    }}
                                  >
                                    x{item.qty || 1}
                                  </span>
                                </div>

                                {selectedCustomizations.length > 0 && (
                                  <div
                                    style={{
                                      display: 'flex',
                                      flexDirection: 'column',
                                      gap: 4,
                                      padding: '7px 9px',
                                      borderRadius: 8,
                                      background: '#F2F7FF',
                                      color: '#24456B',
                                      border: '0.5px solid #C9DDF6',
                                    }}
                                  >
                                    {selectedCustomizations.map(
                                      (
                                        group: any,
                                        groupIndex: number,
                                      ) => (
                                        <div
                                          key={
                                            group.groupId ||
                                            groupIndex
                                          }
                                          style={{
                                            fontSize: 12,
                                            lineHeight: 1.4,
                                            fontWeight: 600,
                                          }}
                                        >
                                          <strong>
                                            {group.groupName}:
                                          </strong>{' '}
                                          {Array.isArray(
                                            group.options,
                                          )
                                            ? group.options
                                                .map(
                                                  (
                                                    option: any,
                                                  ) =>
                                                    option.name,
                                                )
                                                .join(', ')
                                            : ''}
                                        </div>
                                      ),
                                    )}
                                  </div>
                                )}

                                {customerNote && (
                                  <div
                                    style={{
                                      fontSize: 12,
                                      lineHeight: 1.4,
                                      padding:
                                        '7px 9px',
                                      borderRadius: 8,
                                      background:
                                        '#FFF4D8',
                                      color: '#6B4F00',
                                      border:
                                        '0.5px solid #E8D59B',
                                      whiteSpace:
                                        'pre-wrap',
                                      overflowWrap:
                                        'anywhere',
                                    }}
                                  >
                                    <strong>
                                      Note:
                                    </strong>{' '}
                                    {customerNote}
                                  </div>
                                )}
                              </div>
                            )
                          },
                        )}
                      </div>

                      <div
                        style={{
                          display:
                            "flex",
                          alignItems:
                            "center",
                          gap: 6,
                        }}
                      >
                        <div
                          style={{
                            width: 7,
                            height: 7,
                            borderRadius:
                              "50%",
                            background:
                              sc.dot,
                            flexShrink: 0,
                          }}
                        />

                        <span
                          style={{
                            fontSize: 12,
                            color: "#888",
                          }}
                        >
                          {sc.label}
                        </span>
                      </div>

                      {!showHistory && (
                        <div
                          style={{
                            fontSize: 11,
                            color:
                              o.kitchenAcknowledged
                                ? "#4D7A19"
                                : "#A36A00",
                            background:
                              o.kitchenAcknowledged
                                ? "#EAF3DE"
                                : "#FFF4D8",
                            border:
                              "0.5px solid #e0ddd7",
                            padding:
                              "4px 8px",
                            borderRadius: 8,
                          }}
                        >
                          {o.kitchenAcknowledged
                            ? "Kitchen received"
                            : "Sending kitchen confirmation..."}
                        </div>
                      )}

                      {!showHistory && (
                        <div
                          style={{
                            display:
                              "flex",
                            gap: 8,
                            marginTop: 2,
                          }}
                        >
                          <button
                            onClick={() =>
                              completeOrder(
                                o.id,
                              )
                            }
                            style={{
                              flex: 1,
                              fontSize: 12,
                              fontWeight: 500,
                              padding:
                                "8px 0",
                              borderRadius: 8,
                              border:
                                "none",
                              background:
                                "#639922",
                              color:
                                "#EAF3DE",
                              cursor:
                                "pointer",
                              fontFamily:
                                "inherit",
                            }}
                          >
                            Mark done
                          </button>

                          <button
                            onClick={() =>
                              openRefund(
                                o.id,
                              )
                            }
                            style={{
                              flex: 1,
                              fontSize: 12,
                              fontWeight: 500,
                              padding:
                                "8px 0",
                              borderRadius: 8,
                              border:
                                "0.5px solid #e0ddd7",
                              background:
                                "white",
                              color:
                                "#A32D2D",
                              cursor:
                                "pointer",
                              fontFamily:
                                "inherit",
                            }}
                          >
                            Refund
                          </button>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </>
      )}

      {tab === 'menu' && (
        <>
          <div
            style={{
              display: 'flex',
              justifyContent:
                'space-between',
              marginBottom: 16,
            }}
          >
            <h2>Menu</h2>

            <button
              onClick={() =>
                setShowAddModal(
                  true,
                )
              }
            >
              + Add Item
            </button>
          </div>

          <input
            value={search}
            onChange={(e) =>
              setSearch(
                e.target.value,
              )
            }
            placeholder="Search menu..."
            style={{
              width: '100%',
              padding: 12,
              borderRadius: 10,
              border:
                '1px solid #ddd',
              marginBottom: 16,
            }}
          />

          <div
            style={{
              display: 'grid',
              gridTemplateColumns:
                'repeat(auto-fill,minmax(250px,1fr))',
              gap: 12,
              marginTop: 20,
            }}
          >
          {menuItems
            .filter((item) => {
              const q =
                search.toLowerCase()

              return (
                item.name
                  ?.toLowerCase()
                  .includes(q) ||
                item.category
                  ?.toLowerCase()
                  .includes(q) ||
                item.description
                  ?.toLowerCase()
                  .includes(q)
              )
            })
            .map(
            (item: any) => (
              <div
                key={item.id}
                style={{
                  background:
                    'white',
                  padding: 16,
                  borderRadius: 12,
                  border:
                    '1px solid #eee',
                }}
              >
                {item.imageUrl && (
                  <>
                  {(() => {
                    console.log(
                      "IMAGE URL",
                      `${process.env.NEXT_PUBLIC_API_URL}${item.imageUrl}`,
                    )
                    return null
                  })()}
                  <img
                    src={`${process.env.NEXT_PUBLIC_API_URL}${item.imageUrl}`}
                    onError={(e) => {
                      ;(
                        e.target as HTMLImageElement
                      ).src =
                        "/placeholder-food.png"
                    }}
                    alt={item.name}
                    style={{
                      width: '100%',
                      height: 140,
                      objectFit: 'cover',
                      borderRadius: 10,
                      marginBottom: 10,
                    }}
                  />
                  </>
                )}

                <h3>
                  {item.name}
                </h3>

                {item.description && (
                  <p
                    style={{
                      fontSize: 12,
                      color: "#666",
                      marginTop: 4,
                      marginBottom: 8,
                    }}
                  >
                    {item.description}
                  </p>
                )}

                <p>
                  ${item.price}
                </p>

                {item.discount > 0 && (
                  <div
                    style={{
                      color: '#4D7A19',
                      fontWeight: 600,
                    }}
                  >
                    {item.discount}% OFF
                  </div>
                )}

                <div
                  style={{
                    fontSize: 11,
                    color:
                      item.isHidden
                        ? "#A32D2D"
                        : "#888",
                  }}
                >
                  {item.isHidden
                    ? "Hidden from customers"
                    : "Visible to customers"}
                </div>

                <div
                  style={{
                    display: 'flex',
                    gap: 8,
                    marginTop: 10,
                  }}
                >

                  <button
                      type="button"
                      onClick={() => {
                        setEditingDiscountItem(
                          item,
                        )
                        setEditDiscount(
                          String(
                            Number(
                              item.discount || 0,
                            ),
                          ),
                        )
                      }}
                    >
                      Edit sale
                    </button>

                    <button
                      type="button"
                      onClick={() => openEditMenuItem(item)}
                    >
                      Edit item
                    </button>

                    <button
                    onClick={() =>
                      toggleHide(
                        item.id,
                      )
                    }
                  >
                    {item.isHidden
                      ? 'Show'
                      : 'Hide'}
                  </button>
                </div>
              </div>
            ),
          )}
          </div>
        </>
      )}

        {editingDiscountItem && (
          <div
            style={{
              position: 'fixed',
              inset: 0,
              background: 'rgba(0,0,0,.4)',
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center',
              zIndex: 1000,
              padding: 16,
            }}
          >
            <div
              style={{
                background: 'white',
                padding: 20,
                borderRadius: 12,
                width: '100%',
                maxWidth: 400,
                display: 'flex',
                flexDirection: 'column',
                gap: 12,
              }}
            >
              <h3 style={{ margin: 0 }}>
                Edit sale
              </h3>

              <div
                style={{
                  fontSize: 17,
                  fontWeight: 600,
                }}
              >
                {editingDiscountItem.name}
              </div>

              <div>
                <div
                  style={{
                    fontSize: 12,
                    color: '#666',
                  }}
                >
                  Regular price
                </div>

                <strong>
                  ${Number(
                    editingDiscountItem.price,
                  ).toFixed(2)}
                </strong>
              </div>

              <label
                style={{
                  fontSize: 12,
                  fontWeight: 600,
                }}
              >
                Discount (%)
              </label>

              <input
                type="number"
                min="0"
                max="99.99"
                step="0.01"
                value={editDiscount}
                onChange={(e) =>
                  setEditDiscount(
                    e.target.value,
                  )
                }
                placeholder="0"
              />

              {Number(editDiscount) > 0 &&
                Number(editDiscount) < 100 && (
                  <div
                    style={{
                      padding: 12,
                      background: '#f7f7f5',
                      borderRadius: 10,
                    }}
                  >
                    <div
                      style={{
                        fontSize: 12,
                        color: '#666',
                      }}
                    >
                      Customer pays
                    </div>

                    <strong
                      style={{
                        fontSize: 20,
                      }}
                    >
                      ${(
                        Number(
                          editingDiscountItem.price,
                        ) *
                        (1 -
                          Number(
                            editDiscount,
                          ) /
                            100)
                      ).toFixed(2)}
                    </strong>
                  </div>
                )}

              <div
                style={{
                  display: 'flex',
                  gap: 8,
                  flexWrap: 'wrap',
                }}
              >
                <button
                  type="button"
                  disabled={isSavingDiscount}
                  onClick={() =>
                    void saveMenuDiscount()
                  }
                >
                  {isSavingDiscount
                    ? 'Saving...'
                    : 'Save sale'}
                </button>

                {Number(
                  editingDiscountItem.discount || 0,
                ) > 0 && (
                  <button
                    type="button"
                    disabled={isSavingDiscount}
                    onClick={() =>
                      void saveMenuDiscount(0)
                    }
                  >
                    Remove discount
                  </button>
                )}

                <button
                  type="button"
                  disabled={isSavingDiscount}
                  onClick={() => {
                    setEditingDiscountItem(null)
                    setEditDiscount('0')
                  }}
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}

      {editingMenuItem && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={`Edit ${editingMenuItem.name}`}
          style={{
            position: 'fixed', inset: 0, zIndex: 1100,
            background: 'rgba(0,0,0,.45)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            padding: 16,
          }}
        >
          <div
            style={{
              width: '100%', maxWidth: 540, maxHeight: '90vh',
              overflowY: 'auto', boxSizing: 'border-box',
              background: '#fff', borderRadius: 12, padding: 20,
              display: 'flex', flexDirection: 'column', gap: 12,
            }}
          >
            <h3 style={{ margin: 0 }}>Edit Menu Item</h3>
            <label>
              Item name
              <input
                style={{ display: 'block', width: '100%', boxSizing: 'border-box' }}
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
              />
            </label>
            <label>
              Price ($)
              <input
                style={{ display: 'block', width: '100%', boxSizing: 'border-box' }}
                type="number" min="0.01" step="0.01"
                value={editPrice}
                onChange={(e) => setEditPrice(e.target.value)}
              />
            </label>
            <label>
              Discount (%)
              <input
                style={{ display: 'block', width: '100%', boxSizing: 'border-box' }}
                type="number" min="0" max="99.99" step="0.01"
                value={editItemDiscount}
                onChange={(e) => setEditItemDiscount(e.target.value)}
              />
            </label>
            <label>
              Category
              <input
                style={{ display: 'block', width: '100%', boxSizing: 'border-box' }}
                value={editCategory}
                onChange={(e) => setEditCategory(e.target.value)}
              />
            </label>
            <label>
              Description
              <textarea
                style={{ display: 'block', width: '100%', boxSizing: 'border-box', minHeight: 95 }}
                value={editDescription}
                onChange={(e) => setEditDescription(e.target.value)}
              />
            </label>
            {editingMenuItem.imageUrl && !removeEditImage && !editImage && (
              <div>
                <div style={{ fontSize: 12, marginBottom: 6 }}>Current menu image</div>
                <img
                  src={`${process.env.NEXT_PUBLIC_API_URL}${editingMenuItem.imageUrl}`}
                  alt={editingMenuItem.name}
                  style={{ maxWidth: 180, maxHeight: 130, objectFit: 'cover', borderRadius: 8 }}
                />
              </div>
            )}
            <label>
              Replace menu image
              <input
                type="file" accept="image/jpeg,image/png,image/webp"
                style={{ display: 'block', marginTop: 6 }}
                onChange={(e) => {
                  const file = e.target.files?.[0] || null
                  if (file && !['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
                    alert('Choose a JPG, PNG or WebP image.')
                    e.target.value = ''
                    return
                  }
                  setEditImage(file)
                  if (file) setRemoveEditImage(false)
                }}
              />
            </label>
            {editImage && <div style={{ fontSize: 12 }}>New image: {editImage.name}</div>}
            {editingMenuItem.imageUrl && (
              <label style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <input
                  type="checkbox"
                  checked={removeEditImage}
                  onChange={(e) => {
                    setRemoveEditImage(e.target.checked)
                    if (e.target.checked) setEditImage(null)
                  }}
                />
                Remove current menu image
              </label>
            )}
            <CustomizationBuilder
              value={editCustomizations}
              onChange={setEditCustomizations}
              currencySymbol="$"
            />
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              <button type="button" disabled={isSavingMenuItem} onClick={() => void saveEditedMenuItem()}>
                {isSavingMenuItem ? 'Saving…' : 'Save Changes'}
              </button>
              <button
                type="button"
                disabled={isSavingMenuItem}
                onClick={() => setEditingMenuItem(null)}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {showAddModal && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background:
              'rgba(0,0,0,.4)',
            display: 'flex',
            justifyContent:
              'center',
            alignItems:
              'center',
            padding: 16,
            zIndex: 999,
          }}
        >
          <div
            style={{
              background:
                'white',
              padding: 20,
              borderRadius: 12,
              width: '100%',
              maxWidth: 540,
              maxHeight: '90vh',
              overflowY: 'auto',
              boxSizing: 'border-box',
              display: 'flex',
              flexDirection:
                'column',
              gap: 10,
            }}
          >
            <h3>
              Add Menu Item
            </h3>

            <input
              placeholder="Name"
              value={newName}
              onChange={(e) =>
                setNewName(
                  e.target.value,
                )
              }
            />

            <input
              placeholder="Price"
              value={newPrice}
              onChange={(e) =>
                setNewPrice(
                  e.target.value,
                )
              }
            />

            <input
              placeholder="Discount %"
              value={
                newDiscount
              }
              onChange={(e) =>
                setNewDiscount(
                  e.target.value,
                )
              }
            />

            <input
              placeholder="Category"
              value={
                newCategory
              }
              onChange={(e) =>
                setNewCategory(
                  e.target.value,
                )
              }
            />

            <textarea
              placeholder="Description"
              rows={4}
              style={{
                minHeight: 112,
                height: 112,
                flexShrink: 0,
                width: '100%',
                boxSizing: 'border-box',
                resize: 'vertical',
              }}
              value={newDescription}
              onChange={(e) =>
                setNewDescription(
                  e.target.value,
                )
              }
            />

            <input
              type="file"
              accept="image/*"
              onChange={(e) => {
                const file =
                  e.target.files?.[0] ||
                  null

                if (
                  file &&
                  !file.type.startsWith(
                    'image/',
                  )
                ) {
                  alert(
                    'Please choose an image file.',
                  )
                  e.target.value = ''
                  setNewImage(null)
                  return
                }

                setNewImage(file)
              }}
            />

            {newImage && (
              <p>
                {newImage.name}
              </p>
            )}

            <CustomizationBuilder
              value={newCustomizations}
              onChange={setNewCustomizations}
              currencySymbol="$"
            />

            <button
              type="button"
              disabled={
                isCreatingItem
              }
              onClick={
                createItem
              }
              style={{
                opacity:
                  isCreatingItem
                    ? 0.6
                    : 1,
                cursor:
                  isCreatingItem
                    ? 'not-allowed'
                    : 'pointer',
              }}
            >
              {isCreatingItem
                ? 'Creating…'
                : 'Create Item'}
            </button>

            <button
              type="button"
              disabled={
                isCreatingItem
              }
              onClick={() =>
                setShowAddModal(
                  false,
                )
              }
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {refundOrderId && (
        <div
          onClick={(e) => {
            if (
              e.target ===
              e.currentTarget
            ) {
              setRefundOrderId(
                null,
              )
            }
          }}
          style={{
            position: "fixed",
            inset: 0,
            background:
              "rgba(0,0,0,0.35)",
            display: "flex",
            alignItems:
              "center",
            justifyContent:
              "center",
            zIndex: 100,
          }}
        >
          <div
            style={{
              background:
                "white",
              borderRadius: 12,
              border:
                "0.5px solid #d0cec8",
              padding:
                "20px 22px",
              width: 300,
              display: "flex",
              flexDirection:
                "column",
              gap: 14,
            }}
          >
            <div>
              <h3
                style={{
                  fontSize: 15,
                  fontWeight: 500,
                }}
              >
                Refund this order?
              </h3>

              <p
                style={{
                  fontSize: 12,
                  color: "#888",
                  marginTop: 4,
                }}
              >
                Order #
                {
                  refundOrderId
                }{" "}
                · Table{" "}
                {refundOrder?.tableNumber ??
                  "?"}
              </p>
            </div>

            <p
              style={{
                fontSize: 12,
                color: "#666",
                lineHeight: 1.5,
                margin: 0,
              }}
            >
              This will refund the eligible order amount
              to the customer&apos;s original payment method.
              Payment processing fees and the CaviarQR
              application fee are not refunded.
            </p>

            <div
              style={{
                display: "flex",
                gap: 8,
                marginTop: 4,
              }}
            >
              <button
                onClick={() =>
                  setRefundOrderId(
                    null,
                  )
                }
                style={{
                  flex: 1,
                  fontSize: 13,
                  padding:
                    "9px 0",
                  borderRadius: 8,
                  border:
                    "0.5px solid #d0cec8",
                  background:
                    "white",
                  color: "#555",
                  cursor:
                    "pointer",
                  fontFamily:
                    "inherit",
                }}
              >
                Cancel
              </button>

              <button
                onClick={
                  submitRefund
                }
                disabled={
                  refundSubmitting
                }
                style={{
                  opacity:
                    refundSubmitting
                      ? 0.6
                      : 1,
                  flex: 1,
                  fontSize: 13,
                  fontWeight: 500,
                  padding:
                    "9px 0",
                  borderRadius: 8,
                  border:
                    "none",
                  background:
                    "#A32D2D",
                  color:
                    "#FCEBEB",
                  cursor:
                    "pointer",
                  fontFamily:
                    "inherit",
                }}
              >
                {refundSubmitting
                  ? "Refunding…"
                  : "Issue refund"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}