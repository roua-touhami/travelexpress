import axios from "axios";

const API = import.meta.env.VITE_API_URL;

const api = axios.create({ baseURL: API });

api.interceptors.request.use((config) => {
  const token = localStorage.getItem("token");

  if (!config.headers) {
    config.headers = {};
  }

  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }

  return config;
});

// Auth
export const register = (data) => api.post("/auth/register", data);
export const verifyRegistration = (data) =>
  api.post("/auth/verify-registration", data);
export const login = (data) => api.post("/auth/login", data);
export const forgotPassword = (data) => api.post("/auth/forgot-password", data);
export const resetPassword = (data) => api.post("/auth/reset-password", data);
export const getProfile = () => api.get("/auth/me");
export const updateProfile = (data) => api.put("/auth/me", data);

// Posts
export const createPost = (data) => api.post("/posts", data);
export const getAllPosts = (params) => api.get("/posts", { params });
export const getMyPosts = () => api.get("/posts/me");
export const updatePost = (id, data) => api.put(`/posts/${id}`, data);
export const deletePost = (id) => api.delete(`/posts/${id}`);
export const getUserProfile = (userId) => api.get(`/users/${userId}`);

// Applications
export const applyToPost = (postId, data) =>
  api.post(`/posts/${postId}/apply`, data);
export const getPostApplications = (postId) =>
  api.get(`/posts/${postId}/applications`);
export const getMyApplications = () => api.get("/applications/me");
export const getPendingCount = () => api.get("/applications/pending-count");
export const respondApplication = (appId, data) =>
  api.put(`/applications/${appId}/respond`, data);

// Notifications
export const getNotifications = () => api.get("/notifications");
export const getNotificationCount = () => api.get("/notifications/count");

// Chat
export const getMessages = (appId) => api.get(`/chat/${appId}/messages`);
export const sendMessage = (appId, data) =>
  api.post(`/chat/${appId}/messages`, data);
export const markChatAsRead = (appId) => api.post(`/chat/${appId}/read`);
export const getMyChats = () => api.get("/chats");
export const uploadImage = (appId, file) => {
  const fd = new FormData();
  fd.append("file", file);
  return api.post(`/chat/${appId}/upload`, fd, {
    headers: { "Content-Type": "multipart/form-data" },
  });
};
