// app/screens/StudentRepository.tsx - ENHANCED DESIGN
import React, { useEffect, useRef, useState } from "react";
import {
  View, Text, TextInput, TouchableOpacity, ScrollView, StyleSheet,
  Modal, ActivityIndicator, Pressable, Dimensions, Platform, Alert,
} from "react-native";
import { Ionicons, MaterialIcons } from "@expo/vector-icons";
import { router, useFocusEffect } from "expo-router";
import { getToken, removeToken } from "../../lib/auth";
import api from "../../lib/api";

const { width } = Dimensions.get("window");

const DELETE_WINDOW_SEC = 300;
const REVISE_WINDOW_SEC = 300;

type SubmissionType = "draft" | "final";
type ResearchPaper = {
  _id: string;
  title: string;
  author: string;
  adviser?: string;
  student?: string;
  status: "pending" | "approved" | "rejected";
  facultyComment?: string;
  abstract?: string;
  createdAt?: string;
  fileName?: string;
  filePath?: string;
  fileType?: string;
  submissionType?: SubmissionType;
  coAuthors?: string[];
  keywords?: string[] | string;
  year?: string | number;
};

const STATUS_STYLES: Record<ResearchPaper["status"], { bg: string; fg: string; icon: any }> = {
  pending:  { bg: "#FEF3C7", fg: "#B45309", icon: "time-outline" },
  approved: { bg: "#DCFCE7", fg: "#065F46", icon: "checkmark-circle-outline" },
  rejected: { bg: "#FEE2E2", fg: "#7F1D1D", icon: "close-circle-outline" },
};

const normalizeKeywords = (kw?: string[] | string): string[] =>
  Array.isArray(kw)
    ? kw.map(String).map(s => s.trim()).filter(Boolean)
    : (kw || "").split(",").map(s => s.trim()).filter(Boolean);

function StatusBadge({ status }: { status: ResearchPaper["status"] }) {
  const s = STATUS_STYLES[status];
  return (
    <View style={[styles.statBadge, { backgroundColor: s.bg }]}>
      <Ionicons name={s.icon as any} size={14} color={s.fg} />
      <Text style={[styles.statBadgeText, { color: s.fg }]}>{status.toUpperCase()}</Text>
    </View>
  );
}

function TypeBadgeFS({ type }: { type: SubmissionType | undefined }) {
  const isFinal = (type || "draft") === "final";
  return (
    <View
      style={[
        styles.typeBadge,
        { backgroundColor: isFinal ? "#DCFCE7" : "#FEF3C7", borderColor: isFinal ? "#10B981" : "#F59E0B" },
      ]}
    >
      <Text style={{ color: isFinal ? "#065F46" : "#92400E", fontWeight: "800", fontSize: 10 }}>
        {isFinal ? "FINAL" : "DRAFT"}
      </Text>
    </View>
  );
}

function ActionTimers({
  paper,
  onDelete,
  onOpenReviseModal,
}: {
  paper: ResearchPaper;
  onDelete: (p: ResearchPaper) => void;
  onOpenReviseModal: (p: ResearchPaper) => void;
}) {
  const [deleteRemaining, setDeleteRemaining] = React.useState(0);
  const [reviseRemaining, setReviseRemaining] = React.useState(0);
  const isWeb = Platform.OS === "web";

  React.useEffect(() => {
    const createdAt = new Date(paper.createdAt || "");
    const update = () => {
      const elapsed = (Date.now() - createdAt.getTime()) / 1000;
      setDeleteRemaining(Math.max(0, DELETE_WINDOW_SEC - elapsed));
      setReviseRemaining(Math.max(0, REVISE_WINDOW_SEC - elapsed));
    };
    update();
    const id = setInterval(update, 1000);
    return () => clearInterval(id);
  }, [paper.createdAt]);

  const fmt = (s: number) => {
    const m = Math.floor(s / 60);
    const ss = Math.floor(s % 60).toString().padStart(2, "0");
    return `${m}:${ss}`;
  };

  const canModify = deleteRemaining > 0 || reviseRemaining > 0;

  // ====================================================================
  //  EXPIRED VIEW — ONLY ONE LOCK BAR + ONE EXPIRED TEXT + HOVER TOOLTIP
  // ====================================================================
  if (!canModify) {
    const tooltipText =
      `Revise expired after 5 minutes.\nDelete expired after 5 minutes.`;

    const LockWrapper = ({ children }: any) =>
      isWeb ? (
        <div title={tooltipText} style={{ width: "100%" }}>
          {children}
        </div>
      ) : (
        children
      );

    return (
      <View style={styles.actionTimersContainer}>

        <LockWrapper>
          <View
            style={{
              backgroundColor: "#94A3B8",
              paddingVertical: 12,
              borderRadius: 8,
              flexDirection: "row",
              justifyContent: "center",
              alignItems: "center",
              gap: 6,
            }}
          >
            <Ionicons name="lock-closed-outline" size={16} color="#fff" />
            <Text style={{ color: "#fff", fontWeight: "700", fontSize: 13 }}>
              Locked
            </Text>
          </View>
        </LockWrapper>

        <Text
          style={{
            fontSize: 11,
            color: "#DC2626",
            textAlign: "center",
            marginTop: 4,
            fontWeight: "600",
          }}
        >
          🔒 Expired
        </Text>
      </View>
    );
  }

  // ====================================================================
  //  ACTIVE (NON-EXPIRED) VIEW — SHOW NORMAL TWO BUTTONS + TWO TIMERS
  // ====================================================================
  return (
    <View style={styles.actionTimersContainer}>
      <View style={styles.actionButtonsRow}>
        <TouchableOpacity
          onPress={() => (reviseRemaining > 0 ? onOpenReviseModal(paper) : null)}
          style={[
            styles.actionButton,
            styles.reviseButton,
            reviseRemaining <= 0 && styles.actionButtonDisabled,
          ]}
        >
          <Ionicons name="create-outline" size={16} color="#fff" />
          <Text style={styles.actionButtonText}>Revise</Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => (deleteRemaining > 0 ? onDelete(paper) : null)}
          style={[
            styles.actionButton,
            styles.deleteButton,
            deleteRemaining <= 0 && styles.actionButtonDisabled,
          ]}
        >
          <Ionicons name="trash-outline" size={16} color="#fff" />
          <Text style={styles.actionButtonText}>Delete</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.timerTextsContainer}>
        <Text style={styles.timerText}>
          🗑️ {fmt(deleteRemaining)}
        </Text>
        <Text style={styles.timerText}>
          ✏️ {fmt(reviseRemaining)}
        </Text>
      </View>
    </View>
  );
}


function cleanTitle(title: string): string {
  if (!title) return "";
  let cleaned = title
    .replace(/(\w+)\s+(\w+)\s+\1/gi, "$1")
    .replace(/(\w+)\s+[a-z]\s+e\s+\1/gi, "$1")
    .replace(/(\w+)\s+ther\s+\1/gi, "$1")
    .replace(/(\w+)\s+[A-Z]\s+e\s+\1/gi, "$1")
    .replace(/(\w+)\s+of\s+ceptions\s+of/gi, "$1 of")
    .replace(/\b(\w+)\s+\1\b/gi, "$1")
    .replace(/\s+/g, " ")
    .trim();
  return cleaned || title;
}

function formatAbstract(text: string): string {
  if (!text) return "No abstract provided.";
  return text
    .replace(/\n+/g, " ")
    .replace(/\s+/g, " ")
    .replace(/([.!?])\s*([A-Z])/g, "$1 $2")
    .trim();
}

export default function StudentRepository() {
  const [myPapers, setMyPapers] = useState<ResearchPaper[]>([]);
  const [approved, setApproved] = useState<ResearchPaper[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedPaper, setSelectedPaper] = useState<ResearchPaper | null>(null);
  const [loading, setLoading] = useState(false);
  const [menuVisible, setMenuVisible] = useState(false);
  const [tab, setTab] = useState<"my" | "approved">("my");
  const [reviseCoAuthors, setReviseCoAuthors] = useState("");
  const [submitModal, setSubmitModal] = useState(false);

  const [reviseModal, setReviseModal] = useState(false);
  const [reviseTarget, setReviseTarget] = useState<ResearchPaper | null>(null);
  const [reviseTitle, setReviseTitle] = useState("");
  const [reviseAdviser, setReviseAdviser] = useState("");
  const [reviseAbstract, setReviseAbstract] = useState("");
  const [reviseKeywords, setReviseKeywords] = useState("");
  const [reviseType, setReviseType] = useState<SubmissionType>("draft");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [savingRevise, setSavingRevise] = useState(false);
  const webFileInputRef = useRef<HTMLInputElement | null>(null);

  const [clearedLocally, setClearedLocally] = useState(false);

  const logout = async () => {
    try {
      await removeToken();
      router.replace("/login");
    } catch (err) {
      console.error("❌ Logout error:", err);
    }
  };

  useEffect(() => {
    if (!selectedPaper) return;
    const pool = tab === "my" ? myPapers : approved;
    const fresh = pool.find(p => p._id === selectedPaper._id);
    if (fresh && fresh !== selectedPaper) setSelectedPaper(fresh);
  }, [myPapers, approved, tab]);

  const fetchMyResearch = async () => {
    setLoading(true);
    try {
      const token = await getToken();
      if (!token?.token) throw new Error("No authentication token found.");
      const res = await api.get("/student/my-research", {
        headers: { Authorization: `Bearer ${token.token}` },
      });
      const rows: ResearchPaper[] = res.data || [];
      const withType = rows.map((p) => ({
        ...p,
        submissionType: p.submissionType || (p.status === "approved" ? "final" : "draft"),
        keywords: normalizeKeywords(p.keywords),
      }));
      setMyPapers(withType);
      setClearedLocally(false);
    } catch (err) {
      console.error("❌ Failed to fetch student research:", err);
      Alert.alert("Error", "Failed to load your submissions.");
    } finally {
      setLoading(false);
    }
  };

  const fetchApproved = async () => {
    setLoading(true);
    try {
      const token = await getToken();
      const res = await api.get("/student/research", {
        headers: { Authorization: `Bearer ${token?.token}` },
      });
      const rows: ResearchPaper[] = res.data || [];
      const withType = rows.map((p) => ({
        ...p,
        submissionType: p.submissionType || (p.status === "approved" ? "final" : "draft"),
        keywords: normalizeKeywords(p.keywords),
      }));
      setApproved(withType);
    } catch (err) {
      console.error("❌ Failed to fetch approved research:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMyResearch();
    fetchApproved();
  }, []);

  useFocusEffect(
    React.useCallback(() => {
      fetchMyResearch();
      return () => {};
    }, [])
  );



  const openReviseModal = (paper: ResearchPaper) => {
    const coauth = (paper.coAuthors || []).join(", ");
    setReviseCoAuthors(coauth);

    const createdAt = new Date(paper.createdAt || "");
    const minutesElapsed = (Date.now() - createdAt.getTime()) / 60000;
    if (minutesElapsed > REVISE_WINDOW_SEC / 60) {
      Alert.alert("⏰ Too Late", "You can only revise within 5 minutes after uploading.");
      return;
    }
    setReviseTarget(paper);
    setReviseTitle(paper.title || "");
    setReviseAdviser(paper.adviser || "");
    setReviseAbstract(paper.abstract || "");

    const kw = normalizeKeywords(paper.keywords).join(", ");
    setReviseKeywords(kw);

    setReviseType(paper.submissionType || (paper.status === "approved" ? "final" : "draft"));
    setSelectedFile(null);
    setReviseModal(true);
  };

  const submitRevision = async () => {
    if (!reviseTarget) return;

    const createdAt = new Date(reviseTarget.createdAt || "");
    const minutesElapsed = (Date.now() - createdAt.getTime()) / 60000;
    if (minutesElapsed > REVISE_WINDOW_SEC / 60) {
      Alert.alert("⏰ Too Late", "You can only revise within 5 minutes after uploading.");
      setReviseModal(false);
      return;
    }

    try {
      setSavingRevise(true);
      const token = await getToken();
      const keywordsCsv = normalizeKeywords(reviseKeywords).join(",");

      if (selectedFile && Platform.OS === "web") {
        const form = new FormData();
        form.append("title", reviseTitle || "");
        form.append("adviser", reviseAdviser || "");
        form.append("abstract", reviseAbstract || "");
        form.append("submissionType", reviseType);
        form.append("authors", reviseCoAuthors);
        form.append("keywords", keywordsCsv);
        form.append("file", selectedFile);
        await api.put(`/student/revise/${reviseTarget._id}`, form, {
          headers: { Authorization: `Bearer ${token?.token}` },
        });
      } else {
        await api.put(
          `/student/revise/${reviseTarget._id}`,
          {
            title: reviseTitle || reviseTarget.title,
            adviser: reviseAdviser || "",
            abstract: reviseAbstract || "",
            submissionType: reviseType,
            keywords: keywordsCsv,
            authors: reviseCoAuthors,
          },
          { headers: { Authorization: `Bearer ${token?.token}` } }
        );
      }

      Alert.alert("✅ Success", "Revision submitted for approval.");
      setReviseModal(false);
      setReviseTarget(null);
      fetchMyResearch();
    } catch (err: any) {
      const msg = err?.response?.data?.error || "Failed to revise paper.";
      Alert.alert("Error", msg);
    } finally {
      setSavingRevise(false);
    }
  };

  const handleDelete = async (paper: ResearchPaper) => {
    const createdAt = new Date(paper.createdAt || "");
    const minutesElapsed = (Date.now() - createdAt.getTime()) / 60000;
    if (minutesElapsed > DELETE_WINDOW_SEC / 60) {
      Alert.alert("⏰ Too Late", "You can only delete a draft within 5 minutes after uploading.");
      return;
    }

    const confirmDelete =
      Platform.OS === "web"
        ? window.confirm(`Are you sure you want to delete "${paper.title}"?`)
        : true;
    if (!confirmDelete) return;

    try {
      const token = await getToken();
      await api.delete(`/student/delete/${paper._id}`, {
        headers: { Authorization: `Bearer ${token?.token}` },
      });
      Alert.alert("🗑️ Deleted", "Your draft has been removed successfully.");
      fetchMyResearch();
    } catch (err: any) {
      console.error("❌ Delete failed:", err?.response?.data || err);
      const msg = err?.response?.data?.error || "Failed to delete draft. Please try again.";
      Alert.alert("Error", msg);
    }
  };

  async function openStudentFile(item: ResearchPaper) {
    const tokenObj = await getToken();
    const token = tokenObj?.token;
    if (!token) return Alert.alert("Session expired", "Please sign in again.");

    const apiBase = (api.defaults.baseURL || "").replace(/\/+$/, "");
    const base = /^https?:\/\//i.test(apiBase)
      ? apiBase
      : `${window.location.origin}${apiBase.startsWith("/") ? "" : "/"}${apiBase}`;

    if (item.status === "approved") {
      try {
        const signed = await api.get(`${base}/research/file/${item._id}/signed`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const signedUrl = signed.data?.url;
        if (!signedUrl) throw new Error("No signed URL");
        window.open(signedUrl, "_blank");
        return;
      } catch (err) {
        console.error("Signed link fetch failed:", err);
        Alert.alert("Error", "Failed to fetch signed link.");
        return;
      }
    }

    const finalUrl = `${base}/student/file/${item._id}?token=${encodeURIComponent(token)}&t=${Date.now()}`;
    window.open(finalUrl, "_blank");
  }

  const filtered =
    tab === "my"
      ? (clearedLocally ? [] : myPapers)
          .filter((p) => p.status !== "approved")
          .filter((p) => {
            const q = searchQuery.toLowerCase();
            const type = (p.submissionType || (p.status === "approved" ? "final" : "draft")).toLowerCase();
            const kws = normalizeKeywords(p.keywords);
            const kw = kws.join(" ").toLowerCase();

            return (
              (p.title || "").toLowerCase().includes(q) ||
              (p.adviser || "").toLowerCase().includes(q) ||
              (p.author || "").toLowerCase().includes(q) ||
              (Array.isArray(p.coAuthors) && p.coAuthors.some((a) => a.toLowerCase().includes(q))) ||
              (p.status || "").toLowerCase().includes(q) ||
              type.includes(q) ||
              kw.includes(q) ||
              (p.year ? String(p.year).toLowerCase().includes(q) : false)
            );
          })
      : approved
          .filter((p) => p.status === "approved")
          .filter((p) => {
            const q = searchQuery.toLowerCase();
            const type = (p.submissionType || "final").toLowerCase();
            const kws = normalizeKeywords(p.keywords);
            const kw = kws.join(" ").toLowerCase();

            return (
              (p.title || "").toLowerCase().includes(q) ||
              (p.author || "").toLowerCase().includes(q) ||
              (Array.isArray(p.coAuthors) && p.coAuthors.some((a) => a.toLowerCase().includes(q))) ||
              type.includes(q) ||
              kw.includes(q) ||
              (p.year ? String(p.year).toLowerCase().includes(q) : false)
            );
          });

  const renderBadge = (p: ResearchPaper) => {
    const type = p.submissionType || (p.status === "approved" ? "final" : "draft");
    const isFinal = type === "final";
    return (
      <View
        style={[
          styles.badge,
          { backgroundColor: isFinal ? "#DCFCE7" : "#FEF3C7", borderColor: isFinal ? "#10B981" : "#F59E0B" },
        ]}
      >
        <Text style={{ color: isFinal ? "#065F46" : "#92400E", fontWeight: "700", fontSize: 10 }}>
          {isFinal ? "FINAL" : "DRAFT"}
        </Text>
      </View>
    );
  };

  const clearLocalView = () => setClearedLocally(true);
  const restoreFromServer = () => fetchMyResearch();

  return (
    <View style={styles.container}>
      {/* Enhanced Header with Gradient Background */}
      <View style={styles.headerContainer}>
        <View style={styles.headerTopRow}>
          <TouchableOpacity onPress={() => setMenuVisible(true)} style={styles.profileButton}>
            <Ionicons name="person-circle" size={40} color="#2563EB" />
          </TouchableOpacity>
          
          <View style={styles.headerActions}>
            {tab === "my" && (
              <>
                <TouchableOpacity onPress={clearLocalView} style={styles.headerPill}>
                  <Ionicons name="eye-off-outline" size={16} color="#475569" />
                  <Text style={styles.headerPillText}>Clear</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={restoreFromServer} style={styles.headerPill}>
                  <Ionicons name="refresh" size={16} color="#475569" />
                  <Text style={styles.headerPillText}>Restore</Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        </View>

        <Text style={styles.greeting}>Student Research Hub</Text>
        <Text style={styles.subGreeting}>Manage your academic contributions</Text>
      </View>

      {/* Enhanced Menu Dropdown */}
      <Modal visible={menuVisible} transparent animationType="fade" onRequestClose={() => setMenuVisible(false)}>
        <Pressable style={styles.modalOverlay} onPress={() => setMenuVisible(false)}>
          <View style={styles.menuDropdown}>
            <TouchableOpacity
              style={styles.menuItemContainer}
              onPress={() => {
                router.push("/profile");
                setMenuVisible(false);
              }}
            >
              <Ionicons name="person-outline" size={20} color="#475569" />
              <Text style={styles.menuItem}>Profile</Text>
            </TouchableOpacity>
            <View style={styles.menuDivider} />
            <TouchableOpacity
              style={styles.menuItemContainer}
              onPress={() => {
                logout();
                setMenuVisible(false);
              }}
            >
              <Ionicons name="log-out-outline" size={20} color="#DC2626" />
              <Text style={[styles.menuItem, { color: "#DC2626" }]}>Logout</Text>
            </TouchableOpacity>
          </View>
        </Pressable>
      </Modal>

      {/* Enhanced Tabs with Repository Button */}
      <View style={styles.tabSection}>
        <View style={styles.tabWrapper}>
          <View style={styles.tabContainer}>
            <TouchableOpacity style={[styles.tab, tab === "my" && styles.tabActive]} onPress={() => setTab("my")}>
              <Ionicons name="documents-outline" size={18} color={tab === "my" ? "#fff" : "#64748B"} />
              <Text style={[styles.tabText, tab === "my" && styles.tabTextActive]}>My Drafts</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.tab, tab === "approved" && styles.tabActive]}
              onPress={() => setTab("approved")}
            >
              <Ionicons name="checkmark-done-outline" size={18} color={tab === "approved" ? "#fff" : "#64748B"} />
              <Text style={[styles.tabText, tab === "approved" && styles.tabTextActive]}>Approved</Text>
            </TouchableOpacity>
          </View>
        </View>

        <TouchableOpacity style={styles.repoButton} onPress={() => router.push("/repository")}>
          <Ionicons name="library-outline" size={18} color="#fff" />
          <Text style={styles.repoButtonText}>Repository</Text>
        </TouchableOpacity>
      </View>

      {/* Enhanced Search Bar */}
      <View style={styles.searchContainer}>
        <Ionicons name="search" size={20} color="#94A3B8" />
        <TextInput
          placeholder="Search by title, author, keywords..."
          style={styles.searchInput}
          value={searchQuery}
          onChangeText={setSearchQuery}
          placeholderTextColor="#94A3B8"
        />
        {searchQuery.length > 0 && (
          <TouchableOpacity onPress={() => setSearchQuery("")}>
            <Ionicons name="close-circle" size={20} color="#94A3B8" />
          </TouchableOpacity>
        )}
      </View>

      {/* Enhanced List with Loading State */}
      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#2563EB" />
          <Text style={styles.loadingText}>Loading research papers...</Text>
        </View>
      ) : (
        <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
          {filtered.length === 0 ? (
            <View style={styles.emptyState}>
              <Ionicons name="document-text-outline" size={64} color="#CBD5E1" />
              <Text style={styles.emptyStateTitle}>
                {tab === "my" && clearedLocally ? "List Cleared" : "No Research Found"}
              </Text>
              <Text style={styles.emptyStateText}>
                {tab === "my" && clearedLocally
                  ? "Tap 'Restore' to reload your submissions"
                  : searchQuery
                  ? "Try adjusting your search terms"
                  : "Start by submitting your first research paper"}
              </Text>
            </View>
          ) : (
            filtered.map((paper) => (
              <TouchableOpacity
                key={paper._id}
                style={styles.card}
                onPress={() => setSelectedPaper(paper)}
                activeOpacity={0.7}
              >
                <View style={styles.cardContent}>
                  <View style={styles.cardHeader}>
                    <View style={styles.cardTitleRow}>
                      <Text style={styles.cardTitle} numberOfLines={2}>
                        {cleanTitle(paper.title || "")}
                      </Text>
                      {renderBadge(paper)}
                    </View>
                    <StatusBadge status={paper.status || "pending"} />
                  </View>

                  <Text style={styles.cardSubtitle}>
                    {[paper.author, ...(paper.coAuthors || [])]
                      .filter((v, i, arr) => v && arr.indexOf(v) === i)
                      .join(", ")}
                  </Text>

                  {normalizeKeywords(paper.keywords).length > 0 && (
                    <View style={styles.keywordRow}>
                      {normalizeKeywords(paper.keywords).slice(0, 3).map((k, i) => (
                        <View key={`kw-${paper._id}-${i}`} style={styles.keywordChip}>
                          <Text style={styles.keywordText}>#{k}</Text>
                        </View>
                      ))}
                      {normalizeKeywords(paper.keywords).length > 3 && (
                        <Text style={styles.moreKeywords}>
                          +{normalizeKeywords(paper.keywords).length - 3} more
                        </Text>
                      )}
                    </View>
                  )}

                  <View style={styles.cardFooter}>
                    <View style={styles.dateContainer}>
                      <Ionicons name="calendar-outline" size={14} color="#94A3B8" />
                      <Text style={styles.dateText}>
                        {paper.createdAt ? new Date(paper.createdAt).toLocaleDateString() : "—"}
                      </Text>
                    </View>
                    {paper.fileName && (
                      <View style={styles.attachmentIndicator}>
                        <Ionicons name="attach" size={14} color="#2563EB" />
                        <Text style={styles.attachmentText}>File attached</Text>
                      </View>
                    )}
                  </View>
                </View>

                {tab === "my" && paper.status !== "approved" && (
                  <ActionTimers paper={paper} onDelete={handleDelete} onOpenReviseModal={openReviseModal} />
                )}
              </TouchableOpacity>
            ))
          )}
        </ScrollView>
      )}

      {/* Enhanced FAB */}
      {tab === "my" && selectedPaper?.fileName ? (
        <TouchableOpacity style={styles.fab} onPress={() => selectedPaper && openStudentFile(selectedPaper)}>
          <Ionicons name="document-attach" size={26} color="#fff" />
        </TouchableOpacity>
      ) : (
        <>
          <TouchableOpacity style={styles.fab} onPress={() => setSubmitModal(true)}>
            <MaterialIcons name="add" size={32} color="#fff" />
          </TouchableOpacity>

          {/* Enhanced Submit Modal */}
          <Modal visible={submitModal} transparent animationType="fade" onRequestClose={() => setSubmitModal(false)}>
            <Pressable style={styles.modalOverlay} onPress={() => setSubmitModal(false)}>
              <View style={styles.submitModal}>
                <View style={styles.submitModalHeader}>
                  <Text style={styles.submitTitle}>New Submission</Text>
                  <TouchableOpacity onPress={() => setSubmitModal(false)}>
                    <Ionicons name="close" size={24} color="#64748B" />
                  </TouchableOpacity>
                </View>
                <Text style={styles.submitHint}>Choose your submission type:</Text>

                <TouchableOpacity
                  style={styles.submitBtn}
                  onPress={() => {
                    setSubmitModal(false);
                    router.push({ pathname: "/add-research", params: { submissionType: "draft" } });
                  }}
                >
                  <View style={[styles.submitBtnIcon, { backgroundColor: "#FEF3C7" }]}>
                    <Ionicons name="document-text-outline" size={24} color="#D97706" />
                  </View>
                  <View style={styles.submitBtnContent}>
                    <Text style={styles.submitBtnTitle}>Draft Consultation</Text>
                    <Text style={styles.submitBtnSub}>Submit for faculty feedback and revisions</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={20} color="#94A3B8" />
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.submitBtn}
                  onPress={() => {
                    setSubmitModal(false);
                    router.push({ pathname: "/add-research", params: { submissionType: "final" } });
                  }}
                >
                  <View style={[styles.submitBtnIcon, { backgroundColor: "#DCFCE7" }]}>
                    <Ionicons name="cloud-upload-outline" size={24} color="#059669" />
                  </View>
                  <View style={styles.submitBtnContent}>
                    <Text style={styles.submitBtnTitle}>Final Submission</Text>
                    <Text style={styles.submitBtnSub}>Ready for approval and repository publishing</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={20} color="#94A3B8" />
                </TouchableOpacity>
              </View>
            </Pressable>
          </Modal>
        </>
      )}

      {/* Enhanced Details Modal */}
      <Modal 
        visible={!!selectedPaper} 
        animationType="slide" 
        transparent
        onRequestClose={() => setSelectedPaper(null)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.detailsModal}>
            <View style={styles.detailsModalHeader}>
              <Text style={styles.detailsModalTitle} numberOfLines={2}>
                {selectedPaper?.title || "Research Details"}
              </Text>
              <TouchableOpacity onPress={() => setSelectedPaper(null)} style={styles.closeButton}>
                <Ionicons name="close" size={24} color="#fff" />
              </TouchableOpacity>
            </View>

            <ScrollView 
              style={styles.detailsModalBody} 
              contentContainerStyle={styles.detailsModalContent}
              showsVerticalScrollIndicator={true}
            >
              {selectedPaper && (
                <>
                  {/* Status and Type Badges */}
                  <View style={styles.badgesRow}>
                    <StatusBadge status={selectedPaper.status || "pending"} />
                    <TypeBadgeFS type={selectedPaper.submissionType || "draft"} />
                  </View>

                  {/* Author Information */}
                  <View style={styles.infoSection}>
                    <View style={styles.infoRow}>
                      <Ionicons name="person" size={18} color="#64748B" />
                      <Text style={styles.infoLabel}>Author:</Text>
                      <Text style={styles.infoValue}>{selectedPaper.author || "—"}</Text>
                    </View>
                    
                    {selectedPaper.coAuthors && selectedPaper.coAuthors.length > 0 && (
                      <View style={styles.infoRow}>
                        <Ionicons name="people" size={18} color="#64748B" />
                        <Text style={styles.infoLabel}>Co-authors:</Text>
                        <Text style={styles.infoValue}>
                          {Array.isArray(selectedPaper.coAuthors) 
                            ? selectedPaper.coAuthors.join(", ") 
                            : selectedPaper.coAuthors}
                        </Text>
                      </View>
                    )}

                    {selectedPaper.adviser && (
                      <View style={styles.infoRow}>
                        <Ionicons name="school" size={18} color="#64748B" />
                        <Text style={styles.infoLabel}>Adviser:</Text>
                        <Text style={styles.infoValue}>{selectedPaper.adviser}</Text>
                      </View>
                    )}

                    <View style={styles.infoRow}>
                      <Ionicons name="calendar" size={18} color="#64748B" />
                      <Text style={styles.infoLabel}>Submitted:</Text>
                      <Text style={styles.infoValue}>
                        {selectedPaper.createdAt ? new Date(selectedPaper.createdAt).toLocaleDateString() : "—"}
                      </Text>
                    </View>
                  </View>

                  {/* Keywords */}
                  {normalizeKeywords(selectedPaper.keywords).length > 0 && (
                    <View style={styles.keywordsSection}>
                      <Text style={styles.sectionTitle}>Keywords</Text>
                      <View style={styles.keywordContainer}>
                        {normalizeKeywords(selectedPaper.keywords).map((k, i) => (
                          <View key={`modal-kw-${i}`} style={styles.keywordTag}>
                            <Text style={styles.keywordTagText}>#{k}</Text>
                          </View>
                        ))}
                      </View>
                    </View>
                  )}

                  {/* Abstract */}
                  <View style={styles.abstractSection}>
                    <Text style={styles.sectionTitle}>Abstract</Text>
                    <View style={styles.abstractBox}>
                      <Text style={styles.abstractText} selectable>
                        {formatAbstract(selectedPaper.abstract) || "No abstract available."}
                      </Text>
                    </View>
                  </View>

                  {/* Faculty Comment */}
                  {selectedPaper.facultyComment && (
                    <View style={styles.feedbackSection}>
                      <Text style={styles.sectionTitle}>Faculty Feedback</Text>
                      <View style={styles.feedbackBox}>
                        <Ionicons name="chatbox-ellipses" size={20} color="#D97706" />
                        <Text style={styles.feedbackText}>{selectedPaper.facultyComment}</Text>
                      </View>
                    </View>
                  )}

                  {/* Action Button */}
                  <TouchableOpacity 
                    style={styles.viewPdfButton} 
                    onPress={() => openStudentFile(selectedPaper)}
                  >
                    <Ionicons name="document-text" size={20} color="#fff" />
                    <Text style={styles.viewPdfButtonText}>Open Full PDF</Text>
                  </TouchableOpacity>
                </>
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Enhanced Revise Modal */}
      <Modal visible={reviseModal} transparent animationType="fade" onRequestClose={() => setReviseModal(false)}>
        <Pressable style={styles.modalOverlay} onPress={() => setReviseModal(false)}>
          <Pressable style={styles.reviseModalContent} onPress={() => {}}>
            <View style={styles.reviseModalHeader}>
              <Text style={styles.reviseModalTitle}>Revise Submission</Text>
              <TouchableOpacity onPress={() => setReviseModal(false)}>
                <Ionicons name="close" size={24} color="#64748B" />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.reviseScrollView} showsVerticalScrollIndicator={false}>
              <View style={styles.reviseForm}>
                <Text style={styles.reviseHelp}>⏰ You can revise within 5 minutes after upload</Text>

                <View style={styles.formGroup}>
                  <Text style={styles.formLabel}>Title</Text>
                  <TextInput 
                    value={reviseTitle} 
                    onChangeText={setReviseTitle} 
                    placeholder="Enter research title" 
                    style={styles.formInput} 
                  />
                </View>

                <View style={styles.formGroup}>
                  <Text style={styles.formLabel}>Adviser</Text>
                  <TextInput 
                    value={reviseAdviser} 
                    onChangeText={setReviseAdviser} 
                    placeholder="Enter adviser name" 
                    style={styles.formInput} 
                  />
                </View>

                <View style={styles.formGroup}>
                  <Text style={styles.formLabel}>Co-Authors / Members</Text>
                  <TextInput
                    value={reviseCoAuthors}
                    onChangeText={setReviseCoAuthors}
                    placeholder="e.g., Juan Dela Cruz, Maria Santos"
                    style={styles.formInput}
                    autoCapitalize="none"
                    autoCorrect={false}
                  />
                </View>

                <View style={styles.formGroup}>
                  <Text style={styles.formLabel}>Keywords (comma-separated)</Text>
                  <TextInput
                    value={reviseKeywords}
                    onChangeText={setReviseKeywords}
                    placeholder="e.g., machine learning, AI, education"
                    style={styles.formInput}
                    autoCapitalize="none"
                    autoCorrect={false}
                  />
                </View>

                <View style={styles.formGroup}>
                  <Text style={styles.formLabel}>Abstract</Text>
                  <TextInput
                    value={reviseAbstract}
                    onChangeText={setReviseAbstract}
                    placeholder="Enter abstract"
                    style={[styles.formInput, styles.textArea]}
                    multiline
                    numberOfLines={6}
                  />
                </View>

                <View style={styles.formGroup}>
                  <Text style={styles.formLabel}>Submission Type</Text>
                  <View style={styles.typeSelector}>
                    {(["draft", "final"] as const).map((opt) => {
                      const active = reviseType === opt;
                      return (
                        <TouchableOpacity
                          key={opt}
                          onPress={() => setReviseType(opt)}
                          style={[
                            styles.typeOption,
                            active && styles.typeOptionActive,
                            opt === "draft" && active && { borderColor: "#F59E0B", backgroundColor: "#FEF3C7" },
                            opt === "final" && active && { borderColor: "#10B981", backgroundColor: "#DCFCE7" },
                          ]}
                        >
                          <Ionicons 
                            name={opt === "draft" ? "document-text-outline" : "cloud-upload-outline"} 
                            size={18} 
                            color={active ? (opt === "draft" ? "#D97706" : "#059669") : "#94A3B8"} 
                          />
                          <Text style={[
                            styles.typeOptionText,
                            active && { color: opt === "draft" ? "#92400E" : "#065F46", fontWeight: "800" }
                          ]}>
                            {opt.toUpperCase()}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </View>

                <View style={styles.formGroup}>
                  <Text style={styles.formLabel}>Replace File (optional)</Text>
                  {Platform.OS === "web" ? (
                    <>
                      <input
                        ref={webFileInputRef as any}
                        type="file"
                        accept=".pdf,.doc,.docx,.ppt,.pptx"
                        style={{ display: "none" }}
                        onChange={(e) => {
                          const f = e.target.files?.[0] || null;
                          setSelectedFile(f ?? null);
                        }}
                      />
                      <TouchableOpacity 
                        style={styles.filePickerButton} 
                        onPress={() => webFileInputRef.current?.click()}
                      >
                        <Ionicons name="cloud-upload-outline" size={20} color="#2563EB" />
                        <Text style={styles.filePickerText}>
                          {selectedFile ? `Selected: ${selectedFile.name}` : "Choose file"}
                        </Text>
                      </TouchableOpacity>
                    </>
                  ) : (
                    <TouchableOpacity
                      style={styles.filePickerButton}
                      onPress={() =>
                        Alert.alert(
                          "Replace File",
                          "On mobile, use the Add Research screen to re-upload."
                        )
                      }
                    >
                      <Ionicons name="information-circle-outline" size={20} color="#64748B" />
                      <Text style={styles.filePickerText}>Use Add Research to re-upload</Text>
                    </TouchableOpacity>
                  )}
                </View>
              </View>
            </ScrollView>

            <View style={styles.reviseModalFooter}>
              <TouchableOpacity
                style={[styles.reviseSaveButton, savingRevise && { opacity: 0.6 }]}
                onPress={submitRevision}
                disabled={savingRevise}
              >
                {savingRevise ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <>
                    <Ionicons name="checkmark" size={20} color="#fff" />
                    <Text style={styles.reviseSaveButtonText}>Save Changes</Text>
                  </>
                )}
              </TouchableOpacity>
              <TouchableOpacity 
                style={styles.reviseCancelButton} 
                onPress={() => setReviseModal(false)}
              >
                <Text style={styles.reviseCancelButtonText}>Cancel</Text>
              </TouchableOpacity>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { 
    flex: 1, 
    backgroundColor: "#F8FAFC", 
    paddingHorizontal: 20, 
    paddingTop: 50 
  },

  // Enhanced Header Styles
  headerContainer: { 
    marginBottom: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#E2E8F0",
  },
  headerTopRow: { 
    flexDirection: "row", 
    justifyContent: "space-between", 
    alignItems: "center", 
    marginBottom: 12 
  },
  profileButton: {
    padding: 4,
  },
  headerActions: { 
    flexDirection: "row", 
    alignItems: "center", 
    gap: 8 
  },
  headerPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#E2E8F0",
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 20,
  },
  headerPillText: { 
    color: "#475569", 
    fontWeight: "600", 
    fontSize: 12 
  },
  greeting: { 
    fontSize: 28, 
    fontWeight: "800", 
    color: "#0F172A",
    marginBottom: 4,
  },
  subGreeting: {
    fontSize: 14,
    color: "#64748B",
    fontWeight: "500",
  },

  // Enhanced Menu Dropdown
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "center",
    alignItems: "center",
  },
  menuDropdown: {
    backgroundColor: "#fff",
    borderRadius: 12,
    paddingVertical: 8,
    paddingHorizontal: 4,
    shadowColor: "#000",
    shadowOpacity: 0.15,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 8,
    minWidth: 200,
  },
  menuItemContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
  },
  menuItem: { 
    fontSize: 15, 
    color: "#475569",
    fontWeight: "600",
  },
  menuDivider: {
    height: 1,
    backgroundColor: "#E2E8F0",
    marginVertical: 4,
  },

  // Enhanced Tabs
  tabSection: { 
    flexDirection: "row", 
    alignItems: "center", 
    gap: 12, 
    marginBottom: 16 
  },
  tabWrapper: { 
    flex: 1 
  },
  tabContainer: { 
    flexDirection: "row", 
    backgroundColor: "#E2E8F0", 
    borderRadius: 12, 
    padding: 4,
  },
  tab: { 
    flex: 1, 
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 10, 
    borderRadius: 8,
    gap: 6,
  },
  tabActive: { 
    backgroundColor: "#2563EB",
    shadowColor: "#2563EB",
    shadowOpacity: 0.3,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
  },
  tabText: { 
    color: "#64748B", 
    fontWeight: "600", 
    fontSize: 14 
  },
  tabTextActive: { 
    color: "#fff", 
    fontWeight: "700" 
  },

  repoButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#2563EB",
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 16,
    gap: 6,
    shadowColor: "#2563EB",
    shadowOpacity: 0.3,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
  },
  repoButtonText: { 
    color: "#fff", 
    fontWeight: "700", 
    fontSize: 14 
  },

  // Enhanced Search Bar
  searchContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fff",
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    gap: 10,
  },
  searchInput: { 
    flex: 1, 
    color: "#0F172A", 
    fontSize: 15,
    fontWeight: "500",
  },

  // Loading State
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    gap: 16,
    paddingTop: 60,
  },
  loadingText: {
    fontSize: 15,
    color: "#64748B",
    fontWeight: "500",
  },

  // Enhanced Empty State
  scrollView: {
    flex: 1,
  },
  emptyState: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 60,
    paddingHorizontal: 40,
  },
  emptyStateTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: "#475569",
    marginTop: 16,
    marginBottom: 8,
  },
  emptyStateText: {
    fontSize: 14,
    color: "#94A3B8",
    textAlign: "center",
    lineHeight: 20,
  },

  // Enhanced Cards
  card: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    shadowColor: "#000",
    shadowOpacity: 0.04,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  cardContent: {
    gap: 10,
  },
  cardHeader: {
    gap: 8,
  },
  cardTitleRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 12,
  },
  cardTitle: { 
    fontSize: 16, 
    fontWeight: "700", 
    color: "#0F172A",
    flex: 1,
    lineHeight: 22,
  },
  cardSubtitle: { 
    fontSize: 13, 
    color: "#64748B",
    fontWeight: "500",
  },

  badge: {
    borderWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },

  // Status Badges
  statBadge: { 
    flexDirection: "row", 
    alignItems: "center", 
    gap: 4, 
    paddingHorizontal: 8, 
    paddingVertical: 4, 
    borderRadius: 6 
  },
  statBadgeText: { 
    fontSize: 11, 
    fontWeight: "800",
    letterSpacing: 0.5,
  },

  typeBadge: {
    borderWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },

  // Keywords
  keywordRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    alignItems: "center",
  },
  keywordChip: {
    backgroundColor: "#EFF6FF",
    borderColor: "#BFDBFE",
    borderWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  keywordText: { 
    color: "#1E40AF", 
    fontSize: 11, 
    fontWeight: "600" 
  },
  moreKeywords: {
    fontSize: 11,
    color: "#94A3B8",
    fontWeight: "600",
  },

  // Card Footer
  cardFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: "#F1F5F9",
  },
  dateContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  dateText: {
    fontSize: 12,
    color: "#94A3B8",
    fontWeight: "500",
  },
  attachmentIndicator: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  attachmentText: {
    fontSize: 12,
    color: "#2563EB",
    fontWeight: "600",
  },

  // Action Timers
  actionTimersContainer: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: "#F1F5F9",
    gap: 8,
  },
  actionButtonsRow: {
    flexDirection: "row",
    gap: 8,
  },
  actionButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 10,
    borderRadius: 8,
    gap: 6,
  },
  reviseButton: {
    backgroundColor: "#2563EB",
  },
  deleteButton: {
    backgroundColor: "#DC2626",
  },
  actionButtonDisabled: {
    backgroundColor: "#94A3B8",
  },
  actionButtonText: {
    color: "#fff",
    fontWeight: "700",
    fontSize: 13,
  },
  timerTextsContainer: {
    flexDirection: "row",
    justifyContent: "space-around",
    paddingTop: 4,
  },
  timerText: {
    fontSize: 11,
    color: "#64748B",
    fontWeight: "600",
  },
  timerTextExpired: {
    color: "#DC2626",
  },

  // Enhanced FAB
  fab: {
    position: "absolute",
    bottom: 30,
    right: 30,
    backgroundColor: "#2563EB",
    borderRadius: 60,
    width: 60,
    height: 60,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#2563EB",
    shadowOpacity: 0.4,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 8,
  },

  // Enhanced Submit Modal
  submitModal: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 20,
    width: width > 420 ? 420 : "90%",
    maxHeight: "80%",
  },
  submitModalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  submitTitle: { 
    fontSize: 22, 
    fontWeight: "800", 
    color: "#0F172A" 
  },
  submitHint: { 
    fontSize: 14, 
    color: "#64748B",
    marginBottom: 16,
    fontWeight: "500",
  },
  submitBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    backgroundColor: "#F8FAFC",
    marginBottom: 12,
  },
  submitBtnIcon: {
    width: 48,
    height: 48,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  submitBtnContent: {
    flex: 1,
    gap: 4,
  },
  submitBtnTitle: { 
    fontSize: 15, 
    fontWeight: "700",
    color: "#0F172A",
  },
  submitBtnSub: { 
    fontSize: 12, 
    color: "#64748B",
    lineHeight: 16,
  },

  // Enhanced Details Modal
  detailsModal: {
    width: "90%",
    maxWidth: 600,
    maxHeight: "85%",
    backgroundColor: "#fff",
    borderRadius: 16,
    overflow: "hidden",
  },
  detailsModalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: "#2563EB",
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  detailsModalTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#fff",
    flex: 1,
    marginRight: 12,
  },
  closeButton: {
    padding: 4,
  },
  detailsModalBody: {
    flex: 1,
  },
  detailsModalContent: {
    padding: 20,
  },

  badgesRow: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 16,
  },

  infoSection: {
    gap: 12,
    marginBottom: 16,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#F1F5F9",
  },
  infoRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  infoLabel: {
    fontSize: 14,
    fontWeight: "600",
    color: "#475569",
    minWidth: 80,
  },
  infoValue: {
    fontSize: 14,
    color: "#0F172A",
    flex: 1,
    fontWeight: "500",
  },

  keywordsSection: {
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#0F172A",
    marginBottom: 12,
  },
  keywordContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  keywordTag: {
    backgroundColor: "#EFF6FF",
    borderColor: "#BFDBFE",
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  keywordTagText: {
    color: "#1E40AF",
    fontSize: 13,
    fontWeight: "600",
  },

  abstractSection: {
    marginBottom: 16,
  },
  abstractBox: {
    backgroundColor: "#F8FAFC",
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  abstractText: {
    fontSize: 14,
    color: "#475569",
    lineHeight: 22,
    textAlign: "justify",
  },

  feedbackSection: {
    marginBottom: 20,
  },
  feedbackBox: {
    backgroundColor: "#FEF3C7",
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: "#FCD34D",
    flexDirection: "row",
    gap: 12,
  },
  feedbackText: {
    flex: 1,
    fontSize: 14,
    color: "#92400E",
    lineHeight: 20,
  },

  viewPdfButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#2563EB",
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 12,
    gap: 8,
  },
  viewPdfButtonText: {
    color: "#fff",
    fontWeight: "700",
    fontSize: 15,
  },

  // Enhanced Revise Modal
  reviseModalContent: {
    backgroundColor: "#fff",
    borderRadius: 16,
    width: width > 500 ? 500 : "90%",
    maxHeight: "85%",
    overflow: "hidden",
  },
  reviseModalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: "#E2E8F0",
  },
  reviseModalTitle: {
    fontSize: 20,
    fontWeight: "800",
    color: "#0F172A",
  },
  reviseScrollView: {
    maxHeight: 400,
  },
  reviseForm: {
    padding: 20,
  },
  reviseHelp: {
    fontSize: 13,
    color: "#D97706",
    backgroundColor: "#FEF3C7",
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
    fontWeight: "600",
  },

  formGroup: {
    marginBottom: 16,
  },
  formLabel: {
    fontSize: 13,
    fontWeight: "600",
    color: "#475569",
    marginBottom: 8,
  },
  formInput: {
    backgroundColor: "#F8FAFC",
    borderRadius: 10,
paddingHorizontal: 14,
paddingVertical: 12,
fontSize: 14,
color: "#0F172A",
borderWidth: 1,
borderColor: "#E2E8F0",
},
textArea: {
minHeight: 100,
textAlignVertical: "top",
},
typeSelector: {
flexDirection: "row",
gap: 10,
},
typeOption: {
flex: 1,
flexDirection: "row",
alignItems: "center",
justifyContent: "center",
paddingVertical: 12,
paddingHorizontal: 16,
borderRadius: 10,
borderWidth: 2,
borderColor: "#E2E8F0",
backgroundColor: "#F8FAFC",
gap: 6,
},
typeOptionActive: {
borderWidth: 2,
},
typeOptionText: {
fontSize: 13,
fontWeight: "600",
color: "#94A3B8",
},
filePickerButton: {
flexDirection: "row",
alignItems: "center",
gap: 10,
backgroundColor: "#F8FAFC",
paddingVertical: 12,
paddingHorizontal: 14,
borderRadius: 10,
borderWidth: 1,
borderColor: "#E2E8F0",
},
filePickerText: {
fontSize: 14,
color: "#475569",
fontWeight: "500",
},
reviseModalFooter: {
flexDirection: "row",
gap: 10,
padding: 20,
borderTopWidth: 1,
borderTopColor: "#E2E8F0",
},
reviseSaveButton: {
flex: 1,
backgroundColor: "#2563EB",
borderRadius: 10,
paddingVertical: 14,
alignItems: "center",
justifyContent: "center",
flexDirection: "row",
gap: 8,
},
reviseSaveButtonText: {
color: "#fff",
fontWeight: "700",
fontSize: 15,
},
reviseCancelButton: {
flex: 1,
backgroundColor: "#F1F5F9",
borderRadius: 10,
paddingVertical: 14,
alignItems: "center",
justifyContent: "center",
},
reviseCancelButtonText: {
color: "#475569",
fontWeight: "700",
fontSize: 15,
},
});