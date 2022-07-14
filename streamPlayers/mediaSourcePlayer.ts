/*
    directly consumes the data part of the audio stream and adds it to the mediaSource sourcebuffer
    provides delay for the timing of the meta text
*/

import { StreamPlayer } from "./streamPlayer"

export class MediaSourcePlayer implements StreamPlayer {

    private icyAudio: HTMLAudioElement = new Audio()
    private icyMediaSource: MediaSource = new MediaSource()
    private startTimestamp: number = 0
    private icySourceBuffer: SourceBuffer | null = null
    private secondsDelayed: number = 0
    private mediaCodec: string = ''

    constructor(mediaCodec: string, audioContext: AudioContext) {
        this.mediaCodec = mediaCodec
        this.icyAudio.src = URL.createObjectURL(this.icyMediaSource)
    }

    public start() {
        this.startTimestamp = new Date().getTime()
        this.icySourceBuffer = this.icyMediaSource.addSourceBuffer(this.mediaCodec)
        this.icyAudio.play()
    }

    public stop() {
        this.icyAudio?.pause()
        this.startTimestamp = 0
    }

    public connect(node: AudioNode) {
        //node.connect(node.context.destination)

        //TODO: implement audio source from node instead new audiosource
    }

    public get bufferLengthSeconds() {
        return this.secondsDelayed ?? 0
    }

    public pushSoundChunk(soundChunk: Uint8Array) {
        if (!this.icySourceBuffer) { return }
        const secondsBuffered = this.icyMediaSource.sourceBuffers[0].timestampOffset;
        const now = new Date().getTime();
        const secondsPlayed = (now - this.startTimestamp) / 1000;
        this.secondsDelayed = secondsBuffered - secondsPlayed;
        this.icySourceBuffer.appendBuffer(soundChunk)

    }
}