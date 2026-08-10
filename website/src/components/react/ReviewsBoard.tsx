import { useEffect, useMemo, useState } from "react";
import { StarDisplay } from "./StarRating";
import {
  EMPTY_STATS,
  fetchReviews,
  fetchStats,
  formatDate,
  isConfigured,
  PROFILE_LABELS,
  USE_CASE_LABELS,
  type Review,
  type ReviewStats,
} from "../../lib/reviews";

/**
 * The field reports board.
 *
 * Every number on this page is derived from approved reviews returned by the
 * API. Nothing is seeded, nothing is hard-coded, and a statistic with too
 * little behind it is omitted rather than printed weakly — an average built
 * from two reviews says more about the sample than the software.
 *
 * The controls follow the same rule: sorting and filtering only appear once
 * there is enough to sort or filter. Below that they are noise on a page with
 * five cards on it.
 */

const FILTERS_FROM = 8;
const AVERAGE_FROM = 4;
const DISTRIBUTION_FROM = 5;
const PAGE = 12;

function Chip({ children }: { children: React.ReactNode }) {
  return <span className="rv-chip mono">{children}</span>;
}

function ReviewCard({ review }: { review: Review }) {
  const chips: string[] = [];
  if (review.macModel) chips.push(review.macModel);
  if (review.macosVersion) chips.push(`macOS ${review.macosVersion}`);
  if (review.gcoolersVersion) chips.push(`v${review.gcoolersVersion.replace(/^v/i, "")}`);
  if (review.profile) chips.push(PROFILE_LABELS[review.profile] ?? review.profile);
  if (review.useCase) chips.push(USE_CASE_LABELS[review.useCase] ?? review.useCase);

  return (
    <article className="rv-card panel">
      <header className="rv-card-head">
        <StarDisplay rating={review.rating} label={`${review.rating} out of 5`} />
        <time className="rv-date mono" dateTime={new Date(review.createdAt * 1000).toISOString()}>
          {formatDate(review.createdAt)}
        </time>
      </header>

      <h3 className="rv-title">{review.title}</h3>
      {/* React escapes this by construction — the body is text, never markup,
          and it arrives already moderated from the server. */}
      <p className="rv-body">{review.body}</p>

      <footer className="rv-card-foot">
        <p className="rv-who">
          {review.link ? (
            <a href={review.link} target="_blank" rel="noopener noreferrer nofollow ugc">
              {review.displayName}
            </a>
          ) : (
            review.displayName
          )}
        </p>
        {chips.length > 0 && (
          <p className="rv-chips">
            {chips.map((c) => (
              <Chip key={c}>{c}</Chip>
            ))}
          </p>
        )}
      </footer>
    </article>
  );
}

function Distribution({ stats }: { stats: ReviewStats }) {
  const max = Math.max(...Object.values(stats.distribution), 1);
  return (
    <div className="rv-dist">
      <h3 className="sr-only">Rating distribution</h3>
      {[5, 4, 3, 2, 1].map((n) => {
        const count = stats.distribution[String(n)] ?? 0;
        const share = stats.total ? Math.round((count / stats.total) * 100) : 0;
        return (
          <div className="rv-dist-row" key={n}>
            <span className="rv-dist-key mono">{n}★</span>
            <span className="rv-dist-track" aria-hidden="true">
              <i style={{ transform: `scaleX(${count / max})` }} />
            </span>
            <span className="rv-dist-val mono">
              {count}
              <em className="sr-only">
                {" "}
                review{count === 1 ? "" : "s"} at {n} star{n === 1 ? "" : "s"} ({share}%)
              </em>
            </span>
          </div>
        );
      })}
    </div>
  );
}

export default function ReviewsBoard({
  initialReviews = [],
  initialStats = EMPTY_STATS,
}: {
  initialReviews?: Review[];
  initialStats?: ReviewStats;
}) {
  const [reviews, setReviews] = useState<Review[]>(initialReviews);
  const [stats, setStats] = useState<ReviewStats>(initialStats);
  const [cursor, setCursor] = useState<number | null>(null);
  const [rating, setRating] = useState<number | null>(null);
  const [sort, setSort] = useState<"newest" | "oldest">("newest");
  const [loading, setLoading] = useState(false);
  const [loaded, setLoaded] = useState(false);

  // The build baked in whatever existed at deploy time; refresh so an approval
  // made since then is visible without a rebuild.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [page, fresh] = await Promise.all([fetchReviews({ limit: PAGE }), fetchStats()]);
      if (cancelled) return;
      setReviews(page.reviews);
      setCursor(page.nextCursor);
      setStats(fresh);
      setLoaded(true);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Filter and sort go back to the server rather than slicing the page we
  // happen to hold, so "3 stars" means every 3-star review, not the three on
  // screen.
  useEffect(() => {
    if (!loaded) return;
    let cancelled = false;
    setLoading(true);
    (async () => {
      const page = await fetchReviews({ limit: PAGE, rating, sort });
      if (cancelled) return;
      setReviews(page.reviews);
      setCursor(page.nextCursor);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [rating, sort, loaded]);

  async function loadMore() {
    if (!cursor || loading) return;
    setLoading(true);
    const page = await fetchReviews({ limit: PAGE, cursor, rating, sort });
    setReviews((prev) => [...prev, ...page.reviews]);
    setCursor(page.nextCursor);
    setLoading(false);
  }

  const showControls = stats.total >= FILTERS_FROM;
  const showAverage = stats.total >= AVERAGE_FROM && stats.average !== null;
  const showDistribution = stats.total >= DISTRIBUTION_FROM;

  const summary = useMemo(() => {
    if (!stats.total) return null;
    return `${stats.total} approved field report${stats.total === 1 ? "" : "s"}`;
  }, [stats.total]);

  /* ------------------------------------------------------------ empty ---- */
  if (stats.total === 0) {
    return (
      <div className="rv-empty">
        <div className="rv-empty-art" aria-hidden="true">
          <svg viewBox="0 0 240 120" role="presentation">
            {Array.from({ length: 11 }, (_, i) => (
              <circle key={i} className="rv-empty-node" cx={12 + i * 21.6} cy={60 + Math.sin(i * 0.9) * 22} r="3" />
            ))}
            <path
              className="rv-empty-line"
              d={Array.from({ length: 11 }, (_, i) => `${i ? "L" : "M"}${12 + i * 21.6} ${60 + Math.sin(i * 0.9) * 22}`).join(" ")}
              fill="none"
            />
          </svg>
        </div>
        <p className="mono">No signal yet</p>
        <h2>No field reports have been published.</h2>
        <p>
          {isConfigured()
            ? "Nobody has submitted one yet, or nothing has cleared moderation. There are no sample reviews on this page and there never will be — when something appears here, a real person wrote it."
            : "The review channel is not configured for this build, so there is nothing to show yet."}
        </p>
        {isConfigured() && (
          <div className="btn-row">
            <a className="btn btn-primary" href="/reviews/new">
              New field report
            </a>
            <a className="btn btn-quiet" href="/#install">
              Install Gcoolers
            </a>
          </div>
        )}
      </div>
    );
  }

  /* --------------------------------------------------------- populated --- */
  return (
    <div className="rv-board">
      <div className="rv-stats">
        <div className="rv-stat-main">
          {showAverage ? (
            <>
              <p className="rv-avg">
                {stats.average!.toFixed(1)}
                <span aria-hidden="true">/5</span>
              </p>
              <StarDisplay rating={Math.round(stats.average!)} label={`Average ${stats.average!.toFixed(1)} out of 5`} />
            </>
          ) : (
            // Below four reports an average is a number about the sample, not
            // about the software, so it is left out rather than shown weakly.
            <p className="rv-avg-hold mono">Average held until there are {AVERAGE_FROM} reports</p>
          )}
          <p className="rv-count mono">{summary}</p>
        </div>

        {showDistribution && <Distribution stats={stats} />}
      </div>

      {showControls && (
        <div className="rv-controls">
          <div className="rv-filter" role="group" aria-label="Filter by rating">
            <button type="button" className={`rv-pill${rating === null ? " is-on" : ""}`} onClick={() => setRating(null)} aria-pressed={rating === null}>
              All
            </button>
            {[5, 4, 3, 2, 1].map((n) => (
              <button
                key={n}
                type="button"
                className={`rv-pill${rating === n ? " is-on" : ""}`}
                onClick={() => setRating(rating === n ? null : n)}
                aria-pressed={rating === n}
                disabled={(stats.distribution[String(n)] ?? 0) === 0}
              >
                {n}★ <em>{stats.distribution[String(n)] ?? 0}</em>
              </button>
            ))}
          </div>

          <label className="rv-sort">
            <span>Sort</span>
            <select value={sort} onChange={(e) => setSort(e.target.value as "newest" | "oldest")}>
              <option value="newest">Newest first</option>
              <option value="oldest">Oldest first</option>
            </select>
          </label>
        </div>
      )}

      <div className="rv-list" aria-busy={loading}>
        {reviews.map((r) => (
          <ReviewCard key={r.id} review={r} />
        ))}
      </div>

      {reviews.length === 0 && !loading && (
        <p className="rv-none">No reports match that filter.</p>
      )}

      {cursor && (
        <div className="rv-more">
          <button type="button" className="btn btn-ghost" onClick={loadMore} disabled={loading}>
            {loading ? "Loading…" : "Load more reports"}
          </button>
        </div>
      )}
    </div>
  );
}
