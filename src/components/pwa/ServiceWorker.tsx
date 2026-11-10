"use client";

import { useEffect, useRef, useState } from "react";

/** Registers /sw.js in production and offers a reload when a new version is waiting. */
export function ServiceWorker() {
  const [waiting, setWaiting] = useState<globalThis.ServiceWorker | null>(null);
  // Set only when the user accepts the update; the first install also claims clients and must not reload.
  const reloadOnControl = useRef(false);

  useEffect(() => {
    if (process.env.NODE_ENV !== "production" || !("serviceWorker" in navigator)) return;

    const container = navigator.serviceWorker;
    let registration: ServiceWorkerRegistration | undefined;

    const onControllerChange = () => {
      if (reloadOnControl.current) window.location.reload();
    };

    const onUpdateFound = () => {
      const installing = registration?.installing;
      if (!installing) return;
      installing.addEventListener("statechange", () => {
        if (installing.state === "installed" && container.controller) setWaiting(installing);
      });
    };

    container.addEventListener("controllerchange", onControllerChange);

    container
      .register("/sw.js", { scope: "/" })
      .then((reg) => {
        registration = reg;
        reg.addEventListener("updatefound", onUpdateFound);
        if (reg.waiting && container.controller) setWaiting(reg.waiting);
      })
      .catch(() => {});

    return () => {
      container.removeEventListener("controllerchange", onControllerChange);
      registration?.removeEventListener("updatefound", onUpdateFound);
    };
  }, []);

  if (!waiting) return null;

  const applyUpdate = () => {
    reloadOnControl.current = true;
    waiting.postMessage({ type: "SKIP_WAITING" });
  };

  return (
    <div
      role="status"
      className="material shadow-float rounded-2xl safe-bottom animate-rise fixed inset-x-4 bottom-24 z-50 flex items-center justify-between gap-3 px-4 py-3 md:inset-x-auto md:right-6 md:bottom-6 md:w-80"
    >
      <p className="text-subhead font-medium text-label">Update available</p>
      <button type="button" onClick={applyUpdate} className="btn-get shrink-0">
        Reload
      </button>
    </div>
  );
}

export default ServiceWorker;
