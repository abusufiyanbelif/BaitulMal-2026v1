import { ImageResponse } from 'next/og'

// Route segment config
export const runtime = 'edge'

// Image generation
export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          fontSize: 14,
          background: '#13a663', // HSL 160 70% 40% (Rich Calm Green)
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'white',
          borderRadius: '20%',
          fontWeight: 'bold',
          padding: '2px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            Bms3
        </div>
      </div>
    ),
    {
      width: 32,
      height: 32,
    }
  )
}