import React, { useState, useEffect } from "react";
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert } from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import api from "../lib/api";
import { getToken } from "../lib/auth";


export default function EditProfile() {
  const router = useRouter();
  const { user: userParam } = useLocalSearchParams();

  // Parse the user object passed from ProfileScreen
  const user = userParam ? JSON.parse(userParam as string) : {};

  const [fullName, setFullName] = useState(user.fullName || "");
  const [phone, setPhone] = useState(user.phone || "");
  const [affiliation, setAffiliation] = useState(user.affiliation || "");
  const [college, setCollege] = useState(user.college || "");

const handleSave = async () => {
  console.log("BUTTON PRESSED!");

  try {
    const [firstName, ...rest] = fullName.trim().split(" ");
    const lastName = rest.join(" ") || "."; // temp fix so it's never empty

    const tokenObj = await getToken();
    const bearer = tokenObj?.token || tokenObj?.user?.token;

    console.log("Using token:", bearer);

    const res = await api.put(
      "/auth/update",
      { firstName, lastName, phone, affiliation, college },
      { headers: { Authorization: `Bearer ${bearer}` } }
    );

    console.log("UPDATE RESPONSE:", res.data);

    Alert.alert("Success", "Profile updated successfully", [
      { text: "OK", onPress: () => router.back() }
    ]);

  } catch (err) {
    console.log("UPDATE ERROR:", err.response?.data || err.message);
    Alert.alert("Error", "Failed to update profile");
  }
};



  return (
    <View style={styles.container}>

  {/* Close Button */}
  <TouchableOpacity style={styles.closeButton} onPress={() => router.back()}>
    <Text style={styles.closeText}>✕</Text>
  </TouchableOpacity>

  <Text style={styles.header}>Edit Profile</Text>

  <TextInput
    style={styles.input}
    value={fullName}
    onChangeText={setFullName}
    placeholder="Full Name"
  />

  <TextInput
    style={styles.input}
    value={phone}
    onChangeText={setPhone}
    placeholder="Phone"
  />

  <TextInput
    style={styles.input}
    value={affiliation}
    onChangeText={setAffiliation}
    placeholder="Affiliation"
  />

  <TextInput
    style={styles.input}
    value={college}
    onChangeText={setCollege}
    placeholder="College"
  />

  <TouchableOpacity style={styles.button} onPress={handleSave}>
    <Text style={styles.buttonText}>Save Changes</Text>
  </TouchableOpacity>

</View>

  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20, backgroundColor: "#fff" },
  header: { fontSize: 24, fontWeight: "700", marginBottom: 20 },
  input: {
    backgroundColor: "#f1f5f9",
    padding: 14,
    borderRadius: 10,
    marginBottom: 10,
  },
  button: {
    backgroundColor: "#2563eb",
    padding: 16,
    borderRadius: 10,
    alignItems: "center",
    marginTop: 10
  },
  buttonText: {
    color: "#fff",
    fontWeight: "700"
  },
  closeButton: {
  position: "absolute",
  top: 10,
  left: 10,
  zIndex: 10,
  padding: 8,
  backgroundColor: "#e5e7eb",
  borderRadius: 20,
},

closeText: {
  fontSize: 18,
  fontWeight: "700",
  color: "#111827",
},

});
