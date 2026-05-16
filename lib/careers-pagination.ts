export function parseCursorLimit(searchParams: URLSearchParams) {
  const limit = Math.min(
    20,
    Math.max(5, Number(searchParams.get("limit") ?? "10") || 10),
  );
  const cursor = searchParams.get("cursor")?.trim() || null;
  return { limit, cursor };
}

export function cursorPageResult<T extends { id: string }>(
  rows: T[],
  limit: number,
) {
  const hasMore = rows.length > limit;
  const items = hasMore ? rows.slice(0, limit) : rows;
  return {
    items,
    hasMore,
    nextCursor: hasMore ? (items.at(-1)?.id ?? null) : null,
  };
}
