import typescript from "@rollup/plugin-typescript";
import {terser} from "rollup-plugin-terser";

export default {
    input: "src/index.ts",
    output: [
        {format:"cjs", file: "dist/index.cjs"},
        {format: "es", file: "dist/index.mjs"},
        {format: "umd", file: "dist/index.js", name: "macfja-x"}
    ],
    plugins: [
        typescript(),
        terser()
    ]
}
