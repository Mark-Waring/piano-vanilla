export function detectFrequency(target, midpoints) {
    if (target <= midpoints[0]) return 0;
    if (target >= midpoints[midpoints.length - 1]) return midpoints.length - 1;

    for (let i = 0; i < midpoints.length; i++) {
        if (target <= midpoints[i]) return i;
    }

    return midpoints.length - 1;
}