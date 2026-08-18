import axios from "axios";

function getApiBaseUrl() {
  if (process.env.NEXT_PUBLIC_API_URL) {
    return process.env.NEXT_PUBLIC_API_URL.replace(/\/$/, "");
  }

  // Keep browser requests on the portal origin. This avoids CORS, mixed-host,
  // and cookie-scope failures when the portal is opened through localhost,
  // a LAN address, or another development hostname.
  return "/api";
}

export const api = axios.create({
  baseURL: getApiBaseUrl(),
  withCredentials: true,
  headers: {
    "Content-Type": "application/json",
  },
});
