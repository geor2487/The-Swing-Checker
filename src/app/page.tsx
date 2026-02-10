'use client';

import { useState, useRef, useEffect } from 'react';

export default function Home() {
  const [mode, setMode] = useState<'camera' | 'recording' | 'playback'>('camera');
  const [countdown, setCountdown] = useState(10);
  const [recordingDuration, setRecordingDuration] = useState(10);
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('user');
  const [showGuide, setShowGuide] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [playbackSpeed, setPlaybackSpeed] = useState(1);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);

  const cameraRef = useRef<HTMLVideoElement>(null);
  const playbackRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordedChunks = useRef<Blob[]>([]);
  const recordedVideoUrl = useRef<string | null>(null);
  const recordedBlob = useRef<Blob | null>(null);
  const timerRef = useRef<number | null>(null);
  const mimeTypeRef = useRef<string>('video/mp4');

  useEffect(() => {
    const seen = localStorage.getItem('guide-seen');
    if (!seen) setShowGuide(true);

    const savedDuration = localStorage.getItem('duration');
    if (savedDuration) setRecordingDuration(parseInt(savedDuration));

    initCamera();

    return () => {
      stopCamera();
      if (timerRef.current) clearInterval(timerRef.current);
      if (recordedVideoUrl.current) URL.revokeObjectURL(recordedVideoUrl.current);
    };
  }, []);

  const initCamera = async () => {
    try {
      stopCamera();
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode, width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: false
      });
      streamRef.current = stream;
      if (cameraRef.current) {
        cameraRef.current.srcObject = stream;
      }
    } catch (err) {
      alert('カメラを起動できませんでした');
      console.error(err);
    }
  };

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }
  };

  const switchCamera = async () => {
    const newMode = facingMode === 'user' ? 'environment' : 'user';
    setFacingMode(newMode);

    stopCamera();
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: newMode, width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: false
      });
      streamRef.current = stream;
      if (cameraRef.current) {
        cameraRef.current.srcObject = stream;
      }
    } catch (err) {
      console.error(err);
    }
  };

  const startRecording = () => {
    if (!streamRef.current) {
      alert('カメラが起動していません');
      return;
    }

    recordedChunks.current = [];

    // iPhoneで再生可能な形式を優先
    let options: MediaRecorderOptions = {};
    if (MediaRecorder.isTypeSupported('video/mp4')) {
      options = { mimeType: 'video/mp4' };
      mimeTypeRef.current = 'video/mp4';
    } else if (MediaRecorder.isTypeSupported('video/webm;codecs=h264')) {
      options = { mimeType: 'video/webm;codecs=h264' };
      mimeTypeRef.current = 'video/webm';
    } else if (MediaRecorder.isTypeSupported('video/webm;codecs=vp9')) {
      options = { mimeType: 'video/webm;codecs=vp9' };
      mimeTypeRef.current = 'video/webm';
    } else if (MediaRecorder.isTypeSupported('video/webm')) {
      options = { mimeType: 'video/webm' };
      mimeTypeRef.current = 'video/webm';
    }

    try {
      const mr = new MediaRecorder(streamRef.current, options);

      mr.ondataavailable = (event) => {
        if (event.data.size > 0) {
          recordedChunks.current.push(event.data);
        }
      };

      mr.onstop = () => {
        const blob = new Blob(recordedChunks.current, {
          type: options.mimeType || 'video/mp4'
        });

        if (recordedVideoUrl.current) {
          URL.revokeObjectURL(recordedVideoUrl.current);
        }
        recordedVideoUrl.current = URL.createObjectURL(blob);
        recordedBlob.current = blob;

        setMode('playback');

        setTimeout(() => {
          if (playbackRef.current && recordedVideoUrl.current) {
            playbackRef.current.src = recordedVideoUrl.current;
            playbackRef.current.load();
          }
        }, 100);
      };

      mediaRecorderRef.current = mr;
      mr.start(100);
      setMode('recording');
      setCountdown(recordingDuration);

      timerRef.current = window.setInterval(() => {
        setCountdown(prev => {
          if (prev <= 1) {
            stopRecording();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);

    } catch (err) {
      console.error('録画エラー:', err);
      alert('録画を開始できませんでした');
    }
  };

  const stopRecording = () => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
  };

  const retake = async () => {
    setMode('camera');
    setCurrentTime(0);
    setDuration(0);
    setIsPlaying(false);
    setPlaybackSpeed(1);
    await initCamera();
  };

  const saveVideo = async () => {
    if (!recordedBlob.current) return;

    // iPhoneで再生しやすい拡張子を使用
    const extension = mimeTypeRef.current.includes('mp4') ? 'mp4' : 'mov';
    const fileName = `swing-${Date.now()}.${extension}`;

    // Web Share APIを試す（モバイル向け）
    if (navigator.share && navigator.canShare) {
      try {
        const file = new File([recordedBlob.current], fileName, { type: recordedBlob.current.type });
        if (navigator.canShare({ files: [file] })) {
          await navigator.share({
            files: [file],
            title: 'スイング動画',
          });
          return;
        }
      } catch (error) {
        if ((error as Error).name === 'AbortError') return;
      }
    }

    // フォールバック: ダウンロード
    const a = document.createElement('a');
    a.href = recordedVideoUrl.current!;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const closeGuide = () => {
    localStorage.setItem('guide-seen', 'true');
    setShowGuide(false);
  };

  const saveDuration = (sec: number) => {
    setRecordingDuration(sec);
    localStorage.setItem('duration', sec.toString());
  };

  const formatTime = (t: number) => `${Math.floor(t)}.${Math.floor((t % 1) * 10)}`;

  return (
    <div className="min-h-screen bg-black text-white flex flex-col">
      {/* ガイド */}
      {showGuide && (
        <div className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center p-4">
          <div className="bg-zinc-900 rounded-2xl p-6 max-w-sm w-full">
            <h2 className="text-xl font-bold mb-4 text-center">使い方</h2>
            <div className="space-y-3 mb-6 text-sm">
              <div className="flex gap-3 items-start">
                <span className="w-6 h-6 bg-emerald-500 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0">1</span>
                <span>画面をタップして録画開始（{recordingDuration}秒）</span>
              </div>
              <div className="flex gap-3 items-start">
                <span className="w-6 h-6 bg-emerald-500 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0">2</span>
                <span>スロー再生・コマ送りで確認</span>
              </div>
              <div className="flex gap-3 items-start">
                <span className="w-6 h-6 bg-emerald-500 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0">3</span>
                <span>保存ボタンでダウンロード</span>
              </div>
            </div>
            <button onClick={closeGuide} className="w-full bg-emerald-500 py-3 rounded-xl font-bold">
              はじめる
            </button>
          </div>
        </div>
      )}

      {/* 設定 */}
      {showSettings && (
        <div className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center p-4">
          <div className="bg-zinc-900 rounded-2xl p-6 max-w-sm w-full">
            <h2 className="text-xl font-bold mb-4 text-center">設定</h2>
            <p className="text-sm text-zinc-400 mb-2">録画時間</p>
            <div className="flex flex-wrap gap-2 mb-4">
              {[5, 10, 15, 20, 30].map(sec => (
                <button
                  key={sec}
                  onClick={() => saveDuration(sec)}
                  className={`px-4 py-2 rounded-full ${recordingDuration === sec ? 'bg-emerald-500' : 'bg-zinc-800'}`}
                >
                  {sec}秒
                </button>
              ))}
            </div>
            <button onClick={() => setShowSettings(false)} className="w-full bg-zinc-800 py-3 rounded-xl">
              閉じる
            </button>
          </div>
        </div>
      )}

      {/* ヘッダー */}
      <header className="flex justify-between items-center p-4 bg-zinc-900">
        <h1 className="font-bold text-lg">The Swing Checker</h1>
        <div className="flex gap-1">
          <button onClick={() => setShowSettings(true)} className="p-2 hover:bg-zinc-800 rounded-lg">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          </button>
          <button onClick={() => setShowGuide(true)} className="p-2 hover:bg-zinc-800 rounded-lg">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </button>
        </div>
      </header>

      {/* ビデオエリア */}
      <div className="flex-1 relative bg-black">
        {(mode === 'camera' || mode === 'recording') && (
          <video
            ref={cameraRef}
            autoPlay
            playsInline
            muted
            onClick={mode === 'camera' ? startRecording : undefined}
            className={`w-full h-full object-cover ${facingMode === 'user' ? 'scale-x-[-1]' : ''} ${mode === 'camera' ? 'cursor-pointer' : ''}`}
          />
        )}

        {mode === 'playback' && (
          <video
            ref={playbackRef}
            playsInline
            className={`w-full h-full object-cover ${facingMode === 'user' ? 'scale-x-[-1]' : ''}`}
            onLoadedMetadata={(e) => setDuration(e.currentTarget.duration)}
            onTimeUpdate={(e) => setCurrentTime(e.currentTarget.currentTime)}
            onPlay={() => setIsPlaying(true)}
            onPause={() => setIsPlaying(false)}
            onEnded={() => {
              setIsPlaying(false);
              if (playbackRef.current) playbackRef.current.currentTime = 0;
            }}
          />
        )}

        {mode === 'recording' && (
          <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-red-500 px-4 py-2 rounded-full animate-pulse flex items-center gap-2">
            <span className="w-3 h-3 bg-white rounded-full"></span>
            <span className="font-bold">{countdown}秒</span>
          </div>
        )}

        {mode === 'camera' && (
          <>
            <button
              onClick={switchCamera}
              className="absolute top-4 right-4 bg-black/50 p-3 rounded-full backdrop-blur-sm"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
            </button>
            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-black/50 px-4 py-2 rounded-full text-sm backdrop-blur-sm text-center">
              <div className="text-white font-medium">タップして録画</div>
              <div className="text-zinc-400 text-xs">{recordingDuration}秒</div>
            </div>
          </>
        )}
      </div>

      {/* コントロール */}
      <div className="bg-zinc-900 p-4">
        {mode === 'camera' && (
          <div className="flex justify-center">
            <div className="text-zinc-400 text-sm">
              画面をタップして録画開始
            </div>
          </div>
        )}

        {mode === 'recording' && (
          <div className="flex justify-center">
            <button
              onClick={stopRecording}
              className="w-20 h-20 bg-zinc-700 rounded-full flex items-center justify-center"
            >
              <div className="w-8 h-8 bg-red-500 rounded"></div>
            </button>
          </div>
        )}

        {mode === 'playback' && (
          <div className="space-y-4">
            <div>
              <input
                type="range"
                min={0}
                max={duration || 1}
                step={0.01}
                value={currentTime}
                onChange={(e) => {
                  const t = parseFloat(e.target.value);
                  setCurrentTime(t);
                  if (playbackRef.current) playbackRef.current.currentTime = t;
                }}
                className="w-full h-2 bg-zinc-700 rounded-full appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:bg-emerald-500 [&::-webkit-slider-thumb]:rounded-full"
              />
              <div className="flex justify-between text-xs text-zinc-400 mt-1">
                <span>{formatTime(currentTime)}</span>
                <span>{formatTime(duration)}</span>
              </div>
            </div>

            <div className="flex justify-center items-center gap-4">
              <button
                onClick={() => {
                  if (playbackRef.current) {
                    playbackRef.current.pause();
                    playbackRef.current.currentTime = Math.max(0, playbackRef.current.currentTime - 1/30);
                  }
                }}
                className="p-3 bg-zinc-800 rounded-full hover:bg-zinc-700"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12.066 11.2a1 1 0 000 1.6l5.334 4A1 1 0 0019 16V8a1 1 0 00-1.6-.8l-5.333 4zM4.066 11.2a1 1 0 000 1.6l5.334 4A1 1 0 0011 16V8a1 1 0 00-1.6-.8l-5.334 4z" />
                </svg>
              </button>

              <button
                onClick={() => {
                  if (playbackRef.current) {
                    if (playbackRef.current.paused) {
                      playbackRef.current.play();
                    } else {
                      playbackRef.current.pause();
                    }
                  }
                }}
                className="p-4 bg-emerald-500 rounded-full shadow-lg shadow-emerald-500/30 hover:bg-emerald-400"
              >
                {isPlaying ? (
                  <svg className="w-8 h-8" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M6 4h4v16H6V4zm8 0h4v16h-4V4z" />
                  </svg>
                ) : (
                  <svg className="w-8 h-8" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M8 5v14l11-7z" />
                  </svg>
                )}
              </button>

              <button
                onClick={() => {
                  if (playbackRef.current) {
                    playbackRef.current.pause();
                    playbackRef.current.currentTime = Math.min(duration, playbackRef.current.currentTime + 1/30);
                  }
                }}
                className="p-3 bg-zinc-800 rounded-full hover:bg-zinc-700"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.933 12.8a1 1 0 000-1.6L6.6 7.2A1 1 0 005 8v8a1 1 0 001.6.8l5.333-4zM19.933 12.8a1 1 0 000-1.6l-5.333-4A1 1 0 0013 8v8a1 1 0 001.6.8l5.333-4z" />
                </svg>
              </button>
            </div>

            <div className="flex justify-center gap-2">
              {[0.25, 0.5, 1].map(speed => (
                <button
                  key={speed}
                  onClick={() => {
                    setPlaybackSpeed(speed);
                    if (playbackRef.current) playbackRef.current.playbackRate = speed;
                  }}
                  className={`px-4 py-2 rounded-full font-medium ${playbackSpeed === speed ? 'bg-emerald-500' : 'bg-zinc-800 hover:bg-zinc-700'}`}
                >
                  {speed === 1 ? '通常' : `${speed}x`}
                </button>
              ))}
            </div>

            <div className="flex gap-3">
              <button
                onClick={retake}
                className="flex-1 bg-zinc-800 py-3 rounded-xl font-medium hover:bg-zinc-700 flex items-center justify-center gap-2"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                撮り直す
              </button>
              <button
                onClick={saveVideo}
                className="flex-1 bg-emerald-500 py-3 rounded-xl font-medium hover:bg-emerald-400 flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/25"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                </svg>
                保存
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
