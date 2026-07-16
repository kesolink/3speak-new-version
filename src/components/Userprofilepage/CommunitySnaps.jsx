import { useState, useEffect, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import { fetchSnaps } from '../../lib/snaps';
import { getHiveRenderer } from '../../lib/hiveRenderer';
import SnapComposer from './SnapComposer';
import BarLoader from '../Loader/BarLoader';
import './CommunitySnaps.scss';

dayjs.extend(relativeTime);

function SnapBody({ body }) {
  const [html, setHtml] = useState('');
  useEffect(() => {
    let alive = true;
    getHiveRenderer()
      .then((render) => { if (alive) { try { setHtml(render(body || '')); } catch { setHtml(''); } } })
      .catch(() => { if (alive) setHtml(''); });
    return () => { alive = false; };
  }, [body]);
  return <div className="snap-body markdown-body" dangerouslySetInnerHTML={{ __html: html }} />;
}

function SnapCard({ snap }) {
  const when = snap.created ? dayjs(snap.created).fromNow() : '';
  const tags = (snap.tags || []).filter((t) => t && t !== 'nsfw');
  return (
    <article className="snap-card">
      <div className="snap-card-head">
        <Link to={`/p/${snap.owner}`} className="snap-author">@{snap.owner}</Link>
        <a
          className="snap-time"
          href={`https://peakd.com/@${snap.owner}/${snap.permlink}`}
          target="_blank"
          rel="noopener noreferrer"
          title="View on Hive"
        >
          {when}
        </a>
      </div>
      <SnapBody body={snap.body} />
      {tags.length > 0 && (
        <div className="snap-tags">
          {tags.map((t) => (
            <Link key={t} to={`/t/${t}`} className="snap-tag">#{t}</Link>
          ))}
        </div>
      )}
    </article>
  );
}

/**
 * The profile's "Community" tab. Everyone sees the owner's snaps; only the owner
 * (canPost) gets the composer. Newly posted snaps are shown optimistically and then
 * reconciled once the checker has indexed the on-chain post.
 */
export default function CommunitySnaps({ user, canPost = false }) {
  const [optimistic, setOptimistic] = useState([]);

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['community-snaps', user],
    queryFn: () => fetchSnaps(user),
    enabled: !!user,
    staleTime: 30_000,
  });

  const snaps = useMemo(() => {
    const fetched = data?.snaps || [];
    const seen = new Set(fetched.map((s) => s.permlink));
    const extra = optimistic.filter((s) => s.owner === user && !seen.has(s.permlink));
    return [...extra, ...fetched];
  }, [data?.snaps, optimistic, user]);

  const onPosted = (snap) => {
    setOptimistic((prev) => [snap, ...prev.filter((s) => s.permlink !== snap.permlink)]);
    // The checker indexes the on-chain post a few seconds later — reconcile then.
    setTimeout(() => refetch(), 4000);
    setTimeout(() => refetch(), 12000);
  };

  return (
    <div className="community-snaps">
      {canPost && <SnapComposer onPosted={onPosted} />}

      {isLoading && snaps.length === 0 ? (
        <BarLoader />
      ) : snaps.length === 0 ? (
        <div className="snap-empty">
          {canPost ? 'No snaps yet — share your first update above.' : 'No snaps here yet.'}
        </div>
      ) : (
        <div className="snap-list">
          {snaps.map((s) => (
            <SnapCard key={s._id || `${s.owner}/${s.permlink}`} snap={s} />
          ))}
        </div>
      )}
    </div>
  );
}
