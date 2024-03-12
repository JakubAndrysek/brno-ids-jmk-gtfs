import { importGtfs } from "gtfs";
import { Database } from "bun:sqlite";
import { config } from "./config";
import axios from "axios";
import fs from "fs";

const db = new Database(config.dbPath);

export class Gtfs {
    public async fetchStaticGtfs(): Promise<void> {
        if (this.gtfsExists()) {
            return;
        }
        // get data from config.gtfsStaticUrl and save it to config.downloadGtfsPath (pipe it to fs.createWriteStream)
        const response = await axios.get(config.gtfs.url.static, {
            responseType: "stream",
        });
        const writer = fs.createWriteStream(config.gtfs.downloadPath.static);
        response.data.pipe(writer);
        return new Promise((resolve, reject) => {
            writer.on("finish", resolve);
            writer.on("error", reject);
        });
    }

    private gtfsExists(): boolean {
        return fs.existsSync(config.gtfs.downloadPath.static);
    }

    public importGtfs(): void {
        importGtfs({
            agencies: [
                {
                    path: config.gtfs.downloadPath.static,
                },
            ],
            db,
            sqlitePath: config.dbPath,
        });
    }
}

const gtfs = new Gtfs();
gtfs.fetchStaticGtfs().then(() => {
    gtfs.importGtfs();
});
