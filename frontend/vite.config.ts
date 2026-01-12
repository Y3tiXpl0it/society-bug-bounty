import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

// https://vite.dev/config/
export default defineConfig({
    plugins: [tailwindcss(), react()],
    server: {
        // This setting tells Vite to allow requests from the 'dev.societybugbounty.com' host.
        allowedHosts: ['dev.societybugbounty.com'],
        proxy: {
            '/api': {
                target: 'http://fastapi_backend:8000',
                changeOrigin: true,
                rewrite: (path) => path.replace(/^\/api/, ''),
            },
            // Proxy WebSocket connections to the backend
            '/socket.io': {
                target: 'http://fastapi_backend:8000',
                changeOrigin: true,
                ws: true,
            },
        },
    },
});
