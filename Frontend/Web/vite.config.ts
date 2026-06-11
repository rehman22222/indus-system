import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],

  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },

  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          // React core
          if (id.includes('node_modules/react/') ||
            id.includes('node_modules/react-dom/') ||
            id.includes('node_modules/react-router-dom/')) {
            return 'react-vendor';
          }

          // Firebase
          if (id.includes('node_modules/firebase/') ||
            id.includes('node_modules/@firebase/')) {
            return 'firebase-vendor';
          }

          // Radix UI + shadcn utilities
          if (id.includes('node_modules/@radix-ui/') ||
            id.includes('node_modules/class-variance-authority') ||
            id.includes('node_modules/clsx') ||
            id.includes('node_modules/tailwind-merge')) {
            return 'ui-vendor';
          }

          // Forms
          if (id.includes('node_modules/react-hook-form') ||
            id.includes('node_modules/@hookform/') ||
            id.includes('node_modules/zod')) {
            return 'form-vendor';
          }

          // Date utilities
          if (id.includes('node_modules/date-fns')) {
            return 'date-vendor';
          }

          // Admin portal pages — only loaded when admin navigates
          if (id.includes('/src/pages/AdminApp') ||
            id.includes('/src/pages/AdminPortal') ||
            id.includes('/src/components/admin/')) {
            return 'admin-chunk';
          }

          // Doctor portal pages
          if (id.includes('/src/pages/DoctorApp') ||
            id.includes('/src/components/doctor/')) {
            return 'doctor-chunk';
          }

          // Patient portal pages
          if (id.includes('/src/pages/PatientApp') ||
            id.includes('/src/components/patient/')) {
            return 'patient-chunk';
          }

          // Management portal
          if (id.includes('/src/pages/ManagementPortal') ||
            id.includes('/src/components/management/')) {
            return 'management-chunk';
          }
        },
      },
    },
    chunkSizeWarningLimit: 500,
    sourcemap: false,
    minify: 'esbuild',
    target: 'es2020',
  },

  server: {
    port: 5173,
    strictPort: false,
    open: false,
  },

  optimizeDeps: {
    include: [
      'react',
      'react-dom',
      'react-router-dom',
    ],
  },
})
