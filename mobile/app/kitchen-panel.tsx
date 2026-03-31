import { useEffect, useState } from "react"
import { View, Text, ScrollView } from "react-native"

export default function KitchenPanel() {
  const [orders, setOrders] = useState<any[]>([])

  const fetchOrders = async () => {
    try {
      const res = await fetch("http://127.0.0.1:3001/order/cafe1")
      const data = await res.json()
      setOrders(Array.isArray(data) ? data : [])
    } catch (e) {
      console.log(e)
    }
  }

  useEffect(() => {
    fetchOrders()
    const i = setInterval(fetchOrders, 2000)
    return () => clearInterval(i)
  }, [])

  return (
    <ScrollView style={{ padding: 20, backgroundColor: "#000" }}>
      <Text style={{ color: "white" }}>Kitchen — cafe1</Text>

      {orders.map(o => (
        <View key={o.id}>
          <Text style={{ color: "white" }}>Order #{o.id}</Text>
          {o.items.map((i, idx) => (
            <Text key={idx} style={{ color: "white" }}>
              {i.name} x{i.qty}
            </Text>
          ))}
        </View>
      ))}
    </ScrollView>
  )
}