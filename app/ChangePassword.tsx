import React, { useState } from "react";
import { View, Text, TextInput, TouchableOpacity, Alert, StyleSheet } from "react-native";
import { useRouter } from "expo-router";
import api from "../lib/api";
import { getToken } from "../lib/auth";

export default function ChangePassword() {
  const router = useRouter();
  const [oldPin, setOldPin] = useState("");
  const [newPin, setNewPin] = useState("");
  const [confirmPin, setConfirmPin] = useState("");

  const handleChangePassword = async () => {
    if (!oldPin || !newPin || !confirmPin) {
      return Alert.alert("Error", "All fields are required.");
    }

    if (newPin !== confirmPin) {
      return Alert.alert("Error", "New PINs do not match.");
    }

    if (!/^\d{6}$/.test(newPin)) {
      return Alert.alert("Error", "New PIN must be 6 digits.");
    }

    try {
      const tokenObj = await getToken();
      const bearer = tokenObj?.token || tokenObj?.user?.token;

      await api.put(
        "/auth/change-password",
        { oldPin, newPin },
        { headers: { Authorization: `Bearer ${bearer}` } }
      );

      Alert.alert("Success", "PIN updated successfully", [
        { text: "OK", onPress: () => router.back() }
      ]);

    } catch (err: any) {
      console.log("CHANGE PIN ERROR:", err.response?.data || err.message);
      Alert.alert("Error", err.response?.data?.error || "Failed to update PIN");
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Change PIN</Text>

      <TextInput
        style={styles.input}
        placeholder="Old PIN"
        secureTextEntry
        keyboardType="numeric"
        value={oldPin}
        onChangeText={setOldPin}
      />

      <TextInput
        style={styles.input}
        placeholder="New PIN"
        secureTextEntry
        keyboardType="numeric"
        maxLength={6}
        value={newPin}
        onChangeText={setNewPin}
      />

      <TextInput
        style={styles.input}
        placeholder="Confirm New PIN"
        secureTextEntry
        keyboardType="numeric"
        maxLength={6}
        value={confirmPin}
        onChangeText={setConfirmPin}
      />

      <TouchableOpacity style={styles.button} onPress={handleChangePassword}>
        <Text style={styles.buttonText}>Update PIN</Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.cancelButton} onPress={() => router.back()}>
        <Text style={styles.cancelText}>Cancel</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20, backgroundColor: "#fff" },
  title: { fontSize: 24, fontWeight: "800", marginBottom: 20 },
  input: {
    backgroundColor: "#f1f5f9",
    padding: 14,
    borderRadius: 10,
    marginBottom: 12,
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
    fontWeight: "700",
    fontSize: 16
  },
  cancelButton: { marginTop: 15, alignItems: "center" },
  cancelText: { color: "#64748b", fontSize: 15 }
});
