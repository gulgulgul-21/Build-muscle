import { createClient } from "@supabase/supabase-js";
import { validateBackup } from "../../db/repository";
import {
  RevisionConflict,
  type RemoteDocument,
  type SyncRemote,
} from "./engine";
import { envelope } from "./storage";
// Browser publishable key; access is enforced by authenticated RLS and the CAS RPC.
export const authCallback = /(?:access_token|error_description|code)=/.test(
  window.location.hash + window.location.search,
);
export const supabase = createClient(
  "https://zievvkvcifigwmcvezsb.supabase.co",
  "sb_publishable_NNp9EG1NZrJ-twc8o6jiZA_MDnFXrwf",
  { auth: { detectSessionInUrl: true } },
);
async function accountClient(userId: string) {
  const { data, error } = await supabase.auth.getSession();
  if (error || data.session?.user.id !== userId)
    throw new Error("Account changed");
  // Pin the token for this request so switching accounts cannot upload another account's data.
  return createClient(
    "https://zievvkvcifigwmcvezsb.supabase.co",
    "sb_publishable_NNp9EG1NZrJ-twc8o6jiZA_MDnFXrwf",
    { accessToken: async () => data.session!.access_token },
  );
}
function parse(value: unknown): RemoteDocument {
  if (
    !value ||
    typeof value !== "object" ||
    !("revision" in value) ||
    !("payload" in value) ||
    !Number.isSafeInteger(value.revision) ||
    Number(value.revision) < 1
  )
    throw new Error("ข้อมูลบนคลาวด์ไม่ถูกต้อง");
  return {
    revision: Number(value.revision),
    payload: validateBackup(value.payload),
  };
}
export function remoteStore(userId: string): SyncRemote {
  return {
    async read() {
      const client = await accountClient(userId);
      const { data, error } = await client
        .from("form_sync_documents")
        .select("revision,payload")
        .eq("user_id", userId)
        .maybeSingle();
      if (error) throw error;
      return data ? parse(data) : null;
    },
    async write(expectedRevision, data) {
      const client = await accountClient(userId);
      const result = await client.rpc("form_sync_write", {
        expected_revision: expectedRevision,
        document: envelope(data),
      });
      if (result.error) {
        if (result.error.code === "40001") throw new RevisionConflict();
        throw result.error;
      }
      return parse(result.data);
    },
  };
}
