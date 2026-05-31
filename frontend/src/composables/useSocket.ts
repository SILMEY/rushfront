import { io, type Socket } from "socket.io-client";
import { apiFetch } from "../api/http";
import { useAuthStore } from "../stores/authStore";

let socket: Socket | null = null;
let connecting: Promise<Socket> | null = null;

export async function getSocket(): Promise<Socket> {
  if (socket?.connected) return socket;
  if (connecting) return connecting;

  connecting = (async () => {
    const auth = useAuthStore();
    const token = auth.accessToken ?? (await apiFetch<{ token: string }>("/socket/token")).token;
    const url = (import.meta.env.VITE_SOCKET_URL as string) ?? (import.meta.env.VITE_API_URL as string);
    socket = io(url, {
      transports: ["websocket"],
      auth: { token }
    });
    await new Promise<void>((resolve, reject) => {
      socket!.once("connect", () => resolve());
      socket!.once("connect_error", (e) => reject(e));
    });
    return socket!;
  })();

  try {
    return await connecting;
  } finally {
    connecting = null;
  }
}

export function disconnectSocket() {
  socket?.disconnect();
  socket = null;
}
