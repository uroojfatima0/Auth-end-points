const mongoose = require("mongoose")
const connect = mongoose.connect("mongodb+srv://user_name:mogo_password@mongo_db_name");

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
