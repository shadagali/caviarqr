import { View, Text } from 'react-native';

export default function Success() {
  return (
    <View style={{ padding: 20 }}>
      <Text style={{ fontSize: 24 }}>✅ Payment Successful</Text>
      <Text>Your order is being prepared.</Text>
    </View>
  );
}