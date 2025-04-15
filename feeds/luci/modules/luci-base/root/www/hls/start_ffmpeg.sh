#!/bin/bash

CHANNEL=$1
STREAM_URL=$2
# logger -t start_ffmpeg "start_ffmpeg.sh CHANNEL[$CHANNEL] STREAM_URL[$STREAM_URL]"

FFMPEG_LOCK="/tmp/lock/ffmpeg_$CHANNEL.lock"
HLS_LOCK="/tmp/lock/hls_${CHANNEL}.lock"
STREAM_DIR="/www/hls/stream/$CHANNEL/"
INDEX_FILE="$STREAM_DIR/index.m3u8"
FFMPEG_PID=""

stop_ffmpeg() {
    if [ -n "$FFMPEG_PID" ]; then
        # logger -t start_ffmpeg "Stopping FFmpeg process with PID: $FFMPEG_PID"
        kill -9 $FFMPEG_PID
    fi
    rm -f "$STREAM_DIR"*  # Clean up stream files
}

start_ffmpeg() {
    # logger -t start_ffmpeg "Starting FFmpeg with URL: $STREAM_URL"

    # Create directory if not exists
    if [ ! -d "$STREAM_DIR" ]; then
        mkdir -p "$STREAM_DIR"
    fi

    # Delete existing stream files
    rm -f "$STREAM_DIR"*

	ffmpeg -fflags +genpts -rtsp_transport tcp -i "$STREAM_URL" \
		-loglevel error -vsync 1 -vcodec copy -movflags frag_keyframe+empty_moov -an \
		-f hls -hls_time 3 -hls_list_size 10 -use_wallclock_as_timestamps 1 \
		-hls_segment_type mpegts -hls_segment_filename "$STREAM_DIR%d.ts" \
		-hls_flags delete_segments "$INDEX_FILE" &

    FFMPEG_PID=$!  # Save the PID of the FFmpeg process
    # logger -t start_ffmpeg "FFmpeg started with PID: $FFMPEG_PID"
}

check_target_duration() {
    TARGET_DURATION=$(grep "#EXT-X-TARGETDURATION:" "$INDEX_FILE" | cut -d: -f2 | tr -d '[:space:]' | head -n 1)
    #logger -t start_ffmpeg "TARGET_DURATION: $TARGET_DURATION"

    if [ "$TARGET_DURATION" -eq 0 ]; then
        # logger -t start_ffmpeg "TARGETDURATION is wrong.[$TARGET_DURATION] FFmpeg will be restarted."
        return 1
    else
        return 0
    fi
}

# Check if FFMPEG_LOCK exists
if [ -f "$FFMPEG_LOCK" ]; then
    # logger -t start_ffmpeg "FFmpeg already running with PID: $FFMPEG_PID"
    exit 1
else
    touch "$FFMPEG_LOCK"
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
        if [ -f "$HLS_LOCK" ]; then
            LAST_REQUEST_TIME=$(date -r "$HLS_LOCK" +%s)
            #logger -t start_ffmpeg "LAST_REQUEST_TIME[$LAST_REQUEST_TIME]"
            if [ -n "$LAST_REQUEST_TIME" ]; then
                CURRENT_TIMESTAMP=$(date +%s)
                #logger -t start_ffmpeg "CURRENT_TIMESTAMP[$CURRENT_TIMESTAMP]"
                TIME_DIFF=$((CURRENT_TIMESTAMP - LAST_REQUEST_TIME))
                #logger -t start_ffmpeg "TIME_DIFF[$TIME_DIFF]"

                if [ "$TIME_DIFF" -le 30 ]; then
                	:
                    # logger -t start_ffmpeg "New request found within the last 30 seconds, keeping FFmpeg running. [$FFMPEG_PID]"
                else
                    # logger -t start_ffmpeg "No new requests within the last 30 seconds, stopping FFmpeg. [$FFMPEG_PID]"
                    stop_ffmpeg
                    break
                fi
            else
                # logger -t start_ffmpeg "No /hls/ requests found in the logs, stopping FFmpeg. [$FFMPEG_PID]"
                stop_ffmpeg
                break
            fi
        else
            # logger -t start_ffmpeg "No HLS lock file found, stopping FFmpeg. [$FFMPEG_PID]"
            stop_ffmpeg
            break
        fi
    else
        # Monitoring FFmpeg process and index file
        FFMPEG_PID=$(ps aux | awk -v url="$STREAM_URL" '/ffmpeg/ && $0 ~ url && !/bash/ && !/pgrep/ && !/sh -c/ {print $2}')
        if [ ! -f "$FFMPEG_LOCK" ]; then
            # logger -t start_ffmpeg "Monitoring FFmpeg... FFMPEG_LOCK is NOT exist. Stop FFmpeg and terminate start_ffmpeg.sh"
            stop_ffmpeg
            break
        fi

        if [ -z "$FFMPEG_PID" ] || ! check_target_duration; then
            # logger -t start_ffmpeg "Monitoring FFmpeg... FFmpeg is not correct. Restart FFmpeg."
            stop_ffmpeg
            start_ffmpeg
        fi
    fi
done

rm -f "$FFMPEG_LOCK"
rm -f "$HLS_LOCK"

exit 0

