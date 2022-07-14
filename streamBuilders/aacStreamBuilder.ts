/*
    takes data part of the media stream and combines them to valid aac audio frames
    emits chunks of valid aac audio frames
*/
import { Streambuilder } from "./streamBuilder"
import { appendArrayBuffers, buf2hex } from "../Utils/streamUtils"
import { TypedEmitter } from "../typedEventTarget"

const ADTS_FRAMEHEADER_LENGTH = 7
const MINIMUM_AUDIO_LENGTH = 80_000

interface Events {
    data: Uint8Array
}

export class AacStreamBuilder extends TypedEmitter<Events> implements Streambuilder {

    audioChunkRest: Uint8Array = new Uint8Array()
    adtsHeaderPosition: number = 0
    combinedAudioFrames: Uint8Array = new Uint8Array()
    combinedSamples: number = 0

    // ADTS Header structure: AAAAAAAA AAAABCCD EEFFFFGH HHIJKLMM MMMMMMMM MMMOOOOO OOOOOOPP (QQQQQQQQ QQQQQQQQ)

    findFrameLength() { // find M (FrameLength information)
        let high = (this.audioChunkRest[3] & 0b11) << 11
        let mid = this.audioChunkRest[4] << 3
        const low = this.audioChunkRest[5] >>> 5

        return (high + mid + low)
    }

    isInvalidAdtsFrame() {
        return (this.audioChunkRest[0] != 0xff || (this.audioChunkRest[1] & 0xf6) != 0xf0)
    }

    dumpAudioHeader() {
        console.log(buf2hex(this.audioChunkRest.slice(0, ADTS_FRAMEHEADER_LENGTH)))
    }

    buildFromChunk(audioChunk: Uint8Array) {
        this.audioChunkRest = appendArrayBuffers(this.audioChunkRest, audioChunk)
        if (this.audioChunkRest.length < 2) {
            return
        }
        if (this.isInvalidAdtsFrame()) {
            throw new Error('invalid frame header')
        }

        while (this.audioChunkRest.length >= this.findFrameLength() && this.audioChunkRest.length >= ADTS_FRAMEHEADER_LENGTH) {
            const frame = this.audioChunkRest.slice(0, this.findFrameLength()) //check if +1 length
            this.combinedAudioFrames = appendArrayBuffers(this.combinedAudioFrames, frame)
            this.audioChunkRest = this.audioChunkRest.slice(this.findFrameLength())
        }
        if (this.combinedAudioFrames.length > MINIMUM_AUDIO_LENGTH) {
            this.dispatchEvent("data", this.combinedAudioFrames)
            this.combinedAudioFrames = new Uint8Array()
        }
    }

}