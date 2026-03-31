import { useLocalSearchParams, useRouter } from "expo-router"
import { View, Text, TextInput, Pressable } from "react-native"
import { useState } from "react"

export default function ActivateKit(){

  const { kitCode } = useLocalSearchParams()
  const router = useRouter()

  const [name,setName] = useState("")
  const [storeCode,setStoreCode] = useState("")

  async function activate(){

    const business = await fetch(
      "http://YOUR_IP:3001/auth/register",
      {
        method:"POST",
        headers:{
          "Content-Type":"application/json"
        },
        body:JSON.stringify({
          name,
          storeCode
        })
      }
    )

    const businessData = await business.json()

    await fetch(
      "http://YOUR_IP:3001/kits/activate",
      {
        method:"POST",
        headers:{
          "Content-Type":"application/json"
        },
        body:JSON.stringify({
          kitCode,
          businessId: businessData.id
        })
      }
    )

    router.replace("/dashboard")

  }

  return(

    <View style={{ flex:1, padding:20 }}>

      <Text style={{ fontSize:26 }}>
        Activate Kit {kitCode}
      </Text>

      <TextInput
        placeholder="Restaurant Name"
        value={name}
        onChangeText={setName}
        style={{
          borderWidth:1,
          marginTop:20,
          padding:10
        }}
      />

      <TextInput
        placeholder="Store Code"
        value={storeCode}
        onChangeText={setStoreCode}
        style={{
          borderWidth:1,
          marginTop:10,
          padding:10
        }}
      />

      <Pressable
        onPress={activate}
        style={{
          marginTop:20,
          backgroundColor:"black",
          padding:15
        }}
      >

        <Text style={{ color:"white", textAlign:"center" }}>
          Activate
        </Text>

      </Pressable>

    </View>

  )

}