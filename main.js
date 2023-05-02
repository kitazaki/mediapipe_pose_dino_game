Array.prototype.sum = function() {
    return this.reduce(function(a,b){return a+b;}, 0);
};
Array.prototype.mean = function() {
    return this.sum()/this.length;
};
Array.prototype.std = function() {
    const n = this.length;
    const mean = this.mean();
    return Math.sqrt(this.map(x => Math.pow(x - mean, 2)).reduce((a, b) => a + b) / n);
};

function CircularArray(maxLength) {
  this.maxLength = maxLength;
}
CircularArray.prototype = Object.create(Array.prototype);
CircularArray.prototype.push = function(element) {
  Array.prototype.push.call(this, element);
  while (this.length > this.maxLength) {
    this.shift();
  }
}
CircularArray.prototype.mean = function(element) {
  return this.reduce((a, b) => a + b, 0)/this.length;
}
CircularArray.prototype.diff = function(element) {
    return this.slice(1).map((n,i) => n-this[i]);
}


class Detector {
    constructor(lag, threshold) {
        this.y = Array(lag+1).fill(0);
        this.lag = lag;
        this.threshold = threshold;
        this.signals = Array(this.y.length).fill(0);
        this.filteredY = [...this.y];
        this.avgFilter = Array(this.y.length).fill(0);
        this.stdFilter = Array(this.y.length).fill(0);
        this.avgFilter[this.lag - 1] = this.y.slice(0,this.lag).mean();
        this.stdFilter[this.lag - 1] = this.y.slice(0,this.lag).std();
    }

    update(newval) {
	this.signal = newval * -1;
        return this.signal
    }
}


const videoElement = document.getElementsByClassName('input_video')[0];
const canvasElement = document.getElementsByClassName('output_canvas')[0];
const canvasCtx = canvasElement.getContext('2d');


Plotly.plot('chart',[{
    y:[],
    type:'line',
    name:'胴体位置(平均)',
},{
    y:[],
    type:'line',
    name:'検知',
},{
    y:[],
    type:'line',
    name:'胴体位置',
}],
    {
        yaxis: {
            range: [-1,1],
        }
    }
);
var npoints = 0;

var rollings = {
    11: new CircularArray(30),
    12: new CircularArray(30),
    23: new CircularArray(30),
    24: new CircularArray(30),
}
var detector = new Detector(30, 1.0);

var prevsig = 0;
var njump = 0;
var jumptimes = new CircularArray(10);
var results_buffer = [];
var url = "http://localhost:5000/logger"

function clearJumps() {
    jumptimes.length = 0;
    results_buffer.length = 0;
    njump = 0;
    document.getElementById("jumpcount").innerHTML = `${njump} jumps`;
}

document.getElementById("clear").onclick = clearJumps;

function onResults(results) {
  canvasCtx.save();
  canvasCtx.clearRect(0, 0, canvasElement.width, canvasElement.height);
  canvasCtx.drawImage(results.image, 0, 0, canvasElement.width, canvasElement.height);
  drawConnectors(canvasCtx, results.poseLandmarks, POSE_CONNECTIONS,
                 {color: '#00FF00', lineWidth: 4});
  drawLandmarks(canvasCtx, results.poseLandmarks,
                {color: '#FF0000', lineWidth: 2});
  canvasCtx.restore();


    var landmarks = results["poseLandmarks"];
    var ts = Date.now();

    var sig = 0;
    if (landmarks.length > 0) {
        [11,12,23,24].forEach(
            i => rollings[i].push(landmarks[i].y)
        );

        let yval = (
            (landmarks[11].y - rollings[11].mean()) +
            (landmarks[12].y - rollings[12].mean()) +
            (landmarks[23].y - rollings[23].mean()) +
            (landmarks[24].y - rollings[24].mean()));

        let meanvis = (
            landmarks[11].visibility +
            landmarks[12].visibility +
            landmarks[23].visibility +
            landmarks[24].visibility
        )/4;

        //console.log("yval, meanvis: "+yval+", "+meanvis);
        sig = 0;

        if (yval >= 0.4) {
            prevsig = detector.update(yval);
            sig = detector.update(yval);
            //console.log("prevsig: "+prevsig);
        }

        if (yval <= -0.5)
            sig = detector.update(yval);

        let jump = 0
        if ((prevsig < 0) && (sig > 0)) {
            jump = 1;
            prevsig = 0;
        }

        if (jump) {
            njump++;
            console.log("jump!: "+njump);
            jumptimes.push(0.001*ts);
            let rate = Math.round(60./jumptimes.diff().mean());
            if (njump > 2) {
                document.getElementById("jumpcount").innerHTML = `${njump} jumps at ${rate}/min`;
            } else {
                document.getElementById("jumpcount").innerHTML = `${njump} jumps`;
            }
            $.ajax({ 
               type: 'POST',
               url: url,
               data: JSON.stringify({"njump": njump}),
               contentType: 'application/json',
            });
        }



        Plotly.extendTraces("chart",{ y: [[yval],[sig],[0.4*meanvis]]}, [0,1,2]);
        npoints++;
        if (npoints>150) {
            Plotly.relayout('chart',{
                xaxis: {
                    range: [npoints-150,npoints]
                }
            });
        }

    }

    var ret = {};
    ret["landmarks"] = results["poseLandmarks"];
    ret["jump"] = sig;
    ret["date"] = Date.now();
    for (var i = 0; i < ret["landmarks"].length; i++) {
        ret["landmarks"][i]["x"] = Math.round(ret["landmarks"][i]["x"]*1e5)/1e5;
        ret["landmarks"][i]["y"] = Math.round(ret["landmarks"][i]["y"]*1e5)/1e5;
        ret["landmarks"][i]["z"] = Math.round(ret["landmarks"][i]["z"]*1e5)/1e5;
        ret["landmarks"][i]["visibility"] = Math.round(ret["landmarks"][i]["visibility"]*1e3)/1e3;
    }

    results_buffer.push(ret);
    // console.log(results_buffer.length);

    // bufferの数が1000を超えたらリセット
    if (results_buffer.length > 1000) {
        results_buffer.length = 0;
    }

}

            
const downloadToFile = (content, filename, contentType) => {
    const a = document.createElement('a');
    const file = new Blob([content], {type: contentType});
    a.href= URL.createObjectURL(file);
    a.download = filename;
    a.click();
    URL.revokeObjectURL(a.href);
};


const pose = new Pose({locateFile: (file) => {
  return `https://cdn.jsdelivr.net/npm/@mediapipe/pose/${file}`;
}});
pose.setOptions({
  modelComplexity: 1,
  smoothLandmarks: true,
  minDetectionConfidence: 0.5,
  minTrackingConfidence: 0.5
});
pose.onResults(onResults);

const camera = new Camera(videoElement, {
  onFrame: async () => {
    await pose.send({image: videoElement});
  },
  width: 640,
  height: 360
});
camera.start();
