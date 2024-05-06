import { serve } from 'bun';
import { Gtfs } from "./lib"
import anyAscii from "any-ascii";

const PORT = 8080;

const gtfs = new Gtfs();

serve({
  port: PORT,
  async fetch(request) {
    const { method } = request;
    const { pathname } = new URL(request.url);
    const pathRegexForID = /^\/api\/stop\/(\d+)$/;

    const match = pathname.match(pathRegexForID);
    const id = match && match[1];

    if (!id) {
      return new Response("Invalid ID. Try <a href='/api/stop/1252'>/api/stop/1252</a>", {
        status: 400,
        headers: { 'Content-Type': 'text/html' },
      });
    }

    const nextInStop = await gtfs.getNextForStop("U" + id + "Z2", 2);

    const res: string[] = [];

    for (const stopTripData of nextInStop) {
      const line = gtfs.getLineName(stopTripData);
      const time = gtfs.getDepartureTimeHHMM(stopTripData);

      // const _stop = this.getStopName(stopTripData);
      const _stop = gtfs.getDestinationName(stopTripData);
      const __stop = _stop?.substring(
        0,
        14 - (line?.length || 0) - time.length,
      ); // 15 since there is a space
      const stop =
        _stop !== __stop
          ? __stop?.substring(0, __stop.length - 1) + "."
          : _stop;

      const str = `${time} ${line} ${stop}`;
      res.push(str);
    }


    return new Response(anyAscii(res.join("\n")), {
      headers: { 'Content-Type': 'text/plain' },
    });
  }
});

console.log(`Listening on http://localhost:${PORT} ...`);