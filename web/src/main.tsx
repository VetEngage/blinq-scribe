import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { ApolloProvider } from "@apollo/client";
import { RouterProvider } from "react-router";
import { ToastProvider } from "@blinq-scribe/ui";
import "./i18n";
import "./styles/app.css";
import { apollo } from "./api/apollo";
import { router } from "./router";
import { startTheme } from "./state/theme";

startTheme();

createRoot(document.getElementById("root") as HTMLElement).render(
  <StrictMode>
    <ApolloProvider client={apollo}>
      <ToastProvider>
        <RouterProvider router={router} />
      </ToastProvider>
    </ApolloProvider>
  </StrictMode>,
);
