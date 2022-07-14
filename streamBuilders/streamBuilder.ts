export interface Streambuilder {
    buildFromChunk(audioChunk: Uint8Array): void
}