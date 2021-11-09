import ts from "@rollup/plugin-typescript"
import { mkdirSync } from "fs"

mkdirSync("browser", {
    recursive: true
})

mkdirSync("dist", {
    recursive: true
})

/**
 * @type import("rollup").RollupOptions
 */
const config = {
    input: "browserwrapper.ts",
    output: {
        file: "browser/streamplayer.js",
        format: "iife"
    },
    plugins: [
        ts({
            tsconfig: "tsconfig.json",
            outDir: "browser",
            tsBuildInfoFile: ".browser.tsbuildinfo"
        })
    ]
}

export default config