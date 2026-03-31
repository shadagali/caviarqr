import { useEffect, useState } from "react"
import { View, Text, ScrollView } from "react-native"
import { useSearchParams } from "expo-router"

export default function Kitchen() {
  const { storeCode } = useSearchParams()
  const [orders, setOrders] = useState<any[]>([])

  const fetchOrders = async () => {
    const res = await fetch(`http://YOUR_IP:3001/order/${storeCode}`)
    const data = await res.json()
    setOrders(data || [])
  }

  useEffect(() => {
    fetchOrders()
    const interval = setInterval(fetchOrders, 3000)
    return () => clearInterval(interval)
  }, [])

  return (
    <ScrollView style={{ padding: 20 }}>
      {orders.map(order => (
        <View
          key={order.id}
          style={{
            backgroundColor: "#111",
            padding: 15,
            marginBottom: 10,
            borderRadius: 10,
          }}
        >
          <Text style={{ color: "white", fontWeight: "bold" }}>
            Order #{order.id}
          </Text>

          {order.items.map((i, idx) => (
            <Text key={idx} style={{ color: "white" }}>
              {i.name} x{i.qty}
            </Text>
          ))}
        </View>
      ))}
    </ScrollView>
  )
}