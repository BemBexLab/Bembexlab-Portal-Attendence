import axios from "axios";

export const api = axios.create({
  // Next.js proxies this same-origin path to the VPS API using API_URL.
  baseURL: "/api",
  withCredentials: true,
  headers: {
    "Content-Type": "application/json",
  },
});
