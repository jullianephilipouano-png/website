// app/staff/publishing.tsx
import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Alert,
  Platform,
  Linking,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, router } from "expo-router";
import api from "../../lib/api";
import { getToken } from "../../lib/auth";

/** 🎨 Matching Faculty Pastel Palette */
const C = {
  bg: "#f6f6f9",
  card: "#ffffff",
  ink: "#0f172a",
  mute: "#6b7280",
  ring: "#eef2ff",
};

type Visibility = "campus" | "public";

type ResearchItem = {
  _id: string;
  title?: string;
  author?: string;
    coAuthors?: string[] | string; 
  year?: string | number;
  keywords?: string[] | string;
  createdAt?: string;

  // publishing/taxonomy
  visibility?: Visibility | "private" | "embargo";
  landingPageUrl?: string | null;
  categories?: string[];
  genreTags?: string[];

  // optional display
  fileName?: string;
  uploaderRole?: "student" | "faculty" | "staff" | "admin";
};

type FacetEntry = { name: string; count: number };

const toCsv = (v?: string[] | string | null) => {
  if (!v) return "";
  if (Array.isArray(v)) return v.join(", ");
  return v;
};
const toArray = (csv: string) =>
  (csv || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

export default function PublishingScreen() {
  const { id } = useLocalSearchParams<{ id?: string }>();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [coAuthors, setCoAuthors] = useState("");

  // list mode (when no id param)
  const [list, setList] = useState<ResearchItem[]>([]);
  const [search, setSearch] = useState("");

  // edit mode
  const [doc, setDoc] = useState<ResearchItem | null>(null);
  const [title, setTitle] = useState("");
  const [author, setAuthor] = useState("");
  const [year, setYear] = useState("");
  const [keywords, setKeywords] = useState("");

  const [pubType, setPubType] = useState<Visibility>("campus"); // campus | public
  const [landingPageUrl, setLandingPageUrl] = useState("");
  const [categoriesCsv, setCategoriesCsv] = useState("");
  const [genreTagsCsv, setGenreTagsCsv] = useState("");

  // facets for quick-pick
  const [facetCats, setFacetCats] = useState<FacetEntry[]>([]);
  const [facetTags, setFacetTags] = useState<FacetEntry[]>([]);
  const [facetsLoading, setFacetsLoading] = useState(false);

  const hydrateForm = useCallback((r: ResearchItem) => {
    setDoc(r);
    setTitle(r.title || "");
    setAuthor(r.author || "");
    setCoAuthors(
  Array.isArray(r.coAuthors)
    ? r.coAuthors.join(", ")
    : (r.coAuthors as string) || ""
);

    setYear(r.year ? String(r.year) : "");
    setKeywords(toCsv(r.keywords));
    const vis = (r.visibility === "public" ? "public" : "campus") as Visibility;
    setPubType(vis);
    setLandingPageUrl(r.landingPageUrl || "");
    setCategoriesCsv(toCsv(r.categories));
    setGenreTagsCsv(toCsv(r.genreTags));
  }, []);

  const fetchList = useCallback(async () => {
    setLoading(true);
    try {
      const token = await getToken();
      const r = await api.get(`/research-admin`, {
        headers: { Authorization: `Bearer ${token.token}` },
        params: { sort: "latest", status: "approved" },
      });
      const data: ResearchItem[] = r?.data?.data ?? r?.data ?? [];
      setList(data);
    } catch (err: any) {
      console.error("❌ Load list failed:", err?.response?.data || err);
      Alert.alert("Error", "Failed to load research list.");
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchFacets = useCallback(async () => {
    try {
      setFacetsLoading(true);
      const token = await getToken();
      const r = await api.get(`/repository/facets`, {
        headers: { Authorization: `Bearer ${token.token}` },
      });
      setFacetCats(r?.data?.categories || []);
      setFacetTags(r?.data?.genreTags || []);
    } catch (err) {
      // facets are optional; don't noisy-alert
      console.warn("Facet load failed:", err?.response?.data || err);
    } finally {
      setFacetsLoading(false);
    }
  }, []);

  const fetchOne = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    try {
      const token = await getToken();

      // try to GET /research-admin/:id if available
      let item: ResearchItem | null = null;
      try {
        const r = await api.get(`/research-admin/${id}`, {
          headers: { Authorization: `Bearer ${token.token}` },
        });
        item = (r?.data?.data ?? r?.data) || null;
      } catch {
        // fallback: list and pick
        const r2 = await api.get(`/research-admin`, {
          headers: { Authorization: `Bearer ${token.token}` },
        });
        const arr: ResearchItem[] = r2?.data?.data ?? r2?.data ?? [];
        item = arr.find((x) => String(x._id) === String(id)) || null;
      }

      if (!item) {
        Alert.alert("Not found", "Research item not found.");
        router.back();
        return;
      }
      hydrateForm(item);
      // optionally pull facets for quick-pick
      fetchFacets();
    } catch (err: any) {
      console.error("❌ Load item failed:", err?.response?.data || err);
      Alert.alert("Error", "Failed to load research item.");
      router.back();
    } finally {
      setLoading(false);
    }
  }, [hydrateForm, id, fetchFacets]);

  useEffect(() => {
    if (id) fetchOne();
    else fetchList();
  }, [id, fetchList, fetchOne]);

const filtered = useMemo(() => {
  const q = search.trim().toLowerCase();
  if (!q) return list;

  return list.filter((r) => {
    const kws = Array.isArray(r.keywords)
      ? r.keywords
      : toCsv(r.keywords)
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean);

    const coAuths = Array.isArray(r.coAuthors)
      ? r.coAuthors
      : (r.coAuthors || "")
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean);

    return (
      (r.title || "").toLowerCase().includes(q) ||
      (r.author || "").toLowerCase().includes(q) ||
      coAuths.some((a) => a.toLowerCase().includes(q)) || // ✅ added
      kws.some((k) => k.toLowerCase().includes(q)) ||
      (r.year ? String(r.year).includes(q) : false)
    );
  });
}, [list, search]);


  const addChip = (currentCsv: string, setCsv: (v: string) => void, value: string) => {
    const arr = toArray(currentCsv);
    if (!arr.includes(value)) {
      arr.push(value);
      setCsv(arr.join(", "));
    }
  };

  const removeChip = (currentCsv: string, setCsv: (v: string) => void, value: string) => {
    const arr = toArray(currentCsv).filter((x) => x !== value);
    setCsv(arr.join(", "));
  };

  const isValidUrl = (url: string) => /^https?:\/\//i.test(url.trim());

  const saveAll = async () => {
    if (!doc) return;

    if (pubType === "public") {
      const url = (landingPageUrl || "").trim();
      if (!url || !isValidUrl(url)) {
        Alert.alert("Landing page URL required", "Provide a valid http(s) URL to publish online.");
        return;
      }
    }

    // Optional: basic year clean-up (stringified, but must be 4 digits if provided)
    const yearTrim = year.trim();
    if (yearTrim && !/^\d{4}$/.test(yearTrim)) {
      Alert.alert("Check Year", "Year should be a 4-digit value like 2025.");
      return;
    }

    try {
      setSaving(true);
      const token = await getToken();

      await api.put(
        `/research-admin/${doc._id}`,
        {
          // publish type – backend accepts these and clears allow-list/embargo via the visibility endpoint or update
          visibility: pubType,
          allowedViewers: [], // ensure none from this screen
          embargoUntil: null,

          // metadata
          title: title.trim(),
          author: author.trim(),
          coAuthors: coAuthors
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean), 
          year: yearTrim,
          keywords, // backend may split comma → array

          // taxonomy & landing
          landingPageUrl: pubType === "public" ? landingPageUrl.trim() : null,
          categories: toArray(categoriesCsv),
          genreTags: toArray(genreTagsCsv),
        },
        { headers: { Authorization: `Bearer ${token.token}` } }
      );

      Alert.alert("✅ Saved", "Publishing & taxonomy updated.");
      if (id) router.back();
      else fetchList();
    } catch (err: any) {
      console.error("❌ Save failed:", err?.response?.data || err);
      Alert.alert("Error", err?.response?.data?.error || "Failed to save changes.");
    } finally {
      setSaving(false);
    }
  };

  // ---------- RENDER ----------
  if (loading) {
    return (
      <View style={[styles.container, { justifyContent: "center", alignItems: "center" }]}>
        <ActivityIndicator size="large" color="#2563eb" />
        <Text style={{ color: C.mute, marginTop: 10 }}>Loading…</Text>
      </View>
    );
  }

  // LIST MODE (no id) → pick an item to manage
  if (!id) {
    return (
      <View style={styles.container}>
        <View style={styles.topBar}>
          <TouchableOpacity style={styles.topBtn} onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={18} color="#fff" />
            <Text style={styles.topBtnText}>Back</Text>
          </TouchableOpacity>

          <View style={[styles.searchBar]}>
            <Ionicons name="search-outline" size={18} color={C.mute} />
            <TextInput
              placeholder="Search title, author, keyword, year…"
              placeholderTextColor={C.mute}
              value={search}
              onChangeText={setSearch}
              style={styles.searchInput}
              autoCapitalize="none"
              autoCorrect={false}
            />
            {search ? (
              <TouchableOpacity onPress={() => setSearch("")}>
                <Ionicons name="close-circle" size={18} color={C.mute} />
              </TouchableOpacity>
            ) : null}
          </View>
        </View>

        <ScrollView contentContainerStyle={styles.scroll}>
          <Text style={styles.header}>Publishing & Taxonomy – Select a paper</Text>

          {filtered.length === 0 ? (
            <Text style={styles.noResult}>No results.</Text>
          ) : (
            filtered.map((r) => {
              const vis = (r.visibility === "public" ? "public" : "campus") as Visibility;
              return (
                <View key={r._id} style={styles.card}>
                  <Text style={styles.title}>{r.title || "(Untitled)"}</Text>
                <Text style={styles.meta}>Author: {r.author || "—"}</Text>
{r.coAuthors && (Array.isArray(r.coAuthors) ? r.coAuthors.length > 0 : r.coAuthors.trim() !== "") ? (
  <Text style={styles.meta}>
    Co-authors: {Array.isArray(r.coAuthors) ? r.coAuthors.join(", ") : r.coAuthors}
  </Text>
) : null}

                  <Text style={styles.meta}>Year: {r.year || "—"}</Text>
                  <Text style={styles.meta}>
                    Uploaded: {r.createdAt ? new Date(r.createdAt).toLocaleDateString() : "—"}
                  </Text>

                  {/* visibility badge */}
                  <View style={styles.badgeRow}>
                    <View style={[styles.badge, vis === "public" ? styles.badgePublic : styles.badgeCampus]}>
                      <Ionicons
                        name={vis === "public" ? "globe-outline" : "people-outline"}
                        size={14}
                        color="#fff"
                      />
                      <Text style={styles.badgeText}>{vis.toUpperCase()}</Text>
                    </View>
                  </View>

                  {/* quick peek of categories/tags if any */}
                  {(r.categories?.length || r.genreTags?.length) ? (
                    <View style={{ marginTop: 6 }}>
                      <View style={styles.chipsRow}>
                        {(r.categories || []).slice(0, 4).map((c) => (
                          <Text key={`c-${r._id}-${c}`} style={styles.smallChip}>#{c}</Text>
                        ))}
                        {(r.genreTags || []).slice(0, 4).map((t) => (
                          <Text key={`t-${r._id}-${t}`} style={styles.smallChipAlt}>#{t}</Text>
                        ))}
                      </View>
                    </View>
                  ) : null}

                  <View style={{ height: 8 }} />

                  <TouchableOpacity
                    style={[styles.actionBtn, { backgroundColor: "#6366f1" }]}
                    onPress={() =>
                      router.push({ pathname: "/staff/publishing", params: { id: String(r._id) } })
                    }
                  >
                    <Ionicons name="pricetags-outline" size={18} color="#fff" />
                    <Text style={styles.btnText}>Manage Publishing & Taxonomy</Text>
                  </TouchableOpacity>
                </View>
              );
            })
          )}

          <View style={{ height: 24 }} />
        </ScrollView>
      </View>
    );
  }

  // EDIT MODE (id present)
  return (
    <View style={styles.container}>
      {/* Top bar */}
      <View style={styles.topBar}>
        <TouchableOpacity style={styles.topBtn} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={18} color="#fff" />
          <Text style={styles.topBtnText}>Back</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.topBtn, { backgroundColor: "#10B981" }]}
          onPress={saveAll}
          disabled={saving}
        >
          {saving ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <>
              <Ionicons name="save-outline" size={18} color="#fff" />
              <Text style={styles.topBtnText}>Save</Text>
            </>
          )}
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <Text style={styles.header}>Publishing & Taxonomy</Text>
        {doc ? (
          <Text style={styles.subHeader}>{doc.title || "(Untitled)"} • {doc.author || "—"}</Text>
        ) : null}

        {/* Publish Type */}
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Publish Type</Text>
          <View style={styles.segmentRow}>
            <TouchableOpacity
              onPress={() => setPubType("campus")}
              style={[styles.segmentBtn, pubType === "campus" && styles.segmentActive]}
            >
              <Ionicons
                name="people-outline"
                size={16}
                color={pubType === "campus" ? "#fff" : "#2563eb"}
              />
              <Text style={[styles.segmentText, pubType === "campus" && styles.segmentTextActive]}>
                Campus only
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => setPubType("public")}
              style={[styles.segmentBtn, pubType === "public" && styles.segmentActive]}
            >
              <Ionicons
                name="globe-outline"
                size={16}
                color={pubType === "public" ? "#fff" : "#2563eb"}
              />
              <Text style={[styles.segmentText, pubType === "public" && styles.segmentTextActive]}>
                Public online
              </Text>
            </TouchableOpacity>
          </View>

          {pubType === "public" && (
            <>
              <Text style={styles.label}>Landing Page URL (required for public)</Text>
              <TextInput
                style={styles.input}
                placeholder="https://example.edu/repo/handle/1234"
                value={landingPageUrl}
                onChangeText={setLandingPageUrl}
                autoCapitalize="none"
                autoCorrect={false}
              />
              {!!landingPageUrl && isValidUrl(landingPageUrl) && (
                <TouchableOpacity
                  style={[styles.linkBtn]}
                  onPress={() => Linking.openURL(landingPageUrl)}
                >
                  <Ionicons name="open-outline" size={16} color="#2563eb" />
                  <Text style={styles.linkBtnText}>Open landing page</Text>
                </TouchableOpacity>
              )}
            </>
          )}
        </View>

        {/* Metadata */}
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Metadata</Text>

          <Text style={styles.label}>Title</Text>
          <TextInput style={styles.input} value={title} onChangeText={setTitle} placeholder="Title" />

          <Text style={styles.label}>Author</Text>
          <TextInput
            style={styles.input}
            value={author}
            onChangeText={setAuthor}
            placeholder="Author"
          />
          <Text style={styles.label}>Co-Authors (comma-separated)</Text>
              <TextInput
                style={styles.input}
                value={coAuthors}
                onChangeText={setCoAuthors}
                placeholder="e.g. luis.orong@g.msuiit.edu.ph, "
                autoCapitalize="none"
                autoCorrect={false}
              />


          <Text style={styles.label}>Year</Text>
          <TextInput
            style={styles.input}
            value={year}
            onChangeText={setYear}
            placeholder="YYYY"
            keyboardType={Platform.OS === "ios" ? "number-pad" : "numeric"}
          />

          <Text style={styles.label}>Keywords (comma-separated)</Text>
          <TextInput
            style={styles.input}
            value={keywords}
            onChangeText={setKeywords}
            placeholder="gait, sensors, biomechanics"
            autoCapitalize="none"
            autoCorrect={false}
          />
        </View>

        {/* Taxonomy */}
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Taxonomy</Text>

          <Text style={styles.label}>Categories (comma-separated)</Text>
          <TextInput
            style={styles.input}
            value={categoriesCsv}
            onChangeText={setCategoriesCsv}
            placeholder="Thesis, Physics, Materials Science"
            autoCapitalize="words"
            autoCorrect={false}
          />

          {/* quick-pick categories */}
          <View style={styles.quickRow}>
            <Text style={styles.quickLabel}>Suggestions</Text>
            {facetsLoading ? (
              <ActivityIndicator size="small" color="#2563eb" />
            ) : null}
          </View>
          <View style={styles.chipsRow}>
            {facetCats.slice(0, 12).map((c) => {
              const selected = toArray(categoriesCsv).includes(c.name);
              return (
                <TouchableOpacity
                  key={`cat-${c.name}`}
                  onPress={() =>
                    selected
                      ? removeChip(categoriesCsv, setCategoriesCsv, c.name)
                      : addChip(categoriesCsv, setCategoriesCsv, c.name)
                  }
                  style={[styles.chip, selected && styles.chipActive]}
                >
                  <Text style={[styles.chipText, selected && styles.chipTextActive]}>
                    {c.name} ({c.count})
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          <Text style={[styles.label, { marginTop: 10 }]}>Genre Tags (comma-separated)</Text>
          <TextInput
            style={styles.input}
            value={genreTagsCsv}
            onChangeText={setGenreTagsCsv}
            placeholder="Undergraduate, Experimental, Gait"
            autoCapitalize="words"
            autoCorrect={false}
          />

          {/* quick-pick tags */}
          <View style={styles.chipsRow}>
            {facetTags.slice(0, 14).map((t) => {
              const selected = toArray(genreTagsCsv).includes(t.name);
              return (
                <TouchableOpacity
                  key={`tag-${t.name}`}
                  onPress={() =>
                    selected
                      ? removeChip(genreTagsCsv, setGenreTagsCsv, t.name)
                      : addChip(genreTagsCsv, setGenreTagsCsv, t.name)
                  }
                  style={[styles.chipAlt, selected && styles.chipAltActive]}
                >
                  <Text style={[styles.chipText, selected && styles.chipTextActive]}>
                    {t.name} ({t.count})
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        <View style={{ height: 24 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg },
  topBar: {
    width: "100%",
    paddingTop: 14,
    paddingHorizontal: 14,
    paddingBottom: 14,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: "#fff",
    borderBottomWidth: 1,
    borderBottomColor: C.ring,
  },
  topBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#2563eb",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
  },
  topBtnText: { color: "#fff", fontWeight: "700" },

  scroll: { padding: 16, paddingBottom: 40 },
  header: {
    color: C.ink,
    fontSize: 22,
    fontWeight: "900",
    marginBottom: 6,
    textAlign: "left",
  },
  subHeader: { color: C.mute, marginBottom: 12, fontWeight: "600" },

  searchBar: {
    flex: 1,
    marginLeft: 10,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: C.card,
    borderWidth: 1,
    borderColor: C.ring,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 8,
  },
  searchInput: { flex: 1, color: C.ink, fontSize: 14 },

  noResult: { color: C.mute, textAlign: "center", marginTop: 30 },

  card: {
    backgroundColor: C.card,
    borderWidth: 1,
    borderColor: C.ring,
    borderRadius: 12,
    padding: 14,
    marginBottom: 12,
    ...Platform.select({
      ios: { shadowColor: "#000", shadowOpacity: 0.06, shadowRadius: 8, shadowOffset: { width: 0, height: 4 } },
      android: { elevation: 2 },
    }),
  },
  title: { color: C.ink, fontWeight: "800", fontSize: 16, marginBottom: 6 },
  meta: { color: C.mute, fontSize: 13, fontWeight: "600" },

  badgeRow: { marginTop: 6, flexDirection: "row" },
  badge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  badgePublic: { backgroundColor: "#059669" },
  badgeCampus: { backgroundColor: "#2563eb" },
  badgeText: { color: "#fff", fontSize: 12, fontWeight: "700" },

  sectionTitle: { color: C.ink, fontWeight: "900", fontSize: 16, marginBottom: 10 },
  label: { color: C.mute, marginTop: 8, marginBottom: 4, fontSize: 12, fontWeight: "700" },

  input: {
    backgroundColor: "#f9fafb",
    borderWidth: 1,
    borderColor: C.ring,
    borderRadius: 8,
    padding: 10,
    fontSize: 14,
    color: C.ink,
  },

  segmentRow: {
    flexDirection: "row",
    gap: 8,
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  segmentBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#f1f5f9",
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: C.ring,
  },
  segmentActive: {
    backgroundColor: "#2563eb",
    borderColor: "#2563eb",
  },
  segmentText: { color: C.mute, fontWeight: "700", fontSize: 12 },
  segmentTextActive: { color: "#fff" },

  actionBtn: {
    marginTop: 10,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 8,
    paddingVertical: 10,
    gap: 6,
  },
  btnText: { color: "#fff", fontWeight: "700", fontSize: 13 },

  chipsRow: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 8 },
  chip: {
    backgroundColor: "#f1f5f9",
    borderWidth: 1,
    borderColor: C.ring,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
  },
  chipActive: { backgroundColor: "#2563eb", borderColor: "#2563eb" },
  chipAlt: {
    backgroundColor: "#f0fdf4",
    borderWidth: 1,
    borderColor: "#bbf7d0",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
  },
  chipAltActive: { backgroundColor: "#059669", borderColor: "#059669" },
  chipText: { color: C.mute, fontSize: 12, fontWeight: "700" },
  chipTextActive: { color: "#fff" },

  smallChip: {
    backgroundColor: "#dbeafe",
    color: "#2563eb",
    fontSize: 11,
    fontWeight: "700",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
    marginRight: 6,
    marginBottom: 6,
  },
  smallChipAlt: {
    backgroundColor: "#dcfce7",
    color: "#059669",
    fontSize: 11,
    fontWeight: "700",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
    marginRight: 6,
    marginBottom: 6,
  },

  linkBtn: {
    marginTop: 8,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    alignSelf: "flex-start",
    backgroundColor: "#f1f5f9",
    borderColor: C.ring,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  linkBtnText: { color: "#2563eb", fontWeight: "700", fontSize: 12 },
  
  quickRow: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 8 },
  quickLabel: { color: C.mute, fontSize: 12, fontWeight: "700" },
});