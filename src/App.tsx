import clsx from "clsx";
import React from "react"
import toast from "react-hot-toast";
// @ts-expect-error: No types
import ml5 from "ml5";

import { Button } from "./ui/Button";
import { wait } from "./utils/waiter";



const _detector = ml5.objectDetector("cocossd");

function App() {
  const videoRef = React.useRef<HTMLVideoElement>(null);
  const canvasRef = React.useRef<HTMLCanvasElement>(null);
  const inputRef = React.useRef<HTMLInputElement>(null);

  const [isStreaming, setIsStreaming] = React.useState(false);
  const [isMLStatus, setIsMLStatus] = React.useState<"loading" | "ready" | "error">("loading");
  const isStreamingRef = React.useRef(false);


  const handleCanvas = async () => {
    const video = videoRef.current;
    const canvas = canvasRef.current;

    if (!video) return toast.error("Error getting videoRef");
    if (!canvas) return toast.error("Error getting canvasRef");

    canvas.width = canvas.clientWidth;
    canvas.height = canvas.clientHeight;

    const ctx = canvas.getContext("2d");
    if (!ctx) return toast.error("Error getting canvas ctx");

    ctx.lineWidth = 3;
    ctx.strokeStyle = "lime";
    ctx.font = "16px Arial";
    ctx.fillStyle = "lime";

    const detector = await _detector;

    const interval = setInterval(() => parseVideo(), 100);

    function parseVideo() {
      if (!isStreamingRef.current) return clearInterval(interval);

      detector.detect(video, (error: unknown, result: IML5Result[]) => {
        if (error) return console.warn(error);
        if (!result) return;

        ctx!.clearRect(0, 0, canvas!.width, canvas!.height);

        if (Array.isArray(result)) {
          result.forEach(r => {
            const { x, y, width, height, label, confidence } = r;
            ctx!.strokeRect(x, y, width, height);
            ctx!.fillText(`${label} (${Math.round(confidence * 100)}%)`, x, y - 5);
          });
        }
      });
    }
  }

  const onTriggerWebcamClick = async () => {
    if (!videoRef.current) return toast.error("Error getting videoRef");
    if (!navigator.mediaDevices?.getUserMedia) return toast.error("Webcam not supported in this browser");

    try {
      const stream = await window.navigator.mediaDevices.getUserMedia({ video: true, audio: false });
      videoRef.current.srcObject = stream;
      videoRef.current.play();
      setIsStreaming(true);
      isStreamingRef.current = true;
      wait(200).then(() => handleCanvas())
    } catch (error) {
      toast.error("Error getting user webcam");
      console.log(error)
    }
  }

  const onStopWebcamClick = () => {
    const video = videoRef.current;
    if (!video) return toast.error("Error getting videoRef");

    const stream = video.srcObject as MediaStream | null;
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
      video.srcObject = null;
      setIsStreaming(false);
      isStreamingRef.current = false;
    } else {
      video.pause();
      video.src = "";
      setIsStreaming(false);
      isStreamingRef.current = false;
    }
  };

  const onUploadVideo: React.ChangeEventHandler<HTMLInputElement> = (e) => {
    const file = e.target.files?.item(0);
    if (!file) return;

    const video = videoRef.current;
    if (!video) return toast.error("Error getting videoRef");

    const videoURL = URL.createObjectURL(file);
    video.src = videoURL;
    video.play();

    setIsStreaming(true);
    isStreamingRef.current = true;
    wait(200).then(() => handleCanvas());
  }

  React.useEffect(() => {
    _detector
      .then(() => setIsMLStatus("ready"))
      .catch(() => setIsMLStatus("error"))
  }, [])

  return (
    <div className="max-w-xl w-full mx-auto min-h-svh p-5">
      <div className="flex flex-col gap-5">
        <h1 className="text-2xl font-bold text-center">Object detection</h1>

        <div className="w-full relative">
          <video
            muted
            loop
            ref={videoRef}
            className={clsx("w-full", (isStreaming ? 'h-auto' : 'h-0'))}
          />

          <canvas
            ref={canvasRef}
            className="absolute top-0 left-0 right-0 bottom-0 z-10 w-full h-full"
          />
        </div>

        {isMLStatus === "ready" &&
          <div className="flex justify-center gap-2">
            {!isStreaming && <Button variant="blue" onClick={onTriggerWebcamClick}>Open webcam</Button>}
            {!isStreaming && <Button variant="blue" onClick={() => inputRef.current?.click()}>Upload video</Button>}

            {isStreaming && <Button variant="red" onClick={onStopWebcamClick}>Stop</Button>}

            <input type="file" ref={inputRef} className="hidden" onChange={onUploadVideo} />
          </div>
        }

        <div className="text-center">
          ML status: <span className="uppercase">{isMLStatus}</span>
        </div>
      </div>
    </div>
  )
}

export default App
