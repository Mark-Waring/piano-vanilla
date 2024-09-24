import {createAudioContext} from "./audioContext";
import {frequencies, scales} from "./frequencies";
import {detectFrequency} from "./detectFrequency";

const listenButton = document.getElementById("start-button");

const {
  getAudioContext,
  getAudioInput,
  getDetector,
  getOscillator,
  getIsListening,
  getAnalyserNode,
  getVoiceActivatedNote,
  setVoiceActivatedNote,
  initDetector,
  playTone,
  disconnect
} = createAudioContext(listenButton)

let currNoteOptions = Object.keys(frequencies).sort(
  (a, b) => frequencies[a] - frequencies[b]
);
let currFrequencyOptions = Object.values(frequencies).sort(
  (a, b) => frequencies[a] - frequencies[b]
);
const keySelect = document.querySelectorAll('input[name="key-select"]');

function calculateMidpoints(frequencies) {
  const midpoints = [];
  const freqArray = Object.values(frequencies).sort((a, b) => a - b);

  for (let i = 0; i < freqArray.length - 1; i++) {
    const geometricMean = Math.sqrt(freqArray[i] * freqArray[i + 1]);
    midpoints.push(geometricMean);
  }

  return midpoints;
}

let currMidpoints = calculateMidpoints(frequencies);

keySelect.forEach((radio) => {
  radio.addEventListener("change", (event) => {
    const selectedKey = event.target.value;
    const filteredByKey = filterFrequenciesByKey(selectedKey);
    currNoteOptions = Object.keys(filteredByKey).sort(
        (a, b) => frequencies[a] - frequencies[b]
    );
    currFrequencyOptions = Object.values(filteredByKey).sort(
        (a, b) => frequencies[a] - frequencies[b]
    );

    currMidpoints = calculateMidpoints(filteredByKey);
  });
});

function filterFrequenciesByKey(selectedKey) {
  if (!selectedKey) {
    return frequencies;
  }
  const scale = scales[selectedKey];

  return Object.keys(frequencies).reduce((acc, note) => {
    const noteName = note.replace(/\d/, "");
    if (scale.includes(noteName)) {
      acc[note] = frequencies[note];
    }
    return acc;
  }, {});
}


const currAudioTime = () => getAudioContext().currentTime;

let enabledAudio = true;
const enableAudioSelect = document.querySelectorAll(
  'input[name="audio-select"]'
);
enableAudioSelect.forEach((radio) => {
  radio.addEventListener("change", (event) => {
    enabledAudio = event.target.value === "true";
  });
});

function createPiano() {
  const piano = document.getElementById("piano");
  const keys = Object.keys(frequencies);
  let whiteKeyWidth = 4.5;
  let whiteKeyCount = 0;
  let totalWhiteKeyWidth = 0;

  keys.forEach((note) => {
    const key = document.createElement("div");
    const isWhite = !note.includes("#");
    key.className = `key ${!isWhite ? "black" : "white"}`;
    key.dataset.note = note;

    if (isWhite) {
      totalWhiteKeyWidth += whiteKeyWidth;
      key.style.left = `calc(${
        whiteKeyCount * whiteKeyWidth
      }% - ${whiteKeyCount}px)`;
      whiteKeyCount++;
    } else {
      const blackLeft = totalWhiteKeyWidth - whiteKeyWidth / 2;
      key.style.left = `calc(${blackLeft + 1}% - ${whiteKeyCount}px)`;
    }
    key.id = note.toString();
    key.addEventListener("mousedown", () => {
      toggleHighlightKey(key, "start");
      playTone(frequencies[note])();
    });
    key.addEventListener("mouseup", () => {
      toggleHighlightKey(key, "end");
    });

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


const getOctave = (note) => (note ? parseInt(note.match(/\d+/)[0], 10) : null);
const getNoteName = (note) => (note ?? "").replace(/\d/, "");

let lastPlayedNote = null;
let lastPlayedTime = 0;
const MIN_PLAY_INTERVAL = 600;

function activateFromVoice(note) {
  const currTime = currAudioTime();
  if (getVoiceActivatedNote()) {
    var prevActiveKey = document.querySelector(
      `.key[data-note='${getVoiceActivatedNote()}']`
    );
  }
  if (note) {
    var newActiveKey = document.querySelector(`.key[data-note='${note}']`);
  }

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
      if (enabledAudio) {
        playTone(frequencies[note])();
      }
    } else if (!holdNote) {
      newActiveKey.style.backgroundColor = "#ccc";
    }
    setVoiceActivatedNote(note);
  }
}

let isProcessing = false;
let lastProcessedTime = 0;
const PROCESS_INTERVAL = 75;

function getMicrophoneFrequency() {
  if (!getIsListening()) {
    return;
  }
  const now = Date.now();
  if (now - lastProcessedTime < PROCESS_INTERVAL) {
    return setTimeout(
      getMicrophoneFrequency,
      PROCESS_INTERVAL - (now - lastProcessedTime)
    );
  }

  lastProcessedTime = now;

  if (!isProcessing) {
    isProcessing = true;

    getAnalyserNode().getFloatTimeDomainData(getAudioInput());
    const [pitch, clarity] = getDetector().findPitch(
        getAudioInput(),
      getAudioContext().sampleRate
    );
    if (clarity > 0.9 && pitch >= 70 && pitch <= 395) {
      const matchedNoteIdx = detectFrequency(currFrequencyOptions, pitch, currMidpoints);
      var newNote = currNoteOptions[matchedNoteIdx];
    }

    if (
      lastPlayedNote === newNote &&
      currAudioTime() - lastPlayedTime >= MIN_PLAY_INTERVAL
    ) {
      lastPlayedNote = null;
    }

    if ((newNote || getVoiceActivatedNote()) && lastPlayedNote !== newNote) {
      activateFromVoice(newNote);
    }

    setTimeout(() => {
      isProcessing = false;
      getMicrophoneFrequency();
    }, PROCESS_INTERVAL);
  }
}

listenButton.addEventListener("click", async () => {
  if (!getIsListening()) {
    listenButton.textContent = "Stop";
    if (getOscillator()) {
      disconnect();
      listenButton.textContent = "Start";
    }
    await initDetector();
    getMicrophoneFrequency();
  } else {
    disconnect();
    listenButton.textContent = "Start";
  }
});

createPiano();
