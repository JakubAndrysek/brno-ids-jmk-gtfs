import { config } from "../config";
import { mkdir } from "fs/promises";
import path from "path";

export async function mkdirs() {
    const paths = [
        config.gtfs.downloadPath.static,
        config.gtfs.downloadPath.rt,
        config.gtfs.unzipPath.static,
    ];
    const dirs = paths.map((p) => path.dirname(p));
    for (const dir of dirs) {
        await mkdir(dir, { recursive: true });
    }
}
