import { ImageResponse } from 'next/og'
import * as React from 'react';

// Route segment config
export const runtime = 'edge'

// Image generation
export function GET() {
  return new ImageResponse(
    React.createElement('div', {
        style: {
          fontSize: 84,
          background: '#13a663', // HSL 160 70% 40% (Rich Calm Green)
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'white',
          borderRadius: '20%',
          fontWeight: '700',
        }
      },
      React.createElement('div', {
          style: {
              border: '6px solid rgba(255,255,255,0.2)',
              padding: '15px 30px',
              borderRadius: '20px',
          }
      }, 'BMS3')
    ),
    {
      width: 192,
      height: 192,
    }
  )
}