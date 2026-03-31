import { View, Text, TouchableOpacity } from 'react-native';
import { Link } from 'expo-router';
import { useCartStore } from '../cartStore';

export default function Cart() {
  const items = useCartStore((state) => state.items);

  const total = items.reduce((sum, i) => sum + i.price, 0);

  return (
    <View style={{ padding: 20 }}>
      <Text style={{ fontSize: 22 }}>Cart</Text>

      <Text>Items: {items.length}</Text>

      {items.map((item, i) => (
        <Text key={i}>
          {item.name} - ₹{item.price}
        </Text>
      ))}

      <Text style={{ marginTop: 10 }}>Total: ₹{total}</Text>

      {/* 🔥 FORCE CORRECT ROUTE */}
      <Link href="/(tabs)/checkout" asChild>
        <TouchableOpacity
          style={{
            marginTop: 20,
            backgroundColor: 'black',
            padding: 12,
            borderRadius: 8,
            alignItems: 'center',
          }}
        >
          <Text style={{ color: 'white' }}>
            Proceed to Checkout
          </Text>
        </TouchableOpacity>
      </Link>
    </View>
  );
}