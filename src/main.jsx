import React from "react";
import ReactDOM from "react-dom/client";
import StockScope from "./StockScope.jsx";
import { AuthProvider } from "./auth/AuthContext.jsx";

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <AuthProvider>
      <StockScope />
    </AuthProvider>
  </React.StrictMode>
);
