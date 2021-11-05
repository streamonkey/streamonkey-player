# streaMonkey Player

This module provides a JS client library to connect to a radio stream hosted by [streaMonkey](https://www.streamonkey.de/en). It connects to the stream, fetches the history and the current title.

Optionally, it uses the iTunes Search Api to get cover URLs for each audio. 
## include

this module exports `StreamPlayer`

```ts
import {StreamPlayer} from "streamonkey-player"
```

alternatively there is a Browser ready version available for inclusion via a script Tag

```html
<script src="https://player.streamonkey.net/streamplayer.js"></script>
```

Or in this modules `browser` folder

## Basic Usage

```ts
const player = new StreamPlayer("channel", {
    aggregator: "Website"
})
```

where `options` are defined as follows:

```ts
type ArtworkSize = `${number}x${number}`

interface Options {
    // whether to fetch the covers, default: true
    useCovers: boolean                  
    // cover size, default: "400x400"
    coverSize: ArtworkSize              
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

The instance exposes `play()` and `stop()` methods to start and stop the stream

`play()` accepts an optional `Date` instance that will be used for timeshifting

the instances `volume` property is a getter and setter for the volume of the stream. Recommended values are 0-1, but it will accept more

## Events

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
export interface Meta {
    title: string
    artist: string
    coverURL: string // url for the album cover, either downloaded or the fallbackURL
}
```

## Visualization Data

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

## Coverarts

if the coverarts are used, they are fetched from `player.streamonkey.net` which acts as a Proxy to iTunes search API.
Currently, the returned coverarts all point to iTunes' CDN 

## Advanced Usage

### Override the used domain:

```ts
StreamPlayer.loadbalancer = "mycustomlb.de"

const player = StreamPlayer("mychannel", {
    aggregator: "website"
})
```