import { ImageResponse } from 'next/og'

// Route segment config
export const runtime = 'edge'

// Image generation
export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          fontSize: 72,
          background: '#13a663', // HSL 160 70% 40% (Rich Calm Green)
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'white',
          fontWeight: '700',
          borderRadius: '22%',
        }}
      >
        <div style={{ 
            display: 'flex', 
            border: '4px solid rgba(255,255,255,0.2)', 
            padding: '10px 20px',
            borderRadius: '15px'
        }}>
            BMS3
        </div>
      </div>
    ),
    {
      width: 180,
      height: 180,
    }
  )
}