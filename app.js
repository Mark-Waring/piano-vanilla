const { PitchDetector } = await import("pitchy");

const frequencies = {
  C2: 65.41,
  "C#2": 69.3,
  D2: 73.42,
  "D#2": 77.78,
  E2: 82.41,
  F2: 87.31,
  "F#2": 92.5,
  G2: 98.0,
  "G#2": 103.83,
  A2: 110.0,
  "A#2": 116.54,
  B2: 123.47,
  C3: 130.81,
  "C#3": 138.59,
  D3: 146.83,
  "D#3": 155.56,
  E3: 164.81,
  F3: 174.61,
  "F#3": 185.0,
  G3: 196.0,
  "G#3": 207.65,
  A3: 220.0,
  "A#3": 233.08,
  B3: 246.94,
  C4: 261.63,
  "C#4": 277.18,
  D4: 293.66,
  "D#4": 311.13,
  E4: 329.63,
  F4: 349.23,
  "F#4": 369.99,
  G4: 392.0,
  "G#4": 415.3,
  A4: 440.0,
  "A#4": 466.16,
  B4: 493.88,
  C5: 523.25,
};

const scales = {
  C: ['C', 'D', 'E', 'F', 'G', 'A', 'B'],
  'C#': ['C#', 'D#', 'F', 'F#', 'G#', 'A#', 'C'],
  D: ['D', 'E', 'F#', 'G', 'A', 'B', 'C#'],
  'D#': ['D#', 'F', 'G', 'G#', 'A#', 'C', 'D'],
  E: ['E', 'F#', 'G#', 'A', 'B', 'C#', 'D#'],
  F: ['F', 'G', 'A', 'A#', 'C', 'D', 'E'],
  'F#': ['F#', 'G#', 'A#', 'B', 'C#', 'D#', 'F'],
  G: ['G', 'A', 'B', 'C', 'D', 'E', 'F#'],
  'G#': ['G#', 'A#', 'C', 'C#', 'D#', 'F', 'G'],
  A: ['A', 'B', 'C#', 'D', 'E', 'F#', 'G#'],
  'A#': ['A#', 'C', 'D', 'D#', 'F', 'G', 'A'],
  B: ['B', 'C#', 'D#', 'E', 'F#', 'G#', 'A#'],
};

let activeVoiceFreq = null;
let microphoneStream = null;
let isListening = false;
let selectedKey = null;
const keysSelect = document.querySelectorAll('input[name="key-select"]')
keysSelect.forEach(radio => {
  radio.addEventListener('change', (event) => {
    selectedKey = event.target.value;
  });
});


function handleKeyPress(note) {
  const activeKey = document.querySelector(".key.active");
  const newActiveKey = document.querySelector(`.key[data-note='${note}']`);
  if (activeKey) {
    activeKey.classList.remove("active");
    activeKey.style.backgroundColor = activeKey.classList.contains("black")
      ? "black"
      : "white";
  }
  if (newActiveKey) {
    newActiveKey.classList.add("active");
    newActiveKey.style.backgroundColor = "#ccc";
    newActiveKey.click();
  }
}

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
      totalWhiteKeyWidth += whiteKeyWidth
      key.style.left = `calc(${whiteKeyCount * whiteKeyWidth}% - ${whiteKeyCount}px)`;
      whiteKeyCount++;
    } else {
      const blackLeft = totalWhiteKeyWidth - (whiteKeyWidth / 2)
      key.style.left = `calc(${blackLeft + 1}% - ${whiteKeyCount}px)`;
    }
    key.id = note.toString();
    key.addEventListener("mousedown", () => playTone(frequencies[note]));
    key.addEventListener("touchstart", () => playTone(frequencies[note]));
    piano.appendChild(key);
  });
}

let audioContext = null;
let oscillator = null;
let isStarting = false;
let gainNode = null;
let analyserNode = null;
let detector = null;
let audioInput = null;

function initAudioContext() {
  if (!audioContext) {
    audioContext = new (window.AudioContext || window.webkitAudioContext)();
  }
  if (audioContext.state === "suspended") {
    audioContext.resume();
  }
}

function playTone(frequency) {
  initAudioContext()
  if (!oscillator) {
    oscillator = oscillator ?? audioContext.createOscillator();
    isStarting = true;
  }
  gainNode =  audioContext.createGain();

  oscillator.type = "triangle";
  oscillator.connect(gainNode);
  gainNode.connect(audioContext.destination);

  oscillator.frequency.setValueAtTime(frequency, audioContext.currentTime);

  gainNode.gain.setValueAtTime(0, audioContext.currentTime);
  gainNode.gain.linearRampToValueAtTime(1, audioContext.currentTime + 0.01);
  gainNode.gain.linearRampToValueAtTime(0, audioContext.currentTime + 1);

  if (isStarting) {
    oscillator.start();
    isStarting = false;
  }

  startOrResetTimeout()
}

function disconnect() {
  if (oscillator) {
    oscillator.stop();
    oscillator.disconnect();
    gainNode.disconnect();
    oscillator = null;
    gainNode = null;
    isStarting = false;
  }
  
  if (isListening) {
    isListening = false
    analyserNode = null;
    detector = null;
    audioInput = null;
  }
}

let timeoutId;
function startOrResetTimeout() {
  if (timeoutId) {
    clearTimeout(timeoutId);
  }

  timeoutId = setTimeout(() => {
    disconnect()
  }, 30000)
}

async function beginListening() {
  if (!isListening) return;

  initAudioContext()
  analyserNode = audioContext.createAnalyser();

  microphoneStream = await navigator.mediaDevices.getUserMedia({
    audio: true,
  });

  const source = audioContext.createMediaStreamSource(microphoneStream);
  source.connect(analyserNode);

  detector = PitchDetector.forFloat32Array(analyserNode.fftSize);
  detector.minVolumeDecibels = -40;

  audioInput = new Float32Array(analyserNode.fftSize);
  startOrResetTimeout();
  getMicrophoneFrequency();
}


async function getMicrophoneFrequency() {
  if (isListening) {
    analyserNode.getFloatTimeDomainData(audioInput);
    const [pitch, clarity] = detector.findPitch(
        audioInput,
        audioContext.sampleRate
    );
    let newFreq = null;
    if (clarity > 0.8) {
      if (pitch >= 75 && pitch <= 359.6) {
        newFreq = detect(pitch);
      }
    } else {
      newFreq = null;
    }

    // if (newFreq !== activeVoiceFreq) {
      activeVoiceFreq = newFreq;
      handleKeyPress(activeVoiceFreq);
    // }
    setTimeout(getMicrophoneFrequency, 100);
  } else {
    microphoneStream.getTracks().forEach((track) => track.stop());
    analyserNode = null;
    detector = null;
    audioInput = null;
  }

}

function filterFrequenciesByKey(selectedKey) {
  const scale = scales[selectedKey];

  const filteredFrequencies = Object.keys(frequencies).reduce((acc, note) => {
    const noteName = note.replace(/\d/, '');
    if (scale.includes(noteName)) {
      acc[note] = frequencies[note];
    }
    return acc;
  }, {});

  return filteredFrequencies;
}

function detect(freq) {
  const availableKeys = selectedKey ? filterFrequenciesByKey(selectedKey) : frequencies;
  const freqKeys = Object.keys(availableKeys);
  if (!freq) {
    return null;
  } else {
    for (let i = 0; i < freqKeys.length - 1; i++) {
      const midPoint =
        (frequencies[freqKeys[i + 1]] + frequencies[freqKeys[i]]) / 2;
      if (freq <= midPoint) {
        return freqKeys[i];
      }
    }
  }
}

const listenButton = document.getElementById("listenButton");

listenButton.addEventListener("mousedown", () => {
  if (!isListening) {
    isListening = true;
    listenButton.textContent = "Stop";
    if (oscillator) {
      disconnect();
    }
    beginListening();
  } else {
    listenButton.textContent = "Listen";
    isListening = false;
  }
});

createPiano();
