export const frequencies = {
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

export const scales = {
    C: ["C", "D", "E", "F", "G", "A", "B"],
    "C#": ["C#", "D#", "F", "F#", "G#", "A#", "C"],
    D: ["D", "E", "F#", "G", "A", "B", "C#"],
    "D#": ["D#", "F", "G", "G#", "A#", "C", "D"],
    E: ["E", "F#", "G#", "A", "B", "C#", "D#"],
    F: ["F", "G", "A", "A#", "C", "D", "E"],
    "F#": ["F#", "G#", "A#", "B", "C#", "D#", "F"],
    G: ["G", "A", "B", "C", "D", "E", "F#"],
    "G#": ["G#", "A#", "C", "C#", "D#", "F", "G"],
    A: ["A", "B", "C#", "D", "E", "F#", "G#"],
    "A#": ["A#", "C", "D", "D#", "F", "G", "A"],
    B: ["B", "C#", "D#", "E", "F#", "G#", "A#"],
};

export function calculateMidpoints(frequencies) {
    const midpoints = [];
    const freqArray = Object.values(frequencies).sort((a, b) => a - b);

    for (let i = 0; i < freqArray.length - 1; i++) {
        const geometricMean = Math.sqrt(freqArray[i] * freqArray[i + 1]);
        midpoints.push(Math.round(geometricMean * 100) / 100);
    }

    return midpoints;
}

export function filterFrequenciesByKey(selectedKey) {
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