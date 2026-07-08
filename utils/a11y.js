import { cloudTextToSpeech } from '../services/voice.js';

let a11yScaleStep = 0; 
let readAloudOn = false;
let checkInterval = null;

export function changeTextSize(dir) {
  a11yScaleStep = Math.max(-2, Math.min(3, a11yScaleStep + dir));
  const scale = 1 + a11yScaleStep * 0.12;
  document.documentElement.style.setProperty('--a11y-scale', scale);
  
  ['app-root', 'login-gate'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.style.zoom = scale;
  });
}

export function toggleContrast() {
  document.body.classList.toggle('contrast-high');
  const btn = document.getElementById('contrast-toggle-btn');
  if (btn) btn.classList.toggle('active');
}

export function speakTextContent(text, lang = 'en') {
  cloudTextToSpeech(text, lang);
}

export function toggleReadAloud(lang = 'en') {
  readAloudOn = !readAloudOn;
  
  const toggleBtn = document.getElementById('readaloud-toggle-btn');
  const fab = document.getElementById('readaloud-fab');
  
  if (toggleBtn) toggleBtn.classList.toggle('active', readAloudOn);
  if (fab) fab.classList.toggle('on', readAloudOn);
  
  if (readAloudOn) {
    const activeView = document.querySelector('.view.active');
    let bits = [];
    if (activeView) {
      activeView.querySelectorAll('h1, h2, h3, .section-head p, .hero p, .eyebrow').forEach(n => {
        if (n.offsetParent !== null) bits.push(n.innerText.trim());
      });
    }
    const fullText = bits.filter(Boolean).join('. ');
    speakTextContent(fullText, lang);
    
    checkInterval = setInterval(() => {
      if (!readAloudOn) {
        clearInterval(checkInterval);
        return;
      }
      // Simple monitoring of active synthesis states
      // In production, bind to audio element "ended" events
    }, 1000);
  } else {
    // Stop playing audio
    const audios = document.querySelectorAll("audio");
    audios.forEach(a => a.pause());
    if (checkInterval) clearInterval(checkInterval);
  }
}
