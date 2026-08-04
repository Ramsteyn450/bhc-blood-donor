import React from 'react';

export default function BhcCrestLogo({ className = "w-12 h-14", showBanner = true }) {
  return (
    <img
      src="/bhc-logo.png"
      alt="Bishop Heber College Official Logo"
      className={`object-contain select-none drop-shadow-md ${className}`}
    />
  );
}
