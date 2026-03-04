
import { ImageResponse } from 'next/og'
import * as React from 'react';

// Route segment config
export const runtime = 'edge'

// Image generation
export function GET() {
  return new ImageResponse(
    React.createElement('div', {
        style: {
          fontSize: 220,
          background: '#1FB278', // Matching HSL 160 70% 40%
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'white',
          borderRadius: '64px',
          fontWeight: 'bold',
        }
      },
      'BMS3'
    ),
    {
      width: 512,
      height: 512,
    }
  )
}
