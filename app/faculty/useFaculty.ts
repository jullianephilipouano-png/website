import { useCallback, useEffect, useMemo, useState } from "react";
import { Alert, Linking, Platform } from "react-native";
import { getToken, removeToken } from "../../lib/auth";
import api from "../../lib/api";
import axios from "axios";
import { router } from "expo-router";

export type Status = "pending" | "approved" | "rejected";
export type SubmissionType = "draft" | "final";
export type Visibility = "public" | "campus" | "private" | "embargo";

export type ResearchPaper = {
  _id: string;
  title: string;
  abstract: string;
  author: string;
  adviser?: string;
  student?: string;
  status: Status;
  createdAt: string;
  updatedAt?: string;
  fileName?: string;
  fileType?: string;
  submissionType?: SubmissionType;
  visibility?: Visibility;
};

export const normalizeType = (p: ResearchPaper): SubmissionType =>
  p.submissionType ? p.submissionType : p.status === "approved" ? "final" : "draft";

export function useFacultyData() {
  const [myResearch, setMyResearch] = useState<ResearchPaper[]>([]);
  const [studentSubs, setStudentSubs] = useState<ResearchPaper[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchAll = useCallback(async () => {
    try {
      const token = await getToken();
      if (!token?.token) throw new Error("No token found");

      const [myRes, studentRes] = await Promise.all([
        api.get("/faculty/my-research", { headers: { Authorization: `Bearer ${token.token}` } }),
        api.get("/faculty/student-submissions", { headers: { Authorization: `Bearer ${token.token}` } }),
      ]);

      const myArr: ResearchPaper[] = Array.isArray(myRes.data) ? myRes.data : [];
      const stuArr: ResearchPaper[] = Array.isArray(studentRes.data) ? studentRes.data : [];

      setMyResearch(myArr.map((p) => ({ ...p, submissionType: normalizeType(p) })));
      setStudentSubs(stuArr.map((p) => ({ ...p, submissionType: normalizeType(p) })));
    } catch (err) {
      console.error("❌ Failed to fetch:", err);
      Alert.alert("Error", "Failed to load faculty data.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const token = await getToken();
        if (!token?.token) {
          await removeToken();
          router.replace("/login");
          return;
        }
        await fetchAll();
      } catch {
        await removeToken();
        router.replace("/login");
      }
    })();
  }, [fetchAll]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchAll();
  }, [fetchAll]);

  const reviewSubmission = useCallback(
    async (paper: ResearchPaper, decision: "approved" | "rejected", comment: string) => {
      const token = await getToken();
      await api.put(
        `/faculty/review/${paper._id}`,
        { decision, comment, submissionType: paper.submissionType || normalizeType(paper) },
        { headers: { Authorization: `Bearer ${token?.token}` } }
      );
      await fetchAll();
    },
    [fetchAll]
  );

  const uploadResearch = useCallback(
    async (payload: { title: string; abstract: string; submissionType: SubmissionType; file?: File | null }) => {
      const tokenObj = await getToken();
      const authHeader = { Authorization: `Bearer ${tokenObj?.token}` } as const;

      if (Platform.OS === "web" && payload.file) {
        const form = new FormData();
        form.append("title", payload.title);
        form.append("abstract", payload.abstract);
        form.append("submissionType", payload.submissionType);
        form.append("file", payload.file, payload.file.name);
        await api.post("/faculty/my-research", form, { headers: { ...authHeader, "Content-Type": undefined as any } });
      } else {
        await api.post("/faculty/my-research",
          { title: payload.title, abstract: payload.abstract, submissionType: payload.submissionType },
          { headers: authHeader }
        );
      }
      await fetchAll();
    },
    [fetchAll]
  );

  const openFile = useCallback(async (paper: ResearchPaper) => {
    try {
      if (!paper?._id) throw new Error("Invalid file.");
      const tokenObj = await getToken();
      const token = tokenObj?.token;
      const base = (api.defaults.baseURL || "").replace(/\/+$/, "");

      if (paper.status === "approved") {
        const signed = await api.get(`/research/file/${paper._id}/signed`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const url = signed.data?.url;
        if (!url) throw new Error("No signed URL returned");
        return Platform.OS === "web" ? window.open(url, "_blank") : Linking.openURL(url);
      }

      const previewUrl = `${base}/faculty/preview/${paper._id}`;

      if (Platform.OS === "web") {
        const res = await axios.get(previewUrl, {
          responseType: "blob",
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        });
        const blobUrl = URL.createObjectURL(res.data as Blob);
        window.open(blobUrl, "_blank");
        setTimeout(() => URL.revokeObjectURL(blobUrl), 60_000);
        return;
      }
      Linking.openURL(previewUrl);
    } catch (e: any) {
      console.error("❌ Open file error:", e);
      const msg = e?.response?.data?.error || e?.message || "Failed to open file.";
      Platform.OS === "web" ? window.alert(msg) : Alert.alert("Error", msg);
    }
  }, []);

  const analytics = useMemo(() => {
    const uniqueAdvisees = Array.from(
      new Set(studentSubs.map((s) => (s.author || "").toLowerCase().trim()))
    ).filter(Boolean);
    return {
      total: uniqueAdvisees.length,
      approved: studentSubs.filter((s) => s.status === "approved").length,
      pending: studentSubs.filter((s) => s.status === "pending").length,
      rejected: studentSubs.filter((s) => s.status === "rejected").length,
      myResearchCount: myResearch.length,
    };
  }, [studentSubs, myResearch]);

  return { myResearch, studentSubs, loading, refreshing, onRefresh, reviewSubmission, uploadResearch, openFile, analytics };
}
