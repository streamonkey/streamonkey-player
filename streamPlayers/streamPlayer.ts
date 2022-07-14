export interface StreamPlayer {
    start(): void
    stop(): void
    connect(audio: AudioNode): void
    pushSoundChunk(soundchunk: Uint8Array): void
    bufferLengthSeconds: number
}