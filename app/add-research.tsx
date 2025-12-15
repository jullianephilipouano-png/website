import React, { useMemo, useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Alert,
  Platform,
} from "react-native";
import * as DocumentPicker from "expo-document-picker";
import { Ionicons } from "@expo/vector-icons";
import { router, useLocalSearchParams } from "expo-router";
import { getToken } from "../lib/auth";
import api from "../lib/api";

type SubType = "draft" | "final";

function normalizeKeywords(input: string): string[] {
  return input
    .split(",")
    .map(s => s.trim())
    .filter(Boolean);
}

// Helper function to normalize pasted text
function normalizeText(text: string): string {
  return text
    .replace(/\r\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .split('\n')
    .map(line => line.trim())
    .filter(line => line.length > 0)
    .join(' ')
    .trim();
}

export default function AddResearch() {
  const params = useLocalSearchParams();
  const initialType: SubType =
    String(params?.submissionType || "").toLowerCase() === "final" ? "final" : "draft";

  const [title, setTitle] = useState("");
  const [abstract, setAbstract] = useState("");
  const [adviser, setAdviser] = useState("");
  const [authorsInput, setAuthorsInput] = useState("");

  const [file, setFile] = useState<any>(null);
  const [submissionType, setSubmissionType] = useState<SubType>(initialType);
  const [submitting, setSubmitting] = useState(false);

  const [keywords, setKeywords] = useState<string[]>([]);
  const [kwInput, setKwInput] = useState("");

  const addKwFromInput = () => {
    const parts = normalizeKeywords(kwInput);
    if (!parts.length) return;
    setKeywords(prev => {
      const set = new Set(prev);
      parts.forEach(p => set.add(p));
      return Array.from(set);
    });
    setKwInput("");
  };

  const removeKw = (k: string) => setKeywords(prev => prev.filter(x => x !== k));

  const handleKwChange = (text: string) => {
    if (/[,|\n]$/.test(text)) {
      setKwInput(text.replace(/[,|\n]+$/g, ""));
      requestAnimationFrame(addKwFromInput);
    } else {
      setKwInput(text);
    }
  };

  const handleAbstractChange = (text: string) => {
    const lineBreaks = (text.match(/\n/g) || []).length;
    if (lineBreaks > 2) {
      setAbstract(normalizeText(text));
    } else {
      setAbstract(text);
    }
  };

  const handleFilePick = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: [
          "application/pdf",
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        ],
        copyToCacheDirectory: true,
      });
      if (result.canceled) return;
      const selected = result.assets[0];
      setFile(selected);
    } catch (err) {
      console.error("❌ File pick error:", err);
      Alert.alert("Error", "Failed to pick a file. Please try again.");
    }
  };

  const handleSubmit = async () => {
    const kwFinal = Array.from(
      new Set([
        ...keywords,
        ...normalizeKeywords(kwInput)
      ])
    );

    if (!title || !abstract || !file) {
      Alert.alert("Error", "Please fill in Title, Abstract, and attach a file.");
      return;
    }

    try {
      setSubmitting(true);
      const token = await getToken();

      const formData = new FormData();
      formData.append("title", title);
      formData.append("abstract", abstract);
      formData.append("adviser", adviser);
      if (authorsInput.trim()) {
        formData.append("authors", authorsInput);
      }

      formData.append("submissionType", submissionType);

      if (kwFinal.length) formData.append("keywords", kwFinal.join(","));

      if (typeof file?.uri === "string" && file.uri.startsWith("data:")) {
        const arr = file.uri.split(",");
        const mime = arr[0].match(/:(.*?);/)?.[1] || "application/pdf";
        const bstr = globalThis.atob(arr[1]);
        const u8 = new Uint8Array(bstr.length);
        for (let i = 0; i < bstr.length; i++) u8[i] = bstr.charCodeAt(i);
        const blob = new Blob([u8], { type: mime });
        formData.append("file", blob as any, file.name || `upload.${mime.includes("pdf") ? "pdf" : "docx"}`);
      } else if (Platform.OS === "web" && typeof file?.uri === "string" && file.uri.startsWith("blob:")) {
        const resp = await fetch(file.uri);
        const blob = await resp.blob();
        const mime = file.mimeType || blob.type || "application/pdf";
        formData.append("file", blob as any, file.name || `upload.${mime.includes("pdf") ? "pdf" : "docx"}`);
      } else {
        formData.append("file", {
          uri: file.uri,
          name: file.name || "upload.pdf",
          type: file.mimeType || "application/pdf",
        } as any);
      }

      const res = await api.post("/student/upload", formData, {
        headers: { Authorization: `Bearer ${token.token}` },
      });

      console.log("✅ Upload success:", res.data);
      Alert.alert("✅ Success", submissionType === "final" ? "Final submitted!" : "Draft uploaded!");

      setKwInput("");
      setKeywords(kwFinal);

      router.back();
    } catch (err: any) {
      console.error("❌ Upload failed:", err?.response?.data || err);
      Alert.alert("Error", err?.response?.data?.error || "Upload failed.");
    } finally {
      setSubmitting(false);
    }
  };

  const kwHint = useMemo(
    () => (keywords.length ? `${keywords.length} added` : "e.g. machine learning, gait, EMG"),
    [keywords.length]
  );

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.contentContainer}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={28} color="#1E293B" />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle}>
            {submissionType === "final" ? "Upload Final Paper" : "Upload Draft Paper"}
          </Text>
          <Text style={styles.headerSubtitle}>
            {submissionType === "final" ? "For Publishing" : "For Consultation"}
          </Text>
        </View>
      </View>

      {/* Draft / Final toggle */}
      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Submission Type</Text>
        <View style={styles.toggleContainer}>
          {(["draft", "final"] as SubType[]).map((opt) => {
            const active = submissionType === opt;
            return (
              <TouchableOpacity
                key={opt}
                onPress={() => setSubmissionType(opt)}
                style={[
                  styles.toggleButton,
                  active && styles.toggleButtonActive
                ]}
              >
                <Ionicons 
                  name={opt === "draft" ? "create-outline" : "checkmark-done-outline"} 
                  size={22} 
                  color={active ? "#fff" : "#64748B"} 
                />
                <Text style={[
                  styles.toggleText,
                  active && styles.toggleTextActive
                ]}>
                  {opt.toUpperCase()}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      {/* Research Title */}
      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Research Title *</Text>
        <TextInput
          style={styles.input}
          placeholder="Enter your research title"
          placeholderTextColor="#94A3B8"
          value={title}
          onChangeText={setTitle}
        />
      </View>

      {/* Abstract */}
      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Abstract *</Text>
        <Text style={styles.helperText}>Paste your abstract here. Text will wrap naturally in document format.</Text>
        <View style={styles.abstractContainer}>
          <View style={styles.abstractHeader}>
            <Text style={styles.abstractHeaderText}>ABSTRACT</Text>
          </View>
          <TextInput
            style={styles.abstractInput}
            placeholder="Write or paste your abstract here. The text will be displayed in a document-style format with proper paragraph spacing and justified alignment..."
            placeholderTextColor="#94A3B8"
            value={abstract}
            onChangeText={handleAbstractChange}
            multiline
          />
        </View>
      </View>

      {/* Adviser */}
      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Adviser (Optional)</Text>
        <TextInput
          style={styles.input}
          placeholder="adviser@msuiit.edu.ph"
          placeholderTextColor="#94A3B8"
          value={adviser}
          onChangeText={setAdviser}
          autoCapitalize="none"
          keyboardType="email-address"
        />
      </View>

      {/* Authors */}
      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Authors / Members</Text>
        <Text style={styles.helperText}>Separate multiple authors with commas</Text>
        <TextInput
          style={styles.input}
          placeholder="e.g. Juan Dela Cruz, Maria Santos, student3@msuiit.edu.ph"
          placeholderTextColor="#94A3B8"
          value={authorsInput}
          onChangeText={setAuthorsInput}
          autoCapitalize="none"
          autoCorrect={false}
        />
      </View>

      {/* Keywords */}
      <View style={styles.card}>
        <View style={styles.sectionHeader}>
          <View>
            <Text style={styles.sectionTitle}>Keywords</Text>
            <Text style={styles.helperText}>{kwHint}</Text>
          </View>
          <View style={styles.keywordBadge}>
            <Ionicons name="pricetags" size={16} color="#3b82f6" />
            <Text style={styles.keywordBadgeText}>{keywords.length}</Text>
          </View>
        </View>

        <View style={styles.kwInputContainer}>
          <Ionicons name="add-circle-outline" size={24} color="#3b82f6" />
          <TextInput
            style={styles.kwInput}
            placeholder="Type keyword and press comma or enter..."
            placeholderTextColor="#94A3B8"
            value={kwInput}
            onChangeText={handleKwChange}
            onSubmitEditing={addKwFromInput}
            autoCapitalize="none"
            autoCorrect={false}
            blurOnSubmit={false}
          />
        </View>

        {keywords.length > 0 && (
          <View style={styles.kwChips}>
            {keywords.map((k) => (
              <View key={k} style={styles.kwChip}>
                <Text style={styles.kwChipText}>#{k}</Text>
                <TouchableOpacity onPress={() => removeKw(k)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                  <Ionicons name="close-circle" size={20} color="#475569" />
                </TouchableOpacity>
              </View>
            ))}
          </View>
        )}
      </View>

      {/* File Attachment */}
      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Attach Research File *</Text>
        <Text style={styles.helperText}>PDF or DOCX format only</Text>
        
        <TouchableOpacity 
          style={[styles.uploadBtn, file && styles.uploadBtnActive]} 
          onPress={handleFilePick} 
          disabled={submitting}
        >
          <View style={styles.uploadIcon}>
            <Ionicons 
              name={file ? "document-attach" : "cloud-upload-outline"} 
              size={28} 
              color={file ? "#10b981" : "#3b82f6"} 
            />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.uploadText, file && styles.uploadTextActive]}>
              {file ? file.name : "Choose File"}
            </Text>
            <Text style={styles.uploadSubtext}>
              {file ? "Tap to change file" : "Tap to browse your files"}
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={24} color="#94a3b8" />
        </TouchableOpacity>
      </View>

      {/* Submit Button */}
      <TouchableOpacity
        style={[styles.submitBtn, submitting && styles.disabledBtn]}
        onPress={handleSubmit}
        disabled={submitting}
      >
        {submitting ? (
          <ActivityIndicator color="#fff" size="large" />
        ) : (
          <>
            <Ionicons name="cloud-upload" size={26} color="#fff" />
            <Text style={styles.submitText}>
              {submissionType === "final" ? "Submit Final Paper" : "Submit Draft Paper"}
            </Text>
          </>
        )}
      </TouchableOpacity>

      <View style={{ height: 40 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { 
    flex: 1, 
    backgroundColor: "#f8fafc",
  },
  contentContainer: {
    paddingTop: Platform.OS === "ios" ? 60 : 20,
    paddingHorizontal: 20,
    paddingBottom: 40,
  },

  // Header
  header: { 
    flexDirection: "row", 
    alignItems: "center", 
    marginBottom: 24,
    gap: 16,
  },
  backButton: {
    padding: 8,
  },
  headerTitle: { 
    fontSize: 26, 
    fontWeight: "800", 
    color: "#0f172a",
    letterSpacing: -0.5,
  },
  headerSubtitle: {
    fontSize: 16,
    color: "#64748b",
    fontWeight: "600",
    marginTop: 2,
  },

  // Card container
  card: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 20,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },

  // Section headers
  sectionTitle: { 
    fontSize: 17, 
    fontWeight: "700", 
    color: "#0f172a", 
    marginBottom: 8,
    letterSpacing: 0.2,
  },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 12,
  },
  helperText: {
    fontSize: 14,
    color: "#64748b",
    marginBottom: 12,
    fontWeight: "500",
  },

  // Toggle buttons
  toggleContainer: {
    flexDirection: "row",
    gap: 12,
  },
  toggleButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: "#e2e8f0",
    backgroundColor: "#f8fafc",
  },
  toggleButtonActive: {
    borderColor: "#3b82f6",
    backgroundColor: "#3b82f6",
  },
  toggleText: {
    fontSize: 16,
    fontWeight: "800",
    color: "#64748b",
    letterSpacing: 0.5,
  },
  toggleTextActive: {
    color: "#fff",
  },

  // Input fields
  input: {
    backgroundColor: "#f8fafc",
    borderColor: "#e2e8f0",
    borderWidth: 1.5,
    borderRadius: 12,
    paddingVertical: 16,
    paddingHorizontal: 16,
    fontSize: 16,
    color: "#0f172a",
    fontWeight: "500",
  },
  textArea: { 
    minHeight: 160, 
    textAlignVertical: "top",
    lineHeight: 24,
  },

  // Abstract document style
  abstractContainer: {
    backgroundColor: "#ffffff",
    borderWidth: 2,
    borderColor: "#cbd5e1",
    borderRadius: 8,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 3,
  },
  abstractHeader: {
    backgroundColor: "#f8fafc",
    borderBottomWidth: 2,
    borderBottomColor: "#cbd5e1",
    paddingVertical: 16,
    alignItems: "center",
  },
  abstractHeaderText: {
    fontSize: 16,
    fontWeight: "800",
    color: "#0f172a",
    letterSpacing: 2,
  },
  abstractInput: {
    backgroundColor: "#ffffff",
    paddingHorizontal: 24,
    paddingVertical: 20,
    fontSize: 15,
    color: "#0f172a",
    lineHeight: 26,
    textAlign: "justify",
    fontWeight: "400",
    minHeight: 200,
  },

  // Keywords
  keywordBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#eff6ff",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#bfdbfe",
  },
  keywordBadgeText: {
    fontSize: 15,
    fontWeight: "800",
    color: "#3b82f6",
  },
  kwInputContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: "#f8fafc",
    borderWidth: 1.5,
    borderColor: "#e2e8f0",
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  kwInput: {
    flex: 1,
    fontSize: 16,
    color: "#0f172a",
    fontWeight: "500",
  },
  kwChips: { 
    flexDirection: "row", 
    flexWrap: "wrap", 
    gap: 10, 
    marginTop: 16,
  },
  kwChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#e0e7ff",
    borderRadius: 20,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: "#c7d2fe",
  },
  kwChipText: { 
    color: "#3730a3", 
    fontWeight: "700", 
    fontSize: 15,
  },

  // File upload
  uploadBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
    borderColor: "#e2e8f0",
    borderWidth: 2,
    borderStyle: "dashed",
    borderRadius: 12,
    paddingVertical: 20,
    paddingHorizontal: 20,
    backgroundColor: "#f8fafc",
  },
  uploadBtnActive: {
    borderColor: "#10b981",
    backgroundColor: "#f0fdf4",
    borderStyle: "solid",
  },
  uploadIcon: {
    width: 56,
    height: 56,
    borderRadius: 12,
    backgroundColor: "#eff6ff",
    alignItems: "center",
    justifyContent: "center",
  },
  uploadText: { 
    fontSize: 16, 
    color: "#3b82f6", 
    fontWeight: "700",
    marginBottom: 4,
  },
  uploadTextActive: {
    color: "#10b981",
  },
  uploadSubtext: {
    fontSize: 14,
    color: "#64748b",
    fontWeight: "500",
  },

  // Submit button
  submitBtn: {
    backgroundColor: "#3b82f6",
    borderRadius: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 20,
    gap: 12,
    marginTop: 8,
    shadowColor: "#3b82f6",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 6,
  },
  submitText: { 
    color: "#fff", 
    fontWeight: "800", 
    fontSize: 18,
    letterSpacing: 0.3,
  },
  disabledBtn: { 
    opacity: 0.5,
  },
});