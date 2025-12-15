// app/_layout.tsx
import React, { useEffect, useState } from "react";
import { Stack } from "expo-router";
import SplashScreen from "./SplashScreen";

export default function RootLayout() {
  const [showSplash, setShowSplash] = useState(true);

  useEffect(() => {
  const t = setTimeout(() => setShowSplash(false), 6000);
  return () => clearTimeout(t);
}, []);


  if (showSplash) return <SplashScreen />;

  return <Stack screenOptions={{ headerShown: false }} />;
}
