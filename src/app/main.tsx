import React from "react";
import ReactDOM from "react-dom/client";
import { RouterProvider } from "react-router-dom";
import { router } from "./router";
import { TenantProvider } from "@/lib/tenant";
import { AuthProvider } from "@/features/auth/AuthContext";
import { ToastProvider } from "@/components/ui";
import "@/styles.css";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <TenantProvider>
      <AuthProvider>
        <ToastProvider>
          <RouterProvider router={router} />
        </ToastProvider>
      </AuthProvider>
    </TenantProvider>
  </React.StrictMode>,
);
