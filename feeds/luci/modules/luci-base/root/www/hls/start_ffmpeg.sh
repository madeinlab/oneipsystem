#!/bin/bash

CHANNEL=$1
STREAM_URL=$2
echo "start_ffmpeg.sh CHANNEL[$CHANNEL] STREAM_URL[$STREAM_URL]"

LOCK_FILE="/tmp/lock/ffmpeg_$CHANNEL.lock"
STREAM_DIR="/www/hls/stream/$CHANNEL/"
INDEX_FILE="$STREAM_DIR/index.m3u8"
FFMPEG_PID=""

stop_ffmpeg() {
    if [ -n "$FFMPEG_PID" ]; then
        echo "Stopping FFmpeg process with PID: $FFMPEG_PID"
        kill -9 $FFMPEG_PID
    fi
    rm -f "$STREAM_DIR"*  # Clean up stream files
}

start_ffmpeg() {
    echo "Starting FFmpeg with URL: $STREAM_URL"

    # Create directory if not exists
    if [ ! -d "$STREAM_DIR" ]; then
        mkdir -p "$STREAM_DIR"
    fi

    # Delete existing stream files
    rm -f "$STREAM_DIR"*

    #ffmpeg -fflags nobuffer -rtsp_transport tcp -i "$STREAM_URL" \
    #    -loglevel error -vsync 0 -copyts -vcodec copy -movflags frag_keyframe+empty_moov \
    #    -an -f hls \
    #    -hls_time 2 -hls_list_size 5 \
    #    -use_wallclock_as_timestamps 1 \
    #    -hls_segment_type mpegts \
    #    -hls_segment_filename "$STREAM_DIR%d.ts" \
    #    -hls_flags delete_segments+split_by_time \
    #    "$INDEX_FILE" &

	ffmpeg -fflags +genpts -rtsp_transport tcp -i "$STREAM_URL" \
		-loglevel error -vsync 1 -vcodec copy -movflags frag_keyframe+empty_moov -an \
		-f hls -hls_time 3 -hls_list_size 10 -use_wallclock_as_timestamps 1 \
		-hls_segment_type mpegts -hls_segment_filename "$STREAM_DIR%d.ts" \
		-hls_flags delete_segments "$INDEX_FILE" &

    FFMPEG_PID=$!  # Save the PID of the FFmpeg process
    echo "FFmpeg started with PID: $FFMPEG_PID"
}

check_target_duration() {
    #TARGET_DURATION=$(grep -m 1 "#EXT-X-TARGETDURATION:" "$INDEX_FILE" | cut -d: -f2 | tr -d '[:space:]')
    TARGET_DURATION=$(grep "#EXT-X-TARGETDURATION:" "$INDEX_FILE" | cut -d: -f2 | tr -d '[:space:]' | head -n 1)
    echo "TARGET_DURATION: $TARGET_DURATION"

    #if ! [[ "$TARGET_DURATION" =~ ^[0-9]+$ ]]; then
    #    echo "TARGET_DURATION is not a valid number or is empty. FFmpeg will be restarted."
    #    return 1
    #fi

    #if [ "$TARGET_DURATION" -eq 0 ] || [ "$TARGET_DURATION" -gt 10 ]; then
    if [ "$TARGET_DURATION" -eq 0 ]; then
        echo "TARGETDURATION is wrong.[$TARGET_DURATION] FFmpeg will be restarted."
        return 1
    else
        return 0
    fi
}

# Check if LOCK_FILE exists
if [ -f "$LOCK_FILE" ]; then
    echo "FFmpeg already running with PID: $FFMPEG_PID"
    exit 1
else
    touch "$LOCK_FILE"
    # Stop existing FFmpeg process if running, then start a new one
    stop_ffmpeg
    start_ffmpeg
fi

# Monitoring requests every 30 seconds based on Nginx logs
MONITORING_COUNT=0
while true; do
    sleep 5
    MONITORING_COUNT=$((MONITORING_COUNT + 5))

    if [ "$MONITORING_COUNT" -eq 30 ]; then
        MONITORING_COUNT=0
        # Extract the last request time from Nginx logs
        PORT=$((CHANNEL * 1000 + 50554))
        LAST_REQUEST_TIME=$(tail -n 100 /var/log/nginx/access.log | grep "https://192.168.1.100:$PORT/hls/" | tail -n 1 | awk '{print $4}' | sed 's/\[//')
        echo "[$$] PORT[$PORT] LAST_REQUEST_TIME[$LAST_REQUEST_TIME]"

        # Calculate the time difference from the current time
        if [ -n "$LAST_REQUEST_TIME" ]; then
            FORMATTED_DATE=$(echo "$LAST_REQUEST_TIME" | sed 's/\//-/g' | sed 's/:/ /' | awk '{split($1, d, "-"); month=d[2]; day=d[1]; year=d[3]; gsub(/Jan/, "1", month); gsub(/Feb/, "2", month); gsub(/Mar/, "3", month); gsub(/Apr/, "4", month); gsub(/May/, "5", month); gsub(/Jun/, "6", month); gsub(/Jul/, "7", month); gsub(/Aug/, "8", month); gsub(/Sep/, "9", month); gsub(/Oct/, "10", month); gsub(/Nov/, "11", month); gsub(/Dec/, "12", month); printf("%s-%s-%s %s", year, month, day, $2)}')
            #echo "[$$] FORMATTED_DATE: $FORMATTED_DATE"
            LAST_REQUEST_TIMESTAMP=$(date -d "$FORMATTED_DATE" +%s)
            #echo "[$$] LAST_REQUEST_TIMESTAMP: $LAST_REQUEST_TIMESTAMP"
            CURRENT_TIMESTAMP="$(date +%s)"
            #echo "[$$] CURRENT_TIMESTAMP: $CURRENT_TIMESTAMP"
            TIME_DIFF="$((CURRENT_TIMESTAMP - LAST_REQUEST_TIMESTAMP))"
            #echo "[$$] TIME_DIFF $TIME_DIFF"

            if [ "$TIME_DIFF" -le 30 ]; then
                echo "New request found within the last 30 seconds, keeping FFmpeg running. [$FFMPEG_PID]"
            else
                echo "No new requests within the last 30 seconds, stopping FFmpeg. [$FFMPEG_PID]"
                stop_ffmpeg
                break
            fi
        else
            echo "No /hls/ requests found in the logs, stopping FFmpeg. [$FFMPEG_PID]"
            stop_ffmpeg
            break
        fi
    else
        # Monitoring FFmpeg process and index file
        FFMPEG_PID=$(ps aux | awk -v url="$STREAM_URL" '/ffmpeg/ && $0 ~ url && !/bash/ && !/pgrep/ && !/sh -c/ {print $2}')
        if [ ! -f "$LOCK_FILE" ]; then
            echo "Monitoring FFmpeg... LOCK_FILE is NOT exist. Stop FFmpeg and terminate start_ffmpeg.sh"
            stop_ffmpeg
            break
        fi

        if [ -z "$FFMPEG_PID" ] || ! check_target_duration; then
            echo "Monitoring FFmpeg... FFmpeg is not correct. Restart FFmpeg."
            stop_ffmpeg
            start_ffmpeg
        fi
    fi
done

rm -f "$LOCK_FILE"

exit 0
