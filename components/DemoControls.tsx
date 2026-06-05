"use client";

import { DemoState } from "@/app/page";

interface Props {
  demoState: DemoState;
  onVerifyLegit: () => void;
  onVerifyFraud: () => void;
  onLocation: () => void;
}

export default function DemoControls({
  demoState,
  onVerifyLegit,
  onVerifyFraud,
  onLocation,
}: Props) {
  const loading = demoState === "loading";

  return (
    <div className="w-full max-w-sm">
      <p className="text-xs text-gray-500 uppercase tracking-widest mb-3 text-center font-mono">
        Demo Controls
      </p>

      <div className="flex flex-col gap-2">
        <button
          onClick={onVerifyLegit}
          disabled={loading}
          className="
            w-full py-3 px-4 rounded-xl font-semibold text-sm
            bg-green-700 hover:bg-green-600 active:bg-green-800
            text-white transition-all duration-150
            disabled:opacity-40 disabled:cursor-not-allowed
            flex items-center justify-center gap-2
            border border-green-500/30
          "
        >
          <span>✓</span>
          Verify legit passenger
        </button>

        <button
          onClick={onVerifyFraud}
          disabled={loading}
          className="
            w-full py-3 px-4 rounded-xl font-semibold text-sm
            bg-red-700 hover:bg-red-600 active:bg-red-800
            text-white transition-all duration-150
            disabled:opacity-40 disabled:cursor-not-allowed
            flex items-center justify-center gap-2
            border border-red-500/30
          "
        >
          <span>⚠</span>
          Verify fraud attempt
        </button>

        <button
          onClick={onLocation}
          disabled={loading}
          className="
            w-full py-3 px-4 rounded-xl font-semibold text-sm
            bg-blue-700 hover:bg-blue-600 active:bg-blue-800
            text-white transition-all duration-150
            disabled:opacity-40 disabled:cursor-not-allowed
            flex items-center justify-center gap-2
            border border-blue-500/30
          "
        >
          <span>📍</span>
          Trigger location notification
        </button>
      </div>

      <div className="mt-4 text-center">
        <p className="text-[10px] text-gray-600 font-mono">
          Identity: Number Verification + SIM Swap (CAMARA)
        </p>
        <p className="text-[10px] text-gray-600 font-mono">
          Location: Location Retrieval v0.3 (CAMARA)
        </p>
      </div>
    </div>
  );
}
