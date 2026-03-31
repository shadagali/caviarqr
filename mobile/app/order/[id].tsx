import { useLocalSearchParams } from "expo-router"
import { useEffect, useState } from "react"
import { View, Text } from "react-native"

export default function OrderStatus(){

  const { id } = useLocalSearchParams()

  const [order,setOrder] = useState<any>(null)

  async function loadOrder(){

    const res = await fetch(
      `http://YOUR_IP:3001/order/${id}`
    )

    const data = await res.json()

    setOrder(data)

  }

  useEffect(()=>{

    loadOrder()

    const interval = setInterval(loadOrder,3000)

    return ()=>clearInterval(interval)

  },[])

  if(!order){

    return(
      <View>
        <Text>Loading...</Text>
      </View>
    )

  }

  return(

    <View style={{ flex:1, padding:20 }}>

      <Text style={{ fontSize:28, fontWeight:"bold" }}>
        Order #{order.id}
      </Text>

      <Text style={{ marginTop:20, fontSize:20 }}>
        Status: {order.status}
      </Text>

    </View>

  )

}