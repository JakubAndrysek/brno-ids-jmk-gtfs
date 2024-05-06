# brno-gtfs

This project is a simple web server that serves GTFS data for stops in Brno, Czech Republic.
It is only prototype and it is not finished yet. Feee free to fork it and finish it.
If you add new features, inform me about it.

Forked from [Bitrey/brno-ids-jmk-gtfs](https://github.com/Bitrey/brno-ids-jmk-gtfs)

To install dependencies:

```bash
bun install
```

To run a basic web server that serves GTFS data for stops:

```bash
bun run src/serve.ts
```

<img width="456" alt="image" src="https://github.com/JakubAndrysek/brno-ids-jmk-gtfs/assets/33494544/af3e1f4c-d069-47c5-8831-ce68575de0f0">

<img width="358" alt="image" src="https://github.com/JakubAndrysek/brno-ids-jmk-gtfs/assets/33494544/860943c4-fb0a-4436-b10a-9d37784b52ec">

```bash
debug: GTFS does not exist, fetching
debug: GTFS fetched and unzipped
debug: GTFS does not exist, fetching
debug: GTFS fetched and unzipped
Listening on http://localhost:8080 ...
debug: GTFS parsed in 4411ms
debug: GTFS parsed
debug: GTFS parsed in 4411ms
debug: GTFS parsed
09:44 12 Komarov
09:45 12 Komarov
09:55 72 Techno.
10:15 72 Techno.
```

Trips will be added in the future.


This project was created using `bun init` in bun v1.0.7. [Bun](https://bun.sh) is a fast all-in-one JavaScript runtime.
