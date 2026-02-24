import { ImageResponse } from 'next/og'

// Route segment config
export const runtime = 'edge'

// Image generation
export function GET() {
  return new ImageResponse(
    (
      <div
        style={{
          fontSize: 96,
          background: '#16a34a',
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'white',
          borderRadius: '24px',
          fontWeight: 'bold',
        }}
      >
        B
      </div>
    ),
    {
      width: 192,
      height: 192,
    }
  )
}
