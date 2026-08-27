"use client";

import React, { useEffect, useState } from "react";

export function MouseFollower() {
  const [pos, setPos] = useState({ x: -100, y: -100 });
  const [isHovered, setIsHovered] = useState(false);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    let animationFrameId: number;
    let targetX = -100;
    let targetY = -100;
    let currentX = -100;
    let currentY = -100;

    const handleMouseMove = (e: MouseEvent) => {
      targetX = e.clientX;
      targetY = e.clientY;
      if (!isVisible) setIsVisible(true);

      const target = e.target as HTMLElement | null;
      if (target) {
        const isInteractive = Boolean(
          target.closest("button, a, input, textarea, [role='button'], .clickable, .monaco-editor, .prism-editor-wrapper")
        );
        setIsHovered(isInteractive);
      }
    };

    const handleMouseLeave = () => setIsVisible(false);
    const handleMouseEnter = () => setIsVisible(true);

    const updatePosition = () => {
      currentX += (targetX - currentX) * 0.18;
      currentY += (targetY - currentY) * 0.18;

      setPos({ x: currentX, y: currentY });
      animationFrameId = requestAnimationFrame(updatePosition);
    };

    window.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseleave", handleMouseLeave);
    document.addEventListener("mouseenter", handleMouseEnter);

    animationFrameId = requestAnimationFrame(updatePosition);

    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseleave", handleMouseLeave);
      document.removeEventListener("mouseenter", handleMouseEnter);
      cancelAnimationFrame(animationFrameId);
    };
  }, [isVisible]);

  if (!isVisible) return null;

  return (
    <>
      {/* Outer Glowing Pulsing Circle */}
      <div
        className="pointer-events-none fixed top-0 left-0 z-[9999] rounded-full transition-transform duration-75 ease-out"
        style={{
          transform: `translate3d(${pos.x}px, ${pos.y}px, 0) translate(-50%, -50%) scale(${
            isHovered ? 1.8 : 1
          })`,
          width: "36px",
          height: "36px",
          border: isHovered ? "2px solid rgba(77, 181, 157, 0.9)" : "1.5px solid rgba(77, 181, 157, 0.5)",
          backgroundColor: isHovered ? "rgba(77, 181, 157, 0.12)" : "rgba(77, 181, 157, 0.04)",
          boxShadow: isHovered
            ? "0 0 20px rgba(77, 181, 157, 0.5), inset 0 0 10px rgba(77, 181, 157, 0.3)"
            : "0 0 10px rgba(77, 181, 157, 0.2)",
          backdropFilter: isHovered ? "blur(2px)" : "none",
        }}
      />
      {/* Inner Precision Dot */}
      <div
        className="pointer-events-none fixed top-0 left-0 z-[10000] rounded-full bg-[#7be3c4] shadow-[0_0_8px_#7be3c4] transition-transform duration-75"
        style={{
          transform: `translate3d(${pos.x}px, ${pos.y}px, 0) translate(-50%, -50%) scale(${
            isHovered ? 1.4 : 1
          })`,
          width: "6px",
          height: "6px",
        }}
      />
    </>
  );
}
