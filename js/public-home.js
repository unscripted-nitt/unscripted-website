// js/public-home.js — loads events & gallery on homepage from Firestore

import { db } from './firebase-config.js';
import { collection, getDocs, query, orderBy, limit, where } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// ── EVENTS PREVIEW ──────────────────────────────────────────
async function loadEventsPreview() {
  const container = document.getElementById('events-preview-container');
  if (!container) return;
  try {
    const q = query(collection(db, 'events'), orderBy('date', 'desc'));
    const snap = await getDocs(q);
    container.innerHTML = '';
    if (snap.empty) {
      container.innerHTML = '<p style="color:var(--mid);text-align:center;padding:2rem;">No events yet. Check back soon!</p>';
      return;
    }
    snap.forEach(doc => {
      const e = doc.data();
      const dateStr = e.date?.toDate ? e.date.toDate().toLocaleDateString('en-IN', {day:'numeric',month:'long',year:'numeric'}) : (e.date || '');
      const isUpcoming = e.type === 'upcoming';
      container.innerHTML += `
        <div class="event-card fade-up">
          <div class="event-date">${dateStr}</div>
          <div class="event-title">${e.title || 'Untitled Event'}</div>
          <div class="event-desc">${e.description || ''}</div>
          <span class="event-badge ${isUpcoming ? 'badge-upcoming' : 'badge-past'}">${isUpcoming ? '🗓️ Upcoming' : '✓ Past'}</span>
        </div>`;
    });
    document.querySelectorAll('.fade-up').forEach(el => {
      setTimeout(() => el.classList.add('visible'), 100);
    });
  } catch(err) {
    container.innerHTML = '<p style="color:var(--mid);text-align:center;padding:2rem;">Could not load events.</p>';
    console.warn('Events load error:', err);
  }
}

// ── GALLERY PREVIEW ─────────────────────────────────────────
async function loadGalleryPreview() {
  const container = document.getElementById('galleryPreview');
  if (!container) return;
  try {
    const q = query(collection(db, 'gallery'), orderBy('date', 'desc'));
    const snap = await getDocs(q);
    container.innerHTML = '';
    if (snap.empty) {
      container.innerHTML = '<div class="gallery-placeholder">📸 No photos yet.</div>';
      return;
    }
    snap.forEach(doc => {
      const p = doc.data();
      const img = document.createElement('img');
      img.src = p.url;
      img.alt = p.caption || 'Unscripted moment';
      img.loading = 'lazy';
      img.onclick = () => openLightbox(p.url);
      container.appendChild(img);
    });
  } catch(err) {
    container.innerHTML = '<div class="gallery-placeholder">📸 Gallery loading...</div>';
  }
}

function openLightbox(src) {
  const lb = document.getElementById('lightbox');
  const img = document.getElementById('lightboxImg');
  if (lb && img) { img.src = src; lb.classList.add('open'); }
}
window.closeLightbox = function() {
  document.getElementById('lightbox')?.classList.remove('open');
};

loadEventsPreview();
loadGalleryPreview();
