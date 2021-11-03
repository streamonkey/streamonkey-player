# streaMonkey Player

see [test.html](test.html) for a usage example

this module exports `StreamPlayer`

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