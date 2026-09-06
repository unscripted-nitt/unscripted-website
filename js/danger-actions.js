// js/danger-actions.js
// ============================================================
// Shared helper for every "dangerous" admin action: deletes, the
// leaderboard reset, the restore-from-backup buttons, and
// primary-admin promotion/demotion.
//
// Flow:
//   1. Triple confirmation (3 sequential browser confirm() popups).
//   2. Create or advance a `pendingActions/{actionId}` doc.
//   3. The FIRST admin's confirm just records their approval and stops
//      — nothing happens yet ("needs one more admin").
//   4. A SECOND, different admin approves — either from the "Pending
//      Approvals" panel, or by clicking the same button again.
//      Firestore Security Rules only allow the actual write once the
//      pendingActions doc shows 2 distinct approvals and
//      status:'approved' — enforced server-side, not just here.
//   5. For actions a security rule can't gate directly (restoring a
//      backup, flipping isPrimaryAdmin), a Cloud Function
//      (onPendingActionWritten) watches for status:'approved' and
//      performs the action with the Admin SDK.
//
// SCOPE NOTE: for simple single-document actions (delete a member,
// photo, video, voting session, notification; reset the leaderboard),
// approving from the Pending Approvals panel finishes the job on the
// spot. "Delete Event" also cleans up related feedback/votes/guest
// tokens/badges — that cascade lives in admin-dashboard.html's own
// deleteEvent() function, so once an event-delete request is approved,
// whichever admin is looking at the Events tab needs to click "Delete"
// on that event one more time to actually run the full cleanup (the
// approval already granted means it will now go through immediately,
// with no further confirmation needed).
// ============================================================

import { db } from './firebase-config.js';
import {
  doc, getDoc, setDoc, updateDoc, deleteDoc, onSnapshot, collection, query, where, serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

const SIMPLE_DELETE_COLLECTIONS = ['users', 'gallery', 'videos', 'votingSessions', 'notifications'];

/** Three sequential confirm() dialogs, as required for every dangerous action. */
export function tripleConfirm(label) {
  if (!confirm(`⚠️ ${label}`)) return false;
  if (!confirm('Second confirmation — are you absolutely sure you want to proceed?')) return false;
  if (!confirm('Final (3rd) confirmation — this also requires a SECOND admin to approve before it takes effect. Continue?')) return false;
  return true;
}

/**
 * Runs the confirm+approve workflow for a "delete" or "settings-reset"
 * style action, then calls `performFn()` to do the actual Firestore
 * write once 2 distinct admins have approved (Firestore rules enforce
 * this independently — performFn will simply fail if rules disagree).
 *
 * @param {string} actionId  stable id, e.g. `del_events_${eventId}`
 * @param {string} label     shown in the confirm dialogs / pending list
 * @param {{uid:string,name:string}} me   the current admin
 * @param {{collection:string, docId:string}} target  what this deletes/resets
 * @param {Function} performFn  async () => void — the real delete/write
 */
export async function runDualApprovalAction(actionId, label, me, target, performFn) {
  if (!tripleConfirm(label)) return;

  const ref = doc(db, 'pendingActions', actionId);
  const snap = await getDoc(ref);

  if (!snap.exists() || ['executed', 'failed'].includes(snap.data().status)) {
    await setDoc(ref, {
      kind: 'delete', label,
      targetCollection: target.collection, targetDocId: target.docId,
      requestedBy: me.uid, requestedByName: me.name || '',
      approvals: [me.uid], status: 'pending', createdAt: serverTimestamp(),
    });
    alert('Request recorded. This needs approval from a second admin — see "Pending Approvals" below.');
    return;
  }

  const data = snap.data();
  if (data.approvals.includes(me.uid)) {
    alert('You already approved this request. Waiting for a different admin to approve it.');
    return;
  }

  const approvals = [...data.approvals, me.uid];
  const nowApproved = approvals.length >= 2;
  await updateDoc(ref, { approvals, status: nowApproved ? 'approved' : 'pending' });

  if (!nowApproved) {
    alert('Approval recorded. Still needs one more admin.');
    return;
  }

  try {
    await performFn();
    await updateDoc(ref, { status: 'executed', executedAt: serverTimestamp() });
    alert('Approved by 2 admins — action completed.');
  } catch (e) {
    await updateDoc(ref, { status: 'failed', error: String(e.message || e) }).catch(() => {});
    alert('Approved, but the action failed: ' + e.message);
  }
}

/**
 * Same idea, for actions a Cloud Function executes (restore, primary
 * admin change) rather than a plain client write. This just manages the
 * pendingActions doc — the Cloud Function `onPendingActionWritten` does
 * the actual work once status flips to 'approved'.
 */
export async function requestOrApproveServerAction(actionId, kind, label, me, extraFields) {
  if (!tripleConfirm(label)) return;

  const ref = doc(db, 'pendingActions', actionId);
  const snap = await getDoc(ref);

  if (!snap.exists() || ['executed', 'failed'].includes(snap.data().status)) {
    await setDoc(ref, {
      kind, label, ...extraFields,
      requestedBy: me.uid, requestedByName: me.name || '',
      approvals: [me.uid], status: 'pending', createdAt: serverTimestamp(),
    });
    alert('Request recorded. This needs approval from a second admin before it runs — see "Pending Approvals" below.');
    return;
  }

  const data = snap.data();
  if (data.approvals.includes(me.uid)) {
    alert('You already approved this request. Waiting for a different admin to approve it.');
    return;
  }

  const approvals = [...data.approvals, me.uid];
  const nowApproved = approvals.length >= 2;
  await updateDoc(ref, { approvals, status: nowApproved ? 'approved' : 'pending' });
  alert(nowApproved
    ? 'Approved by 2 admins — this will run in the background within a few seconds.'
    : 'Approval recorded. Still needs one more admin.');
}

/** Live-renders the list of pending/approved/failed (not-yet-cleared) requests. */
export function watchPendingActions(containerEl, me, isPrimaryAdmin) {
  const q = query(collection(db, 'pendingActions'), where('status', 'in', ['pending', 'approved', 'failed']));
  return onSnapshot(q, (snap) => {
    const rows = [];
    snap.forEach((d) => {
      const a = d.data();
      if (a.kind === 'primaryAdminChange' && !isPrimaryAdmin) return; // only primary admins see these
      const mine = a.approvals.includes(me.uid);
      const needsManualRerun = a.status === 'approved' && a.kind === 'delete' && a.targetCollection === 'events';
      const statusTag = a.status === 'failed'
        ? `<span style="color:#c62828;font-weight:700;">FAILED — ${a.error || ''}</span>`
        : a.status === 'approved' ? (needsManualRerun
            ? '<span style="color:#e65100;font-weight:700;">Approved — click Delete on that event again to finish</span>'
            : '<span style="color:#2e7d32;font-weight:700;">Approved — executing…</span>')
        : `<span>${a.approvals.length}/2 approvals</span>`;
      rows.push(`
        <div style="display:flex;justify-content:space-between;align-items:center;gap:1rem;padding:0.75rem 1rem;border:1px solid var(--border);border-radius:8px;margin-bottom:0.6rem;">
          <div>
            <div style="font-weight:600;">${a.label}</div>
            <div style="font-size:0.78rem;color:var(--text-light);">Requested by ${a.requestedByName || a.requestedBy} · ${statusTag}</div>
          </div>
          ${a.status === 'pending' && !mine
            ? `<button class="btn-primary" style="padding:0.4rem 0.9rem;font-size:0.82rem;" onclick="window.__approvePendingAction('${d.id}')">Approve</button>`
            : mine ? '<span style="font-size:0.78rem;color:var(--text-light);">You approved this</span>' : ''}
        </div>`);
    });
    containerEl.innerHTML = rows.length
      ? rows.join('')
      : '<p style="color:var(--text-light);font-size:0.88rem;">No pending approvals.</p>';
  });
}

/**
 * Generic "Approve" button used from the Pending Approvals panel.
 * For simple single-document deletes and the leaderboard reset, this
 * finishes the job immediately. For the event-delete cascade and the
 * server-executed kinds (restore / primaryAdminChange), it just
 * records the 2nd approval — see SCOPE NOTE above / the Cloud Function.
 */
export async function approvePendingActionGeneric(actionId, me) {
  const ref = doc(db, 'pendingActions', actionId);
  const snap = await getDoc(ref);
  if (!snap.exists()) return alert('This request no longer exists.');
  const data = snap.data();
  if (data.status !== 'pending') return alert('This request is no longer awaiting approval.');
  if (data.approvals.includes(me.uid)) return alert('You already approved this request.');
  if (!confirm(`Approve: "${data.label}"? This is a second, independent confirmation.`)) return;
  if (!confirm('Are you sure? Once approved this action runs immediately.')) return;

  const approvals = [...data.approvals, me.uid];
  await updateDoc(ref, { approvals, status: 'approved' });

  if (data.kind === 'delete' && SIMPLE_DELETE_COLLECTIONS.includes(data.targetCollection)) {
    try {
      await deleteDoc(doc(db, data.targetCollection, data.targetDocId));
      await updateDoc(ref, { status: 'executed', executedAt: serverTimestamp() });
      alert('Approved and deleted.');
    } catch (e) {
      await updateDoc(ref, { status: 'failed', error: String(e.message || e) }).catch(() => {});
      alert('Approved, but the delete failed: ' + e.message);
    }
  } else if (data.kind === 'delete' && data.targetCollection === 'settings') {
    try {
      await setDoc(doc(db, 'settings', data.targetDocId), { resetAt: serverTimestamp() }, { merge: true });
      await updateDoc(ref, { status: 'executed', executedAt: serverTimestamp() });
      alert('Approved — leaderboard reset.');
    } catch (e) {
      await updateDoc(ref, { status: 'failed', error: String(e.message || e) }).catch(() => {});
      alert('Approved, but the reset failed: ' + e.message);
    }
  } else {
    alert('Approval recorded.' + (data.kind === 'delete' ? ' Go to that event and click Delete again to finish removing it.' : ' This will run automatically in the background.'));
  }
}

window.__approvePendingAction = function (actionId) {
  window.__dangerActionsMe && approvePendingActionGeneric(actionId, window.__dangerActionsMe);
};
