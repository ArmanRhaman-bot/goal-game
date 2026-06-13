const express = require("express");
const path = require("path");

const app = express();

app.use(express.static(path.join(__dirname,"public")));

app.get("/",(req,res)=>{

res.redirect("/play");

});

app.get("/play",(req,res)=>{

const taskid=req.query.taskid;

if(!taskid){

return res.send("Invalid Task ID");

}

res.sendFile(path.join(__dirname,"public","index.html"));

});

const PORT=process.env.PORT||3000;

app.listen(PORT,()=>{

console.log("Server Running "+PORT);

});