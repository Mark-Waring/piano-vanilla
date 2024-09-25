
const { PitchDetector } = await import("pitchy");

export function createAudioContext() {
    let audioContext = null;
    let oscillator = null;
    let analyserNode = null;
    let gainNode = null;
    let microphoneStream = null;
    let audioDetector = null;
    let audioInput = null;
    let voiceActivatedNote = null;
    let isListening = false;
    let isAudioEnabled = true;

    function getAudioContext() {
        return audioContext;
    }

    function getOscillator() {
        return oscillator;
    }

    function getAnalyserNode() {
        return analyserNode;
    }

    function getDetector() {
        return audioDetector;
    }

    function getAudioInput() {
        return audioInput;
    }

    function getVoiceActivatedNote() {
        return voiceActivatedNote;
    }

    function setVoiceActivatedNote(note) {
        voiceActivatedNote = note;
    }

    function getIsListening() {
        return isListening;
    }

    function getIsAudioEnabled() {
        return isAudioEnabled;
    }

    function setIsAudioEnabled(isEnabled) {
        isAudioEnabled = isEnabled;
    }

    function initAudioContext() {
        if (!audioContext || audioContext.state === "closed") {
            audioContext = (new (window.AudioContext || window.webkitAudioContext)());
        }
        if (audioContext === "suspended") {
            audioContext.resume();
        }
    }

    function playTone(Hz) {
        return () => {
            if (!isListening) {
                return;
            }

            initAudioContext();

            if (!oscillator) {
                const newOscillator = audioContext.createOscillator()
                oscillator = newOscillator;
                newOscillator.type = "triangle";
                newOscillator.start();
            }

            if (!gainNode) {
                const newGainNode = audioContext.createGain()
                gainNode = newGainNode;
                newGainNode.connect(audioContext.destination);
                oscillator.connect(newGainNode);
            }

            gainNode.gain.cancelScheduledValues(audioContext.currentTime);

            oscillator.frequency.value = Hz;
            trigger(gainNode.gain);
        };
    }

    const smoothingInterval = 0.02;
    const attackDuration = 0.398;

    function trigger(gain, resetTimeout) {
        gain.setTargetAtTime(
            1,
            audioContext.currentTime + smoothingInterval,
            smoothingInterval
        );
        gain.setTargetAtTime(0, audioContext.currentTime + attackDuration, smoothingInterval);

        startOrResetTimeout();
    }


    let sleepId;
    let disconnectId;

    function startOrResetTimeout() {
        if (disconnectId) {
            clearTimeout(disconnectId);
        }

        if (sleepId) {
            clearTimeout(sleepId);
        }

        disconnectId = setTimeout(disconnect, 12000);
        sleepId = setTimeout(sleep, 6000);
    }

    function sleep() {
        if (oscillator) {
            oscillator.stop();
            oscillator.disconnect();
            oscillator = null;
        }

        if (gainNode) {
            gainNode.disconnect();
            gainNode = null;
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
                microphoneStream.getTracks().forEach((track) => track.stop());
                microphoneStream = null;
            }

            audioDetector = null;
            audioContext = null;
            isListening = false;
            const listenButton = document.getElementById("start-button");
            listenButton.textContent = "Start"
        }
    }

    async function initDetector() {
        isListening = true;
        try {
           initAudioContext();
            if (!analyserNode) {
                analyserNode = audioContext.createAnalyser();
            }

            microphoneStream = await navigator.mediaDevices.getUserMedia({
                audio: true,
            });

            const source = audioContext.createMediaStreamSource(microphoneStream);
            source.connect(analyserNode);
            audioDetector = PitchDetector.forFloat32Array(analyserNode.fftSize);
            audioDetector.minVolumeDecibels = -40;

            audioInput = new Float32Array(analyserNode.fftSize)
            startOrResetTimeout();
        } catch (error) {
            console.error(
                "Error accessing microphone or setting up analyser node:",
                error
            );
        }
    }

    return {
        getAudioContext,
        getAudioInput,
        getDetector,
        getOscillator,
        getIsListening,
        getAnalyserNode,
        getVoiceActivatedNote,
        getIsAudioEnabled,
        setVoiceActivatedNote,
        setIsAudioEnabled,
        initDetector,
        playTone,
        disconnect
    };
}