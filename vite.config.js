import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
  build: {
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        login: resolve(__dirname, 'pages/login.html'),
        dashboard: resolve(__dirname, 'pages/dashboard.html'),
        admin: resolve(__dirname, 'pages/admin.html'),
        events: resolve(__dirname, 'pages/events.html'),
        members: resolve(__dirname, 'pages/members.html'),
        gallery: resolve(__dirname, 'pages/gallery.html'),
        contact: resolve(__dirname, 'pages/contact.html'),
      }
    }
  }
});
