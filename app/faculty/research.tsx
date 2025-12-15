// app/screens/faculty/research.tsx
import React, { useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Platform,
  ActivityIndicator,
  StyleSheet,
  Linking,
  Alert,
  Modal,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import FacultyShell from "./Shell";
import { useFacultyData, normalizeType } from "./useFaculty";

// API + auth helpers
import api from "../../lib/api";
import { getToken } from "../../lib/auth";

type SubmissionType = "draft" | "final";

export default function FacultyResearch() {
  const { myResearch, uploadResearch } = useFacultyData();

  // mirror list so we can optimistically update after edit/delete
  const [list, setList] = useState<any[]>(myResearch);
  useEffect(() => setList(myResearch), [myResearch]);

  const [showForm, setShowForm] = useState(false);
  const [title, setTitle] = useState("");
  const [abstract, setAbstract] = useState("");
  const [keywords, setKeywords] = useState(""); // 👈 NEW (csv)
  const [submissionType, setSubmissionType] = useState<SubmissionType>("draft");
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);

  // ---------- EDIT MODAL ----------
  const [editOpen, setEditOpen] = useState(false);
  const [editBusy, setEditBusy] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editAbstract, setEditAbstract] = useState("");
  const [editKeywords, setEditKeywords] = useState(""); // 👈 NEW (csv)
  const [editSubmissionType, setEditSubmissionType] = useState<SubmissionType>("draft");
  const [replaceFile, setReplaceFile] = useState<File | null>(null);

  // ---------- DELETE SPINNER PER ROW ----------
  const [deletingIds, setDeletingIds] = useState<Record<string, boolean>>({});

  const currentEditing = useMemo(
    () => list.find((r) => r._id === editId),
    [editId, list]
  );

  const doUpload = async () => {
    if (!title.trim() || !abstract.trim()) {
      Alert.alert("Missing info", "Title and Abstract are required");
      return;
    }
    setBusy(true);
    try {
      const created = await uploadResearch({
        title,
        abstract,
        submissionType,
        keywords, // 👈 pass csv to helper (backend accepts csv or array)
        file: Platform.OS === "web" ? file ?? undefined : undefined,
      });

      if (created?.research) {
        setList((prev) => [created.research, ...prev]);
      }

      setTitle("");
      setAbstract("");
      setKeywords("");
      setSubmissionType("draft");
      setFile(null);
      setShowForm(false);
    } catch (e: any) {
      Alert.alert(
        "Upload failed",
        e?.response?.data?.error || e?.message || "Please try again."
      );
    } finally {
      setBusy(false);
    }
  };

  /** Open file with Authorization header (web uses blob→new tab).
   *  On native, we still deep-link to the endpoint (best-effort).
   */
  async function openFacultyFile(item: any) {
    try {
      if (!item?._id) {
        Alert.alert("Error", "Invalid file");
        return;
      }
      const tokenObj = await getToken();
      const token = tokenObj?.token;
      if (!token) {
        Alert.alert("Session expired", "Please sign in again.");
        return;
      }

      // Build absolute API base
      const apiBase = (() => {
        const b = (api.defaults.baseURL || "").replace(/\/+$/, "");
        if (/^https?:\/\//i.test(b)) return b;
        if (typeof window !== "undefined") {
          return `${window.location.origin}${b.startsWith("/") ? "" : "/"}${b}`;
        }
        return b;
      })();

      const url = `${apiBase}/faculty/preview/${item._id}`;

      if (Platform.OS === "web") {
        const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
        if (!res.ok) {
          let detail = "";
          try { detail = await res.text(); } catch {}
          if (res.status === 404) {
            const hint =
              /no filePath on record/i.test(detail)
                ? "This record has no attached file."
                : /File not found on disk/i.test(detail)
                ? "The file record exists but the file is missing on the server."
                : "File not found.";
            throw new Error(`${hint}`);
          }
          throw new Error(`Open failed (${res.status}) ${detail}`);
        }
        const blob = await res.blob();
        const blobUrl = URL.createObjectURL(blob);

        const a = document.createElement("a");
        a.href = blobUrl;
        a.target = "_blank";
        a.rel = "noopener noreferrer";
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);

        setTimeout(() => URL.revokeObjectURL(blobUrl), 60_000);
        return;
      }

      // Native best-effort
      Linking.openURL(url);
    } catch (e: any) {
      console.error("❌ Faculty open file error:", e);
      const msg =
        e?.response?.data?.error ||
        e?.message ||
        "Failed to open file.";
      Alert.alert("Error", msg);
    }
  }

  // ---------- DELETE ----------
  function confirmDelete(item: any) {
    if (!item?._id) return;

    if (Platform.OS === "web") {
      const ok = window.confirm(`Delete "${item.title}"? This cannot be undone.`);
      if (ok) doDelete(item);
      return;
    }

    Alert.alert(
      "Delete this paper?",
      `This will remove "${item?.title}" from your uploads.`,
      [
        { text: "Cancel", style: "cancel" },
        { text: "Delete", style: "destructive", onPress: () => doDelete(item) },
      ]
    );
  }

  async function doDelete(item: any) {
    if (!item?._id) return;
    try {
      setDeletingIds((m) => ({ ...m, [item._id]: true }));
      await api.delete(`/faculty/my-research/${item._id}`);
      setList((prev) => prev.filter((x) => x._id !== item._id));
    } catch (e: any) {
      const msg = e?.response?.data?.error || e?.message || "Failed to delete.";
      if (Platform.OS === "web") {
        window.alert(`Delete failed: ${msg}`);
      } else {
        Alert.alert("Delete failed", msg);
      }
    } finally {
      setDeletingIds((m) => {
        const { [item._id]: _, ...rest } = m;
        return rest;
      });
    }
  }

  // ---------- EDIT ----------
  function startEdit(item: any) {
    setEditId(item._id);
    setEditTitle(item.title || "");
    setEditAbstract(item.abstract || "");
    setEditKeywords(Array.isArray(item.keywords) ? item.keywords.join(", ") : ""); // 👈 seed from array → csv
    setEditSubmissionType(normalizeType(item) as SubmissionType);
    setReplaceFile(null);
    setEditOpen(true);
  }

  async function saveEdit() {
    if (!editId) return;
    if (!editTitle.trim() || !editAbstract.trim()) {
      Alert.alert("Missing info", "Title and Abstract are required");
      return;
    }
    setEditBusy(true);
    try {
      const fd = new FormData();
      fd.append("title", editTitle);
      fd.append("abstract", editAbstract);
      fd.append("submissionType", editSubmissionType);
      fd.append("keywords", editKeywords); // 👈 send csv
      if (Platform.OS === "web" && replaceFile) {
        // @ts-ignore
        fd.append("file", replaceFile);
      }

      const { data } = await api.put(`/faculty/my-research/${editId}`, fd, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      const updated = data?.research || {};

      setList(prev =>
        prev.map(r =>
          r._id === editId
            ? {
                ...r,
                ...updated,
                title: editTitle,
                abstract: editAbstract,
                submissionType: editSubmissionType,
                keywords: updated.keywords || editKeywords.split(",").map(s => s.trim()).filter(Boolean), // 👈 optimistic
              }
            : r
        )
      );

      setEditOpen(false);
      setEditId(null);
    } catch (e: any) {
      const msg = e?.response?.data?.error || e?.message || "Failed to save changes.";
      Alert.alert("Edit failed", msg);
    } finally {
      setEditBusy(false);
      setReplaceFile(null);
    }
  }

  const Right = (
    <TouchableOpacity style={styles.addBtn} onPress={() => setShowForm((s) => !s)}>
      <Ionicons name={showForm ? "close" : "add-circle"} size={18} color="#fff" />
      <Text style={styles.addText}>{showForm ? "Close" : "Upload New"}</Text>
    </TouchableOpacity>
  );

  return (
    <FacultyShell title="My Research" subtitle="Upload, edit & manage your papers" right={Right}>
      {showForm && (
        <View style={styles.formCard}>
          <Text style={styles.label}>Research Title</Text>
          <View style={styles.inputWrap}>
            <Ionicons name="document-text-outline" size={20} color="#64748b" style={{ marginRight: 10 }} />
            <TextInput
              placeholder="Enter research title"
              style={styles.input}
              value={title}
              onChangeText={setTitle}
              placeholderTextColor="#94a3b8"
            />
          </View>

          <Text style={styles.label}>Abstract / Summary</Text>
          <View style={[styles.inputWrap, { height: 140, alignItems: "flex-start" }]}>
            <Ionicons name="create-outline" size={20} color="#64748b" style={{ marginTop: 12, marginRight: 10 }} />
            <TextInput
              placeholder="Enter abstract"
              style={[styles.input, { height: 120, textAlignVertical: "top" }]}
              value={abstract}
              onChangeText={setAbstract}
              multiline
              placeholderTextColor="#94a3b8"
            />
          </View>

          {/* NEW: Keywords */}
          <Text style={styles.label}>Keywords (comma-separated)</Text>
          <View style={styles.inputWrap}>
            <Ionicons name="pricetags-outline" size={20} color="#64748b" style={{ marginRight: 10 }} />
            <TextInput
              placeholder="e.g., biomechanics, gait, EMG"
              style={styles.input}
              value={keywords}
              onChangeText={setKeywords}
              placeholderTextColor="#94a3b8"
              autoCapitalize="none"
            />
          </View>

          <Text style={styles.label}>Submission Type</Text>
          <View style={{ flexDirection: "row", gap: 8, marginBottom: 6 }}>
            {(["draft", "final"] as const).map((opt) => {
              const active = submissionType === opt;
              return (
                <TouchableOpacity
                  key={opt}
                  onPress={() => setSubmissionType(opt)}
                  style={{
                    paddingVertical: 8,
                    paddingHorizontal: 12,
                    borderRadius: 10,
                    borderWidth: 2,
                    borderColor: active ? "#2563EB" : "#E2E8F0",
                    backgroundColor: active ? "#EFF6FF" : "#F8FAFC",
                  }}
                >
                  <Text style={{ fontWeight: "800", color: "#1E293B" }}>{opt.toUpperCase()}</Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {Platform.OS === "web" && (
            <>
              <Text style={styles.label}>Attach File (optional)</Text>
              <input
                type="file"
                accept="application/pdf,.pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,.docx,application/msword,.doc"
                onChange={(e) => setFile((e.target.files?.[0] as any) || null)}
              />
              {file ? (
                <Text style={{ marginTop: 6, color: "#475569", fontSize: 12 }}>
                  Selected: <Text style={{ fontWeight: "700" }}>{file.name}</Text>
                </Text>
              ) : null}
            </>
          )}

          <TouchableOpacity
            disabled={busy}
            onPress={doUpload}
            style={[styles.uploadBtn, busy && { opacity: 0.6 }]}
          >
            {busy ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <>
                <Ionicons name="cloud-upload" size={18} color="#fff" />
                <Text style={styles.uploadText}>Upload</Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      )}

      {list.length === 0 ? (
        <View style={styles.empty}>
          <Ionicons name="document-outline" size={64} color="#cbd5e1" />
          <Text style={styles.emptyText}>No research uploaded yet</Text>
          <Text style={styles.emptySub}>Upload your first research paper to get started</Text>
        </View>
      ) : (
        <ScrollView style={{ marginTop: 8 }}>
          {list.map((r: any) => {
            const isFinal = normalizeType(r) === "final";
            const deleting = !!deletingIds[r._id];
            return (
              <View key={r._id} style={styles.rowCard}>
                <View style={styles.iconBox}>
                  <Ionicons name="document-text" size={20} color="#2563eb" />
                </View>

                <View style={{ flex: 1 }}>
                  <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                    <Text style={styles.title}>{r.title}</Text>
                    <TypeBadge isFinal={isFinal} />
                  </View>

                  <Text style={styles.abstract} numberOfLines={2}>
                    {r.abstract}
                  </Text>

                  {/* Keyword chips (list) */}
                  {!!r.keywords?.length && (
                    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 6 }}>
                      {r.keywords.map((k: string) => (
                        <View key={`${r._id}-${k}`} style={{ paddingHorizontal: 8, paddingVertical: 4, borderRadius: 999, backgroundColor: "#f1f5f9" }}>
                          <Text style={{ fontSize: 11, fontWeight: "700", color: "#334155" }}>#{k}</Text>
                        </View>
                      ))}
                    </View>
                  )}

                  <Text style={styles.date}>Uploaded: {new Date(r.createdAt).toLocaleDateString()}</Text>

                  {/* Actions row */}
                  <View style={{ flexDirection: "row", gap: 8, marginTop: 10, flexWrap: "wrap" }}>
                    {r.fileName ? (
                      <TouchableOpacity onPress={() => openFacultyFile(r)} style={styles.viewBtn} activeOpacity={0.85}>
                        <Ionicons name="attach-outline" size={16} color="#2563EB" />
                        <Text style={styles.viewBtnText}>View file ({r.fileName})</Text>
                      </TouchableOpacity>
                    ) : (
                      <View style={styles.viewBtnDisabled}>
                        <Ionicons name="attach-outline" size={16} color="#94A3B8" />
                        <Text style={[styles.viewBtnText, { color: "#94A3B8" }]}>No file</Text>
                      </View>
                    )}

                    <TouchableOpacity onPress={() => startEdit(r)} style={styles.editBtn} activeOpacity={0.9}>
                      <Ionicons name="create-outline" size={16} color="#0f766e" />
                      <Text style={styles.editBtnText}>Edit</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      onPress={() => (deleting ? null : confirmDelete(r))}
                      style={[styles.delBtn, deleting && { opacity: 0.6 }]}
                      activeOpacity={0.9}
                      disabled={deleting}
                    >
                      {deleting ? (
                        <ActivityIndicator size="small" color="#b91c1c" />
                      ) : (
                        <>
                          <Ionicons name="trash-outline" size={16} color="#b91c1c" />
                          <Text style={styles.delBtnText}>Delete</Text>
                        </>
                      )}
                    </TouchableOpacity>
                  </View>
                </View>
              </View>
            );
          })}
        </ScrollView>
      )}

      {/* ---------- EDIT MODAL ---------- */}
      <Modal visible={editOpen} transparent animationType="fade" onRequestClose={() => setEditOpen(false)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
              <Text style={styles.modalTitle}>Edit Research</Text>
              <TouchableOpacity onPress={() => setEditOpen(false)} style={styles.modalX}>
                <Ionicons name="close" size={18} color="#334155" />
              </TouchableOpacity>
            </View>

            <Text style={styles.label}>Title</Text>
            <View style={styles.inputWrap}>
              <Ionicons name="document-text-outline" size={20} color="#64748b" style={{ marginRight: 10 }} />
              <TextInput
                placeholder="Enter title"
                style={styles.input}
                value={editTitle}
                onChangeText={setEditTitle}
                placeholderTextColor="#94a3b8"
              />
            </View>

            <Text style={styles.label}>Abstract</Text>
            <View style={[styles.inputWrap, { height: 140, alignItems: "flex-start" }]}>
              <Ionicons name="create-outline" size={20} color="#64748b" style={{ marginTop: 12, marginRight: 10 }} />
              <TextInput
                placeholder="Enter abstract"
                style={[styles.input, { height: 120, textAlignVertical: "top" }]}
                value={editAbstract}
                onChangeText={setEditAbstract}
                multiline
                placeholderTextColor="#94a3b8"
              />
            </View>

            {/* NEW: Edit keywords */}
            <Text style={styles.label}>Keywords (comma-separated)</Text>
            <View style={styles.inputWrap}>
              <Ionicons name="pricetags-outline" size={20} color="#64748b" style={{ marginRight: 10 }} />
              <TextInput
                placeholder="e.g., biomechanics, gait, EMG"
                style={styles.input}
                value={editKeywords}
                onChangeText={setEditKeywords}
                placeholderTextColor="#94a3b8"
                autoCapitalize="none"
              />
            </View>

            <Text style={styles.label}>Submission Type</Text>
            <View style={{ flexDirection: "row", gap: 8, marginBottom: 6 }}>
              {(["draft", "final"] as const).map((opt) => {
                const active = editSubmissionType === opt;
                return (
                  <TouchableOpacity
                    key={opt}
                    onPress={() => setEditSubmissionType(opt)}
                    style={{
                      paddingVertical: 8,
                      paddingHorizontal: 12,
                      borderRadius: 10,
                      borderWidth: 2,
                      borderColor: active ? "#2563EB" : "#E2E8F0",
                      backgroundColor: active ? "#EFF6FF" : "#F8FAFC",
                    }}
                  >
                    <Text style={{ fontWeight: "800", color: "#1E293B" }}>{opt.toUpperCase()}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {Platform.OS === "web" && (
              <>
                <Text style={styles.label}>Replace File (optional)</Text>
                <input
                  type="file"
                  accept="application/pdf,.pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,.docx,application/msword,.doc"
                  onChange={(e) => setReplaceFile((e.target.files?.[0] as any) || null)}
                />
                {replaceFile ? (
                  <Text style={{ marginTop: 6, color: "#475569", fontSize: 12 }}>
                    Selected: <Text style={{ fontWeight: "700" }}>{replaceFile.name}</Text>
                  </Text>
                ) : null}
              </>
            )}

            <TouchableOpacity
              disabled={editBusy}
              onPress={saveEdit}
              style={[styles.saveBtn, editBusy && { opacity: 0.6 }]}
            >
              {editBusy ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <>
                  <Ionicons name="save-outline" size={18} color="#fff" />
                  <Text style={styles.saveText}>Save changes</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </FacultyShell>
  );
}

function TypeBadge({ isFinal }: { isFinal: boolean }) {
  return (
    <View
      style={{
        borderWidth: 1,
        paddingHorizontal: 8,
        paddingVertical: 3,
        borderRadius: 999,
        backgroundColor: isFinal ? "#DCFCE7" : "#FEF3C7",
        borderColor: isFinal ? "#10B981" : "#F59E0B",
      }}
    >
      <Text style={{ color: isFinal ? "#065F46" : "#92400E", fontWeight: "700", fontSize: 11 }}>
        {isFinal ? "FINAL" : "DRAFT"}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  addBtn: {
    backgroundColor: "#2563eb",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  addText: { color: "#fff", fontWeight: "800" },

  formCard: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: "#eef2ff",
  },
  label: { fontSize: 15, fontWeight: "700", color: "#1e293b", marginBottom: 8, marginTop: 12 },
  inputWrap: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#f8fafc",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    paddingHorizontal: 12,
    marginBottom: 8,
  },
  input: { flex: 1, fontSize: 16, color: "#1e293b", paddingVertical: 12 },

  uploadBtn: {
    marginTop: 12,
    borderRadius: 12,
    backgroundColor: "#2563eb",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 12,
    flexDirection: "row",
    gap: 8,
  },
  uploadText: { color: "#fff", fontWeight: "800" },

  empty: { alignItems: "center", justifyContent: "center", paddingVertical: 60 },
  emptyText: { fontSize: 18, color: "#64748b", fontWeight: "600", marginTop: 16 },
  emptySub: { fontSize: 14, color: "#94a3b8", marginTop: 6, textAlign: "center" },

  rowCard: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: "#eef2ff",
    flexDirection: "row",
    gap: 12,
    marginBottom: 10,
  },
  iconBox: {
    width: 44,
    height: 44,
    backgroundColor: "#dbeafe",
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  title: { fontSize: 16, fontWeight: "700", color: "#1e293b", marginBottom: 6 },
  abstract: { fontSize: 14, color: "#64748b", lineHeight: 20, marginBottom: 6 },

  date: { fontSize: 12, color: "#94a3b8", fontStyle: "italic" },

  viewBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#EFF6FF",
    borderRadius: 10,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: "#2563EB",
  },
  viewBtnDisabled: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#F1F5F9",
    borderRadius: 10,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  viewBtnText: { color: "#2563EB", fontWeight: "700", fontSize: 13 },

  editBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#ecfeff",
    borderRadius: 10,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: "#0ea5e9",
  },
  editBtnText: { color: "#0f766e", fontWeight: "800", fontSize: 13 },

  delBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#fef2f2",
    borderRadius: 10,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: "#fecaca",
  },
  delBtnText: { color: "#b91c1c", fontWeight: "800", fontSize: 13 },

  // Modal
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(2,6,23,0.45)",
    alignItems: "center",
    justifyContent: "center",
    padding: 16,
  },
  modalCard: {
    width: "100%",
    maxWidth: 560,
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  modalTitle: { fontSize: 16, fontWeight: "900", color: "#1e293b" },
  modalX: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#f1f5f9",
  },
  saveBtn: {
    marginTop: 12,
    borderRadius: 12,
    backgroundColor: "#0ea5e9",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 12,
    flexDirection: "row",
    gap: 8,
  },
  saveText: { color: "#fff", fontWeight: "800" },
});
