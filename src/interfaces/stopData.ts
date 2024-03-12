import { Route, Stop, StopTime, Trip } from "gtfs-types";

export interface StopTripData {
    stop?: Stop;
    stopTime?: StopTime;
    trip?: Trip;
    route?: Route;
}
