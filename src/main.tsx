import React, { lazy, Suspense } from "react"
import ReactDOM from "react-dom/client"
import ApplicationBoundary, { ApplicationLoading } from "./Recovery"
import { initializeAppearance } from "./appearance"
import "./index.css"
import { startOfflineSupport } from "./offline"

const stopInitialAppearance = initializeAppearance()
const App = lazy(() => import("./App").then(module => { stopInitialAppearance(); return module }))

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <ApplicationBoundary><Suspense fallback={<ApplicationLoading />}><App /></Suspense></ApplicationBoundary>
  </React.StrictMode>,
)

void startOfflineSupport()
