// js/public-home.js — loads events & gallery on homepage from Firestore

import { db, auth } from './firebase-config.js';
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
    let eventsRendered = 0;
    
    snap.forEach(doc => {
      const e = doc.data();
      const isActive = e.isActive === true; 
      
      // Strict filter: Do not show on homepage if deactivated by Admin
      if (!isActive) return;
      
      eventsRendered++;

      let dateStr = '—';
      if (e.date) {
        try {
          const dObj = e.date.toDate ? e.date.toDate() : new Date(e.date);
          dateStr = dObj.toLocaleDateString('en-IN', { day:'numeric', month:'long', year:'numeric' });
        } catch(e) { dateStr = String(e.date); }
      }
      const isUpcoming = e.type === 'upcoming';
      
      let rolesHtml = '';
      if (e.rolesDisplay && e.rolesDisplay.length > 0) {
        rolesHtml = '<div class="event-roles-grid" style="margin-top:1.5rem; display:flex; flex-wrap:wrap; gap:0.5rem;">';
        e.rolesDisplay.forEach(r => {
           rolesHtml += `<span style="background:rgba(0,0,0,0.05); color:var(--dark); padding:0.4rem 0.8rem; border-radius:100px; font-size:0.75rem; font-weight:600;"><span style="color:var(--admin-accent); margin-right:0.3rem;">${r.role}</span> ${r.name}</span>`;
        });
        rolesHtml += '</div>';
      }
      
      container.innerHTML += `
        <div class="event-card fade-up ${isActive ? 'active-event' : ''}">
          <div class="event-date">${dateStr}</div>
          <div class="event-title">${e.title || 'Untitled Event'}</div>
          <div class="event-desc">${e.description || ''}</div>
          ${rolesHtml}
          <span class="event-badge ${isActive ? 'badge-live' : (isUpcoming ? 'badge-upcoming' : 'badge-past')}">${isActive ? '⚡ LIVE NOW' : (isUpcoming ? '🗓️ Upcoming' : '✓ Past')}</span>
        </div>`;
    });
    
    if (eventsRendered === 0) {
        container.innerHTML = '<p style="color:var(--mid);text-align:center;padding:2rem;">No live events currently listed.</p>';
    } else {
        document.querySelectorAll('.fade-up').forEach(el => {
          setTimeout(() => el.classList.add('visible'), 100);
        });
    }
  } catch(err) {
    container.innerHTML = '<p style="color:var(--mid);text-align:center;padding:2rem;">Could not load events.</p>';
    console.warn('Events load error:', err);
  }
}

// ── GALLERY PREVIEW ─────────────────────────────────────────
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

async function loadGalleryPreview(isLoggedIn = false) {
  const container = document.getElementById('galleryPreview');
  if (!container) return;
  try {
    let q;
    if (isLoggedIn) {
      // Members see everything
      q = query(collection(db, 'gallery'), orderBy('date', 'desc'));
    } else {
      // Guests see only public
      q = query(collection(db, 'gallery'), where('visibility', '==', 'public'), orderBy('date', 'desc'));
    }
    
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
    console.warn('Gallery load error:', err);
    container.innerHTML = '<div class="gallery-placeholder">📸 Gallery loading...</div>';
  }
}

// Re-run gallery load when auth state changes
onAuthStateChanged(auth, (user) => {
  loadGalleryPreview(!!user);
});

function openLightbox(src) {
  const lb = document.getElementById('lightbox');
  const img = document.getElementById('lightboxImg');
  if (lb && img) { img.src = src; lb.classList.add('open'); }
}
window.closeLightbox = function() {
  document.getElementById('lightbox')?.classList.remove('open');
};

// ── PATHWAYS PREVIEW ───────────────────────────────────────
async function loadPathwaysPreview() {
  const container = document.getElementById('pathways-preview-grid');
  if (!container) return;
  try {
    const snap = await getDocs(collection(db, 'pathways'));
    container.innerHTML = '';
    const order = ['L1', 'L2', 'L3K', 'L3H'];
    const pData = {};
    snap.forEach(d => pData[d.id] = d.data());

    order.forEach((id, i) => {
      const p = pData[id];
      if (!p) return;
      const card = document.createElement('div');
      card.className = 'pathway-card fade-up';
      card.style.transitionDelay = (i * 0.1) + 's';
      card.innerHTML = `
        <div class="pathway-num">0${i + 1}</div>
        <h3>${p.name}</h3>
        <p>${p.description || ''}</p>
        <span class="pathway-tag">${i < 2 ? (i === 0 ? 'Beginner' : 'Intermediate') : 'Advanced'}</span>
      `;
      container.appendChild(card);
    });
    
    // Trigger animations
    setTimeout(() => {
      container.querySelectorAll('.fade-up').forEach(el => el.classList.add('visible'));
    }, 100);
  } catch (err) {
    console.warn('Pathways preview error:', err);
    container.innerHTML = '<p style="color:var(--mid);">Could not load pathways.</p>';
  }
}

loadEventsPreview();
loadPathwaysPreview();
loadGalleryPreview();
