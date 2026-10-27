"use client";

import { useEffect } from "react";

export function PwaRegister() {
  useEffect(() => {
    if (typeof window !== "undefined" && "serviceWorker" in navigator && process.env.NODE_ENV === "production") {
      navigator.serviceWorker
        .register("/sw.js")
        .then((reg) => {
          reg.onupdatefound = () => {
            const installing = reg.installing;
            if (installing) {
              installing.onstatechange = () => {
                if (installing.state === "installed" && navigator.serviceWorker.controller) {
                  console.log("[PWA] New service worker installed and ready.");
                }
              };
            }
          };
        })
        .catch((err) => {
          console.warn("[PWA] Service worker registration failed:", err);
        });
    }
  }, []);

  return null;
}
