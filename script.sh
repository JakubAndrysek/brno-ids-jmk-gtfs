#!/bin/bash

# Funzione per leggere costantemente dalla porta seriale
read_serial() {
    echo "Inizio lettura dalla porta seriale..."
    while true; do
        cat /dev/ttyACM0
    done
}

# Esegui la funzione di lettura dalla porta seriale in background
read_serial &

# Salva il PID del processo di lettura della porta seriale
PID_SERIAL_READ=$!

# Loop infinito per eseguire lo script esterno ogni 5 minuti
while true; do
    echo "Eseguo lo script esterno..."
    output=$(/home/bitrey/.bun/bin/bun /home/bitrey/Documents/Webdev_Projects/brno-ids-jmk-gtfs/src/index.ts)
    echo $output
    # send output to  >/dev/ttyACM0
    echo $output >/dev/ttyACM0

    # Controlla se ci sono stati errori nell'output
    if [ $? -ne 0 ]; then
        echo "Errore nell'esecuzione dello script esterno. Terminazione dello script."
        exit 1
    fi

    # Attendere 3 minuti
    sleep 180
done
