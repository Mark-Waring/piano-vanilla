const {PitchDetector} = await import("pitchy");

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

let sortedFreqKeys = [];
let midPoints = {};

initializeFrequencies(frequencies);

function initializeFrequencies(frequencies) {
    sortedFreqKeys = Object.keys(frequencies).sort((a, b) => frequencies[a] - frequencies[b]);

    midPoints = {};
    for (let i = 0; i < sortedFreqKeys.length - 1; i++) {
        const key1 = sortedFreqKeys[i];
        const key2 = sortedFreqKeys[i + 1];
        midPoints[key1] = (frequencies[key1] + frequencies[key2]) / 2;
    }
}

let audioContext = null;
let oscillator = null;
let isStarting = false;
let gainNode = null;
let analyserNode = null;
let detector = null;
let audioInput = null;
let activeVoiceFreq = null;
let microphoneStream = null;
let isListening = false;
let selectedKey = null;
let availableKeys = frequencies;
let sortedKeys = Object.keys(availableKeys);
const keysSelect = document.querySelectorAll('input[name="key-select"]');

keysSelect.forEach(radio => {
    radio.addEventListener('change', (event) => {
        selectedKey = event.target.value;
        availableKeys = filterFrequenciesByKey(selectedKey);
        sortedKeys = Object.keys(availableKeys);
    });
});

let enabledAudio = true;
const enableAudioSelect = document.querySelectorAll('input[name="audio-select"]');
enableAudioSelect.forEach(radio => {
    radio.addEventListener('change', (event) => {
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
            key.style.left = `calc(${whiteKeyCount * whiteKeyWidth}% - ${whiteKeyCount}px)`;
            whiteKeyCount++;
        } else {
            const blackLeft = totalWhiteKeyWidth - (whiteKeyWidth / 2);
            key.style.left = `calc(${blackLeft + 1}% - ${whiteKeyCount}px)`;
        }
        key.id = note.toString();
        key.addEventListener("click", () => playTone(frequencies[note]));
        key.addEventListener("touchstart", () => playTone(frequencies[note]));
        piano.appendChild(key);
    });
}

function initAudioContext() {
    if (!audioContext) {
        audioContext = new (window.AudioContext || window.webkitAudioContext)();
    }
    if (audioContext.state === "suspended") {
        audioContext.resume();
    }
}

function playTone(frequency) {
    initAudioContext();
    if (!oscillator) {
        oscillator = oscillator ?? audioContext.createOscillator();
        isStarting = true;
    }
    gainNode = audioContext.createGain();

    oscillator.type = "triangle";
    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);

    oscillator.frequency.setValueAtTime(frequency, audioContext.currentTime);

    gainNode.gain.setValueAtTime(0, audioContext.currentTime);
    gainNode.gain.linearRampToValueAtTime(1, audioContext.currentTime + 0.005);
    gainNode.gain.linearRampToValueAtTime(0, audioContext.currentTime + .5);

    if (isStarting) {
        oscillator.start();
        isStarting = false;
    }

    startOrResetTimeout();
}

let timeoutId;

function startOrResetTimeout() {
    if (timeoutId) {
        clearTimeout(timeoutId);
    }

    timeoutId = setTimeout(disconnect, 30000);
}

async function initDetector() {
    initAudioContext();
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

const getOctave = (note) => note ? parseInt(note.match(/\d+/)[0], 10) : null
const getNoteName = (note) => (note ?? "").replace(/\d/, '')


function handleKeyPress(note) {
    const prevActiveKey = document.querySelector(`.key[data-note='${activeVoiceFreq}']`);
    const newActiveKey = document.querySelector(`.key[data-note='${note}']`);
    if (prevActiveKey && prevActiveKey !== newActiveKey) {
        prevActiveKey.style.backgroundColor = prevActiveKey.classList.contains("black")
            ? "black"
            : "white";
    }

    if (newActiveKey) {
        const activeNoteName = getNoteName(activeVoiceFreq);
        const newNoteName = getNoteName(note);
        const activeOctave = getOctave(activeVoiceFreq);
        const newOctave = getOctave(note);
        const isAccidentalJump = note !== activeVoiceFreq ||
            (activeNoteName === newNoteName && (newOctave - activeOctave === 1));

        if (!isAccidentalJump) {
            newActiveKey.style.backgroundColor = "red"
            if (enabledAudio) {
                playTone(frequencies[note]);
            }

        } else {
            newActiveKey.style.backgroundColor = "#ccc"
        }
        activeVoiceFreq = note;
    }
}

function getMicrophoneFrequency() {
    if (isListening) {
        analyserNode.getFloatTimeDomainData(audioInput);
        const [pitch, clarity] = detector.findPitch(
            audioInput,
            audioContext.sampleRate
        );
        let newFreq = null;
        if (clarity > 0.85) {
            if (pitch && pitch >= 70 && pitch <= 395) {
                newFreq = binaryDetect(sortedKeys, pitch, availableKeys);
            }
        } else {
            newFreq = null;
        }

        if (newFreq || activeVoiceFreq) {
            handleKeyPress(newFreq);
        }

        setTimeout(getMicrophoneFrequency, 75);
    }
}

function filterFrequenciesByKey(selectedKey) {
    if (!selectedKey) {
        return frequencies;
    }
    const scale = scales[selectedKey];

    return Object.keys(frequencies).reduce((acc, note) => {
        const noteName = note.replace(/\d/, '');
        if (scale.includes(noteName)) {
            acc[note] = frequencies[note];
        }
        return acc;
    }, {});
}

function binaryDetect(arr, target, values) {
    let low = 0;
    let high = arr.length - 1;

    while (low <= high) {
        const mid = Math.floor((low + high) / 2);
        const midValue = values[arr[mid]];

        if (midValue === target) {
            return arr[mid];
        }

        if (midValue < target) {
            low = mid + 1;
        } else {
            high = mid - 1;
        }
    }

    if (low >= arr.length) {
        return arr[arr.length - 1];
    }
    if (low > 0 && Math.abs(values[arr[low - 1]] - target) < Math.abs(values[arr[low]] - target)) {
        return arr[low - 1];
    }
    return arr[low];
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
        analyserNode = null;
        detector = null;
        isListening = false;
        audioInput = null;
        microphoneStream.getTracks()?.forEach((track) => track.stop());
        microphoneStream = null;
        listenButton.textContent = "Listen";
    }
}

const listenButton = document.getElementById("listenButton");

listenButton.addEventListener("click", () => {
    if (!isListening) {
        listenButton.textContent = "Stop";
        if (oscillator) {
            disconnect();
        }
        isListening = true;
        initDetector();
    } else {
        disconnect();
        listenButton.textContent = "Listen";
        isListening = false;
    }
});

createPiano();
