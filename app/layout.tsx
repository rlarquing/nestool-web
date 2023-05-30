import './globals.css';
import { Inter } from 'next/font/google';
import React from 'react';
import { Template } from '../components';

const inter = Inter({ subsets: ['latin'] });

export const metadata = {
  title: 'Nestool-web',
  description: 'Herramienta para generar código al api-base-nestjs'
}

export default function RootLayout ({
  children
}: {
  children: React.ReactNode
}) {
  return (
    <html lang='en'>
      <body className={inter.className}>
        <Template>
          {children}
        </Template>
      </body>
    </html>
  )
}
