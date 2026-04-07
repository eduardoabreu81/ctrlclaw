"use client";

import { useIdleWarning } from "@/hooks/use-idle-timeout";
import { useRuntimeStore } from "@/stores/runtime-store";

export function IdleWarning() {
  const { isWarningVisible, timeRemaining } = useRuntimeStore();
  const { stayLoggedIn, logoutNow } = useIdleWarning();

  if (!isWarningVisible) return null;

  const minutes = Math.floor((timeRemaining || 0) / 60);
  const seconds = (timeRemaining || 0) % 60;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4 shadow-xl">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center">
            <svg
              className="w-6 h-6 text-amber-600"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
              />
            </svg>
          </div>
          <h2 className="text-lg font-semibold">Session Expiring</h2>
        </div>

        <p className="text-gray-600 mb-6">
          Your session will expire in{" "}
          <span className="font-mono font-bold">
            {minutes}:{seconds.toString().padStart(2, "0")}
          </span>{" "}
          due to inactivity.
        </p>

        <div className="flex gap-3">
          <button
            onClick={stayLoggedIn}
            className="flex-1 py-2 px-4 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            Stay Logged In
          </button>
          <button
            onClick={logoutNow}
            className="flex-1 py-2 px-4 border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-gray-500"
          >
            Logout
          </button>
        </div>
      </div>
    </div>
  );
}
