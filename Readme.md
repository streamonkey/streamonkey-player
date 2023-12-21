# streaMonkey Player

This module provides a JS client library to connect to a radio stream hosted by [streaMonkey](https://www.streamonkey.de/en). It connects to the stream, fetches the history and the current title.

Optionally, you can provide a URL from where it fetches the cover arts per title.

## include

this module exports `StreamPlayer`

```ts
import {StreamPlayer} from "streamonkey-player"
```

Or in this modules `browser` folder after you built it locally with `npm run build`.

You could also use the [unpkg](https://unpkg.com/) CDN:

```html
<script src="https://unpkg.com/streamonkey-player/browser/streamplayer.js"></script>
```

## Basic Usage

For basic usage, do the following and replace the `<mount-name>` and the `<aggregator name>` with your desired mount and aggregator. (see [player.html](./player.html))

```ts
const playBtn = document.getElementById()

const player = new StreamPlayer("<mount-name>", {
    aggregator: "<aggregator name>"
})

playBtn.addEventListener("click", () => {
    player.play()
})
```

## Advanced Usage

### Additional options

the Options for the constructor are defined as follows:

```ts
interface Options {
    covers?: {
        URL?: string         // the backend to use
        fallback?: string    // fallback image URL
    } | null            
    // the aggregator to use, this must be set, e.g. "Website"
    aggregator: string                  
    // whether to use the systems media control
    useMediaSession: boolean            
    // an URL to an image that will be used when no cover could be found 
    fallbackCover: string               
    // additional query params in the URL
    queryParams: Record<string, string> 
}
```

The `queryParams` in particular can be used to pass additional information to the streaming backend, e.g. companion ad data, as follows:

```ts
const player = new StreamPlayer("<mount-name>", {
    aggregator: "<aggregator name>",
    queryParams: {
        "companionAds": "true",
        "companion_zone_alias": "<zone1>,<zone2>,<zone3>,<zone4>,..."
})
```

### Events

The instance of the `StreamPlayer` is an `EventEmitter` and dispatches 2 Custom Events:

`currentchange`: The currentitle changed and is passed in `event.details`

```ts
streamPlayer.addEventListener("currentchange", (e) => {
    console.log(e.detail);
})
```

`historychange`: The history changed and is passed in `event.details` the history is an Array of `Meta`

```ts
streamPlayer.addEventListener("historychange", (e) => {
    console.log(e.detail);
})
```

both times the returned Metadata is structured as follows:

```ts
interface Meta {
    title: string
    artist: string
    cover: any
    time: Date
    companionAd: CompanionAd | null
}

interface CompanionAd {
    creative_id: string
    resource_url: string
    resource_type: string
    click: string
    click_tracking: string[]
    view_tracking: string[]
    resource_data: number[]
}

```

### Visualization Data

internally, this module uses the [Web AudioContext](https://developer.mozilla.org/en-US/docs/Web/API/AudioContext) and specifically the [AnalyzerNode](https://developer.mozilla.org/en-US/docs/Web/API/AnalyserNode) to get the Frequency Data.

Access the Data by passing a `UInt8Array` to the instances `.fft()` function. The size can be up to 512, but then the upper frequencies will not change much, which may not be desired.

```ts
const fftData = new Uint8Array(200)

function loop() {
    // this will mutate the fftData:
    streamPlayer.fft(fftData)

    // do something with the fftData

    requestAnimationFrame(loop)
}

loop()
```

### Coverarts

To use this library with coverarts, provide a URL to the options. This endpoint will be called as follows, if the song was "Enemy" by "Imagine Dragons" for Example:

```
http://example.com/audios?artist=Imagine%20Dragons&title=Enemy
```

The response of this endpoint has to be a URL to the actual image, e.g:

```
https://is1-ssl.mzstatic.com/image/thumb/Music116/v4/fd/78/f0/fd78f070-5a95-e509-c362-0f362f5ddca9/source/100x100bb.jpg
```

If this request returns a non 200 response, then the fallback URL will be used.

### Override the used domain:

```ts
StreamPlayer.loadbalancer = "mycustomlb.de"

const player = StreamPlayer("mychannel", {
    aggregator: "website"
})
```

## Can you please add featureX?

create an issue in the issue tracker in [GitHub](https://github.com/streamonkey/streamonkey-player/issues)

or fork and create a pull request