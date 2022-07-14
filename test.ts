import { StreamController } from "./streamcontroller.js"

const player = new StreamController("foo", {
    aggregator: ""
})

player.addEventListener("currentchange", e => {
    e.detail
})

player.addEventListener("historychange", e => {
    e.detail
})