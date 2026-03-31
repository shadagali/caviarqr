import { useLocalSearchParams } from 'expo-router'
import { useEffect, useState } from 'react'
import { View, Text, ScrollView, Image, Button } from 'react-native'

export default function StorePage() {
  const { storeCode } = useLocalSearchParams()
  const [menu, setMenu] = useState<any[]>([])
  const [cart, setCart] = useState<any[]>([])

  const fetchMenu = async () => {
    const res = await fetch(
      `http://127.0.0.1:3001/menu/${storeCode}`
    )
    const data = await res.json()
    setMenu(data)
  }

  useEffect(() => {
    fetchMenu()
  }, [])

  const addToCart = (item: any) => {
    setCart([...cart, item])
  }

  const checkout = async () => {
    const totalAmount = cart.reduce((sum, i) => sum + i.price, 0)

    const res = await fetch(
      'http://127.0.0.1:3001/order/checkout',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          storeCode,
          items: cart,
          totalAmount,
        }),
      }
    )

    const data = await res.json()

    // 🔥 open Stripe URL
    window.location.href = data.url
  }

  return (
    <ScrollView style={{ padding: 20 }}>
      <Text style={{ fontSize: 22, marginBottom: 10 }}>
        {storeCode}
      </Text>

      {menu.map((item) => (
        <View key={item.id} style={{ marginBottom: 20 }}>

          {item.imageUrl && (
            <Image
              source={{ uri: item.imageUrl }}
              style={{ width: '100%', height: 150 }}
            />
          )}

          <Text>{item.name}</Text>
          <Text>{item.category}</Text>
          <Text>₹{item.price}</Text>

          <Button title="Add to cart" onPress={() => addToCart(item)} />
        </View>
      ))}

      {cart.length > 0 && (
        <Button title="Checkout" onPress={checkout} />
      )}
    </ScrollView>
  )
}