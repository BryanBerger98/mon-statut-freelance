import { useEffect, useRef, useState } from 'react';

/**
 * Reversible string codec for a single URL search-param value.
 * @template TValue the decoded value type
 */
export type UrlParamCodec<TValue> = {
  /** Decode a raw query-string value; may throw on malformed input (the hook falls back to the default). */
  parse: (raw: string) => TValue;
  /** Encode the value to a query-string-safe string. */
  serialize: (value: TValue) => string;
};

/**
 * Inputs for {@link useUrlParam}.
 * @template TValue the decoded value type
 */
export type UseUrlParamInput<TValue> = {
  /** The URL search-param key. */
  key: string;
  /** Value used before the URL is read (SSR + first paint) and when the param is absent or malformed. */
  defaultValue: TValue;
  /** Reversible codec mapping the value to/from its string form. */
  codec: UrlParamCodec<TValue>;
};

/**
 * Sync one piece of state with a single URL search param — shareable and refresh-safe.
 * SSR-safe: starts at `defaultValue` (Astro prerenders the island with no `window`), reads
 * `window.location` only inside a mount effect, and writes via `history.replaceState`
 * (no navigation, no history-stack spam).
 * @param input key, default value and reversible codec — see {@link UseUrlParamInput}
 * @returns a `[value, setValue]` tuple, like `useState`
 */
export const useUrlParam = <TValue>(input: UseUrlParamInput<TValue>): readonly [TValue, (next: TValue) => void] => {
  const { key, defaultValue, codec } = input;
  const [value, setValue] = useState<TValue>(defaultValue);

  // Latest-value refs so the mount effect can read the URL once without re-running
  // (and clobbering user edits) when `codec` / `defaultValue` change identity each render.
  const codecRef = useRef(codec);
  codecRef.current = codec;
  const defaultRef = useRef(defaultValue);
  defaultRef.current = defaultValue;

  useEffect(() => {
    const raw = new URLSearchParams(window.location.search).get(key);
    if (raw === null) return;
    try {
      setValue(codecRef.current.parse(raw));
    } catch {
      setValue(defaultRef.current);
    }
  }, [key]);

  const setParam = (next: TValue): void => {
    setValue(next);
    const params = new URLSearchParams(window.location.search);
    params.set(key, codecRef.current.serialize(next));
    const query = params.toString();
    window.history.replaceState(null, '', query ? `?${query}` : window.location.pathname);
  };

  return [value, setParam] as const;
};
