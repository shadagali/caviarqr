import { useRouter } from 'expo-router';
import { useCart } from '../cartStore';

export default function Checkout() {
  const router = useRouter();
  const { items, storeCode } = useCart();

  const handleCheckout = async () => {
    const res = await fetch('http://localhost:3001/stripe/checkout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ items, storeCode }),
    });

    const data = await res.json();
    router.push(data.url);
  };

  return (
    <button onClick={handleCheckout}>
      Pay Now
    </button>
  );
}