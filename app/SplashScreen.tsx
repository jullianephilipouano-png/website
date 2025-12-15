import React, { useEffect, useRef } from "react";
import { View, Animated, StyleSheet, Text, Platform } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import { removeToken } from "../lib/auth";

export default function SplashScreen() {
  const logoScale = useRef(new Animated.Value(0.7)).current;
  const logoOpacity = useRef(new Animated.Value(0)).current;
  const logoRotate = useRef(new Animated.Value(0)).current;
  const glowPulse = useRef(new Animated.Value(0)).current;
  const particlesOpacity = useRef(new Animated.Value(0)).current;
  const titleOpacity = useRef(new Animated.Value(0)).current;
  const titleTranslate = useRef(new Animated.Value(30)).current;
  const titleScale = useRef(new Animated.Value(0.9)).current;
  const subtitleOpacity = useRef(new Animated.Value(0)).current;
  const dividerWidth = useRef(new Animated.Value(0)).current;
  const floatAnim = useRef(new Animated.Value(0)).current;
  const shimmerAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // --- Main animation sequence ---
    Animated.sequence([
      // Logo entrance with rotation
      Animated.parallel([
        Animated.timing(logoOpacity, {
          toValue: 1,
          duration: 1000,
          useNativeDriver: true,
        }),
        Animated.spring(logoScale, {
          toValue: 1,
          tension: 35,
          friction: 7,
          useNativeDriver: true,
        }),
        Animated.timing(logoRotate, {
          toValue: 1,
          duration: 1000,
          useNativeDriver: true,
        }),
      ]),
      // Particles and title
      Animated.parallel([
        Animated.timing(particlesOpacity, {
          toValue: 1,
          duration: 900,
          useNativeDriver: true,
        }),
        Animated.timing(titleOpacity, {
          toValue: 1,
          duration: 800,
          useNativeDriver: true,
        }),
        Animated.spring(titleScale, {
          toValue: 1,
          tension: 40,
          friction: 8,
          useNativeDriver: true,
        }),
        Animated.timing(titleTranslate, {
          toValue: 0,
          duration: 800,
          useNativeDriver: true,
        }),
      ]),
      // Divider and subtitle
      Animated.parallel([
        Animated.timing(dividerWidth, {
          toValue: 1,
          duration: 700,
          useNativeDriver: false,
        }),
        Animated.timing(subtitleOpacity, {
          toValue: 1,
          duration: 700,
          delay: 250,
          useNativeDriver: true,
        }),
      ]),
    ]).start();

    // Continuous glow pulse
    Animated.loop(
      Animated.sequence([
        Animated.timing(glowPulse, {
          toValue: 1,
          duration: 2000,
          useNativeDriver: true,
        }),
        Animated.timing(glowPulse, {
          toValue: 0,
          duration: 2000,
          useNativeDriver: true,
        }),
      ])
    ).start();

    // Floating idle animation
    Animated.loop(
      Animated.sequence([
        Animated.timing(floatAnim, {
          toValue: 1,
          duration: 3500,
          useNativeDriver: true,
        }),
        Animated.timing(floatAnim, {
          toValue: 0,
          duration: 3500,
          useNativeDriver: true,
        }),
      ])
    ).start();

    // Shimmer effect
    Animated.loop(
      Animated.timing(shimmerAnim, {
        toValue: 1,
        duration: 2500,
        useNativeDriver: true,
      })
    ).start();

    // --- Navigate after 8 seconds ---
    const navigateAfterSplash = async () => {
      try {
        await removeToken();
        console.log("🧹 Cleared tokens, navigating to login...");
        router.replace("/login");
      } catch (err) {
        console.error("❌ Error navigating:", err);
        router.replace("/login");
      }
    };

    const timeout = setTimeout(() => {
      navigateAfterSplash();
    }, 7000); // 7 seconds display time

    return () => clearTimeout(timeout);
  }, []);

  const floatTranslate = floatAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, -10],
  });

  const rotateValue = logoRotate.interpolate({
    inputRange: [0, 1],
    outputRange: ["-5deg", "0deg"],
  });

  const glowScale = glowPulse.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 1.15],
  });

  const glowOpacity = glowPulse.interpolate({
    inputRange: [0, 1],
    outputRange: [0.3, 0.6],
  });

  const shimmerTranslate = shimmerAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [-200, 200],
  });

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={["#0a0f1e", "#1a1f35", "#0f1729", "#1e293b"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
      />

      {/* Animated background gradient orbs */}
      <Animated.View style={[styles.orbContainer, { opacity: particlesOpacity }]}>
        <View style={[styles.orb, styles.orb1]} />
        <View style={[styles.orb, styles.orb2]} />
        <View style={[styles.orb, styles.orb3]} />
      </Animated.View>

      {/* Grid overlay */}
      <View style={styles.gridOverlay} />

      {/* Particle effects */}
      <Animated.View style={[styles.particleContainer, { opacity: particlesOpacity }]}>
        <View style={[styles.particle, styles.particle1]} />
        <View style={[styles.particle, styles.particle2]} />
        <View style={[styles.particle, styles.particle3]} />
        <View style={[styles.particle, styles.particle4]} />
        <View style={[styles.particle, styles.particle5]} />
        <View style={[styles.particle, styles.particle6]} />
        <View style={[styles.particle, styles.particle7]} />
        <View style={[styles.particle, styles.particle8]} />
      </Animated.View>

      {/* Main content */}
      <Animated.View
        style={[
          styles.contentWrapper,
          {
            transform: [{ translateY: floatTranslate }],
          },
        ]}
      >
        {/* Logo with glow */}
        <View style={styles.logoContainer}>
          <Animated.View
            style={[
              styles.logoGlow,
              {
                transform: [{ scale: glowScale }],
                opacity: glowOpacity,
              },
            ]}
          />
          <Animated.View
            style={[
              styles.logoFrame,
              {
                opacity: logoOpacity,
                transform: [{ scale: logoScale }, { rotate: rotateValue }],
              },
            ]}
          >
            <Animated.Image
              source={require("../assets/images/logo.jpg")}
              style={styles.logo}
              resizeMode="contain"
            />
            {/* Shimmer effect overlay */}
            <Animated.View
              style={[
                styles.shimmer,
                {
                  transform: [{ translateX: shimmerTranslate }],
                },
              ]}
            />
          </Animated.View>
        </View>

        {/* Text content */}
        <Animated.View
          style={[
            styles.textContainer,
            {
              opacity: titleOpacity,
              transform: [{ translateY: titleTranslate }, { scale: titleScale }],
            },
          ]}
        >
          <View style={styles.titleWrapper}>
            <Text style={styles.emoji}>📚</Text>
            <Text style={styles.title}>RESEARCH REPOSITORY</Text>
          </View>

          <Animated.View
            style={[
              styles.divider,
              {
                width: dividerWidth.interpolate({
                  inputRange: [0, 1],
                  outputRange: ["0%", "80%"],
                }),
              },
            ]}
          >
            <LinearGradient
              colors={["transparent", "#6366f1", "#818cf8", "#6366f1", "transparent"]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.dividerGradient}
            />
          </Animated.View>

          <Animated.View style={{ opacity: subtitleOpacity, alignItems: "center" }}>
            <Text style={styles.subtitle}>
              ✨ Advancing Knowledge Through Innovation
            </Text>
            <Text style={styles.tagline}>
              🎓 A Digital Archive for Academic Excellence
            </Text>
            <View style={styles.badgeContainer}>
              <View style={styles.badge}>
                <Text style={styles.badgeText}>🔬 Research</Text>
              </View>
              <View style={styles.badge}>
                <Text style={styles.badgeText}>📊 Analysis</Text>
              </View>
              <View style={styles.badge}>
                <Text style={styles.badgeText}>🚀 Innovation</Text>
              </View>
            </View>
          </Animated.View>
        </Animated.View>
      </Animated.View>

      {/* Footer */}
      <Animated.View style={[styles.footer, { opacity: subtitleOpacity }]}>
        <View style={styles.footerContent}>
          <Text style={styles.footerText}>
            🔒 Powered by AI Technology • Est. {new Date().getFullYear()}
          </Text>
          <View style={styles.loadingDots}>
            <View style={[styles.dot, styles.dot1]} />
            <View style={[styles.dot, styles.dot2]} />
            <View style={[styles.dot, styles.dot3]} />
          </View>
        </View>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0a0f1e",
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
    overflow: "hidden",
  },
  orbContainer: {
    position: "absolute",
    width: "100%",
    height: "100%",
  },
  orb: {
    position: "absolute",
    borderRadius: 1000,
    opacity: 0.15,
  },
  orb1: {
    width: 400,
    height: 400,
    backgroundColor: "#6366f1",
    top: -200,
    left: -100,
    ...(Platform.OS === "web" && { filter: "blur(80px)" }),
  },
  orb2: {
    width: 350,
    height: 350,
    backgroundColor: "#818cf8",
    bottom: -150,
    right: -100,
    ...(Platform.OS === "web" && { filter: "blur(80px)" }),
  },
  orb3: {
    width: 300,
    height: 300,
    backgroundColor: "#a5b4fc",
    top: "40%",
    right: -80,
    ...(Platform.OS === "web" && { filter: "blur(60px)" }),
  },
  gridOverlay: {
    position: "absolute",
    width: "100%",
    height: "100%",
    opacity: 0.02,
    ...(Platform.OS === "web" && {
      backgroundImage:
        "linear-gradient(rgba(99, 102, 241, 0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(99, 102, 241, 0.5) 1px, transparent 1px)",
      backgroundSize: "50px 50px",
    }),
  },
  particleContainer: {
    position: "absolute",
    width: "100%",
    height: "100%",
  },
  particle: {
    position: "absolute",
    borderRadius: 50,
    backgroundColor: "rgba(129, 140, 248, 0.6)",
    shadowColor: "#818cf8",
    shadowOpacity: 0.8,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 0 },
  },
  particle1: { width: 6, height: 6, top: "12%", left: "8%" },
  particle2: { width: 8, height: 8, top: "20%", right: "12%" },
  particle3: { width: 4, height: 4, bottom: "35%", left: "15%" },
  particle4: { width: 7, height: 7, bottom: "15%", right: "20%" },
  particle5: { width: 5, height: 5, top: "55%", right: "5%" },
  particle6: { width: 6, height: 6, top: "70%", left: "25%" },
  particle7: { width: 4, height: 4, top: "30%", left: "5%" },
  particle8: { width: 5, height: 5, bottom: "50%", right: "8%" },
  contentWrapper: {
    alignItems: "center",
    justifyContent: "center",
    zIndex: 10,
  },
  logoContainer: {
    marginBottom: 48,
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
  },
  logoGlow: {
    position: "absolute",
    width: Platform.OS === "web" ? 240 : 200,
    height: Platform.OS === "web" ? 240 : 200,
    borderRadius: 120,
    backgroundColor: "#6366f1",
    ...(Platform.OS === "web" && { filter: "blur(50px)" }),
  },
  logoFrame: {
    padding: 12,
    borderRadius: 28,
    backgroundColor: "rgba(26, 31, 53, 0.8)",
    borderWidth: 2,
    borderColor: "rgba(99, 102, 241, 0.3)",
    shadowColor: "#6366f1",
    shadowOpacity: 0.5,
    shadowRadius: 30,
    shadowOffset: { width: 0, height: 8 },
    overflow: "hidden",
    position: "relative",
  },
  logo: {
    width: Platform.OS === "web" ? 200 : 160,
    height: Platform.OS === "web" ? 200 : 160,
    borderRadius: 20,
  },
  shimmer: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    width: 100,
    backgroundColor: "rgba(255, 255, 255, 0.2)",
    ...(Platform.OS === "web" && {
      background:
        "linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.3), transparent)",
    }),
  },
  textContainer: {
    alignItems: "center",
    maxWidth: 600,
    paddingHorizontal: 24,
  },
  titleWrapper: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 20,
  },
  emoji: {
    fontSize: Platform.OS === "web" ? 36 : 30,
  },
  title: {
    fontSize: Platform.OS === "web" ? 36 : 28,
    color: "#f1f5f9",
    fontWeight: "800",
    letterSpacing: 4,
    textAlign: "center",
    textTransform: "uppercase",
    textShadowColor: "rgba(99, 102, 241, 0.5)",
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 10,
  },
  divider: {
    height: 3,
    marginVertical: 24,
    overflow: "hidden",
    borderRadius: 2,
  },
  dividerGradient: {
    flex: 1,
    height: "100%",
  },
  subtitle: {
    fontSize: Platform.OS === "web" ? 20 : 17,
    color: "#cbd5e1",
    fontWeight: "600",
    textAlign: "center",
    marginBottom: 12,
    letterSpacing: 0.5,
  },
  tagline: {
    fontSize: Platform.OS === "web" ? 16 : 14,
    color: "#94a3b8",
    fontWeight: "500",
    textAlign: "center",
    marginBottom: 24,
    letterSpacing: 0.5,
  },
  badgeContainer: {
    flexDirection: "row",
    gap: 12,
    flexWrap: "wrap",
    justifyContent: "center",
  },
  badge: {
    backgroundColor: "rgba(99, 102, 241, 0.15)",
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "rgba(99, 102, 241, 0.3)",
  },
  badgeText: {
    color: "#a5b4fc",
    fontSize: 13,
    fontWeight: "600",
  },
  footer: {
    position: "absolute",
    bottom: 50,
    alignItems: "center",
  },
  footerContent: {
    alignItems: "center",
    gap: 12,
  },
  footerText: {
    fontSize: 13,
    color: "#64748b",
    textAlign: "center",
    fontWeight: "500",
  },
  loadingDots: {
    flexDirection: "row",
    gap: 8,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#6366f1",
  },
  dot1: {
    opacity: 0.4,
  },
  dot2: {
    opacity: 0.7,
  },
  dot3: {
    opacity: 1,
  },
});