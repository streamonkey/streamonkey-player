export const sleep = (timeout: number) => new Promise<void>((resolve) => {
    setTimeout(() => {
        resolve()
    }, timeout)
})

export function appendArrayBuffers(buffer1: Uint8Array, buffer2: Uint8Array) {
    let res = new Uint8Array(buffer1.length + buffer2.length);
    res.set(buffer1);
    res.set(buffer2, buffer1.length);
    return res;
}

export function buf2hex(buffer: Uint8Array) { // buffer is an ArrayBuffer
    return [...new Uint8Array(buffer)]
        .map(x => x.toString(16).padStart(2, '0'))
        .join('');
}
