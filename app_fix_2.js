import {
    PoseLandmarker,
    FilesetResolver,
    DrawingUtils
}
from "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14";

// ポーズのコネクション情報を定義
const POSE_CONNECTIONS = [
    [0, 1], [1, 2], [2, 3], [3, 7],
    [0, 4], [4, 5], [5, 6], [6, 8],
    [9, 10],
    [11, 12],
    [11, 13], [13, 15], [15, 17], [17, 19], [19, 15], [15, 21],
    [12, 14], [14, 16], [16, 18], [18, 20], [20, 16], [16, 22],
    [11, 23], [23, 24], [24, 12]
];

const video =
document.getElementById("video");

const canvas =
document.getElementById("canvas");

const ctx =
canvas.getContext("2d");

const cameraBtn =
document.getElementById("cameraBtn");

const videoFile =
document.getElementById("videoFile");

const downloadBtn =
document.getElementById("downloadBtn");

let poseLandmarker;
let drawingUtils;

let csvData = [];

let poseReady = false;

let animationId = null;

//////////////////////////////////////////////////////
// MediaPipe初期化
//////////////////////////////////////////////////////

async function initPose(){

    const vision =
    await FilesetResolver.forVisionTasks(
        "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm"
    );

    poseLandmarker =
    await PoseLandmarker.createFromOptions(
        vision,
        {
            baseOptions:{
                modelAssetPath:
                "https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_full/float16/latest/pose_landmarker_full.task"
            },
            runningMode:"VIDEO",
            numPoses:1
        }
    );

    drawingUtils =
    new DrawingUtils(ctx);

    poseReady = true;

    console.log("Pose Ready");
}

//////////////////////////////////////////////////////
// CSV
//////////////////////////////////////////////////////

function saveLandmarks(landmarks){

    const row = {
        timestamp: performance.now()
    };

    landmarks.forEach((p,i)=>{

        row[`x${i}`] = p.x;
        row[`y${i}`] = p.y;
        row[`z${i}`] = p.z;

    });

    row.headY = landmarks[0].y;

    row.shoulderCenterY =
    (
        landmarks[11].y +
        landmarks[12].y
    ) / 2;

    row.hipCenterY =
    (
        landmarks[23].y +
        landmarks[24].y
    ) / 2;

    csvData.push(row);
}

//////////////////////////////////////////////////////
// 描画
//////////////////////////////////////////////////////

function drawResults(result){

    ctx.clearRect(
        0,
        0,
        canvas.width,
        canvas.height
    );

    ctx.drawImage(
        video,
        0,
        0,
        canvas.width,
        canvas.height
    );

    if(!result.landmarks.length){
        return;
    }

    for(const landmarks of result.landmarks){

        // ランドマーク間を線で繋ぐ（骨の描画）
        ctx.strokeStyle = "#00ff00";
        ctx.lineWidth = 2;
        
        for(const connection of POSE_CONNECTIONS){
            const start = landmarks[connection[0]];
            const end = landmarks[connection[1]];
            
            if(start && end){
                ctx.beginPath();
                ctx.moveTo(
                    start.x * canvas.width,
                    start.y * canvas.height
                );
                ctx.lineTo(
                    end.x * canvas.width,
                    end.y * canvas.height
                );
                ctx.stroke();
            }
        }

        // ランドマークのノードを描画
        drawingUtils.drawLandmarks(
            landmarks,
            {
                color:"#ff00ff",
                radius:4
            }
        );

        saveLandmarks(landmarks);
    }
}

//////////////////////////////////////////////////////
// 解析
//////////////////////////////////////////////////////

function analyzeFrame(){

    if(video.paused || video.ended){
        return;
    }

    const result =
    poseLandmarker.detectForVideo(
        video,
        performance.now()
    );

    drawResults(result);

    animationId =
    requestAnimationFrame(
        analyzeFrame
    );
}

//////////////////////////////////////////////////////
// カメラ
//////////////////////////////////////////////////////

cameraBtn.addEventListener(
"click",
async ()=>{

    if(!poseReady){
        alert("モデル読み込み中");
        return;
    }

    csvData = [];

    const stream =
    await navigator.mediaDevices
    .getUserMedia({
        video:true
    });

    video.srcObject = stream;

    await video.play();

    // カメラの実際の解像度を取得
    const settings = stream
        .getVideoTracks()[0]
        .getSettings();
    
    canvas.width = settings.width || 1280;
    canvas.height = settings.height || 720;

    if(animationId){
        cancelAnimationFrame(
            animationId
        );
    }

    analyzeFrame();
});

//////////////////////////////////////////////////////
// 動画読込
//////////////////////////////////////////////////////

videoFile.addEventListener(
"change",
async(e)=>{

    if(!poseReady){

        alert(
        "MediaPipe読み込み中です"
        );

        return;
    }

    const file =
    e.target.files[0];

    if(!file){
        return;
    }

    csvData = [];

    if(animationId){
        cancelAnimationFrame(
            animationId
        );
    }

    video.srcObject = null;

    video.src =
    URL.createObjectURL(
        file
    );

    await new Promise(resolve=>{

        video.onloadedmetadata =
        resolve;

    });

    // 動画の実際の解像度を取得
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    await video.play();

    analyzeFrame();
});

//////////////////////////////////////////////////////
// CSV保存
//////////////////////////////////////////////////////

downloadBtn.addEventListener(
"click",
()=>{

    if(csvData.length===0){

        alert(
        "データがありません"
        );

        return;
    }

    const headers =
    Object.keys(csvData[0]);

    let csv =
    headers.join(",") +
    "\n";

    csvData.forEach(row=>{

        csv +=
        headers
        .map(
            h=>row[h]
        )
        .join(",");

        csv += "\n";

    });

    const blob =
    new Blob(
        [csv],
        {
            type:"text/csv"
        }
    );

    const a =
    document.createElement("a");

    a.href =
    URL.createObjectURL(blob);

    a.download =
    "pose_data.csv";

    a.click();
});

//////////////////////////////////////////////////////
// 起動
//////////////////////////////////////////////////////

(async()=>{

    await initPose();

})();