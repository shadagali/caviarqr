import { View, Text } from 'react-native';

export default function Cancel() {
  return (
    <View style={{ padding: 20 }}>
      <Text style={{ fontSize: 24 }}>❌ Payment Cancelled</Text>
      <Text>Please try again.</Text>
    </View>
  );
}