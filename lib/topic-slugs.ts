import "server-only";
import { getIndexableMarkets, getQuestionSeriesIndex } from "./api";

/**
 * Topic slugs that have a real /topic/<slug> page.
 *
 * A topic hub is prerendered only when something indexable sits under it, so
 * the bot's full topic tree is much larger than the set of pages that exist.
 * This is the single source of truth for that set: `generateStaticParams` uses
 * it to decide what to build, and the footer directory uses it to decide what
 * to link. When those two drifted apart the footer shipped 14 site-wide 404s.
 *
 * Series count as well as markets — a topic whose only content is a rolling
 * question still deserves a hub, and that hub is the only thing linking the
 * question's family page.
 */
export async function publishedTopicSlugs(): Promise<Set<string>> {
  const [markets, series] = await Promise.all([
    getIndexableMarkets(),
    getQuestionSeriesIndex(),
  ]);
  // ACTIVE markets only, matching what a topic page actually renders: it lists
  // what is trading and 404s when that list is empty. Counting settled markets
  // here produced a hub (/topic/clf — club friendlies, all played) that the
  // footer linked and the page then 404'd.
  return new Set(
    [
      ...markets.filter((m) => m.status === "active").map((m) => m.category_id),
      ...series.map((s) => s.category_id),
    ].filter((s): s is string => Boolean(s)),
  );
}
