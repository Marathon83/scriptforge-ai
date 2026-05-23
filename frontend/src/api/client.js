import axios from "axios";

const api = axios.create({ baseURL: "http://127.0.0.1:8000" });

export const generateScript  = (data) => api.post("/generate", data).then(r => r.data);
export const simulateScript  = (data) => api.post("/simulate", data).then(r => r.data);
export const debugScript     = (data) => api.post("/debug", data).then(r => r.data);
export const analyzeScript   = (data) => api.post("/analyze", data).then(r => r.data);
export const convertScript   = (data) => api.post("/convert", data).then(r => r.data);
export const improveScript   = (data) => api.post("/improve", data).then(r => r.data);
export const buildCheatsheet = (data) => api.post("/cheatsheet", data).then(r => r.data);
export const tutorCode       = (data) => api.post("/tutor", data).then(r => r.data);
export const runSandbox      = (data) => api.post("/sandbox", data).then(r => r.data);
