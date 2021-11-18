import { TypedEmitter } from "./typedEventTarget.js"
import { MyStats, SocketMeta } from "./types.js"

//@ts-ignore
const AudioContext = globalThis.AudioContext || globalThis.webkitAudioContext

const sleep = (time: number) => {
    return new Promise((resolve) => {
        setTimeout(resolve, time)
    })
}

const noCache = () => {
    return Math.random().toString().slice(2)
}

interface CoverResponse {
    resultCount: number
    results: Result[]
}

interface Result {
    artworkUrl100: string
}

interface HistoryEntryRaw {
    LiveStreamId: string
    InsertDate: string
    MetaArtist: string
    MetaSong: string
    MetaTitle: string
}

export interface Meta {
    title: string
    artist: string
    coverURL: string
    time: Date
}

type ArtworkSize = `${number}x${number}`

export interface Options {
    useCovers?: boolean
    coverSize?: ArtworkSize
    aggregator: string
    useMediaSession?: boolean
    fallbackCover?: string
    queryParams?: Record<string, string>
}

interface MetaEvents {
    currentchange: Meta
    historychange: Meta[]
}

type FullOptions = Required<Options>
type DefaultOptions = Omit<FullOptions, "aggregator">

const defaultOptions: DefaultOptions = {
    coverSize: "400x400",
    useCovers: true,
    useMediaSession: true,
    fallbackCover: "https://player.streamonkey.net/logo_monkey.svg",
    queryParams: {}
}

/**
 * StreamPlayer emits two events:
 * - `currentchange`: when the current song changes
 * - `historychange`: when the history changes
 */
export class StreamPlayer extends TypedEmitter<MetaEvents> {
    private ctx = new AudioContext()
    private gain = this.ctx.createGain()
    private analyzer = this.ctx.createAnalyser()
    private streamurl: string = ""
    private getSocketurl: ((id: string) => string) | null = null
    private historyurl: string = ""
    private statsurl: string = ""
    public edge: string = ""
    private initialization: Promise<void>
    private audio: HTMLAudioElement | null = null
    private src: MediaElementAudioSourceNode | null = null
    private lbRes: Response | null = null

    get response() {
        return this.lbRes
    }

    private options: FullOptions

    public history: Meta[] = []

    public static loadbalancer = "frontend.streamonkey.net"

    private async initURLs() {
        const lbURL = new URL(`https://${StreamPlayer.loadbalancer}/${this.channel}`)

        Object.entries(this.options.queryParams).forEach(([k, v]) => lbURL.searchParams.set(k, v))

        lbURL.searchParams.set("aggregator", this.options.aggregator)

        this.historyurl = `https://${StreamPlayer.loadbalancer}/${this.channel}/history`

        this.lbRes = await fetch(lbURL.toString(), { method: "HEAD" })

        this.streamurl = this.lbRes.url

        const edgeURL = new URL(this.streamurl)

        this.edge = edgeURL.host

        this.getSocketurl = (id) => `wss://${this.edge}/wstitleupdate/${id}`
        this.statsurl = `https://${this.edge}/${this.channel}/mystats`
    }

    /**
     * 
     * @param channel the channel to connect to
     * @param options 
     */
    constructor(private channel: string, options: Options) {
        super()

        if (!options.aggregator) {
            throw new Error("options.aggregator must be set!")
        }

        this.options = Object.assign(defaultOptions, options)

        this.initialization = this.initURLs()

        this.analyzer.fftSize = Math.pow(2, 10)
        this.analyzer.maxDecibels = 0
        this.analyzer.minDecibels = -70
        this.analyzer.smoothingTimeConstant = 0.85 // dampen the animation
        this.gain.gain.value = 1

        this.getHistory()

        this.setMediaSession()
    }

    private _playing = false

    /**
     * get the playing state
     */
    public get playing() {
        return this._playing
    }

    /**
     * start the playback of the stream
     * @param time the time of the stream to start at, if omitted will start at live
     * @returns 
     */
    public async play(time?: Date) {
        if (this.playing) return

        // this check is necessary for safari, because it doesn't support await for creating an <audio> element
        // if omitted, the playback will not start in safari
        if (this.streamurl == "") {
            await this.initialization
        }

        this.audio = document.createElement("audio")
        document.body.append(this.audio)
        this.audio.style.display = "none"
        this.audio.crossOrigin = "use-credentials"

        let url = new URL(this.streamurl)

        if (time) {
            const canAAC = this.audio.canPlayType("audio/aacp")

            const codec = canAAC == "probably" ? "aacp" : "mp3"

            url.pathname = `/${this.channel}/stream/${codec}/${time.getUTCFullYear()}/${time.getUTCMonth() + 1}/${time.getUTCDate()}/${time.getUTCHours()}/${time.getUTCMinutes()}/${time.getUTCSeconds()}`
        }

        url.searchParams.set("nocache", noCache())

        this.audio.src = url.toString()

        this.audio.volume = 1

        this.src = this.ctx.createMediaElementSource(this.audio)

        this.src.connect(this.gain).connect(this.analyzer).connect(this.ctx.destination)

        // connect the websocket only after the audio is loaded
        this.audio.addEventListener("loadeddata", () => {
            this.connectWebsocket().catch(() => { })
        })

        this.audio.play()

        this._playing = true
    }

    /**
     * stop the playback of the stream
     * can be restarted afterwards
     * @returns
     */
    public stop() {
        if (!this._playing) return

        this.socket?.close()

        this.audio?.pause()

        this.src?.disconnect()

        this.audio?.remove()

        this.audio = null

        this.src = null

        this._playing = false
    }

    private socket: WebSocket | null = null

    private setMediaSession() {
        if (this.options.useMediaSession && "mediaSession" in navigator && navigator.mediaSession) {
            navigator.mediaSession.setActionHandler("play", () => this.play())
            navigator.mediaSession.setActionHandler("pause", this.stop)
            navigator.mediaSession.setActionHandler("stop", this.stop)
        }
    }

    private async getSessionID(): Promise<string> {
        await this.initialization

        if (!this._playing) throw new Error("Not playing")

        const res = await fetch(this.statsurl, {
            mode: "cors",
            credentials: "include"
        })

        if (res.status != 200) {
            await sleep(1000)
            return await this.getSessionID()
        }

        const json: MyStats = await res.json()

        return json.SessionId
    }

    private connectWebsocket = async () => {
        this.socket?.close()

        if (!this.playing || this.getSocketurl == null) return

        const sessionID = await this.getSessionID()

        this.socket = new WebSocket(this.getSocketurl(sessionID))

        this.socket.onerror = async () => {
            this.socket?.close()
            console.log("retrying connection")

            await sleep(2000)
            this.connectWebsocket()
        }

        this.socket.addEventListener("message", async (e: MessageEvent<string>) => {
            const json: SocketMeta = JSON.parse(e.data)

            const cover = json.cover_url != "" ? json.cover_url : await this.getCoverURL(json.title, json.artist)

            this.dispatchEvent("currentchange", {
                artist: json.artist,
                coverURL: cover,
                title: json.title,
                time: new Date()
            })

            this.getHistory()

            if (this.options.useMediaSession) {
                navigator.mediaSession!.metadata = new MediaMetadata({
                    title: json.title,
                    artist: json.artist,
                    artwork: [
                        { src: cover, sizes: "400x400" },
                    ]
                })
            }
        })
    }

    private getCoverURL = async (title: string, artist: string) => {
        if (!this.options.useCovers) {
            return this.options.fallbackCover
        }

        const res = await fetch(`https://player.streamonkey.net/coverart?search=${encodeURIComponent(artist + " " + title)}`, {
            mode: "cors"
        })

        try {
            const json: CoverResponse = await res.json()

            const first = json.results[0]

            if (first != undefined) {
                return first.artworkUrl100.replace("100x100", this.options.coverSize)
            }

        } catch (e) { }

        return this.options.fallbackCover
    }

    private async getHistory() {
        await this.initialization
        const res = await fetch(this.historyurl)

        const json: HistoryEntryRaw[] = await res.json()

        if (!Array.isArray(json)) {
            this.history = []
            return
        }

        const hist = json.slice(0, 20)

        this.history = await Promise.all(hist.map(async v => {
            const cover = await this.getCoverURL(v.MetaSong, v.MetaArtist)

            return {
                title: v.MetaSong,
                artist: v.MetaArtist,
                coverURL: cover,
                time: new Date(v.InsertDate)
            }
        }))

        this.dispatchEvent("historychange", this.history)
    }

    /**
     * set a new volume for the stream (range 0-1)
     */
    set volume(vol: number) {
        this.gain.gain.value = vol
    }

    /**
     * get the current volume of the stream (range 0-1)
     */
    get volume() {
        return this.gain.gain.value
    }

    /**
     * Fill the given array with the current spectrum data
     * @param data a Uint8Array to which the fftdata will be written
     */
    fft(data: Uint8Array) {
        this.analyzer.getByteFrequencyData(data)
    }
}

