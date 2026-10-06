import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: { dedupe: ['react', 'react-dom', 'three', '@react-three/fiber', '@react-three/drei', '@react-three/rapier', 'ecctrl', 'zustand'] },
  optimizeDeps: { include: ['react', 'react-dom', 'react/jsx-runtime', 'react/jsx-dev-runtime', 'three', '@react-three/fiber', '@react-three/drei', '@react-three/rapier', 'ecctrl'] },
  server: { proxy: { '/api': 'http://localhost:8000' } },
})
