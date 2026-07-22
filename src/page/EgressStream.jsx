import { useEffect, useMemo, useState } from 'react';
import {
  LiveKitRoom,
  RoomAudioRenderer,
  VideoTrack,
  useRoomContext,
  useTracks,
} from '@livekit/components-react';
import { Track } from 'livekit-client';
import EgressHelper from '@livekit/egress-sdk';
import './EgressStream.scss';

/**
 * What LiveKit's egress records for a standalone stream.
 *
 * This page is opened by the egress worker — a headless Chrome — NOT by a
 * person. It gets the room URL and a recorder token as query params, connects,
 * and renders the broadcaster's program track edge to edge with no chrome at
 * all: no chat, no rail, no badges. The studio already composites everything
 * the audience should see (scenes, guest split, name tags, boosts) into that
 * one track, so "record what the audience sees" really is just "show that track
 * full-bleed".
 *
 * Recording server-side is the whole point: the host's phone can lock, be
 * backgrounded, or have its page discarded entirely, and this keeps rolling —
 * which also keeps the VOD's timeline aligned with the chat comments, since
 * those are timecoded from the stream's go-live moment.
 *
 * Deliberately NOT the watch page: that does its own auth handover, joins as a
 * guest, renders overlays and would need every one of them suppressed. This
 * uses the token egress hands us and nothing else.
 */

/** Fills the frame in either orientation — see the note on object-fit below. */
function ProgramTrack() {
  const tracks = useTracks([Track.Source.Camera], { onlySubscribed: false });
  const room = useRoomContext();

  // The broadcaster is the only remote publisher; the OBS ingress joins under
  // its own identity and must never be picked as the program.
  const program = useMemo(
    () => tracks.find((t) => !t.participant.isLocal && !t.participant.identity.startsWith('obs-')) ?? null,
    [tracks],
  );

  // Tell the egress worker when there is actually something to record. Without
  // this it waits forever for a "ready" signal and produces nothing.
  const [started, setStarted] = useState(false);
  useEffect(() => {
    if (!room) return;
    EgressHelper.setRoom(room);
  }, [room]);
  useEffect(() => {
    if (started || !program) return;
    setStarted(true);
    EgressHelper.startRecording();
  }, [program, started]);

  if (!program) {
    // Blank rather than a placeholder: this frame ends up in the VOD.
    return <div className="egress-stream__idle" />;
  }
  return <VideoTrack trackRef={program} className="egress-stream__video" />;
}

export default function EgressStream() {
  // Egress passes these; EgressHelper reads them from the URL for us.
  const url = EgressHelper.getLiveKitURL();
  const token = EgressHelper.getAccessToken();

  if (!url || !token) {
    return <div className="egress-stream egress-stream__idle" />;
  }

  return (
    <div className="egress-stream">
      <LiveKitRoom
        serverUrl={url}
        token={token}
        connect
        audio={false}
        video={false}
        // adaptiveStream would throttle the track based on whether its element
        // looks "visible" to a headless browser — exactly the trap that starves
        // the studio's OBS source. A recorder must always get full quality.
        options={{ adaptiveStream: false, dynacast: false }}
        onDisconnected={() => EgressHelper.endRecording()}
      >
        <RoomAudioRenderer />
        <ProgramTrack />
      </LiveKitRoom>
    </div>
  );
}
