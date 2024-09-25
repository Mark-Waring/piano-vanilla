export function detectFrequency(arr, target, midpoints) {
    let low = 0;
    let high = midpoints.length - 1;

    while (low <= high) {
        const mid = Math.floor((low + high) / 2);

        if (target === arr[mid]) {
            return mid;
        }

        if (target < midpoints[mid]) {
            high = mid - 1;
        } else {
            low = mid + 1;
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

