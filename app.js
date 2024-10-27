import { createAudioContext } from "./audioContext";
import {
  frequencies,
  calculateMidpoints,
  filterFrequenciesByKey,
} from "./frequencies";
import { detectFrequency } from "./matchFrequency";

const {
  getAudioContext,
  getAudioInput,
  getDetector,
  sleep,
  getIsListening,
  getAnalyserNode,
  getVoiceActivatedNote,
  getIsAudioEnabled,
  setIsAudioEnabled,
  setVoiceActivatedNote,
  initDetector,
  playTone,
  resetTimeout,
  disconnect,
} = createAudioContext();

const keySelect = document.querySelectorAll('input[name="key-select"]');

document.querySelector("#scales").addEventListener("change", (event) => {
  const checked = event.target.checked;
  if (!checked) {
    const allKeySelect = document.querySelector("#all-key-select");
    allKeySelect.click();
  }
  const radios = document.querySelector(".key-radios");
  radios.style.visibility = checked ? "visible" : "hidden";
});

let currNoteOptions = Object.keys(frequencies).sort(
  (a, b) => frequencies[a] - frequencies[b]
);
let currFrequencyOptions = Object.values(frequencies).sort(
  (a, b) => frequencies[a] - frequencies[b]
);

let currMidpoints = calculateMidpoints(frequencies);

keySelect.forEach((radio) => {
  radio.addEventListener("change", handleKeySelect);
});

function handleKeySelect(event) {
  const selectedKey = event.target.value;
  const filteredByKey = filterFrequenciesByKey(selectedKey);
  currNoteOptions = Object.keys(filteredByKey).sort(
    (a, b) => frequencies[a] - frequencies[b]
  );
  currFrequencyOptions = Object.values(filteredByKey).sort(
    (a, b) => frequencies[a] - frequencies[b]
  );

  currMidpoints = calculateMidpoints(filteredByKey);
}

const currAudioTime = () => getAudioContext().currentTime;

const enableAudioSelect = document.querySelectorAll(
  'input[name="audio-select"]'
);
enableAudioSelect.forEach((radio) => {
  radio.addEventListener("change", (event) => {
    setIsAudioEnabled(event.target.value === "true");
  });
});

const getOctave = (note) => (note ? parseInt(note.match(/\d+/)[0], 10) : null);
const getNoteName = (note) => (note ?? "").replace(/\d/, "");

const pianoKeys = {};

function createPiano() {
  const piano = document.getElementById("piano");
  const keys = Object.keys(frequencies);

  keys.forEach((note) => {
    const key = document.createElement("button");
    const isWhite = !note.includes("#");
    key.className = `key ${!isWhite ? "black" : "white"} btn`;
    key.dataset.note = note;
    if (["B", "E"].includes(getNoteName(note))) {
      key.classList.add("consecutive-white");
    }
    key.id = note.toString();
    key.addEventListener("mousedown", () => {
      toggleHighlightKey(key, "start");
      playTone(frequencies[note])();
    });
    key.addEventListener("mouseup", () => {
      toggleHighlightKey(key, "end");
    });
    pianoKeys[note] = key;

    piano.appendChild(key);
  });
}

function toggleHighlightKey(key, marker) {
  if (getIsListening()) {
    if (marker === "start") {
      key.style.backgroundColor = "red";
    } else if (marker === "end") {
      key.style.backgroundColor = key.classList.contains("black")
        ? "black"
        : "white";
    }
  }
}

let lastPlayedNote = null;
let lastPlayedTime = 0;
const MIN_PLAY_INTERVAL = 600;

function activateFromVoice(note) {
  const currTime = currAudioTime();
  const prevActiveKey = getVoiceActivatedNote()
    ? pianoKeys[getVoiceActivatedNote()]
    : null;
  const newActiveKey = note ? pianoKeys[note] : null;

  if (prevActiveKey && prevActiveKey !== newActiveKey) {
    toggleHighlightKey(prevActiveKey, "end");
    lastPlayedNote = null;
  }

  if (newActiveKey) {
    const prevNote = getNoteName(getVoiceActivatedNote());
    const newNoteName = getNoteName(note);
    const prevOctave = getOctave(getVoiceActivatedNote());
    const newOctave = getOctave(note);
    const isTempNote =
      note !== getVoiceActivatedNote() ||
      (prevNote === newNoteName && Math.abs(newOctave - prevOctave) === 1);
    const holdNote =
      lastPlayedNote === note && currTime - lastPlayedTime < MIN_PLAY_INTERVAL;
    if (!isTempNote && !holdNote) {
      toggleHighlightKey(newActiveKey, "start");
      lastPlayedNote = note;
      lastPlayedTime = currTime;
      if (getIsAudioEnabled()) {
        playTone(frequencies[note])();
      } else {
        resetTimeout();
      }
    } else if (!holdNote) {
      newActiveKey.style.backgroundColor = "#ccc";
    }
    setVoiceActivatedNote(note);
  }
}

let lastProcessedTime = 0;
const PROCESS_INTERVAL = 75;
let rafId = null;

let lastActivityTime = Date.now();
const INACTIVITY_TIMEOUT = 12000;
const SLEEP_TIMEOUT = 6000;

function getMicrophoneFrequency() {
  if (!getIsListening()) {
    cancelAnimationFrame(rafId);
    rafId = null;
    return;
  }

  const now = Date.now();

  if (now - lastActivityTime > INACTIVITY_TIMEOUT) {
    if (rafId) {
      cancelAnimationFrame(rafId);
      rafId = null;
    }
    disconnect();
    return;
  } else if (now - lastActivityTime > SLEEP_TIMEOUT) {
    sleep();
  }

  if (now - lastProcessedTime >= PROCESS_INTERVAL) {
    lastProcessedTime = now;

    getAnalyserNode().getFloatTimeDomainData(getAudioInput());
    const [pitch, clarity] = getDetector().findPitch(
      getAudioInput(),
      getAudioContext().sampleRate
    );

    if (clarity > 0.9 && pitch >= 70 && pitch <= 395) {
      lastActivityTime = now; // Reset inactivity timer when we detect a valid pitch
      const matchedNoteIdx = detectFrequency(pitch, currMidpoints);
      var newNote = currNoteOptions[matchedNoteIdx];

      if (
        lastPlayedNote === newNote &&
        currAudioTime() - lastPlayedTime >= MIN_PLAY_INTERVAL
      ) {
        lastPlayedNote = null;
      }

      if ((newNote || getVoiceActivatedNote()) && lastPlayedNote !== newNote) {
        activateFromVoice(newNote);
      }
    } else {
      if (getVoiceActivatedNote()) {
        activateFromVoice(null);
      }
    }
  }

  rafId = requestAnimationFrame(getMicrophoneFrequency);
}

const listenButton = document.getElementById("start-button");

listenButton.addEventListener("click", async () => {
  try {
    if (!getIsListening()) {
      listenButton.textContent = "Stop";
      await initDetector();
      lastActivityTime = Date.now(); // Reset activity timer when starting
      rafId = requestAnimationFrame(getMicrophoneFrequency);
    } else {
      if (rafId) {
        cancelAnimationFrame(rafId);
        rafId = null;
      }
      disconnect();
    }
  } catch (error) {
    console.error("Failed to initialize audio:", error);
    if (rafId) {
      cancelAnimationFrame(rafId);
      rafId = null;
    }
    disconnect();
  }
});

function cleanup() {
  if (rafId) {
    cancelAnimationFrame(rafId);
    rafId = null;
  }
  keySelect.forEach((radio) => {
    radio.removeEventListener("change", handleKeySelect);
  });
  enableAudioSelect.forEach((radio) => {
    radio.removeEventListener("change", handler);
  });
  disconnect();
}

// Add event listener for page unload
window.addEventListener("unload", cleanup);

createPiano();
