// app/screens/ResearchRepository.tsx
import React, { useEffect, useState, useCallback, useMemo } from "react";
import {
  View, Text, ScrollView, TouchableOpacity, ActivityIndicator, Alert,
  Platform, Linking, StyleSheet, TextInput, RefreshControl, Modal
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import api from "../../lib/api";
import { getToken } from "../../lib/auth";
import Markdown from "react-native-markdown-display";

type RepoItem = {
  _id?: string;
  id?: string;
  title?: string;
  author?: string;
  coAuthors?: string[] | string;
  year?: number | string;
  createdAt?: string;
  abstract?: string;
  keywords?: string[] | string;
  fileUrl?: string;
  filePath?: string;
  fileName?: string;
  uploaderRole?: "student" | "staff" | "faculty" | "admin";
  categories?: string[];
  genreTags?: string[];
};

type FacetEntry = { name: string; count: number };

/** ===== AI Tools types ===== */
type AiMode = "tldr"  | "methods" | "citations" | "recommendations";
type CitationPayload = { apa: string; ieee: string; bibtex: string };

function ensureArray<T = unknown>(v: unknown): T[] {
  return Array.isArray(v) ? (v as T[]) : [];
}
function toKeywordArray(k: RepoItem["keywords"]): string[] {
  if (Array.isArray(k)) return k.filter(Boolean).map(String);
  if (typeof k === "string") return k.split(",").map(s => s.trim()).filter(Boolean);
  return [];
}
function safeDateMs(v?: string) {
  const t = v ? new Date(v).getTime() : 0;
  return Number.isFinite(t) ? t : 0;
}
function quickSummary(text?: string) {
  if (!text) return "No abstract available for this study.";
  const sentences = text.replace(/\s+/g, " ").split(/[.!?]\s/).filter(s => s.length > 40);
  const top = sentences.slice(0, 2).join(". ") + ".";
  return top.trim() || (text.slice(0, 200) + "…");
}
function formatRecommendations(text: string): string {
  if (!text) return "No recommendations available.";
  
  // Split by numbers or bullets and clean up each recommendation
  const recommendations = text
    .split(/\d+\.\s*|\n\s*[-•*]\s*/)
    .map(rec => rec.trim())
    .filter(rec => rec.length > 0);
  
  // Format each recommendation as a proper sentence
  const formatted = recommendations.map(rec => {
    // Ensure it starts with capital letter and ends with period
    let formattedRec = rec.trim();
    
    // Capitalize first letter
    if (formattedRec.length > 0) {
      formattedRec = formattedRec.charAt(0).toUpperCase() + formattedRec.slice(1);
    }
    
    // Ensure it ends with proper punctuation
    if (!/[.!?]$/.test(formattedRec)) {
      formattedRec += '.';
    }
    
    // Remove any extra whitespace and ensure coherent sentences
    formattedRec = formattedRec
      .replace(/\s+/g, ' ')
      .replace(/\s+([.,!?])/g, '$1')
      .trim();
    
    return formattedRec;
  });
  
  // Return as bullet list instead of numbered list
  return formatted.map(rec => `• ${rec}`).join('\n\n');
}

/** ===== Copy helper (no extra deps required) ===== */
const copyToClipboard = async (text: string) => {
  try {
    if (Platform.OS === "web" && typeof navigator !== "undefined" && (navigator as any).clipboard) {
      await (navigator as any).clipboard.writeText(text || "");
      Alert.alert?.("Copied", "Text copied to clipboard.");
      return;
    }
    Alert.alert?.(
      "Copy not available",
      "On native, install clipboard support:\n• npx expo install expo-clipboard\nor\n• npm i @react-native-clipboard/clipboard"
    );
  } catch (e: any) {
    console.warn("Copy failed:", e?.message || e);
    Alert.alert?.("Copy failed", "Could not copy to clipboard.");
  }
};

export default function ResearchRepository() {
  const [loading, setLoading] = useState(true);
  const [repository, setRepository] = useState<RepoItem[]>([]);
  const [search, setSearch] = useState("");

  const [sortBy, setSortBy] = useState<"latest" | "year">("latest");

  const [facetsLoading, setFacetsLoading] = useState(false);
  const [facetCategories, setFacetCategories] = useState<FacetEntry[]>([]);
  const [facetGenres, setFacetGenres] = useState<FacetEntry[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [selectedGenres, setSelectedGenres] = useState<string[]>([]);

  const [refreshing, setRefreshing] = useState(false);

  const [selected, setSelected] = useState<RepoItem | null>(null);
  const [summary, setSummary] = useState<string>("");
  const [summarizing, setSummarizing] = useState(false);

  // AI Tools state/cache
  const [aiMode, setAiMode] = useState<AiMode | null>(null);
  const [aiBusy, setAiBusy] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [aiCache, setAiCache] = useState<Record<string, Partial<Record<AiMode, string>>>>({});
  const [aiCiteCache, setAiCiteCache] = useState<Record<string, CitationPayload | undefined>>({});

  // ---- Fetch facets ----
  const fetchFacets = useCallback(async () => {
    try {
      setFacetsLoading(true);
      const token = (await getToken())?.token;
      const res = await api.get("/repository/facets", {
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      });
      setFacetCategories(res?.data?.categories || []);
      setFacetGenres(res?.data?.genreTags || []);
    } catch (err) {
      console.warn("Facet load error:", (err as any)?.response?.data || err);
    } finally {
      setFacetsLoading(false);
    }
  }, []);

  // ---- Fetch repository ----
  const fetchRepository = useCallback(async () => {
    try {
      setLoading(true);
      const token = (await getToken())?.token;
      const params: any = {};
      if (search.trim()) params.q = search.trim();
      params.sort = sortBy === "year" ? "year" : "latest";
      if (selectedCategory !== "all") params.category = selectedCategory;
      if (selectedGenres.length) params.genre = selectedGenres.join(",");

      const res = await api.get("/repository", {
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
        params,
      });
      const raw = res?.data?.items ?? res?.data?.data ?? res?.data ?? [];
      setRepository(ensureArray<RepoItem>(raw));
    } catch (err: any) {
      console.error("❌ Repository fetch error:", err.response?.data || err);
      Alert.alert("Error", err?.response?.data?.error || "Failed to load research repository.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [search, sortBy, selectedCategory, selectedGenres]);

  useEffect(() => { fetchFacets(); }, [fetchFacets]);
  useEffect(() => { fetchRepository(); }, [fetchRepository]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchRepository();
    fetchFacets();
  }, [fetchRepository, fetchFacets]);

  // ---- Chips helpers ----
  const toggleGenre = (g: string) => {
    setSelectedGenres(prev => prev.includes(g) ? prev.filter(x => x !== g) : [...prev, g]);
  };
  const clearFilters = () => { setSelectedCategory("all"); setSelectedGenres([]); };

  // ---- Client-side final filters/sort ----
 const filtered = useMemo(() => {
  const q = search.trim().toLowerCase();
  let data = [...repository];

  if (selectedCategory !== "all")
    data = data.filter(r => (r.categories || []).includes(selectedCategory));
  if (selectedGenres.length)
    data = data.filter(r => selectedGenres.every(g => (r.genreTags || []).includes(g)));

  // Sort by year or latest
  if (sortBy === "year")
    data.sort((a, b) => Number(String(b.year || 0)) - Number(String(a.year || 0)));
  else
    data.sort((a, b) => safeDateMs(b.createdAt) - safeDateMs(a.createdAt));

  // ✅ Apply search filtering
  if (q) {
    data = data.filter(r => {
      const kws = toKeywordArray(r.keywords);
      const coAuths = Array.isArray(r.coAuthors)
        ? r.coAuthors
        : (r.coAuthors || "").split(",").map(s => s.trim()).filter(Boolean);
      return (
        (r.title || "").toLowerCase().includes(q) ||
        (r.author || "").toLowerCase().includes(q) ||
        coAuths.some(a => a.toLowerCase().includes(q)) || // ✅ include co-authors
        kws.some(k => k.toLowerCase().includes(q)) ||
        (r.year ? String(r.year).includes(q) : false)
      );
    });
  }

  return data;
}, [repository, sortBy, selectedCategory, selectedGenres, search]);


  // ---- Open card (summary) ----
  const handleSelect = async (r: RepoItem) => {
    setSelected(r);
    setSummary("");
    setSummarizing(true);
    setAiMode(null);
    setAiError(null);
    try {
      const token = (await getToken())?.token;
      const res = await api.post("/ai/summary",
        { text: r.abstract, filePath: r.filePath ?? null },
        { headers: token ? { Authorization: `Bearer ${token}` } : undefined }
      );
      setSummary(res?.data?.summary || quickSummary(r.abstract));
    } catch (err) {
      console.error("❌ Summary error:", err);
      setSummary(quickSummary(r.abstract));
    } finally {
      setSummarizing(false);
    }
  };

  // ---- Open PDF ----
  const handleOpenPDF = async (item: RepoItem) => {
    try {
      if (!item?._id) return Alert.alert?.("Error", "Invalid file");
      const token = (await getToken())?.token;
      if (!token) return Alert.alert?.("Session expired", "Please sign in again.");
      const apiBase = (api.defaults.baseURL || "").replace(/\/+$/, "");
      const url = `${apiBase}/research/file/${item._id}`;

      if (Platform.OS === "web") {
        const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
        if (!res.ok) throw new Error(`Open failed (${res.status})`);
        const blob = await res.blob();
        const blobUrl = URL.createObjectURL(blob);
        window.open(blobUrl, "_blank");
        setTimeout(() => URL.revokeObjectURL(blobUrl), 60_000);
        return;
      }
      Linking.openURL(url);
    } catch (e: any) {
      console.error("❌ Open PDF error:", e);
      Alert.alert?.("Error", e?.message || "Failed to open PDF.");
    }
  };

  // ---- Run AI tool ----
const runAiTool = useCallback(async (mode: AiMode) => {
  if (!selected) return;
  setAiMode(mode);
  setAiError(null);

  const id = selected._id || selected.id || selected.title || "x";
  if (mode === "citations") {
    if (aiCiteCache[id]) return;
  } else {
    if (aiCache[id]?.[mode]) return;
  }

  try {
    setAiBusy(true);
    const token = (await getToken())?.token;

    if (mode === "tldr") {
      const res = await api.post(
        "/ai/tldr",
        { abstract: (selected.abstract || "").trim(), filePath: selected.filePath ?? null },
        { headers: token ? { Authorization: `Bearer ${token}` } : undefined }
      );
      const text = res?.data?.text || "No takeaway.";
      setAiCache(prev => ({ ...prev, [id]: { ...(prev[id] || {}), tldr: text } }));
      return;
    }

    // other modes go through abstract-tools
    const res = await api.post(
      "/ai/abstract-tools",
      {
        mode,
        abstract: (selected.abstract || "").trim(),
        meta: {
          title: (selected.title || "").trim(),
          author: (selected.author || "").trim(),
            coAuthors: Array.isArray(selected.coAuthors)
        ? selected.coAuthors
        : (selected.coAuthors || "")
            .split(",")
            .map(s => s.trim())
            .filter(Boolean),
          year: selected.year,
          categories: selected.categories || [],
          genreTags: selected.genreTags || [],
        },
        filePath: selected.filePath ?? null,
        researchId: selected._id || selected.id || null, // Pass research ID so backend can fetch filePath
      },
      { headers: token ? { Authorization: `Bearer ${token}` } : undefined }
    );

    if (mode === "citations" && res?.data?.citations) {
      setAiCiteCache(prev => ({ ...prev, [id]: res.data.citations as CitationPayload }));
    } else {
      const text = res?.data?.text || "No output.";
      setAiCache(prev => ({ ...prev, [id]: { ...(prev[id] || {}), [mode]: text } }));
    }
  } catch (e: any) {
    const msg = e?.response?.data?.error || e?.message || "Failed to run AI tool.";
    setAiError(msg);
    Alert.alert?.("AI Error", msg);
  } finally {
    setAiBusy(false);
  }
}, [selected, aiCache, aiCiteCache]);


  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#2563eb" />
        <Text style={{ color: "#6b7280", marginTop: 10 }}>Loading research repository...</Text>
      </View>
    );
  }

  const selectedId = selected?._id || selected?.id || selected?.title || "x";
  const cite = aiCiteCache[selectedId];

  return (
    <View style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={styles.header}>🎓 Research Repository</Text>
        <Text style={styles.subHeader}>Tap on any study to view the abstract and AI tools.</Text>

        {/* Search */}
        <View style={styles.searchContainer}>
          <Ionicons name="search-outline" size={20} color="#6b7280" />
          <TextInput
            placeholder="Search by title, author, or keyword..."
            placeholderTextColor="#6b7280"
            value={search}
            onChangeText={setSearch}
            style={styles.searchInput}
            onSubmitEditing={fetchRepository}
            returnKeyType="search"
          />
          {search ? (
            <TouchableOpacity onPress={() => { setSearch(""); }}>
              <Ionicons name="close-circle" size={20} color="#6b7280" />
            </TouchableOpacity>
          ) : null}
        </View>

        {/* Categories */}
        <View style={styles.sectionHeaderRow}>
          <Text style={styles.sectionHeader}>Categories</Text>
          {facetsLoading ? <ActivityIndicator size="small" color="#2563eb" /> : null}
        </View>
        <View style={styles.chipsRow}>
          <TouchableOpacity onPress={() => setSelectedCategory("all")} style={[styles.catChip, selectedCategory === "all" && styles.catChipActive]}>
            <Text style={[styles.chipText, selectedCategory === "all" && styles.chipTextActive]}>All</Text>
          </TouchableOpacity>
          {facetCategories.map((c) => (
            <TouchableOpacity
              key={`cat-${c.name}`}
              onPress={() => setSelectedCategory(c.name === selectedCategory ? "all" : c.name)}
              style={[styles.catChip, selectedCategory === c.name && styles.catChipActive]}
            >
              <Text style={[styles.chipText, selectedCategory === c.name && styles.chipTextActive]}>
                {c.name} ({c.count})
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Genres */}
        <View style={styles.sectionHeaderRow}>
          <Text style={styles.sectionHeader}>Genres</Text>
          {(selectedCategory !== "all" || selectedGenres.length > 0) ? (
            <TouchableOpacity onPress={clearFilters} style={styles.clearBtn}>
              <Ionicons name="close-circle" size={16} color="#fff" />
              <Text style={styles.clearText}>Clear</Text>
            </TouchableOpacity>
          ) : null}
        </View>
        <View style={styles.chipsRow}>
          {facetGenres.map((g) => {
            const on = selectedGenres.includes(g.name);
            return (
              <TouchableOpacity
                key={`gen-${g.name}`}
                onPress={() => toggleGenre(g.name)}
                style={[styles.genreChip, on && styles.genreChipActive]}
              >
                <Text style={[styles.chipText, on && styles.chipTextActive]}>
                  {g.name} ({g.count})
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Apply */}
        <View style={{ height: 8 }} />
        <TouchableOpacity onPress={fetchRepository} style={styles.applyBtn} activeOpacity={0.85}>
          <Ionicons name="filter" size={16} color="#fff" />
          <Text style={styles.applyBtnText}>Apply Filters</Text>
        </TouchableOpacity>

        {/* Cards */}
        {filtered.length === 0 ? (
          <Text style={styles.noResult}>No research found.</Text>
        ) : (
          filtered.map((r) => {
            const key = r._id || r.id || r.filePath || r.title || Math.random().toString(36).slice(2);
            const kws = toKeywordArray(r.keywords);
            return (
              <TouchableOpacity key={key} onPress={() => handleSelect(r)} style={styles.card}>
                <Text style={styles.title}>{r.title || "(Untitled)"}</Text>
                <Text style={styles.author}>By {r.author || "—"}</Text>
{r.coAuthors && (Array.isArray(r.coAuthors) ? r.coAuthors.length > 0 : r.coAuthors.trim() !== "") ? (
  <Text style={[styles.author, { fontStyle: "normal", color: "#2563eb" }]}>
    Co-authors: {Array.isArray(r.coAuthors) ? r.coAuthors.join(", ") : r.coAuthors}
  </Text>
) : null}

                <Text style={styles.year}>📅 {r.year || "Year not specified"}</Text>

                <View style={styles.metaChipsWrap}>
                  {(r.categories || []).slice(0, 4).map((c) => (
                    <Text key={`c-${key}-${c}`} style={styles.smallChip}>#{c}</Text>
                  ))}
                  {(r.genreTags || []).slice(0, 4).map((g) => (
                    <Text key={`g-${key}-${g}`} style={styles.smallChipAlt}>#{g}</Text>
                  ))}
                </View>

                {!!r.abstract && (
                  <Text numberOfLines={3} style={styles.abstract}>
                    {r.abstract}
                  </Text>
                )}
                {kws.length > 0 && (
                  <View style={styles.keywordContainer}>
                    {kws.map((k, idx) => (
                      <Text key={idx} style={styles.keyword}>#{k}</Text>
                    ))}
                  </View>
                )}

                <TouchableOpacity style={styles.viewBtn} onPress={() => handleOpenPDF(r)}>
                  <Ionicons name="document-text-outline" size={18} color="#fff" />
                  <Text style={styles.btnText}>Open Full PDF</Text>
                </TouchableOpacity>
              </TouchableOpacity>
            );
          })
        )}
      </ScrollView>

      {/* Modal */}
      <Modal visible={!!selected} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modal}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{selected?.title || "Study Summary"}</Text>
              <TouchableOpacity onPress={() => setSelected(null)}>
                <Ionicons name="close" size={24} color="#fff" />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalBody} contentContainerStyle={[styles.modalContent, { paddingBottom: 40 }]} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator>
              <Text style={styles.modalMeta}>👩‍💼 Author: {selected?.author || "—"}</Text>
              {selected?.coAuthors && (Array.isArray(selected.coAuthors)
                ? selected.coAuthors.length > 0
                : (selected.coAuthors || "").trim() !== "") && (
                <Text style={styles.modalMeta}>
                  👥 Co-authors: {Array.isArray(selected.coAuthors)
                    ? selected.coAuthors.join(", ")
                    : selected.coAuthors}
                </Text>
              )}

              <Text style={styles.modalMeta}>📅 Year: {selected?.year || "—"}</Text>

              {toKeywordArray(selected?.keywords).length > 0 && (
                <View style={styles.keywordContainer}>
                  {toKeywordArray(selected?.keywords).map((k, i) => (
                    <Text key={i} style={styles.keyword}>#{k}</Text>
                  ))}
                </View>
              )}

              <View style={[styles.metaChipsWrap, { marginTop: 6 }]}>
                {(selected?.categories || []).map((c, i) => (
                  <Text key={`mc-${i}`} style={styles.smallChip}>#{c}</Text>
                ))}
                {(selected?.genreTags || []).map((g, i) => (
                  <Text key={`mg-${i}`} style={styles.smallChipAlt}>#{g}</Text>
                ))}
              </View>

              {/* AI Tools */}
              <View style={[styles.aiToolsRow, { gap: 8 }]}>
                {([
                  ["tldr", "Short takeaway"],
                  ["methods", "Methods checklist"],
                  ["citations", "Citations"],
                  ["recommendations", "Recommendations"],
                ] as [AiMode, string][]).map(([key, label]) => {
                  const active = aiMode === key;
                  return (
                    <TouchableOpacity
                      key={key}
                      disabled={aiBusy}
                      onPress={() => runAiTool(key)}
                      style={[styles.aiToolChip, active && styles.aiToolChipActive, aiBusy && { opacity: 0.6 }]}
                      activeOpacity={0.8}
                    >
                      <Text style={[styles.chipText, active && styles.chipTextActive]}>{label}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              {/* Output */}
              <View style={styles.summaryBox}>
                {/* Citations */}
                {aiMode === "citations" ? (
                  aiBusy && !cite ? (
                    <ActivityIndicator size="large" color="#2563eb" />
                  ) : cite ? (
                    <View>
                      <Text style={{ color: "#0f172a", fontWeight: "700", marginBottom: 8 }}>Citations</Text>

                      <Text style={{ color: "#0f172a", marginBottom: 6 }}>APA</Text>
                      <View style={styles.copyRow}>
                        <TextInput editable={false} selectTextOnFocus value={cite.apa} style={styles.copyInput} multiline />
                        <TouchableOpacity onPress={() => copyToClipboard(cite.apa)} style={styles.copyBtn}>
                          <Ionicons name="copy-outline" size={16} color="#fff" />
                          <Text style={styles.copyText}>Copy</Text>
                        </TouchableOpacity>
                      </View>

                      <Text style={{ color: "#0f172a", marginTop: 12, marginBottom: 6 }}>IEEE</Text>
                      <View style={styles.copyRow}>
                        <TextInput editable={false} selectTextOnFocus value={cite.ieee} style={styles.copyInput} multiline />
                        <TouchableOpacity onPress={() => copyToClipboard(cite.ieee)} style={styles.copyBtn}>
                          <Ionicons name="copy-outline" size={16} color="#fff" />
                          <Text style={styles.copyText}>Copy</Text>
                        </TouchableOpacity>
                      </View>

                      <Text style={{ color: "#0f172a", marginTop: 12, marginBottom: 6 }}>BibTeX</Text>
                      <View style={styles.copyRow}>
                        <TextInput editable={false} selectTextOnFocus value={cite.bibtex} style={[styles.copyInput, { minHeight: 110 }]} multiline />
                        <TouchableOpacity onPress={() => copyToClipboard(cite.bibtex)} style={styles.copyBtn}>
                          <Ionicons name="copy-outline" size={16} color="#fff" />
                          <Text style={styles.copyText}>Copy</Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  ) : (
                    <Text style={{ color: "#0f172a" }}>{aiError || "No citations generated."}</Text>
                  )
                ) : summarizing && !aiMode ? (
                  <ActivityIndicator size="large" color="#2563eb" />
                ) : aiMode ? (
                  aiBusy ? (
                    <ActivityIndicator size="large" color="#2563eb" />
                  ) : aiError ? (
                    <Text style={{ color: "#0f172a" }}>{aiError}</Text>
                  ) : (
                    <Markdown style={{ body: { color: "#0f172a", fontSize: 14, lineHeight: 22 }, strong: { color: "#0f172a", fontWeight: "700" } }}>
                      {aiMode === "recommendations" 
                        ? formatRecommendations(aiCache[selectedId]?.[aiMode] || "Generating…")
                        : aiCache[selectedId]?.[aiMode] || "Generating…"
                      }
                    </Markdown>
                  )
                ) : (
                  <Markdown style={{ body: { color: "#0f172a", fontSize: 14, lineHeight: 22 }, strong: { color: "#0f172a", fontWeight: "700" } }}>
                    {summary || quickSummary(selected?.abstract)}
                  </Markdown>
                )}
              </View>

              <TouchableOpacity style={styles.viewBtn} onPress={() => selected && handleOpenPDF(selected)}>
                <Ionicons name="document-text-outline" size={18} color="#fff" />
                <Text style={styles.btnText}>Open Full PDF</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#cdd7dfff" },
  scroll: { padding: 20, paddingBottom: 40 },
  center: { flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: "#f6f6f9" },
  header: { color: "#0f172a", fontSize: 26, fontWeight: "800", textAlign: "center", marginBottom: 6 },
  subHeader: { color: "#6b7280", textAlign: "center", fontSize: 14, marginBottom: 20 },

  searchContainer: {
    flexDirection: "row", alignItems: "center", backgroundColor: "#ffffff",
    borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10, marginBottom: 12,
    borderWidth: 1, borderColor: "#eef2ff",
  },
  searchInput: { flex: 1, color: "#0f172a", fontSize: 14 },

  sectionHeaderRow: { flexDirection: "row", alignItems: "center", marginTop: 6, marginBottom: 6 },
  sectionHeader: { color: "#0f172a", fontWeight: "700", fontSize: 14 },
  clearBtn: {
    marginLeft: "auto", flexDirection: "row", alignItems: "center", gap: 6,
    backgroundColor: "#6b7280", paddingHorizontal: 10, paddingVertical: 5, borderRadius: 999,
  },
  clearText: { color: "#fff", fontSize: 12, fontWeight: "700" },

  chipsRow: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginBottom: 10 },
  catChip: {
    backgroundColor: "#ffffff", borderWidth: 1, borderColor: "#dbeafe",
    paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999,
  },
  catChipActive: { backgroundColor: "#2563eb", borderColor: "#2563eb" },
  genreChip: {
    backgroundColor: "#ffffff", borderWidth: 1, borderColor: "#dbeafe",
    paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999,
  },
  genreChipActive: { backgroundColor: "#2563eb", borderColor: "#2563eb" },
  chipText: { color: "#2563eb", fontSize: 12, fontWeight: "700" },
  chipTextActive: { color: "#fff" },

  applyBtn: {
    alignSelf: "flex-start", flexDirection: "row", alignItems: "center", gap: 6,
    backgroundColor: "#2563eb", borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8, marginBottom: 14,
  },
  applyBtnText: { color: "#fff", fontWeight: "700", fontSize: 12 },

  card: { backgroundColor: "#ffffff", borderRadius: 14, padding: 18, marginBottom: 16, borderWidth: 1, borderColor: "#eef2ff" },
  title: { color: "#0f172a", fontSize: 17, fontWeight: "700", marginBottom: 4 },
  author: { color: "#6b7280", fontStyle: "italic", marginBottom: 4 },
  year: { color: "#6b7280", fontSize: 13, marginBottom: 6 },

  metaChipsWrap: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginBottom: 8 },
  smallChip: { backgroundColor: "#dbeafe", color: "#2563eb", fontSize: 11, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 999 },
  smallChipAlt: { backgroundColor: "#eef2ff", color: "#2563eb", fontSize: 11, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 999 },

  abstract: { color: "#6b7280", fontSize: 15, lineHeight: 24, marginBottom: 8 },
  keywordContainer: { flexDirection: "row", flexWrap: "wrap", marginBottom: 8 },
  keyword: {
    backgroundColor: "#2563eb", color: "#fff", fontSize: 12,
    paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8, marginRight: 6, marginBottom: 6,
  },
  noResult: { color: "#6b7280", textAlign: "center", marginTop: 20, fontSize: 14 },

  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.68)",
    justifyContent: "center",
    alignItems: "center",
  },
  modal: {
    width: "50%",
    maxHeight: "85%", // Slightly reduced to ensure it fits well on screen
    backgroundColor: "#ffffffff",
    borderRadius: 12,
    overflow: "hidden",
  },
  modalBody: {
    flex: 1,
  },
  modalContent: {
    padding: 30,
    paddingBottom: 10,
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: "#2563EB",
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#ffffffff",
    flex: 1,
    marginRight: 10,
  },
  modalMeta: {
    fontSize: 14,
    color: "#7e8692ff",
    marginBottom: 8,
  },
  summaryBox: {
    backgroundColor: "#bdc7d3ff",
    padding: 16,
    borderRadius: 8,
    marginBottom: 16,
  },
  viewBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#2563EB",
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    marginBottom: 8, // Reduced bottom margin since we have paddingBottom in container
  },
  btnText: { color: "#fff", fontWeight: "700", fontSize: 13 },

  aiToolChip: {
    backgroundColor: "#ffffff", borderWidth: 1, borderColor: "#dbeafe",
    paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999,
  },
  aiToolChipActive: { backgroundColor: "#2563eb", borderColor: "#2563eb" },
  aiToolsRow: { flexDirection: "row", flexWrap: "wrap", marginTop: 10, marginBottom: 12 },
  // copyable citations
  copyRow: { flexDirection: "row", alignItems: "stretch", gap: 8 },
  copyInput: {
    flex: 1, backgroundColor: "#f6f6f9", color: "#0f172a",
    paddingHorizontal: 10, paddingVertical: 10, borderRadius: 8, borderWidth: 1, borderColor: "#eef2ff",
  },
  copyBtn: {
    flexDirection: "row", alignItems: "center", gap: 6,
    backgroundColor: "#2563eb", paddingHorizontal: 12, borderRadius: 8,
  },
  copyText: { color: "#fff", fontWeight: "700", fontSize: 12 },
});