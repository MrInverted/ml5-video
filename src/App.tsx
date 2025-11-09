import clsx from "clsx";
import React from "react"
import toast from "react-hot-toast";
import { AutoModel, AutoProcessor, RawImage } from '@huggingface/transformers';

import { Button } from "./ui/Button";
import { wait } from "./utils/waiter";



const _model = AutoModel.from_pretrained('Xenova/gelan-c_all')
const _processor = AutoProcessor.from_pretrained('Xenova/gelan-c_all');

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
    const fpsRef = document.getElementById("fps");

    if (!video) return toast.error("Error getting videoRef");
    if (!canvas) return toast.error("Error getting canvasRef");
    if (!fpsRef) return toast.error("Error getting fpsEl");

    canvas.width = canvas.clientWidth;
    canvas.height = canvas.clientHeight;

    const ctx = canvas.getContext("2d");
    if (!ctx) return toast.error("Error getting canvas ctx");

    ctx.lineWidth = 3;
    ctx.strokeStyle = "lime";
    ctx.font = "16px Arial";
    ctx.fillStyle = "lime";

    const model = await _model;
    const processor = await _processor;

    // @ts-expect-error: size exist
    if (processor.feature_extractor?.size) processor.feature_extractor.size = { shortest_edge: 126 };

    parseVideo();

    async function parseVideo() {
      if (!isStreamingRef.current) return;

      const start = performance.now();

      // 1️⃣ Рисуем текущий кадр с камеры на canvas
      ctx!.drawImage(video!, 0, 0, canvas!.width, canvas!.height);

      // 2️⃣ Читаем изображение из canvas
      const image = await RawImage.read(canvas!);

      // 3️⃣ Обрабатываем изображение процессором (resize + нормализация)
      const inputs = await processor(image);

      // 4️⃣ Достаём размеры, с которыми реально работала модель
      // reshaped_input_sizes → [ [height, width] ]
      const [modelHeight, modelWidth] = inputs.reshaped_input_sizes[0];

      // 5️⃣ Настоящие размеры видео (canvas)
      const videoWidth = canvas!.width;
      const videoHeight = canvas!.height;

      // 6️⃣ Вычисляем, как модель вписала изображение, чтобы сохранить пропорции
      const scale = Math.min(modelWidth / videoWidth, modelHeight / videoHeight);

      // Размер области, которую реально "занимает" изображение в модели
      const scaledWidth = videoWidth * scale;
      const scaledHeight = videoHeight * scale;

      // Паддинг по бокам / сверху и снизу
      const padX = (modelWidth - scaledWidth) / 2;
      const padY = (modelHeight - scaledHeight) / 2;

      // 7️⃣ Запускаем модель
      const threshold = 0.3;
      const { outputs } = await model(inputs);
      const predictions = outputs.tolist();

      // 8️⃣ Очищаем холст перед отрисовкой рамок
      // ctx!.clearRect(0, 0, canvas!.width, canvas!.height);
      // ctx!.drawImage(video!, 0, 0, canvas!.width, canvas!.height);

      // 9️⃣ Преобразуем координаты модели в координаты канваса
      for (const [xmin, ymin, xmax, ymax, score, id] of predictions) {
        if (score < threshold) break;

        // @ts-expect-error: label
        const label = model.config?.id2label?.[id];
        const confidence = Math.round(score * 100);

        // Убираем паддинг и масштабируем к размерам canvas
        const x0 = ((xmin - padX) / scaledWidth) * videoWidth;
        const y0 = ((ymin - padY) / scaledHeight) * videoHeight;
        const x1 = ((xmax - padX) / scaledWidth) * videoWidth;
        const y1 = ((ymax - padY) / scaledHeight) * videoHeight;

        const w = x1 - x0;
        const h = y1 - y0;

        ctx!.strokeRect(x0, y0, w, h);
        ctx!.fillText(`${label} (${confidence}%)`, x0, Math.max(10, y0 - 5));
      }

      // 🔟 FPS расчёт
      const end = performance.now();
      const frameTime = (end - start) / 1000;
      const fps = 1 / frameTime;
      console.log(`Frame: ${frameTime.toFixed(3)}s, FPS: ${fps.toFixed(1)}`);
      fpsRef!.textContent = "FPS: " + fps.toFixed(1);

      // 🔁 Следующий кадр
      requestAnimationFrame(parseVideo);
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
      wait(10).then(() => handleCanvas());
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
    Promise.all([_model, _processor])
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
          <div className="flex justify-center items-center gap-2">
            {!isStreaming && <Button variant="blue" onClick={onTriggerWebcamClick}>Open webcam</Button>}
            {!isStreaming && <Button variant="blue" onClick={() => inputRef.current?.click()}>Upload video</Button>}

            {isStreaming && <Button variant="red" onClick={onStopWebcamClick}>Stop</Button>}
            {isStreaming && <span id="fps"></span>}

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
