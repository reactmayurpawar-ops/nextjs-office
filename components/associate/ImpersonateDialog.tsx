'use client';

import { useEffect, useState } from 'react';
import { useTargetSearch, useStartImpersonation, type TargetSummary } from './use-impersonation';
import styles from './ImpersonateDialog.module.css';

/**
 * Picker for choosing which customer to act as.
 *
 * Ineligible matches are shown, disabled, with the reason — the alternative is a silently
 * short list and a support ticket asking why a customer is missing. The server re-checks
 * everything on start regardless; this is an affordance, not the control.
 */
export function ImpersonateDialog({ onClose }: { onClose: () => void }) {
  const [term, setTerm] = useState('');
  const [debounced, setDebounced] = useState('');
  const search = useTargetSearch(debounced);
  const start = useStartImpersonation();

  useEffect(() => {
    const id = setTimeout(() => setDebounced(term), 250);
    return () => clearTimeout(id);
  }, [term]);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  const targets = search.data?.targets ?? [];

  return (
    <div
      className={styles.backdrop}
      role="presentation"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className={styles.dialog} role="dialog" aria-modal="true" aria-label="Act as a customer">
        <div className={styles.head}>
          <h2 className={styles.title}>Act as a customer</h2>
          <p className={styles.hint}>
            Everything you do will be recorded against your own name as well as theirs.
          </p>
          <input
            className={styles.search}
            type="search"
            autoFocus
            placeholder="Search by name, username or account…"
            value={term}
            onChange={(e) => setTerm(e.target.value)}
          />
        </div>

        {start.isError && (
          <p className={styles.error} role="alert">
            {(start.error as Error).message}
          </p>
        )}

        {search.isError && (
          <p className={styles.error} role="alert">
            {(search.error as Error).message}
          </p>
        )}

        {debounced.trim().length < 3 ? (
          <p className={styles.empty}>Type at least 3 characters to search.</p>
        ) : search.isPending ? (
          <p className={styles.empty}>Searching…</p>
        ) : targets.length === 0 ? (
          <p className={styles.empty}>No customers matched.</p>
        ) : (
          <ul className={styles.results}>
            {targets.map((t) => (
              <TargetRow
                key={t.userId}
                target={t}
                pending={start.isPending}
                onPick={() => start.mutate({ targetUserId: t.userId })}
              />
            ))}
          </ul>
        )}

        <div className={styles.foot}>
          <button type="button" className={styles.cancel} onClick={onClose}>
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

function TargetRow({
  target,
  pending,
  onPick,
}: {
  target: TargetSummary;
  pending: boolean;
  onPick: () => void;
}) {
  return (
    <li>
      <button
        type="button"
        className={styles.row}
        disabled={!target.eligible || pending}
        onClick={onPick}
      >
        <span className={styles.rowName}>{target.name}</span>
        <span className={styles.rowAccount}>
          {target.accountName || 'No account'} · {target.username}
        </span>
        {!target.eligible && target.reason && (
          <span className={styles.rowReason}>{target.reason}</span>
        )}
      </button>
    </li>
  );
}
