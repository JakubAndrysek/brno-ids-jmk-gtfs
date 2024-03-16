#!/bin/bash

# Wait for the device to be connected
while [ ! -e /dev/ttyACM0 ]; do
    echo "Waiting for the device to be connected..."
    sleep 1
done

# Wait for the device to be ready
while [ ! -r /dev/ttyACM0 ]; do
    echo "Waiting for the device to be ready..."
    sleep 1
done

echo "Device is ready!"

# Wait to be sure the device is ready
sleep 10

# Set the device parameters
echo "Setting the device parameters..."

# Keep the ttyACM0 device open on fd 3
exec 3<>/dev/ttyACM0
stty -F /dev/ttyACM0 9600 cs8 -cstopb -parenb
# echo "1" >&3 # send data
cat <&3 & # read the data

# Loop infinito per eseguire lo script esterno ogni 5 minuti
while true; do
    echo "Eseguo lo script esterno..."
    output=$(/home/bitrey/.bun/bin/bun /home/bitrey/Documents/Webdev_Projects/brno-ids-jmk-gtfs/src/index.ts)
    echo $output
    # send output to  >/dev/ttyACM0
    echo $output >&3

    # Attendere 3 minuti
    sleep 180
done
