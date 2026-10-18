import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import type { User } from "@supabase/supabase-js";
import { useLiveQuery } from "dexie-react-hooks";
import { db, download } from "../../db/repository";
import { useData } from "../../app/context";
import { supabase, remoteStore, authCallback } from "./client";
import { localStore, bindAccount, envelope } from "./storage";
import {
  SetupRequired,
  SyncConflict,
  syncOnce,
  type RemoteDocument,
} from "./engine";
type State =
  | "signedOut"
  | "syncing"
  | "synced"
  | "offline"
  | "setup"
  | "conflict"
  | "error";
type Value = {
  user: User | null;
  state: State;
  error: string;
  lastSynced: string | null;
  pending: RemoteDocument | null;
  sync: () => Promise<void>;
  choose: (source: "local" | "cloud") => Promise<void>;
  signOut: () => Promise<void>;
};
const Context = createContext<Value | null>(null);
export function SyncProvider({ children }: { children: ReactNode }) {
  const { data } = useData();
  const [user, setUser] = useState<User | null>(null);
  const [state, setState] = useState<State>("signedOut");
  const [error, setError] = useState("");
  const [pending, setPending] = useState<RemoteDocument | null>(null);
  const binding = useLiveQuery(() => db.syncMeta.get("account"), []);
  const locked = useRef(false);
  const currentUser = useRef<string | null>(null);
  const blocked = useRef(false);
  const latest = useRef<() => Promise<void>>(async () => {});
  async function sync() {
    if (!user || locked.current || blocked.current) return;
    if (!navigator.onLine) {
      setState("offline");
      return;
    }
    locked.current = true;
    setState("syncing");
    setError("");
    try {
      await syncOnce(
        {
          ...localStore,
          accept: async (...args) => {
            if (currentUser.current !== user.id)
              throw new Error("Account changed");
            await localStore.accept(...args);
          },
        },
        remoteStore(user.id),
        user.id,
      );
      if (currentUser.current === user.id) setState("synced");
    } catch (e) {
      if (currentUser.current !== user.id) return;
      if (e instanceof SetupRequired) {
        blocked.current = true;
        setPending(e.remote);
        setState("setup");
      } else if (e instanceof SyncConflict) {
        blocked.current = true;
        setState("conflict");
      } else {
        setState(navigator.onLine ? "error" : "offline");
        setError("ซิงก์ไม่สำเร็จ ข้อมูลยังอยู่ในอุปกรณ์นี้ กรุณาลองอีกครั้ง");
      }
    } finally {
      locked.current = false;
    }
  }
  latest.current = sync;
  useEffect(() => {
    const { data: listener } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        if (currentUser.current !== (session?.user.id ?? null))
          blocked.current = false;
        currentUser.current = session?.user.id ?? null;
        setUser(session?.user ?? null);
        if (!session) setState("signedOut");
        if (authCallback) window.location.hash = "/settings";
      },
    );
    return () => listener.subscription.unsubscribe();
  }, []);
  useEffect(() => {
    const timer = setTimeout(() => {
      void latest.current();
    }, 1200);
    return () => clearTimeout(timer);
  }, [data, user]);
  useEffect(() => {
    const update = () => {
      void latest.current();
    };
    const interval = setInterval(update, 30000);
    window.addEventListener("focus", update);
    window.addEventListener("online", update);
    const offline = () => {
      if (currentUser.current && !blocked.current) setState("offline");
    };
    window.addEventListener("offline", offline);
    return () => {
      clearInterval(interval);
      window.removeEventListener("focus", update);
      window.removeEventListener("online", update);
      window.removeEventListener("offline", offline);
    };
  }, []);
  async function choose(source: "local" | "cloud") {
    if (!user || locked.current) return;
    locked.current = true;
    setError("");
    try {
      const captured = await localStore.read();
      const remote = remoteStore(user.id);
      const cloud = await remote.read();
      // Keep both sides recoverable before an explicit source selection.
      download(
        "form-before-sync.json",
        JSON.stringify(envelope(captured.data), null, 2),
      );
      if (cloud)
        download(
          "form-cloud-before-sync.json",
          JSON.stringify(cloud.payload, null, 2),
        );
      if (source === "cloud" && !cloud) throw new Error("empty");
      if (pending && cloud?.revision !== pending.revision) {
        setPending(cloud);
        throw new Error("changed");
      }
      const accepted =
        source === "cloud"
          ? cloud!
          : await remote.write(cloud?.revision ?? 0, captured.data);
      if (currentUser.current !== user.id) throw new Error("Account changed");
      await bindAccount(user.id, captured.data, accepted, source === "cloud");
      blocked.current = false;
      setPending(null);
      setState("synced");
    } catch {
      setError("ไม่สามารถเลือกข้อมูลได้ กรุณาตรวจสอบและลองอีกครั้ง");
    } finally {
      locked.current = false;
    }
  }
  async function signOut() {
    if (locked.current) throw new Error("กรุณารอให้ซิงก์เสร็จก่อน");
    currentUser.current = null;
    blocked.current = true;
    const { error } = await supabase.auth.signOut({ scope: "local" });
    if (error) throw error;
    setUser(null);
    setState("signedOut");
  }
  return (
    <Context.Provider
      value={{
        user,
        state,
        error,
        lastSynced:
          binding?.userId === user?.id ? (binding?.lastSyncedAt ?? null) : null,
        pending,
        sync,
        choose,
        signOut,
      }}
    >
      {children}
    </Context.Provider>
  );
}
export function useSync() {
  const value = useContext(Context);
  if (!value) throw new Error("Missing SyncProvider");
  return value;
}
