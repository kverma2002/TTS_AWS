const API_URL = "API Gateway URL"; // Update this with your actual API endpoint if needed

async function getAuthToken() {
  return new Promise((resolve) => {
    chrome.storage.local.get(["tokens"], (data) => {
      if (data.tokens && data.tokens.access_token) {
        resolve(data.tokens.access_token);
      } else {
        resolve(null);
      }
    });
  });
}

function injectOverlayCSS() {
  if (!document.getElementById("overlay-css")) {
    const link = document.createElement("link");
    link.id = "overlay-css";
    link.rel = "stylesheet";
    link.href = chrome.runtime.getURL("overlay.css");
    document.head.appendChild(link);
  }
}

// Create or retrieve the overlay container
function getOrCreateOverlay() {
  injectOverlayCSS();

  let overlay = document.getElementById("tts-overlay-player");
  if (!overlay) {
    overlay = document.createElement("div");
    overlay.id = "tts-overlay-player";
    overlay.className = "tts-overlay-player";
    // Minimal single-row design
    overlay.innerHTML = `
      <!-- Close button (top-right corner) -->
      <button id="tts-close-btn" class="tts-close-btn">&times;</button>

      <!-- Loading spinner, hidden once audio is ready -->
      <div id="tts-loading-spinner" class="tts-spinner"></div>

      <!-- Play/Pause button with icon -->
      <button id="tts-play-pause-btn" class="tts-play-pause-btn">
        <span id="tts-play-pause-icon">❚❚</span>
      </button>

      <!-- Progress bar -->
      <input 
        type="range" 
        id="tts-progress-bar" 
        class="tts-progress-bar" 
        min="0" 
        max="100" 
        value="0"
      />

      <!-- Time display (e.g. "0:00 / 0:30") -->
      <span id="tts-time-display" class="tts-time-display">0:00 / 0:00</span>
    `;
    document.body.appendChild(overlay);

    // Close/hide the overlay
    overlay.querySelector("#tts-close-btn").addEventListener("click", () => {
      overlay.style.display = "none";
      if (overlay.audioObj) {
        overlay.audioObj.pause();
      }
      overlay.audioObj = null;
    });
  }
  return overlay;
}

// Convert seconds to mm:ss
function formatTime(seconds) {
  const minutes = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${minutes}:${secs < 10 ? "0" : ""}${secs}`;
}

// Fetch TTS audio
async function fetchTTSAudio(text, config) {

  // Get auth token
  const authToken = await getAuthToken();

  console.log("Auth token:", authToken);

  if (!authToken) {
    throw new Error("No auth token available. Please sign in.");
  }

  const payload = {
    text: text,
    voice: config.voice || "Joanna",
    engine: config.engine || "standard",
    speed: config.speed || 1.0
  };

  console.log("Fetching TTS audio with payload:", payload);
  console.log("Using auth token:", authToken);

  return fetch(API_URL, {
    method: "POST",
    headers: { 
      "Content-Type": "application/json",
      "Authorization": `${authToken}`
    },
    body: JSON.stringify(payload)
  })
    .then(response => {
      console.log("Response:", response);
      if (!response.ok) {
        throw new Error(`Network response not ok: ${response.status}`);
      }
      return response.blob();
    });
}

// Listen for messages from background.js
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === "speakText" && message.text) {
    console.log("Received speakText message:", message.text);

    // If overlay is currently visible, ignore
    const existingOverlay = document.getElementById("tts-overlay-player");
    if (existingOverlay && existingOverlay.style.display !== "none") {
      console.log("Overlay is already visible, ignoring...");
      return;
    }

    // Create/show the overlay
    const overlay = getOrCreateOverlay();
    overlay.style.display = "flex";

    // Grab references to elements
    const spinner = document.getElementById("tts-loading-spinner");
    const playPauseBtn = overlay.querySelector("#tts-play-pause-btn");
    const playPauseIcon = overlay.querySelector("#tts-play-pause-icon");
    const progressBar = overlay.querySelector("#tts-progress-bar");
    const timeDisplay = overlay.querySelector("#tts-time-display");

    // Show spinner initially
    spinner.style.display = "block";

    // Hide controls until audio is ready
    playPauseBtn.style.display = "none";
    progressBar.style.display = "none";
    timeDisplay.style.display = "none";

    // Get TTS config from storage
    chrome.storage.local.get("ttsConfig", (data) => {
      const config = data.ttsConfig || {};
      fetchTTSAudio(message.text, config)
        .then(blob => {
          const audioUrl = URL.createObjectURL(blob);
          spinner.style.display = "none";

          // Show controls once loaded
          playPauseBtn.style.display = "inline-block";
          progressBar.style.display = "inline-block";
          timeDisplay.style.display = "inline-block";

          const audio = new Audio(audioUrl);
          overlay.audioObj = audio;
          audio.playbackRate = parseFloat(config.speed) || 1.0;

          // Update time display after metadata is loaded
          audio.addEventListener("loadedmetadata", () => {
            timeDisplay.textContent = `0:00 / ${formatTime(audio.duration)}`;
            progressBar.max = Math.floor(audio.duration);
          });

          // Update current time / progress
          audio.addEventListener("timeupdate", () => {
            progressBar.value = Math.floor(audio.currentTime);
            timeDisplay.textContent = 
              `${formatTime(audio.currentTime)} / ${formatTime(audio.duration)}`;
          });

          // Seek via the progress bar
          progressBar.addEventListener("input", (e) => {
            audio.currentTime = e.target.value;
          });

          // Toggle play/pause with icons
          playPauseBtn.addEventListener("click", () => {
            if (audio.paused) {
              audio.play();
              playPauseIcon.textContent = "❚❚";  // pause icon
            } else {
              audio.pause();
              playPauseIcon.textContent = "▶";   // play icon
            }
          });

          // Start playback
          audio.play();
          playPauseIcon.textContent = "❚❚";  // show pause icon initially
        })
        .catch(err => {
          console.error("Error fetching TTS audio:", err);
          spinner.style.display = "none";
        });
    });
  }
});
