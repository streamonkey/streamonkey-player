import { StreamPlayer } from "./streamplayer"

const player = new StreamPlayer("foo", {
    aggregator: ""
})

player.addEventListener("currentchange", e => {
    e.detail
})

player.addEventListener("historychange", e => {
    e.detail
})