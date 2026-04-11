"use client";

import Fuse, { type IFuseOptions } from "fuse.js";
import { useMemo, useState } from "react";

export function useFuseSearch<T>(
  data: T[],
  keys: string[],
  options?: IFuseOptions<T>
) {
  const [query, setQuery] = useState("");

  const fuse = useMemo(
    () =>
      new Fuse(data, {
        keys,
        threshold: 0.3,
        includeScore: true,
        minMatchCharLength: 2,
        ...options,
      }),
    [data, keys, options]
  );

  const results = useMemo(() => {
    if (!query.trim()) return data;
    return fuse.search(query).map((result) => result.item);
  }, [query, fuse, data]);

  return { query, setQuery, results };
}
