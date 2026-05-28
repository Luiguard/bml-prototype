import av

def extract_video(path):
    container = av.open(path)
    video_stream = next((s for s in container.streams if s.type == 'video'), None)
    if not video_stream:
        return
    
    print(f"Codec: {video_stream.codec_context.name}")
    print(f"Profile: {video_stream.codec_context.profile}")
    print(f"Width: {video_stream.codec_context.width}")
    print(f"Height: {video_stream.codec_context.height}")
    
    # We need the WebCodecs codec string (e.g. 'avc1.42E01E')
    # PyAV codec context might have extradata?
    extradata = video_stream.codec_context.extradata
    print(f"Extradata: {extradata.hex() if extradata else 'None'}")
    
    count = 0
    for packet in container.demux(video_stream):
        is_keyframe = packet.is_keyframe
        pts = packet.pts
        time_base = packet.time_base
        pts_micros = int(pts * time_base * 1000000) if pts is not None else 0
        dur_micros = int(packet.duration * time_base * 1000000) if packet.duration is not None else 0
        print(f"Chunk {count}: {len(bytes(packet))} bytes, keyframe={is_keyframe}, pts={pts_micros}, dur={dur_micros}")
        count += 1
        if count > 5:
            break

if __name__ == '__main__':
    extract_video('dummy.mp4')
