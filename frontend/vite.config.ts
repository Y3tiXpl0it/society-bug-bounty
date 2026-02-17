import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, '..', '');
    const proxyTarget = env.VITE_API_PROXY_TARGET || 'http://fastapi_backend:8000';

    return {
        envDir: '..',
        plugins: [tailwindcss(), react()],
        server: {
            // This setting tells Vite to allow requests from the 'dev.societybugbounty.com' host.
            allowedHosts: ['dev.societybugbounty.com'],
            proxy: {
                '/api': {
                    target: proxyTarget,
                    changeOrigin: true,
                    rewrite: (path) => path.replace(/^\/api/, ''),
                },
                // Proxy WebSocket connections to the backend
                '/socket.io': {
                    target: proxyTarget,
                    changeOrigin: true,
                    ws: true,
                },
            },
        },
    };
});
