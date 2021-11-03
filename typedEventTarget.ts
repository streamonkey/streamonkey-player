/**
 * Map the keys to the CustomEvent details
 */
declare type EventDetails = {
    [k: string]: any
}

/**
 * EventTarget, but with types
 */
export class TypedEmitter<L extends EventDetails = EventDetails> {
    private emitter = new EventTarget()

    addEventListener<U extends keyof L>(
        type: U,
        listener: ((evt: CustomEvent<L[U]>) => void) | null,
        options?: boolean | AddEventListenerOptions
    ) {
        // the cast is necessary, since listener can only listen on Event (but it also works with customevents, typescript just doesn't like it)
        return this.emitter.addEventListener(
            type as string,
            (listener as unknown) as EventListenerOrEventListenerObject | null,
            options
        )
    }

    /**
     * dispatchEvent has been changed from the standard implementation, so it's easier to use and more stricly typeable
     * @param event event name
     * @param detail customevent data
     * @returns boolean
     */
    dispatchEvent<U extends keyof L>(event: U, detail?: L[U]): boolean {
        return this.emitter.dispatchEvent(new CustomEvent(event as string, { detail }))
    }

    removeEventListener<U extends keyof L>(
        type: U,
        listener: ((evt: CustomEvent<L[U]>) => void) | null,
        options?: boolean | AddEventListenerOptions
    ) {
        return this.emitter.removeEventListener(type as string, (listener as unknown) as EventListener, options)
    }
}
