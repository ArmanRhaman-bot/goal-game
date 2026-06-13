let shots = 0;
let goals = 0;

const keeper = document.getElementById("keeper");
const ball = document.getElementById("ball");
const score = document.getElementById("score");

let move = 0;

// Goalkeeper Move
setInterval(() => {

move++;

if(move % 2==0){

keeper.style.left = "35%";

}else{

keeper.style.left = "65%";

}

},500);


// Shoot Button

document.getElementById("shootBtn").onclick=function(){

if(shots>=7){
return;
}

shots++;

ball.style.transition="0.4s";
ball.style.bottom="320px";

setTimeout(()=>{

ball.style.transition="0s";
ball.style.bottom="20px";

// Random Goal

let chance=Math.random();

if(chance>0.35){

goals++;

}

score.innerHTML="Goals : "+goals+" / 7";

if(shots==7){

gameFinish();

}

},450);

};



function gameFinish(){

document.getElementById("shootBtn").style.display="none";

document.getElementById("finish").style.display="block";

document.getElementById("rewardText").innerHTML=
"Goals : "+goals+" / 7";

}



// Claim

function claimReward(){

let url=new URL(window.location);

let task=url.searchParams.get("taskid");

window.location.href=
"https://t.me/YourBot?start=claim_"+task+"_"+goals;

}