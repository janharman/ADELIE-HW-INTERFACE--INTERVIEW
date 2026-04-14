import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
	base: '/Adelie-interface-test/',
	plugins: [react()],
	server: {
		port: 3000, // Aby to běželo na stejném portu jako CRA
	},
	define: {
		// Definujeme globální konstantu s aktuálním datem
		__BUILD_DATE__: JSON.stringify(new Date().toLocaleString())
	}
})