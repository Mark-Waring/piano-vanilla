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

let audioContext = null;
let activeVoiceFreq = null;

function highlightKey(note) {
  const activeKey = document.querySelector(".key.active");
  if (activeKey) {
    activeKey.classList.remove("active");
    activeKey.style.backgroundColor = activeKey.classList.contains("black")
      ? "black"
      : "white";
  }
  const newActiveKey = document.querySelector(`.key[data-note='${note}']`);
  if (newActiveKey) {
    newActiveKey.classList.add("active");
    newActiveKey.style.backgroundColor = "#ccc";
  }
}

function updateActiveVoiceFreq(newFreq) {
  activeVoiceFreq = newFreq;
  highlightKey(newFreq);
}

function createPiano() {
  const piano = document.getElementById("piano");
  piano.style.boxSizing = "border-box";
  const keys = Object.keys(frequencies);
  let whiteKeyWidth = 60;
  let whiteKeyCount = 0;

  keys.forEach((note) => {
    const key = document.createElement("div");
    const isWhite = !note.includes("#");
    key.className = `key ${!isWhite ? "black" : "white"}`;
    key.dataset.note = note;

    if (isWhite) {
      key.style.left = `${whiteKeyCount * whiteKeyWidth}px`;
      whiteKeyCount++;
    } else {
      const blackKeyOffset = whiteKeyWidth / 1.333;
      key.style.left = `${
        (whiteKeyCount - 1) * whiteKeyWidth + blackKeyOffset
      }px`;
    }

    key.addEventListener("mousedown", () => playTone(frequencies[note]));
    piano.appendChild(key);
  });
}

function playTone(frequency) {
  if (!audioContext) {
    audioContext = new (window.AudioContext || window.webkitAudioContext)();
  }

  const oscillator = audioContext.createOscillator();
  const gainNode = audioContext.createGain();

  oscillator.type = "triangle";
  oscillator.frequency.setValueAtTime(frequency, audioContext.currentTime);
  oscillator.connect(gainNode);

  gainNode.connect(audioContext.destination);
  gainNode.gain.setValueAtTime(0, audioContext.currentTime);
  gainNode.gain.linearRampToValueAtTime(1, audioContext.currentTime + 0.01);
  gainNode.gain.linearRampToValueAtTime(0, audioContext.currentTime + 1);

  oscillator.start();

  setTimeout(() => {
    oscillator.stop();
    oscillator.disconnect();
  }, 1000);
}

async function getMicrophoneFrequency() {
  const audioContext = new (window.AudioContext || window.webkitAudioContext)();
  const analyser = audioContext.createAnalyser();

  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const source = audioContext.createMediaStreamSource(stream);
    source.connect(analyser);

    analyser.fftSize = 16384;
    const bufferLength = analyser.frequencyBinCount;
    const frequencyData = new Float32Array(bufferLength);
    const timeDomainData = new Uint8Array(bufferLength);

    function analyzeFrequency() {
      analyser.getFloatFrequencyData(frequencyData);
      analyser.getByteTimeDomainData(timeDomainData);

      let maxVal = -Infinity;
      let maxIndex = 0;
      for (let i = 0; i < bufferLength; i++) {
        if (frequencyData[i] > maxVal) {
          maxVal = frequencyData[i];
          maxIndex = i;
        }
      }

      const nyquist = audioContext.sampleRate / 2;
      const freq = (maxIndex / bufferLength) * nyquist;

      const avgAmplitude =
        timeDomainData.reduce((sum, val) => sum + Math.abs(val - 128), 0) /
        bufferLength;
      if (avgAmplitude > 2) {
        activeVoiceFreq = detect(freq);
      } else {
        activeVoiceFreq = null;
      }
      updateActiveVoiceFreq(activeVoiceFreq);

      setTimeout(analyzeFrequency, 50);
    }

    analyzeFrequency();
  } catch (err) {
    console.error("Error accessing microphone:", err);
  }
}

function detect(freq) {
  const freqKeys = Object.keys(frequencies);
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
    return null;
  }
}

document.getElementById("listenButton").addEventListener("mousedown", () => {
  if (activeVoiceFreq === null) {
    getMicrophoneFrequency();
  } else {
    activeVoiceFreq = null;
  }
});

createPiano();
