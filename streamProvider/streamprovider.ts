/*
    Provides a continuous data stream from the stream url and splits the meta data from the audio stream
    meta data are consumed, decoded and dispatched by metaInfoHelper
    sound data are either directly consumed by the mediaSource player or further parsed into full audio frames by streamBuilder
*/
import { TypedEmitter } from "../typedEventTarget.js"
import { AacStreamBuilder } from "../streamBuilders/aacStreamBuilder.js"
import { appendArrayBuffers } from "../Utils/streamUtils.js"
import { Streambuilder } from "../streamBuilders/streamBuilder.js"


interface soundStreamEvent {
    soundStream: Uint8Array
}

interface metaTextEvent {
    metaText: Uint8Array
}

interface codecUpdateEvent {
    codecString: string
}

interface UpdateEvent {
    soundstreamupdate: soundStreamEvent
    metatextupdate: metaTextEvent
    codecupdate: codecUpdateEvent
}



export class StreamProvider extends TypedEmitter<UpdateEvent>{
    private fetchAbortController: AbortController
    private streamUrl: URL
    private _mediaCodec: string = ''
    private streamBuilder: Streambuilder | null = null

    constructor(hostname: string, mountName: string, aggregator: string, additionalParams: Record<string, string> = {}) {
        super()
        this.fetchAbortController = new AbortController();
        this.streamUrl = new URL(`https://${hostname}/${mountName}`)

        Object.entries(additionalParams).forEach(([k, v]) => this.streamUrl.searchParams.set(k, v))

        this.streamUrl.searchParams.set("aggregator", aggregator)

        this.streamUrl.searchParams.set("icyjson", "true")
        // this.streamUrl.searchParams.set("attachcodecinfo", "true")
    }

    public get mediaCodec() {
        return this._mediaCodec
    }

    async start() {

        const fetchResponse = await fetch(this.streamUrl.toString(),
            {
                signal: this.fetchAbortController.signal,
                mode: 'cors',
                headers: {
                    'Icy-MetaData': '1'
                },
            }).catch((err) => {
                throw new Error(`Stream Error: ${err.toString()}`)
            })

        const mediaCodec = fetchResponse.headers.get('Content-Type')
        const icyMetaInt = parseInt(fetchResponse.headers.get('icy-metaint') ?? '')

        if (!mediaCodec) {
            throw new Error('no media codec specified')
        }
        if (!icyMetaInt || isNaN(icyMetaInt)) {
            throw new Error('no icy-metaint specified')
        }

        if (!fetchResponse.body) {
            throw new Error('no response body from stream')
        }

        this._mediaCodec = mediaCodec

        if (mediaCodec == 'audio/aac') {
            this.streamBuilder = new AacStreamBuilder()
        } else {
            throw new Error('unsupported codec ' + mediaCodec)
        }

        this.dispatchEvent("codecupdate", {
            codecString: mediaCodec
        })

        const reader = fetchResponse.body.getReader()

        let workingStream = new Uint8Array()

        while (true) { // TODO handle stop
            const data = await reader.read()

            if (data.done) {
                return
            }

            if (!data.value) {
                throw new Error('empty data stream')
            }
            workingStream = appendArrayBuffers(workingStream, data.value); // we are using a stream with the new chunk data and the rest from the previous chunk
            let soundStream = new Uint8Array(); // stores audio only data from current chunk
            while (workingStream.length > icyMetaInt) {
                const metaLength = workingStream[icyMetaInt] * 16; // length of the following meta infos
                const metaTextStream = workingStream.slice(icyMetaInt + 1, icyMetaInt + 1 + metaLength);
                if (metaTextStream.length > 0) {
                    this.dispatchEvent("metatextupdate", {
                        metaText: metaTextStream
                    })

                }
                const nextAudioData = workingStream.slice(0, icyMetaInt); //audio data from start to next meta info


                this.streamBuilder.buildFromChunk(nextAudioData)

                soundStream = appendArrayBuffers(soundStream, nextAudioData); // add sound data until next meta block to play stream
                workingStream = workingStream.slice(icyMetaInt + 1 + metaLength, workingStream.length); // cut down stream, remove already processed sound and meta data
            }


            this.dispatchEvent("soundstreamupdate", {
                soundStream: soundStream,
            })

            //await sleep(200)
        }

    }

    stop() {
        this.fetchAbortController.abort()
        this.fetchAbortController = new AbortController()
        this.streamBuilder = null
    }
}