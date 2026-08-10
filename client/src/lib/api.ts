import axios from "axios";

export const api = axios.create({
  // Keep browser requests on the portal origin. Next.js proxies this prefix to
  // the API server, which also ensures the HTTP-only auth cookie belongs to
  // the same host as the portal instead of a hard-coded localhost host.
  baseURL: "/api",
  withCredentials: true,
  headers: {
    "Content-Type": "application/json",
  },
});
