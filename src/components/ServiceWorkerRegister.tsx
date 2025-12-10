"use client";

import { useEffect } from "react";

export default function ServiceWorkerRegister() {
  useEffect(() => {
    if ("serviceWorker" in navigator && window.location.hostname !== "localhost") {
      navigator.serviceWorker
        .register("/sw.js")
        .then((registration) => {
          console.log("Hera Scope Registered: ", registration.scope);
        })
        .catch((error) => {
          console.error("Hera Scope Failed: ", error);
        });
    }
  }, []);

  return null;
}
