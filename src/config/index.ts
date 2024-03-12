import path from "path";
import { mkdirs } from "./mkdirs";
import "dotenv/config";

export const config = Object.freeze({
    dbPath: path.join(process.cwd(), "/gtfs/db.sqlite"),
    gtfs: {
        url: {
            static: "https://content.idsjmk.cz/kestazeni/gtfs.zip",
            rt: "https://content.idsjmk.cz/kestazeni/gtfsReal.dat",
        },
        downloadPath: {
            static: path.join(process.cwd(), "/gtfs/download/gtfs.zip"),
            rt: path.join(process.cwd(), "/gtfs/download/gtfsReal.json"),
        },
        unzipPath: {
            static: path.join(process.cwd(), "/gtfs/unzip"),
        },
        files: {
            agency: "agency.txt",
            calendar: "calendar.txt",
            calendarDates: "calendar_dates.txt",
            routes: "routes.txt",
            shapes: "shapes.txt",
            stopTimes: "stop_times.txt",
            stops: "stops.txt",
            trips: "trips.txt",
        },
        rtCacheSeconds: 30,
    },
});

mkdirs();
