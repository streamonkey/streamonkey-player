/*
  decodes meta data from streamprovider
  emits decoded meta data on a timer according to difference between buffered and played audio
*/

import { TypedEmitter } from "../typedEventTarget.js"

interface metatextUpdateEvent {
  metaText: string
}

interface Meta {
  [key: string]: string
}

interface MetaEvent {
  metatextchange: metatextUpdateEvent
}

export class MetaInfoHelper extends TypedEmitter<MetaEvent> {
  private trackedTimers: any

  constructor() {
    super()
    this.trackedTimers = new Set()
  }

  startMetaTextTimer(metaTextStream: Uint8Array, secondsDelayed: number) {
    const metaText = new TextDecoder("utf-8").decode(metaTextStream);
    const myTimeout = setTimeout(() => {
      console.log("ICY-META-INFO: ", metaText)
      this.dispatchEvent("metatextchange", {
        metaText: metaText
      })
      this.trackedTimers.delete(myTimeout)
    }, secondsDelayed * 1000)
    this.trackedTimers.add(myTimeout)
  }

  clearAllMetaTextTimers() {
    for (const timeout of this.trackedTimers.values()) {
      clearTimeout(timeout)
    }
    this.trackedTimers.clear()
  }
}