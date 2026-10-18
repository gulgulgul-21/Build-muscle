import type { Backup } from "../../domain/model";
export type Dataset = Backup["data"];
const missing = Symbol("missing");
type Value = unknown | typeof missing;
function stable(value: unknown): string {
  if (Array.isArray(value)) return "[" + value.map(stable).join(",") + "]";
  if (value && typeof value === "object")
    return (
      "{" +
      Object.entries(value)
        .filter(([key]) => key !== "updatedAt")
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([key, val]) => JSON.stringify(key) + ":" + stable(val))
        .join(",") +
      "}"
    );
  return JSON.stringify(value) ?? "undefined";
}
export function sameData(a: Dataset, b: Dataset) {
  return (
    stable(
      Object.fromEntries(
        Object.entries(a).map(([key, rows]) => [
          key,
          [...rows].sort((a, b) => a.id.localeCompare(b.id)),
        ]),
      ),
    ) ===
    stable(
      Object.fromEntries(
        Object.entries(b).map(([key, rows]) => [
          key,
          [...rows].sort((a, b) => a.id.localeCompare(b.id)),
        ]),
      ),
    )
  );
}
function equal(a: Value, b: Value) {
  return a === missing || b === missing ? a === b : stable(a) === stable(b);
}
function object(value: Value): value is Record<string, unknown> {
  return (
    value !== missing &&
    value !== null &&
    typeof value === "object" &&
    !Array.isArray(value)
  );
}
export function mergeData(
  base: Dataset,
  local: Dataset,
  remote: Dataset,
): { data: Dataset; conflicts: string[] } {
  const conflicts: string[] = [];
  function merge(b: Value, l: Value, r: Value, path: string): Value {
    if (equal(l, r)) return l;
    if (equal(l, b)) return r;
    if (equal(r, b)) return l;
    if (object(b) && object(l) && object(r)) {
      const result: Record<string, unknown> = {};
      for (const key of new Set([
        ...Object.keys(b),
        ...Object.keys(l),
        ...Object.keys(r),
      ])) {
        if (key === "updatedAt") {
          result[key] = [b[key], l[key], r[key]]
            .filter((v) => typeof v === "string")
            .sort()
            .at(-1);
          continue;
        }
        const value = merge(
          Object.hasOwn(b, key) ? b[key] : missing,
          Object.hasOwn(l, key) ? l[key] : missing,
          Object.hasOwn(r, key) ? r[key] : missing,
          path + "." + key,
        );
        if (value !== missing)
          Object.defineProperty(result, key, {
            value,
            enumerable: true,
            writable: true,
            configurable: true,
          });
      }
      return result;
    }
    conflicts.push(path);
    return l;
  }
  const result: Record<string, unknown> = {};
  for (const table of Object.keys(base) as (keyof Dataset)[]) {
    const b = new Map(base[table].map((row) => [row.id, row])),
      l = new Map(local[table].map((row) => [row.id, row])),
      r = new Map(remote[table].map((row) => [row.id, row]));
    const rows: unknown[] = [];
    for (const key of new Set([...b.keys(), ...l.keys(), ...r.keys()])) {
      const value = merge(
        b.get(key) ?? missing,
        l.get(key) ?? missing,
        r.get(key) ?? missing,
        table + "." + key,
      );
      if (value !== missing) rows.push(structuredClone(value));
    }
    result[table] = rows;
  }
  return { data: result as Dataset, conflicts };
}
