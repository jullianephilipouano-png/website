// app/screens/faculty/submissions.tsx
import React, { useMemo, useState } from "react";
import { View, Text, TextInput, FlatList, TouchableOpacity, StyleSheet, Modal, ScrollView, Platform } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import FacultyShell from "./Shell";
import { useFacultyData, normalizeType, ResearchPaper } from "./useFaculty";

const STATUS_CONFIG = {
  pending: { color: "#f59e0b", bg: "#fef3c7", icon: "time-outline" },
  approved: { color: "#10b981", bg: "#d1fae5", icon: "checkmark-circle-outline" },
  rejected: { color: "#ef4444", bg: "#fee2e2", icon: "close-circle-outline" },
};

type StatusFilter = "all" | "approved" | "rejected" | "pending";

export default function FacultySubmissions() {
  const { studentSubs, onRefresh, openFile, reviewSubmission } = useFacultyData();
  const [q, setQ] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [commentFor, setCommentFor] = useState<Record<string, string>>({});
  const [selected, setSelected] = useState<ResearchPaper | null>(null);

  // -----------------------------
  // TAG FILTER SYSTEM
  // -----------------------------
  const allTags = useMemo(() => {
    const set = new Set<string>();
    studentSubs.forEach(sub => {
      (sub.keywords || []).forEach(k => set.add(k.trim()));
    });
    return Array.from(set).sort();
  }, [studentSubs]);

  const [tagFilter, setTagFilter] = useState<string | null>(null);

  // -----------------------------
  // STATUS COUNTS
  // -----------------------------
  const counts = useMemo(
    () => ({
      approved: studentSubs.filter(s => s.status === "approved").length,
      rejected: studentSubs.filter(s => s.status === "rejected").length,
      pending: studentSubs.filter(s => s.status === "pending").length,
      all: studentSubs.length,
    }),
    [studentSubs]
  );

  // -----------------------------
  // COMBINED FILTERING
  // -----------------------------
  const filtered = useMemo(() => {
    const s = q.toLowerCase().trim();

    return studentSubs.filter((sub) => {
      // Status
      const statusOk = statusFilter === "all" ? true : sub.status === statusFilter;
      if (!statusOk) return false;

      // Tag
      const tagOk = tagFilter ? (sub.keywords || []).includes(tagFilter) : true;
      if (!tagOk) return false;

      // Search
      if (!s) return true;

      const type = normalizeType(sub);
      const kw = (sub.keywords || []).join(" ").toLowerCase();
      const coauth = (sub.coAuthors || []).join(" ").toLowerCase();

      return (
        sub.title.toLowerCase().includes(s) ||
        (sub.author || "").toLowerCase().includes(s) ||
        coauth.includes(s) ||
        sub.status.toLowerCase().includes(s) ||
        type.includes(s) ||
        kw.includes(s)
      );
    });
  }, [q, tagFilter, statusFilter, studentSubs]);

  // -----------------------------
  const review = async (paper: ResearchPaper, decision: "approved" | "rejected") => {
    await reviewSubmission(paper, decision, commentFor[paper._id] || "");
    setCommentFor((s) => ({ ...s, [paper._id]: "" }));
    onRefresh();
    setSelected(null);
  };

  // -----------------------------
  return (
    <FacultyShell title="Student Works" subtitle="Search, filter, and review">

      {/* Search */}
      <View style={styles.search}>
        <Ionicons name="search-outline" size={22} color="#64748b" style={{ marginRight: 12 }} />
        <TextInput
          style={{ flex: 1, fontSize: 16, color: "#0f172a" }}
          placeholder="Search by title, author, status, type, or keyword…"
          value={q}
          onChangeText={setQ}
          placeholderTextColor="#94a3b8"
        />
        {q.length > 0 && (
          <TouchableOpacity onPress={() => setQ("")}>
            <Ionicons name="close-circle" size={22} color="#94a3b8" />
          </TouchableOpacity>
        )}
      </View>

      {/* STATUS FILTER */}
      <View style={styles.pillsRow}>
        <Pill active={statusFilter === "all"} label={`All (${counts.all})`} onPress={() => setStatusFilter("all")} />
        <Pill active={statusFilter === "approved"} icon="checkmark-circle-outline" tint="#10b981" label={`Approved (${counts.approved})`} onPress={() => setStatusFilter("approved")} />
        <Pill active={statusFilter === "rejected"} icon="close-circle-outline" tint="#ef4444" label={`Rejected (${counts.rejected})`} onPress={() => setStatusFilter("rejected")} />
        <Pill active={statusFilter === "pending"} icon="time-outline" tint="#f59e0b" label={`Pending (${counts.pending})`} onPress={() => setStatusFilter("pending")} />
      </View>

      {/* -----------------------------
            TAG FILTER UI
         -----------------------------*/}
      {allTags.length > 0 && (
        <View style={{ marginTop: 16 }}>
          <Text style={{ fontWeight: "700", color: "#475569", marginBottom: 8, fontSize: 13, letterSpacing: 0.5, textTransform: "uppercase" }}>
            Filter by Tag
          </Text>

          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ flexDirection: "row", gap: 8 }}
          >
            {/* ALL TAGS */}
            <TouchableOpacity
              onPress={() => setTagFilter(null)}
              style={[
                styles.tagChip,
                { 
                  backgroundColor: tagFilter === null ? "#3b82f6" : "#f1f5f9",
                  borderWidth: 1,
                  borderColor: tagFilter === null ? "#3b82f6" : "#e2e8f0"
                }
              ]}
            >
              <Text style={{ color: tagFilter === null ? "#fff" : "#475569", fontWeight: "700", fontSize: 13 }}>
                All Tags
              </Text>
            </TouchableOpacity>

            {/* INDIVIDUAL TAGS */}
            {allTags.map((tag) => (
              <TouchableOpacity
                key={tag}
                onPress={() => setTagFilter(tag)}
                style={[
                  styles.tagChip,
                  { 
                    backgroundColor: tagFilter === tag ? "#3b82f6" : "#f1f5f9",
                    borderWidth: 1,
                    borderColor: tagFilter === tag ? "#3b82f6" : "#e2e8f0"
                  }
                ]}
              >
                <Text style={{ color: tagFilter === tag ? "#fff" : "#475569", fontWeight: "700", fontSize: 13 }}>
                  #{tag}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      )}

      {/* LIST OF PAPERS */}
      <FlatList
        data={filtered}
        keyExtractor={(item) => item._id}
        contentContainerStyle={{ gap: 16, paddingTop: 16 }}
        renderItem={({ item }) => {
          const cfg = STATUS_CONFIG[item.status];
          const isFinal = normalizeType(item) === "final";

          return (
            <View style={styles.card}>
              {/* Status + Type */}
              <View style={styles.headerRow}>
                <View style={[styles.badge, { backgroundColor: cfg.bg }]}>
                  <Ionicons name={cfg.icon} size={18} color={cfg.color} />
                  <Text style={[styles.badgeText, { color: cfg.color }]}>{item.status.toUpperCase()}</Text>
                </View>
                <TypeBadge isFinal={isFinal} />
              </View>

              <Text style={styles.title}>{item.title}</Text>

              {/* Author */}
              <View style={styles.authorRow}>
                <Ionicons name="person-outline" size={18} color="#64748b" />
                <Text style={styles.authorText}>{item.author}</Text>
              </View>

              {/* Co-authors */}
              {!!item.coAuthors?.length &&
                (() => {
                  const filteredCoAuthors = item.coAuthors.filter(
                    (a) => a.toLowerCase().trim() !== (item.author || "").toLowerCase().trim()
                  );
                  if (!filteredCoAuthors.length) return null;

                  return (
                    <View style={[styles.authorRow, { marginTop: -4 }]}>
                      <Ionicons name="people-outline" size={18} color="#64748b" />
                      <Text style={[styles.authorText, { fontStyle: "italic", color: "#475569" }]}>
                        Co-authors: {filteredCoAuthors.join(", ")}
                      </Text>
                    </View>
                  );
                })()
              }

              {/* Abstract */}
              <TouchableOpacity onPress={() => setSelected(item)} activeOpacity={0.8}>
                <View>
                  {item.abstract.split('\n').slice(0, 3).map((line, idx) => (
                    <Text key={idx} style={styles.abstract} numberOfLines={1}>
                      {line.trim() || ' '}
                    </Text>
                  ))}
                  {item.abstract.split('\n').length > 3 && (
                    <Text style={[styles.abstract, { fontStyle: 'italic', color: '#94a3b8' }]}>
                      ...
                    </Text>
                  )}
                </View>
              </TouchableOpacity>

              {/* Keywords */}
              {!!item.keywords?.length && (
                <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 10 }}>
                  {item.keywords.map((k) => (
                    <View key={`${item._id}-${k}`} style={styles.keywordChip}>
                      <Text style={styles.keywordChipText}>#{k}</Text>
                    </View>
                  ))}
                </View>
              )}

              {/* View File */}
              {item.fileName && (
                <TouchableOpacity style={styles.viewBtn} onPress={() => openFile(item)}>
                  <Ionicons name="document-attach-outline" size={20} color="#3b82f6" />
                  <Text style={styles.viewBtnText}>{item.fileName}</Text>
                </TouchableOpacity>
              )}

              {/* View details */}
              <TouchableOpacity style={styles.detailsBtn} onPress={() => setSelected(item)}>
                <Ionicons name="information-circle-outline" size={20} color="#6366f1" />
                <Text style={styles.detailsBtnText}>View Full Details</Text>
              </TouchableOpacity>

              {/* Feedback input */}
              <View style={styles.feedbackSection}>
                <Text style={styles.feedbackLabel}>Add Feedback (Optional)</Text>
                <View style={styles.commentBox}>
                  <Ionicons name="chatbubble-ellipses-outline" size={20} color="#64748b" style={{ marginTop: 14 }} />
                  <TextInput
                    placeholder="Share your thoughts, suggestions, or concerns about this submission…"
                    value={commentFor[item._id] || ""}
                    onChangeText={(t) => setCommentFor((s) => ({ ...s, [item._id]: t }))}
                    placeholderTextColor="#94a3b8"
                    style={styles.feedbackInput}
                    multiline
                    numberOfLines={4}
                    textAlignVertical="top"
                  />
                </View>
              </View>

              {/* Approve / Reject */}
              <View style={{ flexDirection: "row", gap: 12 }}>
                <ActionBtn label="Approve" icon="checkmark-circle" tone="#10b981" onPress={() => review(item, "approved")} />
                <ActionBtn label="Reject" icon="close-circle" tone="#ef4444" onPress={() => review(item, "rejected")} />
              </View>
            </View>
          );
        }}

        ListEmptyComponent={
          <View style={{ alignItems: "center", justifyContent: "center", paddingVertical: 80 }}>
            <View style={styles.emptyIconCircle}>
              <Ionicons name="documents-outline" size={48} color="#94a3b8" />
            </View>
            <Text style={{ fontSize: 18, color: "#475569", fontWeight: "700", marginTop: 16 }}>
              {q ? "No submissions match your search" : "No student submissions found"}
            </Text>
            <Text style={{ fontSize: 14, color: "#94a3b8", marginTop: 6, textAlign: "center", paddingHorizontal: 32 }}>
              {q ? "Try adjusting your filters or search query" : "Student submissions will appear here once uploaded"}
            </Text>
          </View>
        }
      />

      {/* -----------------------------
            FULL DETAILS MODAL
         -----------------------------*/}
      <Modal
        visible={!!selected}
        animationType="slide"
        presentationStyle="fullScreen"
        onRequestClose={() => setSelected(null)}
      >
        <View style={styles.modalRoot}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setSelected(null)} style={styles.closeBtn}>
              <Ionicons name="arrow-back" size={24} color="#0f172a" />
              <Text style={styles.closeText}>Back</Text>
            </TouchableOpacity>
          </View>

          {selected && (
            <ScrollView contentContainerStyle={styles.modalScroll}>
              {/* Header Card */}
              <View style={styles.modalCard}>
                <View style={styles.headerRow}>
                  {(() => {
                    const cfg = STATUS_CONFIG[selected.status];
                    return (
                      <View style={[styles.badge, { backgroundColor: cfg.bg }]}>
                        <Ionicons name={cfg.icon} size={18} color={cfg.color} />
                        <Text style={[styles.badgeText, { color: cfg.color }]}>{selected.status.toUpperCase()}</Text>
                      </View>
                    );
                  })()}
                  <TypeBadge isFinal={normalizeType(selected) === "final"} />
                </View>

                <Text style={styles.modalTitle}>{selected.title}</Text>

                {/* Author */}
                <View style={styles.modalInfoRow}>
                  <View style={styles.modalInfoIcon}>
                    <Ionicons name="person-outline" size={20} color="#6366f1" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.modalInfoLabel}>Primary Author</Text>
                    <Text style={styles.modalInfoValue}>{selected.author}</Text>
                  </View>
                </View>

                {/* Co Authors */}
                {!!selected.coAuthors?.length &&
                  (() => {
                    const filteredCoAuthors = selected.coAuthors.filter(
                      (a) => a.toLowerCase().trim() !== (selected.author || "").toLowerCase().trim()
                    );
                    if (!filteredCoAuthors.length) return null;

                    return (
                      <View style={[styles.modalInfoRow, { marginTop: 12 }]}>
                        <View style={styles.modalInfoIcon}>
                          <Ionicons name="people-outline" size={20} color="#6366f1" />
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.modalInfoLabel}>Co-Authors</Text>
                          <Text style={styles.modalInfoValue}>{filteredCoAuthors.join(", ")}</Text>
                        </View>
                      </View>
                    );
                  })()
                }
              </View>

              {/* Abstract Card */}
              <View style={styles.modalCard}>
                <View style={styles.abstractPageContainer}>
                  {/* Title Section */}
                  <View style={styles.abstractTitleSection}>
                    <Text style={styles.abstractDocTitle}>{selected.title}</Text>
                    <Text style={styles.abstractAuthors}>
                      {selected.author}
                      {selected.coAuthors && selected.coAuthors.length > 0 && 
                        `, ${selected.coAuthors.filter(a => a.toLowerCase().trim() !== (selected.author || "").toLowerCase().trim()).join(", ")}`
                      }
                    </Text>
                  </View>

                  {/* Abstract Heading */}
                  <Text style={styles.abstractHeading}>ABSTRACT</Text>

                  {/* Abstract Content */}
                  <View style={styles.abstractContentContainer}>
                    <Text style={styles.abstractContentText}>
                      {selected.abstract}
                    </Text>
                  </View>
                </View>
              </View>

              {/* Keywords Card */}
              {!!selected.keywords?.length && (
                <View style={styles.modalCard}>
                  <View style={styles.modalSectionHeader}>
                    <Ionicons name="pricetags-outline" size={22} color="#6366f1" />
                    <Text style={styles.sectionLabelModal}>Keywords</Text>
                  </View>
                  <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 8 }}>
                    {selected.keywords.map((k: string) => (
                      <View key={`${selected._id}-modal-${k}`} style={styles.keywordChipModal}>
                        <Text style={styles.keywordChipModalText}>#{k}</Text>
                      </View>
                    ))}
                  </View>
                </View>
              )}

              {/* Attachment Card */}
              {selected.fileName && (
                <View style={styles.modalCard}>
                  <View style={styles.modalSectionHeader}>
                    <Ionicons name="attach-outline" size={22} color="#6366f1" />
                    <Text style={styles.sectionLabelModal}>Attached File</Text>
                  </View>
                  <TouchableOpacity
                    style={styles.fileAttachmentBtn}
                    onPress={() => openFile(selected)}
                  >
                    <View style={styles.fileIconContainer}>
                      <Ionicons name="document-attach-outline" size={24} color="#3b82f6" />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.fileName}>{selected.fileName}</Text>
                      <Text style={styles.fileAction}>Tap to view</Text>
                    </View>
                    <Ionicons name="chevron-forward" size={20} color="#94a3b8" />
                  </TouchableOpacity>
                </View>
              )}

              {/* Feedback Card */}
              <View style={styles.modalCard}>
                <View style={styles.modalSectionHeader}>
                  <Ionicons name="chatbubble-ellipses-outline" size={22} color="#6366f1" />
                  <Text style={styles.sectionLabelModal}>Feedback</Text>
                </View>
                <View style={[styles.commentBox, { backgroundColor: "#f8fafc", minHeight: 140, marginTop: 12 }]}>
                  <TextInput
                    placeholder="Share your thoughts, suggestions, or concerns about this submission…"
                    value={commentFor[selected._id] || ""}
                    onChangeText={(t) => setCommentFor((s) => ({ ...s, [selected._id]: t }))}
                    placeholderTextColor="#94a3b8"
                    style={styles.feedbackInputModal}
                    multiline
                    numberOfLines={6}
                    textAlignVertical="top"
                  />
                </View>
              </View>

              {/* Action Buttons */}
              <View style={{ flexDirection: "row", gap: 12, marginTop: 8 }}>
                <ActionBtn label="Approve" icon="checkmark-circle" tone="#10b981" onPress={() => review(selected, "approved")} />
                <ActionBtn label="Reject" icon="close-circle" tone="#ef4444" onPress={() => review(selected, "rejected")} />
              </View>

              <View style={{ height: 32 }} />
            </ScrollView>
          )}
        </View>
      </Modal>
    </FacultyShell>
  );
}

// =========================
// COMPONENTS
// =========================

function Pill({ active, label, onPress, icon, tint = "#475569" }: any) {
  return (
    <TouchableOpacity
      onPress={onPress}
      style={[
        styles.pill,
        { 
          borderColor: active ? tint : "#e2e8f0", 
          backgroundColor: active ? tint : "#ffffff",
          shadowColor: active ? tint : "transparent",
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: active ? 0.2 : 0,
          shadowRadius: 4,
          elevation: active ? 2 : 0,
        },
      ]}
    >
      {icon ? <Ionicons name={icon} size={18} color={active ? "#fff" : tint} /> : null}
      <Text style={[styles.pillText, { color: active ? "#fff" : tint }]}>{label}</Text>
    </TouchableOpacity>
  );
}

function TypeBadge({ isFinal }: { isFinal: boolean }) {
  return (
    <View
      style={{
        borderWidth: 1.5,
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 999,
        backgroundColor: isFinal ? "#d1fae5" : "#fef3c7",
        borderColor: isFinal ? "#10b981" : "#f59e0b",
      }}
    >
      <Text style={{ color: isFinal ? "#065f46" : "#92400e", fontWeight: "800", fontSize: 11, letterSpacing: 0.5 }}>
        {isFinal ? "FINAL" : "DRAFT"}
      </Text>
    </View>
  );
}

function ActionBtn({ label, icon, tone, onPress }: any) {
  return (
    <TouchableOpacity
      onPress={onPress}
      style={{
        flex: 1,
        borderRadius: 14,
        backgroundColor: tone,
        alignItems: "center",
        justifyContent: "center",
        paddingVertical: 14,
        flexDirection: "row",
        gap: 8,
        shadowColor: tone,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
        elevation: 4,
      }}
    >
      <Ionicons name={icon} size={20} color="#fff" />
      <Text style={{ color: "#fff", fontWeight: "800", fontSize: 15 }}>{label}</Text>
    </TouchableOpacity>
  );
}

// =========================
// STYLES
// =========================

const styles = StyleSheet.create({
  search: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fff",
    borderRadius: 16,
    paddingHorizontal: 18,
    paddingVertical: 14,
    borderWidth: 2,
    borderColor: "#e0e7ff",
    shadowColor: "#6366f1",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },

  pillsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    marginTop: 16,
  },

  pill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 999,
    borderWidth: 1.5,
  },

  pillText: { fontWeight: "800", fontSize: 13 },

  /* Tag Filter Appearance */
  tagChip: {
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderRadius: 999,
  },

  /* Cards */
  card: {
    backgroundColor: "#fff",
    borderRadius: 20,
    padding: 20,
    borderWidth: 1,
    borderColor: "#e0e7ff",
    shadowColor: "#6366f1",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 3,
  },

  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 14,
  },

  badge: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 10,
    gap: 6,
  },

  badgeText: { fontSize: 12, fontWeight: "800", letterSpacing: 0.5 },
  title: { fontSize: 18, fontWeight: "800", color: "#0f172a", marginBottom: 10, lineHeight: 24 },

  authorRow: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 8 },
  authorText: { fontSize: 15, color: "#64748b", fontWeight: "600" },

  abstract: { fontSize: 15, color: "#475569", marginBottom: 10, lineHeight: 22 },

  keywordChip: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    backgroundColor: "#f1f5f9",
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  keywordChipText: { fontSize: 12, fontWeight: "700", color: "#475569" },

  keywordChipModal: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: "#e0e7ff",
    borderWidth: 1,
    borderColor: "#c7d2fe",
  },
  keywordChipModalText: { fontSize: 13, fontWeight: "800", color: "#3730a3" },

  viewBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#eff6ff",
    borderRadius: 12,
    padding: 12,
    marginTop: 10,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#dbeafe",
  },
  viewBtnText: { color: "#3b82f6", fontWeight: "700", fontSize: 14 },

  detailsBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#eef2ff",
    borderRadius: 12,
    padding: 12,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "#e0e7ff",
  },
  detailsBtnText: { color: "#6366f1", fontWeight: "700", fontSize: 14 },

  feedbackSection: {
    marginBottom: 16,
  },

  feedbackLabel: {
    fontSize: 13,
    fontWeight: "800",
    color: "#475569",
    marginBottom: 10,
    letterSpacing: 0.5,
    textTransform: "uppercase",
  },

  commentBox: {
    borderWidth: 1.5,
    borderColor: "#e2e8f0",
    backgroundColor: "#f8fafc",
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
  },

  feedbackInput: {
    flex: 1,
    color: "#0f172a",
    fontSize: 15,
    minHeight: 100,
    paddingVertical: 12,
    paddingHorizontal: 4,
    lineHeight: 22,
  },

  feedbackInputModal: {
    flex: 1,
    color: "#0f172a",
    fontSize: 15,
    minHeight: 120,
    paddingVertical: 12,
    paddingHorizontal: 12,
    lineHeight: 22,
  },

  /* Modal specific styles */
 modalCard: {
  backgroundColor: "#fff",
  borderRadius: 16,
  padding: 20,
  marginBottom: 16,
  borderWidth: 1,
  borderColor: "#e0e7ff",
  shadowColor: "#6366f1",
  shadowOffset: { width: 0, height: 2 },
  shadowOpacity: 0.05,
  shadowRadius: 8,
  elevation: 2,
},

  modalSectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 16,
  },

  sectionLabelModal: {
    fontSize: 16,
    fontWeight: "800",
    color: "#0f172a",
    letterSpacing: 0.3,
  },

  modalInfoRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#f1f5f9",
  },

  modalInfoIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: "#eef2ff",
    alignItems: "center",
    justifyContent: "center",
  },

  modalInfoLabel: {
    fontSize: 12,
    fontWeight: "700",
    color: "#64748b",
    marginBottom: 4,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },

  modalInfoValue: {
    fontSize: 15,
    fontWeight: "600",
    color: "#0f172a",
    lineHeight: 22,
  },

  // Line ~570 onwards in the StyleSheet.create({ ... }) section:

abstractPageContainer: {
  backgroundColor: "#ffffff",
  padding: 32,
  borderRadius: 8,
  borderWidth: 1,
  borderColor: "#d1d5db",
},

abstractTitleSection: {
  borderBottomWidth: 2,
  borderBottomColor: "#000000",
  paddingBottom: 16,
  marginBottom: 24,
},

abstractDocTitle: {
  fontSize: 16,
  fontWeight: "700",
  color: "#000000",
  textAlign: "center",
  lineHeight: 24,
  marginBottom: 12,
},

abstractAuthors: {
  fontSize: 14,
  color: "#000000",
  textAlign: "center",
  lineHeight: 20,
},

abstractHeading: {
  fontSize: 16,
  fontWeight: "700",
  color: "#000000",
  textAlign: "center",
  marginBottom: 20,
  letterSpacing: 1,
},

abstractContentContainer: {
  paddingHorizontal: 8,
},

abstractContentText: {
  fontSize: 14,
  lineHeight: 24,
  color: "#000000",
  textAlign: "justify",
  letterSpacing: 0.2,
},

  fileAttachmentBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: "#f8fafc",
    borderRadius: 12,
    padding: 16,
    marginTop: 8,
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },

  fileIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: "#eff6ff",
    alignItems: "center",
    justifyContent: "center",
  },

  fileName: {
    fontSize: 15,
    fontWeight: "700",
    color: "#0f172a",
    marginBottom: 2,
  },

  fileAction: {
    fontSize: 13,
    color: "#3b82f6",
    fontWeight: "600",
  },

  emptyIconCircle: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: "#f1f5f9",
    alignItems: "center",
    justifyContent: "center",
  },

  /* Modal */
  modalRoot: { flex: 1, backgroundColor: "#f8fafc" },
  modalHeader: {
    paddingTop: Platform.OS === "ios" ? 54 : 24,
    paddingHorizontal: 20,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#e2e8f0",
    backgroundColor: "#ffffff",
  },

  closeBtn: { flexDirection: "row", alignItems: "center", gap: 8, alignSelf: "flex-start" },
  closeText: { fontSize: 17, fontWeight: "800", color: "#0f172a" },

  modalScroll: { padding: 20 },
  modalTitle: { fontSize: 22, fontWeight: "800", color: "#0f172a", marginTop: 10, marginBottom: 8, lineHeight: 30 },

  sectionLabel: {
    fontSize: 13,
    fontWeight: "800",
    color: "#475569",
    marginTop: 20,
    marginBottom: 10,
    letterSpacing: 0.5,
    textTransform: "uppercase",
  },

  modalAbstract: { fontSize: 16, lineHeight: 24, color: "#334155" },
});