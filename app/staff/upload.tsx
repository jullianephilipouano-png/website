// app/screens/StaffUploadScreen.tsx
import React, { useState, useEffect, useCallback } from "react";
import axios from "axios";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Alert,
  Modal,
  Platform,
} from "react-native";
import * as DocumentPicker from "expo-document-picker";
import { Ionicons } from "@expo/vector-icons";
import api from "../../lib/api";
import { getToken } from "../../lib/auth";
import { router } from "expo-router";

/** 🎨 Matching Faculty Pastel Palette */
const C = {
  bg: "#f6f6f9",
  card: "#ffffff",
  ink: "#0f172a",
  mute: "#6b7280",
  ring: "#eef2ff",
};

type ApprovedItem = {
  _id: string;
  title?: string;
  author?: string;
    coAuthors?: string[];
  updatedAt?: string;
  fileName?: string;
  visibility?: string;
  embargoUntil?: string | null;
  keywords?: string[] | string;
  abstract?: string;           // ✅ needed for prefill
  year?: string | number;
};


export default function StaffUploadScreen() {
  const [approvedList, setApprovedList] = useState<ApprovedItem[]>([]);
  const [selected, setSelected] = useState<ApprovedItem | null>(null);
  const [manualMode, setManualMode] = useState(false);
  const [loading, setLoading] = useState(true);
  const [coAuthors, setCoAuthors] = useState("");

  const [uploading, setUploading] = useState(false);
const joinCsv = (v: any) =>
  Array.isArray(v) ? v.join(", ") : (typeof v === "string" ? v : "");

  // Fields
  const [file, setFile] = useState<any>(null); // only used for manual uploads
  const [title, setTitle] = useState("");
  const [author, setAuthor] = useState("");
  const [year, setYear] = useState("");
  const [keywords, setKeywords] = useState("");
  const [abstract, setAbstract] = useState("");

  // reference to the already-approved server-side file
  const [sourceId, setSourceId] = useState<string | null>(null);

  const fetchApproved = useCallback(async () => {
    try {
      const token = await getToken();
      if (!token?.token) throw new Error("Authentication token not found.");
      const res = await api.get("/faculty/approved-list", {
        headers: { Authorization: `Bearer ${token.token}` },
      });
      setApprovedList(res.data || []);
    } catch (err: any) {
      console.error("❌ Fetch approved list failed:", err);
      Alert.alert("Error", "Failed to load approved research.");
    } finally {
      setLoading(false);
    }
  }, []);

  /* ---------------- Fetch Approved Research ---------------- */
  useEffect(() => {
    fetchApproved();
  }, [fetchApproved]);

  /* ---------------- File Picker (manual only) ---------------- */
  const handleFilePick = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ["application/pdf"],
        copyToCacheDirectory: true,
      });
      if (result.canceled) return;
      setFile(result.assets[0]); // { uri, name?, mimeType? }
    } catch (err) {
      console.error("❌ File pick error:", err);
      Alert.alert("Error", "Failed to pick file. Try again.");
    }
  };

  /* --------- Convert picked asset to proper FormData part --------- */
  const filePartFromPickerAsset = async (asset: any): Promise<any> => {
    const fallbackName = (asset?.name && String(asset.name)) || "document.pdf";
    const ensuredName = fallbackName.toLowerCase().endsWith(".pdf")
      ? fallbackName
      : `${fallbackName}.pdf`;

    if (Platform.OS === "web") {
      // On web, FormData requires a Blob/File
      const resp = await fetch(asset.uri);
      const blob = await resp.blob();
      // Force correct content-type; some browsers report octet-stream
      const pdfBlob = blob.type === "application/pdf" ? blob : blob.slice(0, blob.size, "application/pdf");
      return new File([pdfBlob], ensuredName, { type: "application/pdf" });
    }

    // Native – RN FormData accepts this object shape
    return {
      uri: asset.uri,
      name: ensuredName,
      type: asset.mimeType || "application/pdf",
    } as any;
  };


// --- keep helpers above as in your file ---
const isNonEmpty = (v: any) =>
  typeof v === "string" ? v.trim().length > 0 : v !== undefined && v !== null;

const openModal = async (paper?: ApprovedItem) => {
  if (paper) {
    setManualMode(false);
    setSelected(paper);
    setSourceId(paper._id);
    setFile(null);

    // 1) Prefill immediately from list item (so UI shows something now)
    setTitle(paper.title || "");
    setAuthor(paper.author || "");
    setCoAuthors(paper.coAuthors?.join(", ") || ""); 
    setYear(isNonEmpty(paper.year) ? String(paper.year) : "");
    setKeywords(
      Array.isArray(paper.keywords)
        ? paper.keywords.join(", ")
        : (typeof (paper as any).keywords === "string" ? (paper as any).keywords : "")
    );
    setAbstract(isNonEmpty(paper.abstract) ? (paper.abstract as string) : "");

    // 2) Fetch detail and override only with non-empty values (for long abstract, etc.)
    try {
      const token = await getToken();
      const { data } = await api.get(`/faculty/approved/${paper._id}`, {
        headers: { Authorization: `Bearer ${token?.token}` },
      });

      if (Array.isArray(paper.coAuthors) && paper.coAuthors.length) {
  setCoAuthors(paper.coAuthors.join(", "));
} else {
  setCoAuthors("");
}

      if (isNonEmpty(data?.title)) setTitle(data.title);
      if (isNonEmpty(data?.author)) setAuthor(data.author);
      if (isNonEmpty(data?.year)) setYear(String(data.year));
      if (Array.isArray(data?.keywords) && data.keywords.length) {
        setKeywords(data.keywords.join(", "));
      } else if (typeof data?.keywords === "string" && data.keywords.trim()) {
        setKeywords(data.keywords);
      }
      if (isNonEmpty(data?.abstract)) setAbstract(data.abstract);
    } catch (err) {
      console.error("❌ approved/:id fetch failed", err);
      Alert.alert("Note", "Couldn't load full metadata from server. Using list values.");
    }
  } else {
    // Manual upload
    setManualMode(true);
    setSelected(null);
    setSourceId(null);
    setFile(null);
    setTitle("");
    setAuthor("");
    setCoAuthors("");
    setYear("");
    setKeywords("");
    setAbstract("");
  }
};






  /* ---------------- Optional: preview approved PDF via signed URL ---------------- */
  const viewApproved = async () => {
    try {
      if (!sourceId) return;
      const token = await getToken();
      const base = (api.defaults.baseURL || "").replace(/\/+$/, "");
      const res = await fetch(`${base}/research/file/${sourceId}/signed`, {
        headers: { Authorization: `Bearer ${token.token}` },
      });
      if (!res.ok) {
        const msg = await res.text().catch(() => "");
        Alert.alert("Error", `Failed to get preview link (${res.status}) ${msg}`);
        return;
      }
      const { url } = await res.json();
      if (Platform.OS === "web") {
        window.open(url, "_blank");
      } else {
        Alert.alert("PDF Link", url);
      }
    } catch (e: any) {
      console.error("❌ Signed link error:", e);
      Alert.alert("Error", e?.message || "Failed to open file.");
    }
  };

  /* ---------------- Upload Handler ---------------- */
  const handleUpload = async () => {
    if (!title.trim() || !author.trim()) {
      Alert.alert("Error", "Please fill the Title and Author fields.");
      return;
    }

    try {
      setUploading(true);
      const token = await getToken();

      // Path A: Faculty-approved (reuse file by sourceId)
      if (!manualMode && sourceId) {
        const res = await api.post(
          "/research/upload-from-approved",
          { sourceId, title, author, coAuthors, year, keywords, abstract },
          { headers: { Authorization: `Bearer ${token.token}` } }
        );

        console.log("✅ Upload-from-approved success:", res.data);

        // Optimistically remove from the list so it disappears immediately
        setApprovedList((prev) => prev.filter((x) => x._id !== sourceId));

        Alert.alert("✅ Success", "Faculty-approved file attached successfully!", [
          { text: "OK", onPress: () => router.replace("/screens/files") },
        ]);
      } else {
        // Path B: Manual upload (multipart/form-data)
        if (!file) {
          Alert.alert("Error", "Please attach a PDF file for manual upload.");
          return;
        }

        const filePart = await filePartFromPickerAsset(file);
        const formData = new FormData();
        formData.append("title", title);
        formData.append("author", author);
          formData.append("coAuthors", coAuthors);
        formData.append("year", year);
        formData.append("keywords", keywords);
        formData.append("abstract", abstract);
        formData.append("file", filePart);

        // IMPORTANT: Do NOT set Content-Type manually; let Axios/browser set the boundary
        const res = await api.post("/research/upload", formData, {
          headers: { Authorization: `Bearer ${token.token}` },
        });

        console.log("✅ Manual upload success:", res.data);
        // Optionally refresh anything needed; here we just navigate
        Alert.alert("✅ Success", "Legacy research uploaded successfully!", [
          { text: "OK", onPress: () => router.replace("/screens/files") },
        ]);
      }

      // Reset
      setSelected(null);
      setManualMode(false);
      setSourceId(null);
      setFile(null);
      setTitle("");
      setAuthor("");
        setCoAuthors("");
      setYear("");
      setKeywords("");
      setAbstract("");
    } catch (err: any) {
      // Surface server error message if available
      const msg =
        err?.response?.data?.error ||
        err?.message ||
        "Failed to upload research.";
      console.error("❌ Upload failed:", err?.response?.data || err);
      Alert.alert("Error", msg);
    } finally {
      setUploading(false);
    }
  };

  /* ---------------- UI ---------------- */
  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#2563eb" />
        <Text style={{ color: C.mute, marginTop: 10 }}>Loading approved research...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={styles.header}>Faculty-Approved Research</Text>

        {approvedList.length === 0 ? (
          <Text style={{ color: C.mute, textAlign: "center", marginTop: 40 }}>
            No approved research available.
          </Text>
        ) : (
         approvedList.map((r) => (
  <TouchableOpacity key={r._id} style={styles.card} onPress={() => openModal(r)}>
    <Text style={styles.title}>{r.title}</Text>
    <Text style={styles.meta}>Author: {r.author || "—"}</Text>

    {/* ✅ Show co-authors if present */}
    {!!r.coAuthors?.length && (
      <Text style={[styles.meta, { fontStyle: "italic", color: C.mute }]}>
        Co-authors: {r.coAuthors.join(", ")}
      </Text>
    )}

    <Text style={styles.meta}>
      Approved: {r.updatedAt ? new Date(r.updatedAt).toLocaleDateString() : "—"}
    </Text>
    <View style={styles.badge}>
      <Ionicons name="checkmark-circle" size={14} color="#10B981" />
      <Text style={styles.badgeText}>Approved</Text>
    </View>
  </TouchableOpacity>
))

        )}

        {/* ✅ Manual Upload Always Available */}
        <View style={{ alignItems: "center", marginTop: 24 }}>
          <Text style={{ color: C.mute, textAlign: "center", marginBottom: 6 }}>
            Need to upload old accepted research (before the system)?
          </Text>
          <TouchableOpacity style={styles.manualBtn} onPress={() => openModal()}>
            <Ionicons name="add-circle-outline" size={22} color="#fff" />
            <Text style={styles.manualText}>Manual Upload (Legacy Research)</Text>
          </TouchableOpacity>
        </View>

        <TouchableOpacity onPress={() => router.push("/staff")} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color={C.ink} />
          <Text style={{ color: C.ink, marginLeft: 6, fontWeight: "700" }}>Back to Dashboard</Text>
        </TouchableOpacity>
      </ScrollView>

      {/* ---------------- Upload Modal ---------------- */}
      <Modal visible={!!selected || manualMode} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modal}>
            <ScrollView>
              <Text style={styles.modalHeader}>
                {manualMode ? "Manual Upload (Legacy File)" : "Upload Faculty-Approved PDF"}
              </Text>

              {/* PDF Preview (faculty-approved only via signed URL) */}
              {!manualMode && sourceId && (
                <TouchableOpacity style={styles.viewPdfBtn} onPress={viewApproved}>
                  <Ionicons name="document-text-outline" size={18} color="#fff" />
                  <Text style={styles.viewPdfText}>Preview Approved PDF</Text>
                </TouchableOpacity>
              )}

              {/* File Picker (only for manual) */}
              {manualMode && (
                <TouchableOpacity style={styles.fileBtn} onPress={handleFilePick}>
                  <Ionicons name="cloud-upload-outline" size={22} color="#fff" />
                  <Text style={styles.fileBtnText}>{file ? file.name : "Select PDF File"}</Text>
                </TouchableOpacity>
              )}

              {/* Metadata Fields */}
              <View className="form">
                <View style={styles.formGroup}>
                  <Text style={styles.label}>Title *</Text>
                  <TextInput value={title} onChangeText={setTitle} style={styles.input} />
                </View>

                <View style={styles.formGroup}>
                  <Text style={styles.label}>Author *</Text>
                  <TextInput value={author} onChangeText={setAuthor} style={styles.input} />
                </View>
                  {/* ✅ Co-Authors */}
                <View style={styles.formGroup}>
                  <Text style={styles.label}>Co-Authors</Text>
                  <TextInput
                    value={coAuthors}
                    onChangeText={setCoAuthors}
                    placeholder="Separate names with commas"
                    placeholderTextColor={C.mute}
                    style={styles.input}
                  />
                </View>

                <View style={styles.formGroup}>
                  <Text style={styles.label}>Year</Text>
                  <TextInput
                    value={year}
                    onChangeText={setYear}
                    style={styles.input}
                    keyboardType="numeric"
                  />
                </View>

                <View style={styles.formGroup}>
                  <Text style={styles.label}>Keywords</Text>
                  <TextInput value={keywords} onChangeText={setKeywords} style={styles.input} />
                </View>

                <View style={styles.formGroup}>
                  <Text style={styles.label}>Abstract</Text>
                  <TextInput
                    value={abstract}
                    onChangeText={setAbstract}
                    style={[styles.input, { height: 100 }]}
                    multiline
                  />
                </View>
              </View>

              {/* Upload */}
              <TouchableOpacity
                style={[styles.uploadBtn, uploading && { opacity: 0.7 }]}
                onPress={handleUpload}
                disabled={uploading}
              >
                {uploading ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <>
                    <Ionicons name="arrow-up-circle-outline" size={22} color="#fff" />
                    <Text style={styles.uploadText}>Upload</Text>
                  </>
                )}
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.cancelBtn}
                onPress={() => {
                  setSelected(null);
                  setManualMode(false);
                  setSourceId(null);
                  setFile(null);
                   setCoAuthors("");
                }}
              >
                <Text style={styles.cancelText}>Cancel</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}

/* ---------------- Styles ---------------- */
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg },
  scroll: { padding: 20 },
  header: {
    color: C.ink,
    fontSize: 22,
    fontWeight: "900",
    marginBottom: 20,
    textAlign: "center",
  },
  card: {
    backgroundColor: C.card,
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: C.ring,
    ...Platform.select({
      ios: { shadowColor: "#000", shadowOpacity: 0.06, shadowRadius: 8, shadowOffset: { width: 0, height: 4 } },
      android: { elevation: 2 },
    }),
  },
  title: { color: C.ink, fontSize: 16, fontWeight: "800", marginBottom: 6 },
  meta: { color: C.mute, fontSize: 13, fontWeight: "600" },
  badge: { flexDirection: "row", alignItems: "center", gap: 4, marginTop: 6 },
  badgeText: { color: "#10B981", fontWeight: "700", fontSize: 13 },
  manualBtn: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#2563eb",
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 10,
    gap: 8,
  },
  manualText: { color: "#fff", fontWeight: "700", fontSize: 15 },
  backBtn: { marginTop: 20, flexDirection: "row", justifyContent: "center", alignItems: "center" },
  center: { flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: C.bg },
  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.4)", justifyContent: "center", padding: 20 },
  modal: { backgroundColor: "#fff", borderRadius: 16, padding: 20, maxHeight: "90%" },
  modalHeader: {
    color: C.ink,
    fontSize: 20,
    fontWeight: "900",
    marginBottom: 10,
    textAlign: "center",
  },
  viewPdfBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#2563eb",
    borderRadius: 8,
    paddingVertical: 10,
    marginBottom: 12,
    gap: 6,
  },
  viewPdfText: { color: "#fff", fontWeight: "700", fontSize: 14 },
  fileBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: "#2563eb",
    padding: 12,
    borderRadius: 12,
    marginBottom: 14,
  },
  fileBtnText: { color: "#fff", fontWeight: "700", fontSize: 15 },
  formGroup: { marginBottom: 10 },
  label: { color: C.ink, marginBottom: 4, fontWeight: "700", fontSize: 13 },
  input: { 
    backgroundColor: "#f9fafb", 
    color: C.ink, 
    borderRadius: 8, 
    padding: 10,
    borderWidth: 1,
    borderColor: C.ring,
  },
  uploadBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#10b981",
    padding: 14,
    borderRadius: 10,
    marginTop: 10,
  },
  uploadText: { color: "#fff", fontWeight: "700" },
  cancelBtn: { alignItems: "center", marginTop: 14 },
  cancelText: { color: C.mute, fontWeight: "700" },
});