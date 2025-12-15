// lib/api.ts
import axios from "axios";
import { Platform } from "react-native";
import { getToken, removeToken } from "./auth";
import { router } from "expo-router";

const api = axios.create({ baseURL: "https://ced-research-backend.onrender.com/api" });

api.interceptors.request.use(async (config) => {
  const t = await getToken();
  if (t?.token) {
    config.headers = config.headers ?? {};
    (config.headers as any).Authorization = `Bearer ${t.token}`;
  }
  return config;
});

api.interceptors.response.use(
  (res) => res,
  async (err) => {
    const s = err?.response?.status;
    if (s === 401 || s === 403) {
      await removeToken();
      if (Platform.OS === "web") window.location.href = "/login";
      else router.replace("/login");
    }
    return Promise.reject(err);
  }
);

export default api;


