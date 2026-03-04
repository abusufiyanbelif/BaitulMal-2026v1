
import { ImageResponse } from 'next/og'

// Route segment config
export const runtime = 'edge'

// Image generation
export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          fontSize: 16,
          background: '#1FB278', // Matching HSL 160 70% 40%
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'white',
          borderRadius: '6px',
          fontWeight: 'bold',
        }}
      >
        BMS3
      </div>
    ),
    {
      width: 32,
      height: 32,
    }
  )
}
