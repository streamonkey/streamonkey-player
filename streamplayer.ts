//@ts-ignore
const AudioContext = window.AudioContext || window.webkitAudioContext

const sleep = (time: number) => {
    return new Promise((resolve) => {
        setTimeout(resolve, time)
    })
}

const noCache = () => {
    return "?nocache=" + Math.random().toString().slice(2)
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
    coverURL: string | undefined
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

const ctx = new AudioContext()
export class StreamClient extends EventTarget {
    private gain = ctx.createGain()
    private analyzer = ctx.createAnalyser()
    private streamurl: string = ""
    private socketurl: string = ""
    private historyurl: string = ""
    private edge: string = ""
    private initialization: Promise<void>
    private audio: HTMLAudioElement | null = null
    private src: MediaElementAudioSourceNode | null = null

    private options: Options = {
        coverSize: "400x400",
        useCovers: true,
        aggregator: "streaMonkey stream player",
        useMediaSession: true,
        fallbackCover: "https://player.streamonkey.net/logo_monkey.svg",
        queryParams: {}
    }

    public history: Meta[] = []

    public static loadbalancer = "frontend.streamonkey.net"

    private async initURL(channel: string) {
        const lbURL = new URL(`https://${StreamClient.loadbalancer}/${channel}/stream/mp3`)

        Object.entries(this.options.queryParams).forEach(([k, v]) => lbURL.searchParams.set(k, v))

        lbURL.searchParams.set("aggregator", this.options.aggregator)

        this.historyurl = `https://${StreamClient.loadbalancer}/${channel}/history`

        const res = await fetch(lbURL.toString(), { method: "HEAD" })

        this.streamurl = res.url

        const edgeURL = new URL(this.streamurl)

        this.edge = edgeURL.host

        this.socketurl = `wss://${this.edge}/wstitleupdate`
    }

    constructor(channel: string, options: Partial<Options>) {
        super()
        Object.assign(this.options, options)

        this.initialization = this.initURL(channel)

        this.analyzer.fftSize = Math.pow(2, 10)
        this.analyzer.maxDecibels = 0
        this.analyzer.minDecibels = -70
        this.analyzer.smoothingTimeConstant = 0.85 // dampen the animation
        this.gain.gain.value = 1

        this.getHistory()
    }

    private _playing = false

    public get playing() {
        return this._playing
    }

    public async play() {
        if (this._playing) return

        await this.initialization
        await ctx.resume()

        this.audio = document.createElement("audio")
        document.body.append(this.audio)
        this.audio.style.display = "none"
        this.audio.crossOrigin = "use-credentials"

        this.audio.src = this.streamurl + noCache()

        this.audio.volume = 1

        this.src = ctx.createMediaElementSource(this.audio)

        this.src.connect(this.analyzer).connect(ctx.destination)

        this.connectWebsocket()

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
            navigator.mediaSession.setActionHandler("play", this.play)
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

            this.dispatchEvent(new CustomEvent<Meta>("currentchange", {
                detail: {
                    artist: json.artist,
                    coverURL: cover,
                    title: json.title
                }
            }))

            const shortHist = this.history.slice(0, 2).map(m => m.title + m.artist)

            if (shortHist.includes(json.title + json.artist)) {
                this.history.unshift({
                    artist: json.artist,
                    coverURL: cover,
                    title: json.title
                })

                this.dispatchEvent(new CustomEvent<Meta[]>("historychange", {
                    detail: this.history
                }))
            }

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
                coverURL: cover
            }
        }))

        this.dispatchEvent(new CustomEvent<Meta[]>("historychange", {
            detail: this.history
        }))
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

