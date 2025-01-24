const mongoose = require("mongoose")
const connect = mongoose.connect("mongodb+srv://urooj12186:_arooj123@cluster0.g4mjn.mongodb.net/CineHub");

connect.then (() => {
    console.log("Database Connected Successfully");
}) 
.catch(() => {
    console.log("Database cannot be connected");
})

// schema
const SignupSchema = new mongoose.Schema({
    email: {
        type: String,
        required: true,
        unique: true,
    },
    name: {
        type: String,
        required: true,
        unique: true,
    },
    password: {
        type: String,
        required: true
    }
})

//collection part
 const collection = new mongoose.model("users", SignupSchema)

 module.exports = collection;