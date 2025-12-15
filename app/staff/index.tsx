// app/screens/staff/index.tsx
import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  Platform,
  StyleSheet,
  Alert,
  ActivityIndicator,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import api from "../../lib/api";
import { getToken } from "../../lib/auth";
import CentralRepository from "../../components/CentralRepository";
import AsyncStorage from "@react-native-async-storage/async-storage";

/** 🎨 Matching Faculty Pastel Palette */
const C = {
  bg: "#f6f6f9",
  card: "#ffffff",
  ink: "#0f172a",
  mute: "#6b7280",
  ring: "#eef2ff",
};

export default function StaffDashboard() {
  const [loading, setLoading] = useState(true);
  const [staff, setStaff] = useState<any>(null);
  const [showRepository, setShowRepository] = useState(false);

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const token = await getToken();
        const response = await api.get("/auth/me", {
          headers: { Authorization: `Bearer ${token}` },
        });
        setStaff(response.data.user);
      } catch (error: any) {
        console.log("❌ Failed to load staff info:", error?.message || error);
        Alert.alert("Error", "Unable to fetch staff information.");
      } finally {
        setLoading(false);
      }
    };
    fetchProfile();
  }, []);

  const handleUpload = () => router.push("/staff/upload");
  const handleArchive = () => router.push("/staff/archive");

  // NEW: go to the files list where each item has the "Publishing & Taxonomy" button
  const handlePublishingManager = () => router.push("/staff/publishing");

  // Logout
  const handleLogout = async () => {
    console.log("🚪 Logout button clicked!");
    let confirmed = false;

    if (Platform.OS === "web") {
      confirmed = window.confirm("Are you sure you want to log out?");
    } else {
      return Alert.alert(
        "Sign out",
        "Are you sure you want to log out?",
        [
          { text: "Cancel", style: "cancel", onPress: () => console.log("❌ Logout cancelled") },
          { text: "Log out", style: "destructive", onPress: () => performLogout() },
        ],
        { cancelable: true }
      );
    }
    if (!confirmed) return;
    await performLogout();
  };

  const performLogout = async () => {
    try {
      try {
        const token = await getToken();
        if (token?.token) {
          await api.post(
            "/auth/logout",
            {},
            { headers: { Authorization: `Bearer ${token.token}` } }
          );
        }
      } catch (err) {
        console.log("⚠️ Server logout skipped:", err);
      }
      await AsyncStorage.multiRemove(["authToken", "token", "user", "role", "refreshToken"]);
      router.replace("/login");
    } catch (error: any) {
      console.error("❌ Logout error:", error);
      if (Platform.OS === "web") alert(`Failed to log out: ${error?.message || error}`);
      else Alert.alert("Error", `Failed to log out: ${error?.message || error}`);
    }
  };

  if (loading) {
    return (
      <View style={[styles.container, { justifyContent: "center", alignItems: "center" }]}>
        <ActivityIndicator size="large" color="#2563eb" />
        <Text style={{ color: C.mute, marginTop: 10 }}>Loading Staff Dashboard...</Text>
      </View>
    );
  }

  if (showRepository) {
    return (
      <View style={{ flex: 1, backgroundColor: C.bg }}>
        <View style={styles.topBar}>
          <TouchableOpacity style={styles.backButton} onPress={() => setShowRepository(false)}>
            <Ionicons name="arrow-back" size={20} color="#2563eb" />
            <Text style={styles.backText}>Back to Dashboard</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout}>
            <Ionicons name="log-out-outline" size={18} color={C.ink} />
            <Text style={styles.logoutText}>Logout</Text>
          </TouchableOpacity>
        </View>
        <CentralRepository />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* top bar */}
      <View style={styles.topBar}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
          <View style={styles.logoDot} />
          <Text style={styles.appTitle}>Research Repository</Text>
        </View>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
          <View style={styles.avatar}>
            <Ionicons name="person-circle-outline" size={20} color="#2563eb" />
          </View>
          <Text style={styles.userName} numberOfLines={1}>
            {staff?.firstName || staff?.fullName || "Staff"}
          </Text>
          <TouchableOpacity style={styles.iconBtn} onPress={() => router.push("/repository")}>
            <Ionicons name="book-outline" size={18} color={C.ink} />
          </TouchableOpacity>
          <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout}>
            <Ionicons name="log-out-outline" size={18} color={C.ink} />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContainer}>
        <Text style={styles.headerTitle}>Research Repository</Text>
        <Text style={styles.subHeader}>
          Staff Dashboard
          {staff ? ` — Welcome, ${staff.firstName || staff.fullName || "Staff"}` : ""}
        </Text>

        <View style={styles.roleCard}>
          <Ionicons name="people-circle" size={64} color="#2563eb" />
          <Text style={styles.roleTitle}>Staff</Text>
          <Text style={styles.roleSubtitle}>Research / Records Office Personnel</Text>
          <Text style={styles.roleDesc}>
            Handles encoding, tagging, and document management for all research submissions.
          </Text>
        </View>

        <View style={styles.taskCard}>
          <Text style={styles.sectionTitle}>Core Responsibilities</Text>

          <TouchableOpacity style={styles.taskItem} onPress={handleUpload}>
            <View style={[styles.taskIconCircle, { backgroundColor: "#dbeafe" }]}>
              <Ionicons name="cloud-upload-outline" size={24} color="#2563eb" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.taskText}>Upload accepted PDFs</Text>
              <Text style={styles.taskSubtext}>Add new research documents to the repository</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={C.mute} />
          </TouchableOpacity>

          {/* NEW TASK: Publishing & Taxonomy Manager (opens /files list) */}
          <TouchableOpacity style={styles.taskItem} onPress={handlePublishingManager}>
            <View style={[styles.taskIconCircle, { backgroundColor: "#ede9fe" }]}>
              <Ionicons name="pricetags-outline" size={24} color="#7c3aed" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.taskText}>Publishing & Taxonomy</Text>
              <Text style={styles.taskSubtext}>Manage visibility, landing page, categories, and tags</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={C.mute} />
          </TouchableOpacity>

          <TouchableOpacity style={styles.taskItem} onPress={() => setShowRepository(true)}>
            <View style={[styles.taskIconCircle, { backgroundColor: "#cffafe" }]}>
              <Ionicons name="folder-outline" size={24} color="#0891b2" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.taskText}>View uploaded research PDFs</Text>
              <Text style={styles.taskSubtext}>Browse and manage all research documents</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={C.mute} />
          </TouchableOpacity>
        </View>

        <View style={styles.footer}>
          <TouchableOpacity style={styles.navButton} onPress={() => router.push("/repository")}>
            <Ionicons name="book-outline" size={22} color="#fff" />
            <Text style={styles.navText}>View Repository</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  );
}

/* ---------------- STYLES ---------------- */
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg },
  scrollContainer: { padding: 24, alignItems: "center" },

  topBar: {
    height: 56,
    paddingHorizontal: 16,
    backgroundColor: "#fff",
    borderBottomWidth: 1,
    borderBottomColor: C.ring,
    alignItems: "center",
    justifyContent: "space-between",
    flexDirection: "row",
  },
  logoDot: { width: 10, height: 10, borderRadius: 10, backgroundColor: "#2563eb" },
  appTitle: { fontWeight: "800", color: C.ink, fontSize: 16 },

  avatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "#eef2ff",
    alignItems: "center",
    justifyContent: "center",
  },
  userName: { maxWidth: 140, color: C.ink, fontWeight: "800" },

  iconBtn: {
    width: 36,
    height: 36,
    backgroundColor: "#fff",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: C.ring,
    alignItems: "center",
    justifyContent: "center",
  },

  logoutBtn: {
    width: 36,
    height: 36,
    backgroundColor: "#fff",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: C.ring,
    alignItems: "center",
    justifyContent: "center",
  },
  logoutText: {
    color: C.ink,
    fontWeight: "700",
    fontSize: 14,
  },

  headerTitle: {
    fontSize: 28,
    color: C.ink,
    fontWeight: "900",
    marginTop: 20,
  },
  subHeader: {
    color: C.mute,
    fontSize: 16,
    fontWeight: "600",
    marginBottom: 24,
  },
  roleCard: {
    backgroundColor: C.card,
    padding: 20,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: C.ring,
    alignItems: "center",
    marginBottom: 20,
    width: "100%",
    ...Platform.select({
      ios: { shadowColor: "#000", shadowOpacity: 0.06, shadowRadius: 8, shadowOffset: { width: 0, height: 4 } },
      android: { elevation: 2 },
      default: {},
    }),
  },
  roleTitle: {
    fontSize: 22,
    color: C.ink,
    fontWeight: "900",
    marginTop: 8,
  },
  roleSubtitle: {
    fontSize: 15,
    color: C.mute,
    fontWeight: "600",
    marginBottom: 8,
  },
  roleDesc: {
    color: C.mute,
    fontSize: 14,
    textAlign: "center",
  },
  taskCard: {
    backgroundColor: C.card,
    padding: 20,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: C.ring,
    width: "100%",
    ...Platform.select({
      ios: { shadowColor: "#000", shadowOpacity: 0.06, shadowRadius: 8, shadowOffset: { width: 0, height: 4 } },
      android: { elevation: 2 },
      default: {},
    }),
  },
  sectionTitle: {
    color: C.ink,
    fontSize: 18,
    fontWeight: "900",
    marginBottom: 12,
  },
  taskItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 14,
    gap: 12,
    borderBottomColor: "#f1f5f9",
    borderBottomWidth: 1,
  },
  taskIconCircle: {
    width: 48,
    height: 48,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  taskText: {
    color: C.ink,
    fontSize: 15,
    fontWeight: "800",
  },
  taskSubtext: {
    color: C.mute,
    fontSize: 12,
    fontWeight: "600",
    marginTop: 2,
  },
  footer: { marginTop: 32, alignItems: "center" },
  navButton: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#2563eb",
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 50,
  },
  navText: { color: "#fff", fontWeight: "700", marginLeft: 8 },
  backButton: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fff",
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: C.ring,
    gap: 6,
  },
  backText: { color: "#2563eb", fontWeight: "700" },
});