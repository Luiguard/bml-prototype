import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import bwebPlugin from '../vite-plugin-bweb.js'

export default defineConfig({
  plugins: [react(), bwebPlugin()],
})
