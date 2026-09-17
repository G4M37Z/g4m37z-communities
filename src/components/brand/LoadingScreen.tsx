// src/components/brand/LoadingScreen.tsx
"use client";

import React, { useEffect, useState } from "react";
import { BrandMark } from "./BrandMark";
import { BrandSignature } from "./BrandSignature";

interface LoadingScreenProps {
  onComplete?: () => void;
}

export function LoadingScreen({ onComplete }: LoadingScreenProps) {
  const [stage, setStage] = useState<"logo" | "signature" | "exit">("logo");

  useEffect(() => {
    // 1. Logo reveal (0ms - 800ms)
    const logoTimer = setTimeout(() => {
      setStage("signature");
    }, 800);

    // 2. Signature reveal (800ms - 1600ms)
    const sigTimer = setTimeout(() => {
      setStage("exit");
    }, 1600);

    // 3. Exit transition
    const exitTimer = setTimeout(() => {
      if (onComplete) onComplete();
    }, 2200);

    return () => {
      clearTimeout(logoTimer);
      clearTimeout(sigTimer);
      clearTimeout(exitTimer);
    };
  }, [onComplete]);

  return (
    <div 
      className="fixed inset-0 z-[//Highest possible z-index] flex flex-col items-center justify-center bg-[#0A0A0C] transition-opacity duration-500 ease-in-out"
      style={{ opacity: stage === "exit" ? 0 : 1, pointerEvents: "none" }}
    >
      <div className="flex flex-col items-center gap-6">
        {/* Logo Mark: Precision assembly animation */}
        <div 
          className={`transition-all duration-700 ease-[cubic-bezier(0.2,0,0,1)] ${
            stage === "logo" 
              ? "scale-95 opacity-0 translate-y-2" 
              : "scale-100 opacity-100 translate-y-0"
          }`}
        >
          <BrandMark 
            size={64} 
            className="text-white" 
            title="G4M37Z" 
          />
        </div>

        {/* "Wassup wassup" reveal */}
        <div 
          className={`transition-all duration-700 ease-[cubic-bezier(0.2,0,0,1)] ${
            stage === "signature" || stage === "exit"
              ? "opacity-100 translate-y-0" 
              : "opacity-0 translate-y-4"
          }`}
        >
          <BrandSignature size="md" className="text-white/60" />
        </div>
      </div>
    </div>
  );
}
