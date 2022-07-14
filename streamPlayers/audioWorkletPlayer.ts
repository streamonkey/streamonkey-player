/*
    consumes the combined valid audio frames from the streamBuilders and hands them over to an AudioWorkletProcessor


*/

import { StreamPlayer } from "./streamPlayer"


export class MediaSourcePlayer implements StreamPlayer {

    private secondsDelayed: number = 0

    constructor(mediaCodec: string = '') {
    }

    public start() {

    }

    public stop() {

    }

    public connect(node: AudioNode) {

    }

    public get bufferLengthSeconds() {
        return this.secondsDelayed ?? 0
    }

    public pushSoundChunk(soundChunk: Uint8Array) {
        const now = new Date().getTime();
    }
}