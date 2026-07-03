import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

// Handle MSAL redirect before app renders
async function initializeApp() {
  try {
    // Dynamically import to avoid issues if MSAL not configured
    const { handleMSALRedirect } = await import("./lib/azureAuth");
    await handleMSALRedirect();
  } catch (error) {
    // MSAL not configured or error handling redirect - continue with app
    console.log("MSAL redirect handling skipped:", error);
  }

  // Render the app
  createRoot(document.getElementById("root")!).render(<App />);
}

initializeApp().catch((err) => {
  console.error("App init error:", err);
});
