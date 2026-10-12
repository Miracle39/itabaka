import { defineConfig } from "vite";
import { resolve } from "path";

export default defineConfig({
  build: {
    rollupOptions: {
      input: {
        main: resolve(__dirname, "index.html"),
        checkout: resolve(__dirname, "checkout.html"),
        invoice: resolve(__dirname, "invoice.html"),
        admin: resolve(__dirname, "admin.html"),
        adminAllOrders: resolve(__dirname, "admin-all-orders.html"),
        adminOrders: resolve(__dirname, "admin-orders.html"),
        adminApparel: resolve(__dirname, "admin-apparel.html"),
        adminSettings: resolve(__dirname, "admin-settings.html"),
      },
    },
  },
});
