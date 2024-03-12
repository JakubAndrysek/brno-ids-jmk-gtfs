import axios from "axios";
import fs from "fs";
import path from "path";
import { config } from "./config";
import { logger } from "../shared/logger";
import csvToJson from "csvtojson/v2";
import {
    Agency,
    Calendar,
    CalendarDates,
    Route,
    Stop,
    StopTime,
    Trip,
} from "gtfs-types";
import GtfsRealtimeBindings from "gtfs-realtime-bindings";
import moment, { Moment } from "moment";
import { StopTripData } from "./interfaces/stopData";
// import { CronJob } from "cron";
import anyAscii from "any-ascii";
import { lineMap } from "./config/lineMap";

class Gtfs {
    private agency: Agency[] | undefined;
    private calendar: Calendar[] | undefined;
    private calendarDates: CalendarDates[] | undefined;
    private routes: Route[] | undefined;
    private stopTimes: StopTime[] | undefined;
    private stops: Stop[] | undefined;
    private trips: Trip[] | undefined;

    private loadingPromise: Promise<void> | undefined;

    private rtFeed:
        | GtfsRealtimeBindings.transit_realtime.FeedMessage
        | undefined;
    private rtCacheDate: Moment | undefined;

    constructor() {
        this.loadingPromise = this.loadStaticGtfs();
    }

    private async fetchStaticGtfs(): Promise<void> {
        if (this.gtfsExists()) {
            return;
        }
        logger.debug(`Fetching static GTFS from ${config.gtfs.url.static}`);
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

    private async fetchRealtimeGtfs(): Promise<GtfsRealtimeBindings.transit_realtime.FeedMessage> {
        if (this.rtFeed && this.rtCacheDate) {
            if (
                moment().diff(this.rtCacheDate, "seconds") <
                config.gtfs.rtCacheSeconds
            ) {
                return this.rtFeed;
            }
        }

        logger.debug(`Fetching realtime GTFS from ${config.gtfs.url.rt}`);
        const response = await axios.get(config.gtfs.url.rt, {
            responseType: "arraybuffer",
        });
        const feed = GtfsRealtimeBindings.transit_realtime.FeedMessage.decode(
            new Uint8Array(response.data),
        );
        logger.debug(
            `Fetched realtime GTFS with ${feed.entity.length} entities`,
        );

        this.rtFeed = feed;
        this.rtCacheDate = moment();

        fs.writeFileSync(
            config.gtfs.downloadPath.rt,
            JSON.stringify(feed.toJSON(), null, 2),
        );
        return feed;
    }

    private async getRealtimeForTrip(
        tripId: string,
    ): Promise<GtfsRealtimeBindings.transit_realtime.IFeedEntity | undefined> {
        const feed = await this.fetchRealtimeGtfs();
        const trip = feed.entity.find(
            (e) => e.vehicle?.trip?.tripId === tripId,
        );
        return trip;
    }

    private gtfsExists(): boolean {
        return fs.existsSync(config.gtfs.unzipPath.static);
    }

    private async unzip(from: string, to: string): Promise<void> {
        logger.debug(`Unzipping ${from} to ${to}`);
        return new Promise((resolve, reject) => {
            const proc = Bun.spawn(["unzip", "-o", from, "-d", to], {
                onExit: (proc, exitCode, signalCode, error) => {
                    if (exitCode !== 0 || error) {
                        reject(
                            new Error(
                                `Unzip failed: ${exitCode} - error ${error}`,
                            ),
                        );
                    }
                    logger.debug(`Unzip with PID ${proc.pid} successful`);
                    resolve();
                },
            });
            logger.debug(`Unzipping with PID ${proc.pid}`);
        });
    }

    private async parseCsv(path: string): Promise<any[]> {
        // logger.debug(`Parsing CSV file ${path}`);
        return await csvToJson().fromFile(path);
    }

    private async parseStaticGtfsFile<T>(fileName: string): Promise<T> {
        return (await this.parseCsv(
            path.join(config.gtfs.unzipPath.static, fileName),
        )) as T;
    }

    private async getStopTimesForStop(stopId: string): Promise<StopTime[]> {
        if (!this.stopTimes) {
            await this.loadingPromise;
        }

        return (this.stopTimes as StopTime[]).filter(
            (st) => st.stop_id === stopId,
        );
    }

    private async getTripsForStop(stopId: string): Promise<Trip[]> {
        if (!this.trips) {
            await this.loadingPromise;
        }

        const stopTimes = await this.getStopTimesForStop(stopId);
        const tripIds = stopTimes.map((st) => st.trip_id);
        return (this.trips as Trip[]).filter((t) =>
            tripIds.includes(t.trip_id),
        );
    }

    private parseDepartureTime(departureTime: string): Moment {
        // hour might be > 24: https://gtfs.org/reference/static/#stop_timestxt
        const [hour] = departureTime.split(":").map(Number);
        if (hour >= 24) {
            return moment(departureTime, "HH:mm:ss").add(1, "day");
        }
        return moment(departureTime, "H:mm:ss");
    }

    private async getNextForStop(
        stopId: string,
        qty = 1,
    ): Promise<StopTripData[]> {
        const stopTimes = await this.getStopTimesForStop(stopId);
        const trips = await this.getTripsForStop(stopId);

        const { calendar, routes } = this;
        if (!calendar) {
            throw new Error("Calendar not loaded");
        } else if (!routes) {
            throw new Error("Routes not loaded");
        }

        const curWeekday = moment().format("dddd").toLowerCase(); // monday, tuesday, ...

        const now = moment();
        const nextStopTimes = stopTimes.filter((st) => {
            if (
                !st.departure_time ||
                this.parseDepartureTime(st.departure_time).isBefore(now)
            ) {
                return false;
            }
            const foundTrip = trips.find((t) => {
                if (t.trip_id !== st.trip_id || !t.service_id) {
                    return false;
                }
                const c = calendar.find((c) => c.service_id === t.service_id);
                if (!c) {
                    return false;
                }
                const servicedToday = c[curWeekday as keyof typeof c] === "1";
                return servicedToday;
            });
            return foundTrip;
        });

        // sort by arrival time
        nextStopTimes.sort((a, b) =>
            this.parseDepartureTime(a.departure_time!).diff(
                this.parseDepartureTime(b.departure_time!),
            ),
        );

        const res: StopTripData[] = [];

        for (let i = 0; i < qty; i++) {
            const nextTrip = trips.find(
                (t) => t.trip_id === nextStopTimes[i]?.trip_id,
            );

            const nextRoute =
                nextTrip &&
                this.routes?.find((r) => r.route_id === nextTrip?.route_id);

            const nextStop = this.stops?.find((s) => s.stop_id === stopId);

            if (
                i > 0 &&
                nextRoute?.route_short_name ===
                    res[i - 1].route?.route_short_name &&
                nextTrip?.trip_headsign === res[i - 1].trip?.trip_headsign &&
                nextStopTimes[i].departure_time ===
                    res[i - 1].stopTime?.departure_time
            ) {
                nextStopTimes.splice(i, 1);
                i--;
                continue;
            }

            const obj = {
                stop: nextStop as Stop,
                stopTime: nextStopTimes[i],
                trip: nextTrip as Trip,
                route: nextRoute as Route,
            };
            res.push(obj);
        }

        return res;
    }

    private async loadStaticGtfs(): Promise<void> {
        logger.debug("GTFS does not exist, fetching");
        await this.fetchStaticGtfs();
        await this.unzip(
            config.gtfs.downloadPath.static,
            config.gtfs.unzipPath.static,
        );
        logger.debug("GTFS fetched and unzipped");
        this.agency = await this.parseStaticGtfsFile<Agency[]>(
            config.gtfs.files.agency,
        );
        this.calendar = await this.parseStaticGtfsFile<Calendar[]>(
            config.gtfs.files.calendar,
        );
        this.calendarDates = await this.parseStaticGtfsFile<CalendarDates[]>(
            config.gtfs.files.calendarDates,
        );
        this.routes = await this.parseStaticGtfsFile<Route[]>(
            config.gtfs.files.routes,
        );
        this.stopTimes = await this.parseStaticGtfsFile<StopTime[]>(
            config.gtfs.files.stopTimes,
        );
        this.stops = await this.parseStaticGtfsFile<Stop[]>(
            config.gtfs.files.stops,
        );
        this.trips = await this.parseStaticGtfsFile<Trip[]>(
            config.gtfs.files.trips,
        );
        logger.debug("GTFS parsed");
    }

    private getStopName(gtfsData?: StopTripData): string | undefined {
        return gtfsData?.stop?.stop_name;
    }

    private getLineName(gtfsData?: StopTripData): string | undefined {
        return gtfsData?.route?.route_short_name;
    }

    private getDestinationName(gtfsData?: StopTripData): string | undefined {
        return gtfsData?.trip?.trip_headsign;
    }

    private getDepartureTimeHHMM(gtfsData?: StopTripData): string {
        const time = gtfsData?.stopTime?.departure_time;
        return time && this.parseDepartureTime(time).isValid()
            ? this.parseDepartureTime(time).format("HH:mm")
            : "----";
    }

    // public async returnHHMM(stopId: string): Promise<string> {
    //     const _next = await this.getNextForStop(stopId);
    //     console.log(_next, "\n\n\n");
    //     let str = "";
    //     const time = _next?.stopTime?.departure_time;
    //     if (time) {
    //         const date = moment(time, "H:mm:ss");
    //         str += date.format("HHmm");
    //     } else {
    //         str += "----";
    //     }
    //     return str;
    // }

    private mapLine(line: any): string {
        return line && line in lineMap
            ? lineMap[line as keyof typeof lineMap]
            : line;
    }

    public async arduinoOutput(): Promise<string> {
        const nextBuses = await this.getNextForStop("U1252Z2", 2);
        const nextTrams = await this.getNextForStop("U1659Z2", 2);

        const res: string[] = [];

        for (const stopTripData of [...nextBuses, ...nextTrams]) {
            const line = this.mapLine(
                this.getLineName(stopTripData),
            )?.substring(0, 3);
            const time = this.getDepartureTimeHHMM(stopTripData);

            // const _stop = this.getStopName(stopTripData);
            const _stop = this.getDestinationName(stopTripData);
            const __stop = _stop?.substring(
                0,
                14 - (line?.length || 0) - time.length,
            ); // 15 since there is a space
            const stop =
                _stop !== __stop
                    ? __stop?.substring(0, __stop.length - 1) + "."
                    : _stop;

            const str = `${time} ${line} ${stop}`;

            // pad string to it's centered in 16 char display
            const pad = 16 - str.length;
            const leftPad = Math.floor(pad / 2);
            const rightPad = Math.ceil(pad / 2);
            res.push(" ".repeat(leftPad) + str + " ".repeat(rightPad));
        }

        // return "|" + res.join("") + "|";
        res.sort();
        return anyAscii(res.join(""));
    }
}

const gtfs = new Gtfs();
async function exec() {
    const hhmm = await gtfs.arduinoOutput();
    console.log(hhmm);
}

// const job = new CronJob(
//     "0 * * * * *", // cronTime
//     exec, // onTick
//     null, // onComplete
//     false, // start
//     "Europe/Rome", // timeZone
// );
// job.start();

exec();
