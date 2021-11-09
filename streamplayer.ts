import { TypedEmitter } from "./typedEventTarget.js"

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


interface SocketMeta {
    artist: string
    class: string
    companion_ad: null
    cover_data: null
    cover_url: string
    master_id: string
    start_time_unix: string
    title: string
    title_combined: string
}

export interface Meta {
    title: string
    artist: string
    coverURL: string
    time: Date
}

type ArtworkSize = `${number}x${number}`

export interface Options {
    useCovers: boolean
    coverSize: ArtworkSize
    aggregator: string
    useMediaSession: boolean
    fallbackCover: string
    queryParams: Record<string, string>
}

interface MetaEvents {
    currentchange: Meta
    historychange: Meta[]
}

export class StreamPlayer extends TypedEmitter<MetaEvents> {
    private ctx = new AudioContext()
    private gain = this.ctx.createGain()
    private analyzer = this.ctx.createAnalyser()
    private streamurl: string = ""
    private socketurl: string = ""
    private historyurl: string = ""
    public edge: string = ""
    private initialization: Promise<void>
    private audio: HTMLAudioElement | null = null
    private src: MediaElementAudioSourceNode | null = null
    private lbRes: Response | null = null

    get response() {
        return this.lbRes
    }

    private options: Options = {
        coverSize: "400x400",
        useCovers: true,
        aggregator: "",
        useMediaSession: true,
        fallbackCover: "https://player.streamonkey.net/logo_monkey.svg",
        queryParams: {}
    }

    public history: Meta[] = []

    public static loadbalancer = "frontend.streamonkey.net"

    private async initURL(channel: string) {
        const lbURL = new URL(`https://${StreamPlayer.loadbalancer}/${channel}`)

        Object.entries(this.options.queryParams).forEach(([k, v]) => lbURL.searchParams.set(k, v))

        lbURL.searchParams.set("aggregator", this.options.aggregator)

        this.historyurl = `https://${StreamPlayer.loadbalancer}/${channel}/history`

        this.lbRes = await fetch(lbURL.toString(), { method: "HEAD" })

        this.streamurl = this.lbRes.url

        const edgeURL = new URL(this.streamurl)

        this.edge = edgeURL.host

        this.socketurl = `wss://${this.edge}/wstitleupdate`
    }

    constructor(private channel: string, options: Partial<Options>) {
        super()
        Object.assign(this.options, options)

        if (!this.options.aggregator) {
            throw new Error("aggregator must be set!")
        }

        this.initialization = this.initURL(channel)

        this.analyzer.fftSize = Math.pow(2, 10)
        this.analyzer.maxDecibels = 0
        this.analyzer.minDecibels = -70
        this.analyzer.smoothingTimeConstant = 0.85 // dampen the animation
        this.gain.gain.value = 1

        this.getHistory()

        this.setMediaSession()
    }

    private _playing = false

    public get playing() {
        return this._playing
    }

    public async play(time?: Date) {
        if (this._playing) return

        await this.initialization
        await this.ctx.resume()

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
            this.connectWebsocket()
        })

        this.audio.play()

        this._playing = true
    }

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

    private connectWebsocket = () => {
        this.socket?.close()

        this.socket = new WebSocket(this.socketurl)

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

    set volume(vol: number) {
        this.gain.gain.value = vol
    }

    get volume() {
        return this.gain.gain.value
    }

    fft(data: Uint8Array) {
        this.analyzer.getByteFrequencyData(data)
    }
}

