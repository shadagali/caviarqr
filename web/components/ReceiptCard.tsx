'use client'

type Props = {
  order: any
}

export default function ReceiptCard({
  order,
}: Props) {
  return (
    <div
      id="receipt-card"
      style={{
        width: 380,
        background: 'white',
        padding: 24,
        borderRadius: 20,
        color: '#111',
        fontFamily:
          'Arial, sans-serif',
      }}
    >
      <div
        style={{
          textAlign: 'center',
          marginBottom: 20,
        }}
      >
        <h1
          style={{
            fontSize: 28,
            marginBottom: 6,
          }}
        >
          TapServe
        </h1>

        <div
          style={{
            color: '#777',
            fontSize: 14,
          }}
        >
          Order Receipt
        </div>
      </div>

      <div
        style={{
          marginBottom: 18,
        }}
      >
        <div>
          <b>Order:</b> #
          {order.id}
        </div>

        <div>
          <b>Table:</b>{' '}
          {order.tableNumber}
        </div>

        <div>
          <b>Status:</b>{' '}
          {order.status}
        </div>
      </div>

      <div
        style={{
          borderTop:
            '1px solid #eee',
          borderBottom:
            '1px solid #eee',
          padding: '14px 0',
          marginBottom: 18,
        }}
      >
        {order.items?.map(
          (
            item: any,
            i: number,
          ) => (
            <div
              key={i}
              style={{
                display: 'flex',
                justifyContent:
                  'space-between',
                marginBottom: 10,
              }}
            >
              <div>
                {item.name} ×
                {item.qty || 1}
              </div>

              <div>
                $
                {(
                  item.price *
                  (item.qty ||
                    1)
                ).toFixed(2)}
              </div>
            </div>
          ),
        )}
      </div>

      <div
        style={{
          display: 'flex',
          justifyContent:
            'space-between',
          fontSize: 20,
          fontWeight: 700,
          marginBottom: 20,
        }}
      >
        <div>Total</div>

        <div>
          $
          {Number(
            order.total,
          ).toFixed(2)}
        </div>
      </div>

      <div
        style={{
          textAlign: 'center',
          color: '#888',
          fontSize: 13,
        }}
      >
        Powered by TapServe
      </div>
    </div>
  )
}