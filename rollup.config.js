import ts from "@rollup/plugin-typescript"

/**
 * @type import("rollup").RollupOptions
 */
const config = {
    input: "browserwrapper.ts",
    output: {
        dir: "browser",
        format: "iife"
    },
    plugins: [
        ts({
            tsconfig: "tsconfig.json",
            outDir: "browser"
        })
    ]
}

export default config