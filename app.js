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
let analyserNode = null;
let gainNode = null;
let detector = null;
let audioInput = null;
let activeMicNote = null;
let microphoneStream = null;
let isListening = false;
let selectedKey = null;
let currFrequencyPairs = frequencies;
let currNoteOptions = Object.keys(currFrequencyPairs);
let currFrequencyOptions = Object.values(currFrequencyPairs);
const keySelect = document.querySelectorAll('input[name="key-select"]');

keySelect.forEach(radio => {
    radio.addEventListener('change', (event) => {
        selectedKey = event.target.value;
        currFrequencyPairs = filterFrequenciesByKey(selectedKey);
        currNoteOptions = Object.keys(currFrequencyPairs).sort((a, b) => frequencies[a] - frequencies[b]);
        currFrequencyOptions = Object.values(currFrequencyPairs).sort((a, b) => frequencies[a] - frequencies[b]);
    });
});

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

const smoothingInterval = 0.02;
const attackDuration = 0.4;
const now = () => audioContext.currentTime;

function playTone(Hz) {
    return () => {
        if (!isListening) {
            return;
        }
        initAudioContext();

        if (!oscillator) {
            oscillator = audioContext.createOscillator();
            oscillator.type = "triangle";
            oscillator.start();
        }

        if (!gainNode) {
            gainNode = audioContext.createGain();
            gainNode.connect(audioContext.destination);
            oscillator.connect(gainNode);
        }

        gainNode.gain.cancelScheduledValues(now());

        oscillator.frequency.value = Hz;
        trigger(gainNode.gain);
    };
}

function trigger(parameter) {
    parameter.setTargetAtTime(1, now() + smoothingInterval, smoothingInterval);
    parameter.setTargetAtTime(0, now() + attackDuration, smoothingInterval);

    startOrResetTimeout();
}

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

    keys.forEach((note, idx) => {
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
        key.addEventListener("mousedown", () => {
            highlightKey(key, "start")
            playTone(frequencies[note])();
        });
        key.addEventListener("mouseup", () => {
            highlightKey(key, "end")
        });

        piano.appendChild(key);
    });
}

function highlightKey(key, marker) {
    if (isListening) {
        if (marker === "start") {
            key.style.backgroundColor = "red";
        } else if (marker === "end"){
            key.style.backgroundColor = key.classList.contains("black")
                ? "black"
                : "white";
        }
    }
}

function initAudioContext() {
    if (!audioContext || audioContext.state === 'closed') {
        audioContext = new (window.AudioContext || window.webkitAudioContext)();
    }
    if (audioContext.state === "suspended") {
        audioContext.resume();
    }
}

let timeoutId;

function startOrResetTimeout() {
    if (timeoutId) {
        clearTimeout(timeoutId);
    }

    timeoutId = setTimeout(disconnect, 30000);
}

const getOctave = (note) => note ? parseInt(note.match(/\d+/)[0], 10) : null;
const getNoteName = (note) => (note ?? "").replace(/\d/, '');

let lastPlayedNote = null;
let lastPlayedTime = 0;
const MIN_PLAY_INTERVAL = 300;

function handleKeyPress(note) {
    const currTime = now();
    if (activeMicNote) {
        var prevActiveKey = document.querySelector(`.key[data-note='${activeMicNote}']`);
    }
    if (note) {
        var newActiveKey = document.querySelector(`.key[data-note='${note}']`);
    }

    if (prevActiveKey && prevActiveKey !== newActiveKey) {
        highlightKey(prevActiveKey, "end");
    }

    if (newActiveKey) {
        const activeNoteName = getNoteName(activeMicNote);
        const newNoteName = getNoteName(note);
        const activeOctave = getOctave(activeMicNote);
        const newOctave = getOctave(note);
        const isTempNote = note !== activeMicNote ||
            (activeNoteName === newNoteName && Math.abs(newOctave - activeOctave) === 1);
        const holdNote = lastPlayedNote === note && (currTime - lastPlayedTime) < MIN_PLAY_INTERVAL;
        if (!isTempNote && !holdNote) {
            highlightKey(newActiveKey, "start");
            lastPlayedNote = note;
            lastPlayedTime = currTime;
            if (enabledAudio) {
                playTone(frequencies[note])();
            }
        } else if (!holdNote) {
            newActiveKey.style.backgroundColor = "#ccc";
        }
        activeMicNote = note;
    }
}

let isProcessing = false;
let lastProcessedTime = 0;
const PROCESS_INTERVAL = 75;

function getMicrophoneFrequency() {
    if (!isListening) {
        return;
    }
    const now = Date.now();
    if (now - lastProcessedTime < PROCESS_INTERVAL) {
        return setTimeout(getMicrophoneFrequency, PROCESS_INTERVAL - (now - lastProcessedTime));
    }

    lastProcessedTime = now;

    if (!isProcessing) {
        isProcessing = true;

        analyserNode.getFloatTimeDomainData(audioInput);
        const [pitch, clarity] = detector.findPitch(audioInput, audioContext.sampleRate);
        if (clarity > .9 && pitch >= 70 && pitch <= 395) {
            const closestActiveFreqIdx = binaryDetect(currFrequencyOptions, pitch);
            var newNote = currNoteOptions[closestActiveFreqIdx];
        }

        if (newNote || activeMicNote) {
            handleKeyPress(newNote);
        }

        setTimeout(() => {
            isProcessing = false;
            getMicrophoneFrequency();
        }, PROCESS_INTERVAL);
    }
}

function binaryDetect(arr, target) {
    let low = 0;
    let high = arr.length - 1;

    while (low <= high) {
        const mid = Math.floor((low + high) / 2);
        const midValue = arr[mid];

        if (midValue === target) {
            return mid;
        }

        if (midValue < target) {
            low = mid + 1;
        } else {
            high = mid - 1;
        }
    }

    if (low >= arr.length) {
        return arr.length - 1;
    }
    if (low > 0 && Math.abs(arr[low - 1] - target) < Math.abs(arr[low] - target)) {
        return low - 1;
    }
    return low;
}

async function initDetector() {
    try {
        initAudioContext();
        if (!analyserNode) {
            analyserNode = audioContext.createAnalyser();
        }

        microphoneStream = await navigator.mediaDevices.getUserMedia({audio: true});

        const source = audioContext.createMediaStreamSource(microphoneStream);
        source.connect(analyserNode);

        detector = PitchDetector.forFloat32Array(analyserNode.fftSize);
        detector.minVolumeDecibels = -40;

        audioInput = new Float32Array(analyserNode.fftSize);

        startOrResetTimeout();
        getMicrophoneFrequency();

    } catch (error) {
        console.error("Error accessing microphone or setting up analyser node:", error);
    }
}

function disconnect() {
    if (audioContext) {
        audioContext.close().then(() => {
            audioContext = null;
        });
    }

    if (oscillator) {
        oscillator.stop();
        oscillator.disconnect();
        oscillator = null;
    }

    if (gainNode) {
        gainNode.disconnect();
        gainNode = null;
    }

    if (isListening) {
        if (analyserNode) {
            analyserNode.disconnect();
            analyserNode = null;
        }

        if (microphoneStream) {
            microphoneStream.getTracks().forEach(track => track.stop());
            microphoneStream = null;
        }

        detector = null;
        audioInput = null;
        isListening = false;
        listenButton.textContent = "Start";
    }
}

const listenButton = document.getElementById("start-button");

listenButton.addEventListener("click", async () => {
    if (!isListening) {
        listenButton.textContent = "Stop";
        if (oscillator) {
            disconnect();
        }
        isListening = true;
        initDetector();
    } else {
        disconnect();
        listenButton.textContent = "Start";
        isListening = false;
    }
});

createPiano();
