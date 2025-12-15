// app/screens/faculty/index.tsx
import React, { useMemo } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Platform,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import { useFacultyData } from "./useFaculty";
import { useMe } from "./useMe";

/** 🍑 Pastel palette */
const C = {
  bg: "#f6f6f9",
  card: "#ffffff",
  ink: "#0f172a",
  mute: "#6b7280",
  peach: "#ffd9cc",
  pink: "#f8cdd5",
  sand: "#fde9c9",
  mint: "#d6f5e5",
  sky: "#dbeafe",
  lilac: "#ede9fe",
  ring: "#eef2ff",
};

export default function FacultyDashboardHome() {
  const { analytics, studentSubs, myResearch } = useFacultyData();
  const { name } = useMe();

  /** ------- Derived, data-only views ------- */

  // Status counts (data-driven)
  const donut = useMemo(() => {
    const approved = studentSubs.filter((s) => s.status === "approved").length;
    const rejected = studentSubs.filter((s) => s.status === "rejected").length;
    const pending = studentSubs.filter((s) => s.status === "pending").length;
    const total = approved + rejected + pending || 1;
    return {
      approved,
      rejected,
      pending,
      pctApproved: Math.round((approved / total) * 100),
      pctRejected: Math.round((rejected / total) * 100),
      pctPending: Math.round((pending / total) * 100),
      hasAny: approved + rejected + pending > 0,
    };
  }, [studentSubs]);

  // Submissions per month, last 12 months (real timestamps)
  const bars = useMemo(() => {
    if (!studentSubs.length && !myResearch.length) {
      return { labels: [], values: [], max: 1, hasAny: false };
    }
    const now = new Date();
    const keys: string[] = [];
    for (let i = 11; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      keys.push(key);
    }
    const counts: Record<string, number> = Object.fromEntries(keys.map((k) => [k, 0]));
    studentSubs.forEach((s) => {
      const d = new Date(s.createdAt);
      if (!isNaN(d.getTime())) {
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
        if (counts[key] !== undefined) counts[key] += 1;
      }
    });
    myResearch.forEach((r) => {
      const d = new Date(r.createdAt);
      if (!isNaN(d.getTime())) {
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
        if (counts[key] !== undefined) counts[key] += 1;
      }
    });
    const values = keys.map((k) => counts[k]);
    const max = Math.max(1, ...values);
    const labels = keys.map((k) => {
      const m = Number(k.split("-")[1]) - 1;
      return "JFMAMJJASOND".split("")[m];
    });
    const hasAny = values.some((v) => v > 0);
    return { labels, values, max, hasAny };
  }, [studentSubs, myResearch]);

  // Approval rate (data-derived)
  const approvalRate = analytics.total
    ? Math.round((analytics.approved / analytics.total) * 100)
    : 0;

  // Recent lists (data only)
  const recentMyResearch = useMemo(
    () =>
      [...(myResearch || [])]
        .sort((a: any, b: any) => +new Date(b.createdAt) - +new Date(a.createdAt))
        .slice(0, 5),
    [myResearch]
  );

  const pendingSubs = useMemo(
    () =>
      (studentSubs || [])
        .filter((s: any) => s.status === "pending")
        .sort((a: any, b: any) => +new Date(b.createdAt) - +new Date(a.createdAt)),
    [studentSubs]
  );

  const latestSubs = useMemo(
    () =>
      [...(studentSubs || [])]
        .sort((a: any, b: any) => +new Date(b.createdAt) - +new Date(a.createdAt))
        .slice(0, 5),
    [studentSubs]
  );

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      {/* Top App Bar */}
      <View style={styles.topbar}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
          <View style={styles.logoDot} />
          <Text style={styles.appTitle}>Research Repository</Text>
        </View>

        <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
          <View style={styles.avatar}>
            <Ionicons name="person-circle-outline" size={20} color="#2563eb" />
          </View>
          <Text style={styles.userName} numberOfLines={1}>
            {name || "Faculty"}
          </Text>

          <TouchableOpacity style={styles.iconBtn} onPress={() => router.push("/repository")}>
            <Ionicons name="book-outline" size={18} color={C.ink} />
          </TouchableOpacity>
          <TouchableOpacity style={styles.iconBtn} onPress={() => router.push("/login")}>
            <Ionicons name="log-out-outline" size={18} color={C.ink} />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.container}>
        {/* Hero / Welcome */}
        <View style={styles.heroRow}>
          <LinearGradient
            colors={[C.peach, C.pink]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={[styles.heroCard, styles.shadow]}
          >
            <Text style={styles.heroHi}>Welcome</Text>
            <Text style={styles.heroName}>Professor {name || "Faculty"}</Text>
            <Text style={styles.heroSub}>Manage research, review submissions, and track progress.</Text>

            <View style={styles.heroActions}>
              <DashButton icon="book-outline" label="My Research" onPress={() => router.push("/faculty/research")} />
              <DashButton icon="document-text-outline" label="Student Works" onPress={() => router.push("/faculty/submissions")} />
              <DashButton icon="stats-chart-outline" label="Analytics" onPress={() => router.push("/faculty/analytics")} />
            </View>
          </LinearGradient>

          {/* Inbox shows real pending only; hidden if none */}
          {analytics.pending > 0 ? (
            <View style={[styles.inboxCard, styles.shadow]}>
              <Text style={styles.inboxTitle}>Inbox</Text>
              <Text style={styles.inboxCount}>{analytics.pending}</Text>
              <Text style={styles.inboxHint}>Pending reviews</Text>

              <TouchableOpacity
                style={styles.inlineLink}
                onPress={() => router.push("/faculty/submissions")}
              >
                <Text style={styles.inlineLinkText}>Open Submissions</Text>
                <Ionicons name="arrow-forward" size={16} color={C.ink} />
              </TouchableOpacity>
            </View>
          ) : null}
        </View>

        {/* KPI Stat Cards (always real values; zeros allowed) */}
        <View style={styles.grid3}>
          <Stat icon="document-text-outline" value={analytics.myResearchCount} label="My Research" bg={C.sky} ic="#2563eb" />
          <Stat icon="people-outline" value={analytics.total} label="Advisees" bg={C.mint} ic="#059669" />
          <Stat icon="time-outline" value={analytics.pending} label="Pending" bg={C.sand} ic="#d97706" />
        </View>

        {/* Charts Row – only render when there is actual data */}
        {(donut.hasAny || bars.hasAny || analytics.total > 0) && (
          <View style={styles.chartsRow}>
            {donut.hasAny ? (
              <Card title="Intake Status" subtitle="Approved / Rejected / Pending" tone={C.lilac}>
                <MiniDonut
                  approved={donut.approved}
                  rejected={donut.rejected}
                  pending={donut.pending}
                  pctApproved={donut.pctApproved}
                  pctRejected={donut.pctRejected}
                  pctPending={donut.pctPending}
                />
              </Card>
            ) : null}

            {bars.hasAny ? (
              <Card title="Work Intensity" subtitle="Submissions per month (12 mo)" tone={C.sky}>
                <MiniBars labels={bars.labels} values={bars.values} max={bars.max} />
              </Card>
            ) : null}

            {analytics.total > 0 ? (
              <Card title="Approval Rate" subtitle="Share of approved advisees" tone={C.mint}>
                <MiniGauge value={approvalRate} />
              </Card>
            ) : null}
          </View>
        )}

        {/* Recent: My Research (only if you actually have items) */}
        {recentMyResearch.length > 0 && (
          <View style={styles.cardList}>
            <Text style={styles.listTitle}>Recent My Research</Text>
            {recentMyResearch.map((r: any) => (
              <RowItem
                key={r._id}
                iconBg="#dbeafe"
                icon="document-text"
                title={r.title}
                sub={`Uploaded ${new Date(r.createdAt).toLocaleDateString()}`}
                onPress={() => router.push("/faculty/research")}
              />
            ))}
          </View>
        )}

        {/* Review Queue – Pending only (shows top 5) */}
        {pendingSubs.length > 0 && (
          <View style={styles.cardList}>
            <Text style={styles.listTitle}>Pending Reviews</Text>
            {pendingSubs.slice(0, 5).map((s: any) => (
              <RowItem
                key={s._id}
                iconBg="#fde9c9"
                icon="time-outline"
                title={s.title}
                sub={`by ${s.author || "Unknown"} • ${new Date(s.createdAt).toLocaleDateString()}`}
                onPress={() => router.push("/faculty/submissions")}
              />
            ))}
          </View>
        )}

        {/* Latest Student Submissions (only if any) */}
        {latestSubs.length > 0 && (
          <View style={styles.cardList}>
            <Text style={styles.listTitle}>Latest Student Submissions</Text>
            {latestSubs.map((s: any) => (
              <RowItem
                key={s._id}
                iconBg="#dcfce7"
                icon={s.status === "approved" ? "checkmark-circle-outline" : s.status === "rejected" ? "close-circle-outline" : "document-outline"}
                title={s.title}
                sub={`${s.status.toUpperCase()} • ${new Date(s.createdAt).toLocaleDateString()}`}
                onPress={() => router.push("/faculty/submissions")}
              />
            ))}
          </View>
        )}

        {/* Quick Links – keep if useful */}
        <View style={styles.quickLinks}>
          <QLink
            color="#2563eb"
            bg="#e0e7ff"
            icon="add-circle-outline"
            title="Upload a Paper"
            caption="Add your own research"
            onPress={() => router.push("/faculty/research")}
          />
          <QLink
            color="#7c3aed"
            bg="#ede9fe"
            icon="pricetags-outline"
            title="Repository"
            caption="Browse collections"
            onPress={() => router.push("/repository")}
          />
         
        </View>
      </ScrollView>
    </View>
  );
}

/* ---------- Small components ---------- */

function DashButton({ icon, label, onPress }: { icon: any; label: string; onPress: () => void }) {
  return (
    <TouchableOpacity onPress={onPress} style={styles.dashBtn}>
      <Ionicons name={icon} size={16} color={C.ink} />
      <Text style={styles.dashBtnText}>{label}</Text>
    </TouchableOpacity>
  );
}

function Stat({ icon, value, label, bg, ic }: { icon: any; value: number | string; label: string; bg: string; ic: string }) {
  return (
    <View style={[styles.statCard, styles.shadow, { backgroundColor: bg }]}>
      <Ionicons name={icon} size={22} color={ic} />
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

function Card({ title, subtitle, tone, children }: { title: string; subtitle?: string; tone?: string; children?: React.ReactNode }) {
  return (
    <View style={[styles.card, styles.shadow, tone ? { backgroundColor: "#fff", borderColor: tone } : null]}>
      <Text style={styles.cardTitle}>{title}</Text>
      {subtitle ? <Text style={styles.cardSub}>{subtitle}</Text> : null}
      <View style={{ marginTop: 10 }}>{children}</View>
    </View>
  );
}

/** Data-driven donut legend (visual ring is decorative; numbers are real) */
function MiniDonut({
  approved,
  rejected,
  pending,
  pctApproved,
  pctRejected,
  pctPending,
}: {
  approved: number;
  rejected: number;
  pending: number;
  pctApproved: number;
  pctRejected: number;
  pctPending: number;
}) {
  return (
    <View style={styles.donutWrap}>
      <View style={styles.donutOuter}>
        <View style={styles.donutInner} />
      </View>
      <View>
        <Legend color="#22c55e" label={`Approved (${approved}, ${pctApproved}%)`} />
        <Legend color="#ef4444" label={`Rejected (${rejected}, ${pctRejected}%)`} />
        <Legend color="#f59e0b" label={`Pending (${pending}, ${pctPending}%)`} />
      </View>
    </View>
  );
}

/** Bars from values & labels (scaled to max) */
function MiniBars({ labels, values, max }: { labels: string[]; values: number[]; max: number }) {
  return (
    <View style={{ gap: 8 }}>
      <View style={styles.barsWrap}>
        {values.map((v, i) => {
          const h = Math.round((v / max) * 100);
          return <View key={i} style={[styles.bar, { height: 20 + h }]} />;
        })}
      </View>
      <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
        {labels.map((l, i) => (
          <Text key={i} style={{ color: C.mute, fontSize: 10, fontWeight: "700" }}>
            {l}
          </Text>
        ))}
      </View>
    </View>
  );
}

function MiniGauge({ value }: { value: number }) {
  const clamped = Math.max(0, Math.min(100, value));
  return (
    <View style={styles.gaugeWrap}>
      <View style={styles.gaugeTrack}>
        <View style={[styles.gaugeFill, { width: `${clamped}%` }]} />
      </View>
      <Text style={styles.gaugeText}>{clamped}%</Text>
    </View>
  );
}

function QLink({
  color,
  bg,
  icon,
  title,
  caption,
  onPress,
}: {
  color: string;
  bg: string;
  icon: any;
  title: string;
  caption: string;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity onPress={onPress} style={[styles.qLink, styles.shadow, { backgroundColor: bg }]}>
      <View style={[styles.qIcon, { backgroundColor: "#fff" }]}>
        <Ionicons name={icon} size={18} color={color} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={[styles.qTitle, { color }]}>{title}</Text>
        <Text style={styles.qCaption}>{caption}</Text>
      </View>
      <Ionicons name="chevron-forward" size={18} color={color} />
    </TouchableOpacity>
  );
}

function RowItem({
  iconBg,
  icon,
  title,
  sub,
  onPress,
}: {
  iconBg: string;
  icon: any;
  title: string;
  sub?: string;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity onPress={onPress} style={styles.rowItem}>
      <View style={[styles.rowIcon, { backgroundColor: iconBg }]}>
        <Ionicons name={icon} size={18} color="#0f172a" />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.rowTitle} numberOfLines={1}>
          {title}
        </Text>
        {sub ? (
          <Text style={styles.rowSub} numberOfLines={1}>
            {sub}
          </Text>
        ) : null}
      </View>
      <Ionicons name="chevron-forward" size={18} color="#64748b" />
    </TouchableOpacity>
  );
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginVertical: 3 }}>
      <View style={{ width: 10, height: 10, borderRadius: 2, backgroundColor: color }} />
      <Text style={{ color: C.mute, fontWeight: "600" }}>{label}</Text>
    </View>
  );
}

/* ---------- Styles ---------- */

const styles = StyleSheet.create({
  topbar: {
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

  container: { padding: 18, paddingBottom: 36, gap: 14 },

  heroRow: { flexDirection: "row", gap: 14 },
  heroCard: { flex: 1, borderRadius: 18, padding: 18, minHeight: 150 },
  heroHi: { color: C.ink, fontWeight: "800", fontSize: 13, opacity: 0.8 },
  heroName: { color: C.ink, fontWeight: "900", fontSize: 24, marginTop: 2 },
  heroSub: { color: C.ink, opacity: 0.8, marginTop: 6 },

  heroActions: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 12 },
  dashBtn: {
    backgroundColor: "rgba(255,255,255,0.75)",
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  dashBtnText: { color: C.ink, fontWeight: "800", fontSize: 12 },

  inboxCard: {
    width: 180,
    backgroundColor: C.card,
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: C.ring,
  },
  inboxTitle: { color: C.mute, fontWeight: "700", fontSize: 12 },
  inboxCount: { color: C.ink, fontWeight: "900", fontSize: 42, marginTop: 4 },
  inboxHint: { color: C.mute, fontWeight: "600", marginTop: 2 },
  inlineLink: {
    marginTop: 10,
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 10,
    backgroundColor: "#f1f5f9",
  },
  inlineLinkText: { color: C.ink, fontWeight: "700" },

  grid3: { flexDirection: "row", gap: 14 },
  statCard: {
    flex: 1,
    padding: 16,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: C.ring,
    alignItems: "center",
  },
  statValue: { fontSize: 26, fontWeight: "900", color: C.ink, marginTop: 8 },
  statLabel: { color: C.mute, fontWeight: "700", marginTop: 2 },

  chartsRow: { flexDirection: "row", gap: 14 },
  card: {
    flex: 1,
    backgroundColor: "#fff",
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: C.ring,
    minHeight: 160,
  },
  cardTitle: { color: C.ink, fontWeight: "900", fontSize: 14 },
  cardSub: { color: C.mute, fontWeight: "600", fontSize: 12, marginTop: 2 },

  donutWrap: { flexDirection: "row", alignItems: "center", gap: 14 },
  donutOuter: {
    width: 72,
    height: 72,
    borderRadius: 72,
    borderWidth: 10,
    borderColor: "#22c55e",
    borderRightColor: "#ef4444",
    borderBottomColor: "#f59e0b",
    transform: [{ rotateZ: "20deg" }],
    backgroundColor: "#fff",
  },
  donutInner: {
    position: "absolute",
    left: 16,
    top: 16,
    width: 40,
    height: 40,
    borderRadius: 40,
    backgroundColor: "#fff",
  },

  barsWrap: { flexDirection: "row", alignItems: "flex-end", gap: 8, height: 110 },
  bar: { width: 16, borderRadius: 8, backgroundColor: "#60a5fa" },

  gaugeWrap: { marginTop: 2 },
  gaugeTrack: { width: "100%", height: 10, backgroundColor: "#e5e7eb", borderRadius: 999, overflow: "hidden" },
  gaugeFill: { height: 10, backgroundColor: "#a78bfa", borderRadius: 999 },
  gaugeText: { marginTop: 8, color: C.ink, fontWeight: "900" },

  cardList: {
    backgroundColor: "#fff",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: C.ring,
    padding: 12,
    gap: 6,
  },
  listTitle: { fontWeight: "900", color: C.ink, marginBottom: 6 },

  rowItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: "#f1f5f9",
  },
  rowIcon: {
    width: 34,
    height: 34,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  rowTitle: { color: C.ink, fontWeight: "800" },
  rowSub: { color: C.mute, fontWeight: "600", fontSize: 12 },

  quickLinks: { flexDirection: "row", gap: 14 },
  qLink: {
    flex: 1,
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: C.ring,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  qIcon: { width: 34, height: 34, borderRadius: 10, justifyContent: "center", alignItems: "center" },

  qTitle: { fontWeight: "900" },
  qCaption: { color: C.mute, fontWeight: "600" },

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

  shadow: Platform.select({
    ios: { shadowColor: "#000", shadowOpacity: 0.06, shadowRadius: 8, shadowOffset: { width: 0, height: 4 } },
    android: { elevation: 2 },
    default: {},
  }),
});
