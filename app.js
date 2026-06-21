import {
    PoseLandmarker,
    FilesetResolver,
    DrawingUtils,
    POSE_CONNECTIONS
}
from "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14";

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
        drawingUtils.drawConnectors(
            landmarks,
            POSE_CONNECTIONS,
            {
                color:"#0f0",
                lineWidth:2
            }
        );

        // ランドマークのノードを描画
        drawingUtils.drawLandmarks(
            landmarks,
            {
                color:"#f0f",
                radius:3
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

    canvas.width = 960;
    canvas.height = 540;

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

    canvas.width = 960;
    canvas.height = 540;

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