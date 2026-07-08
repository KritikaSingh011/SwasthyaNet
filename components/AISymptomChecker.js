import { runGeminiTriage, scanMedicalReport } from '../services/gemini.js';
import { cloudSpeechToText, cloudTextToSpeech, startVoiceRecognition } from '../services/voice.js';

export function renderAISymptomChecker(container, state, actions) {
  let isRecording = false;
  let mediaRecorder = null;
  let audioChunks = [];
  let nativeRecognizer = null;

  container.innerHTML = `
    <div class="card ai-symptom-panel">
      <div class="ai-symptom-head">
        <div class="ai-symptom-icon">🤖</div>
        <div style="flex:1;">
          <h3>${state.translate("aiPanelTitle")}</h3>
          <p>${state.translate("aiPanelSub")}</p>
        </div>
        <div class="ai-lang-note">${state.translate("aiLangNote")}</div>
      </div>

      <div class="form-field full">
        <label>${state.translate("lblDescribeSymptoms")}</label>
        <textarea class="dictation-box ai-big-textarea" id="symptom-text" rows="4" placeholder="e.g. I have a throbbing headache, feeling feverish and lightheaded when standing up."></textarea>
      </div>

      <div class="mic-row">
        <button class="mic-btn mic-btn-big" id="symptom-mic-btn">
          🎙️ <span id="mic-btn-text">${state.translate("speakSymptoms")}</span>
        </button>
        
        <label class="scan-drop" style="flex:1; max-width:250px; display:inline-flex; align-items:center; justify-content:center; gap:8px;">
          📁 <span>${state.translate("scanReport")}</span>
          <input type="file" accept="image/*" id="report-file-input" style="display:none;">
        </label>
        
        <button class="btn btn-primary ai-analyze-btn" id="symptom-analyze-btn">${state.translate("getAdvice")}</button>
      </div>

      <div class="ai-chip-row">
        <span class="chip-label">${state.translate("chipLabel")}</span>
        <button class="ai-chip" data-chip="${state.translate("chip1")}">${state.translate("chip1")}</button>
        <button class="ai-chip" data-chip="${state.translate("chip2")}">${state.translate("chip2")}</button>
        <button class="ai-chip" data-chip="${state.translate("chip3")}">${state.translate("chip3")}</button>
        <button class="ai-chip" data-chip="${state.translate("chip4")}">${state.translate("chip4")}</button>
      </div>

      <div id="scan-status" style="font-size:12px; color:var(--muted); margin-top:8px;"></div>
      <div class="ai-disclaimer">${state.translate("aiLegalDisclaimer")}</div>

      <!-- Triage Output Box -->
      <div id="triage-output" style="margin-top:16px;"></div>
    </div>
  `;

  const symptomText = container.querySelector('#symptom-text');
  const micBtn = container.querySelector('#symptom-mic-btn');
  const micText = container.querySelector('#mic-btn-text');
  const fileInput = container.querySelector('#report-file-input');
  const scanStatus = container.querySelector('#scan-status');
  const analyzeBtn = container.querySelector('#symptom-analyze-btn');
  const outputArea = container.querySelector('#triage-output');

  // Chip helpers
  container.querySelectorAll('.ai-chip').forEach(chip => {
    chip.onclick = () => {
      symptomText.value = chip.dataset.chip;
      triggerTriageAnalysis();
    };
  });

  // Microphone speech to text
  micBtn.onclick = async () => {
    if (isRecording) {
      if (nativeRecognizer) {
        nativeRecognizer.stop();
        nativeRecognizer = null;
      }
      if (mediaRecorder && mediaRecorder.state !== 'inactive') {
        mediaRecorder.stop();
      }
      isRecording = false;
      micBtn.classList.remove('listening');
      micText.textContent = state.translate("speakSymptoms");
    } else {
      // 1. Try native Web Speech API recognition first
      const nativeRec = startVoiceRecognition(
        (text) => {
          if (text) {
            symptomText.value = (symptomText.value ? symptomText.value + ' ' : '') + text;
          }
        },
        () => {
          isRecording = false;
          micBtn.classList.remove('listening');
          micText.textContent = state.translate("speakSymptoms");
          nativeRecognizer = null;
        },
        state.currentLang
      );

      if (nativeRec) {
        isRecording = true;
        nativeRecognizer = nativeRec;
        micBtn.classList.add('listening');
        micText.textContent = state.translate("listeningTapStop");
        return;
      }

      // 2. Cloud Fallback using MediaRecorder
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        actions.toast("Microphone access is not supported by your browser.", true);
        return;
      }

      audioChunks = [];
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        mediaRecorder = new MediaRecorder(stream);
        
        mediaRecorder.ondataavailable = (event) => {
          audioChunks.push(event.data);
        };

        mediaRecorder.onstop = async () => {
          const audioBlob = new Blob(audioChunks, { type: 'audio/webm' });
          scanStatus.textContent = "🎙️ Transcribing speech via Google Cloud Speech-to-Text...";
          const text = await cloudSpeechToText(audioBlob, state.currentLang);
          scanStatus.textContent = "";
          if (text) {
            symptomText.value = (symptomText.value ? symptomText.value + ' ' : '') + text;
          } else {
            actions.toast("Could not recognize speech. Please speak clearly.", true);
          }
        };

        mediaRecorder.start();
        isRecording = true;
        micBtn.classList.add('listening');
        micText.textContent = state.translate("listeningTapStop");
      } catch (err) {
        console.error("Mic access error:", err);
        actions.toast("Failed to access microphone. Check browser permissions.", true);
      }
    }
  };

  // Multimodal Medical Report Scanner
  fileInput.onchange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    scanStatus.textContent = `📄 Extracting metrics from ${file.name} using Gemini Multimodal...`;
    
    // Read file as base64
    const reader = new FileReader();
    reader.onload = async () => {
      const base64Data = reader.result;
      const parsedText = await scanMedicalReport(base64Data, file.type);
      scanStatus.textContent = "";
      
      if (parsedText) {
        symptomText.value = (symptomText.value ? symptomText.value + '\n' : '') + `[Report Summary: ${parsedText}]`;
        actions.toast("Medical report parsed successfully!");
      } else {
        actions.toast("Could not extract insights from document.", true);
      }
    };
    reader.readAsDataURL(file);
  };

  // Get Advice (Triage) Trigger
  analyzeBtn.onclick = () => triggerTriageAnalysis();

  async function triggerTriageAnalysis() {
    const text = symptomText.value.trim();
    if (!text) {
      actions.toast(state.currentLang === 'hi' ? "कृपया पहले अपने लक्षण बताएं" : "Please describe your symptoms first", true);
      return;
    }

    analyzeBtn.disabled = true;
    analyzeBtn.textContent = "Analyzing...";
    outputArea.innerHTML = `<div class="empty-note">🤖 Gemini is evaluating your health parameters...</div>`;

    const patientHist = state.patients.find(p => p.name.toLowerCase() === state.currentUser?.name?.toLowerCase()) || null;
    const result = await runGeminiTriage(text, state.currentLang, patientHist);
    
    analyzeBtn.disabled = false;
    analyzeBtn.textContent = state.translate("getAdvice");

    renderTriageResult(result, text);
  }

  function renderTriageResult(result, rawText) {
    let html = "";
    
    if (result.urgent) {
      html += `
        <div class="ai-result-card urgent">
          <div class="ai-result-banner urgent">${state.translate("aiUrgentTitle")}</div>
          <div class="ai-result-body">
            <p style="margin:0; font-size:13.5px; line-height:1.6;">${state.translate("aiUrgentBody") || result.seeDoctor}</p>
          </div>
          <div class="ai-result-actions">
            <button class="btn btn-coral btn-sm" id="btn-urgent-advice">🚨 Request Urgent Doctor Advice</button>
            <button class="btn btn-ghost btn-sm" id="btn-speak-advice">🔊 Read Aloud</button>
          </div>
        </div>
      `;
    }

    // Suspected conditions detail block
    html += `
      <div class="ai-result-card" style="margin-top: 12px;">
        <div class="ai-result-banner ok">${state.translate("aiRoutineTitle")} - ${result.label}</div>
        <div class="ai-result-body">
          <div class="ai-symptom-block">
            <h5>Suspected Causes</h5>
            <ul>${result.possibleCauses.map(c => `<li>${c}</li>`).join('')}</ul>
            
            <h5 style="margin-top: 12px;">Suggested Solutions (OTC)</h5>
            <ul>${result.medicine.map(m => `<li>${m}</li>`).join('')}</ul>
            
            <h5 style="margin-top: 12px;">Home Remedies</h5>
            <ul>${result.homeRemedy.map(r => `<li>${r}</li>`).join('')}</ul>
            
            <div class="see-doc" style="margin-top: 12px; font-weight: 600; color: var(--coral-600);">
              ⚠️ ${result.seeDoctor}
            </div>
          </div>
        </div>
        <div class="ai-result-actions">
          <button class="btn btn-primary btn-sm" id="btn-book-regular">📅 Book Regular Appointment</button>
          ${!result.urgent ? `<button class="btn btn-ghost btn-sm" id="btn-speak-advice-routine">🔊 Read Aloud</button>` : ''}
        </div>
      </div>
    `;

    outputArea.innerHTML = html;
    outputArea.scrollIntoView({ behavior: 'smooth', block: 'nearest' });

    // Speak triage result text using Text-to-Speech
    const speechSummary = `${result.label}. Suggested medicine: ${result.medicine.join(', ')}. ${result.seeDoctor}`;
    
    // Bind actions
    const speakBtnUrgent = outputArea.querySelector('#btn-speak-advice');
    if (speakBtnUrgent) speakBtnUrgent.onclick = () => cloudTextToSpeech(speechSummary, state.currentLang);

    const speakBtnRoutine = outputArea.querySelector('#btn-speak-advice-routine');
    if (speakBtnRoutine) speakBtnRoutine.onclick = () => cloudTextToSpeech(speechSummary, state.currentLang);

    const urgentBtn = outputArea.querySelector('#btn-urgent-advice');
    if (urgentBtn) {
      urgentBtn.onclick = () => {
        actions.requestUrgentAdvice(rawText);
      };
    }

    const regularBtn = outputArea.querySelector('#btn-book-regular');
    if (regularBtn) {
      regularBtn.onclick = () => actions.setPatientTab('doctors');
    }
  }
}
