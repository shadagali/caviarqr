export class CreateOrderDto {
  businessId: number
  tableNumber: number
  items: any[]
  totalAmount: number
  stripePaymentIntentId: string
}