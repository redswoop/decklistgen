import { ref, watch, type Ref } from "vue";

/**
 * How a value round-trips through localStorage's string-only storage.
 * The default treats the value AS a string (covers string-union prefs like
 * `"editing" | "physical"`); pass {@link numberSerde} for numeric prefs.
 */
export interface Serde<T> {
  read: (raw: string) => T;
  write: (value: T) => string;
}

const stringSerde: Serde<unknown> = {
  read: (raw) => raw,
  write: (value) => value as string,
};

export const numberSerde: Serde<number> = {
  read: (raw) => {
    const n = Number(raw);
    if (Number.isNaN(n)) throw new Error("not a number");
    return n;
  },
  write: (value) => String(value),
};

/**
 * A ref mirrored to localStorage: seeded from the stored value on creation
 * (falling back to `initial` when the key is absent or unreadable), and written
 * back whenever it changes. Setting the ref to `null`/`undefined` removes the
 * key rather than storing the string `"null"`.
 *
 * Replaces the hand-rolled `ref(getItem(...) || default)` + `watch → setItem`
 * pattern that had accreted across the gallery/lightbox preference composables.
 */
export function usePersistentRef<T>(
  key: string,
  initial: T,
  serde: Serde<T> = stringSerde as Serde<T>,
): Ref<T> {
  const stored = localStorage.getItem(key);
  let start = initial;
  if (stored !== null) {
    try {
      start = serde.read(stored);
    } catch {
      start = initial;
    }
  }

  const state = ref(start) as Ref<T>;

  watch(state, (value) => {
    if (value === null || value === undefined) {
      localStorage.removeItem(key);
    } else {
      localStorage.setItem(key, serde.write(value));
    }
  });

  return state;
}
