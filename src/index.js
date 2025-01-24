const express = require("express");
const swaggerUi = require("swagger-ui-express");
const YAML = require('yamljs');
const path = require("path");
const nodemailer = require('nodemailer');
const randomstring = require('randomstring')
const bcrypt = require("bcrypt");
const crypto = require("crypto");
const collection = require("./config");
const swaggerDocument = YAML.load(path.join(__dirname, "swagger.yaml"));

const app = express();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));


// Serve Swagger UI
app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(swaggerDocument));


app.use(express.json());
app.use(express.urlencoded({ extended: false }));

app.set("view engine", "ejs");
app.use(express.static("public"));

const resetTokens = new Map();

app.get("/", (req, res) => {
  res.render("login");
});

app.get("/signup", (req, res) => {
  res.render("signup");
});

app.get("/forgot-password", (req, res) => {
  res.render("forgot-password");
});

app.get("/reset-password", (req, res) => {
  const { token } = req.query;
  if (!token || !resetTokens.has(token)) {
    return res.send("Invalid or expired token.");
  }
  res.render("reset-password", { token });
});

// Change Password Page (after first login)
app.get("/change-password", (req, res) => {
  res.render("change-password");
});

app.get("/verifyOTP", (req, res) => {
  res.render("verifyOTP");
});

app.get("/requestOTP", (req, res) => {
  res.render('requestOTP');
})

// OTP
const otpCache = {};
function generateOTP() {
  return randomstring.generate({ length: 4, charset: 'numeric' })
}

function sendOTP(email, otp) {
  const mailOptions = {
    from: 'hayyafatima565@gmail.com',
    to: email,
    subject: 'OTP Verification',
    text: `Your OTP for verification is: ${otp}`
  };

  let transporter = nodemailer.createTransport({
    service: 'Gmail',
    auth: {
      user: 'hayyafatima565@gmail.com',
      pass: 'fkgx nqli grpc cryg'
    },
    tls: {
      rejectUnauthorized: false
    }
  });

  transporter.sendMail(mailOptions, (error, info) => {
    if (error) {
      console.log('Error occured', error);
    } else {
      console.log('OTP Email sent successfully:', info.response)
    }
  });
}

// Request OTP
app.post('/requestOTP', (req, res) => {
  const { email } = req.body;
  const otp = generateOTP();
  otpCache[email] = otp;

  sendOTP(email, otp);
  res.cookie('otpCache', otpCache, { maxAge: 30000, httpOnly: true })
  res.render('verifyOTP')
})

// Verify OTP
app.post('/verifyOTP', (req, res) => {
  const { email, otp } = req.body;
  if (!otpCache.hasOwnProperty(email)) {
    return res.status(400).json({ message: 'Email not found' })
  }

  if (otpCache[email] === otp.trim()) {
    delete otpCache[email];
    res.render('home');
  } else {
    return res.status(400).json({ message: 'Invalid OTP' })
  }
})

/**
 * @swagger
 * /signup:
 *   get:
 *     description: Show signup page
 *     responses:
 *       200:
 *         description: Signup page rendered
 */

// Sign up
app.post("/signup", async (req, res) => {
  const { email, username, password } = req.body;

  // Validate email format (check if it contains "@gmail.com")
  const emailRegex = /^[a-zA-Z0-9._%+-]+@gmail\.com$/;
  if (!emailRegex.test(email)) {
    return res.json({ success: false, message: "Please enter a valid Gmail address." });
  }

  // Check if user already exists by email
  const existingUserByEmail = await collection.findOne({ email: email });
  if (existingUserByEmail) {
    return res.json({ success: false, message: "Email is already in use. Please choose another one." });
  }

  // Check if user already exists by username
  const existingUserByUsername = await collection.findOne({ name: username });
  if (existingUserByUsername) {
    return res.json({ success: false, message: "Username is already taken. Please choose another one." });
  }

  // Hash the password
  const saltRounds = 10;
  const hashedPassword = await bcrypt.hash(password, saltRounds);

  // Prepare the data object for inserting into the database
  const data = {
    email: email,
    name: username,
    password: hashedPassword,
  };

  // Insert user data into the database
  const userdata = await collection.insertMany(data); // Use insertOne for a single document
  console.log(userdata);

  // Redirect the user to the OTP request page (or confirmation page)
  res.render("requestOTP"); // Modify the view accordingly if needed
});



// Login
app.post("/login", async (req, res) => {
  try {
    const check = await collection.findOne({ name: req.body.username });
    if (!check) {
      return res.json({ success: false, message: "Username not found."});
    }

    const isPasswordMatch = await bcrypt.compare(req.body.password, check.password);
    if (isPasswordMatch) {
      res.render("home");
    } else {
      res.send("Wrong Password");
    }
  } catch (error) {
    return res.json({ success: false, message: "Error: " + error.message });
  }
});

// Forgot Password 
app.post("/forgot-password", async (req, res) => {
  const { username } = req.body;
  const user = await collection.findOne({ name: username });

  if (!user) {
    return res.json({ success: false, message: "Username not found."});
  }

  const resetToken = crypto.randomBytes(32).toString("hex");
  resetTokens.set(resetToken, username);

  console.log(`Reset Token for ${username}: ${resetToken}`);
  res.redirect(`/reset-password?token=${resetToken}`);
});

// Reset Password 
app.post("/reset-password", async (req, res) => {
  const { token, newPassword } = req.body;

  if (!resetTokens.has(token)) {
    return res.send("Invalid or expired token.");
  }

  const username = resetTokens.get(token);

  const saltRounds = 10;
  const hashedPassword = await bcrypt.hash(newPassword, saltRounds);

  await collection.updateOne({ name: username }, { $set: { password: hashedPassword } });

  resetTokens.delete(token);
  return res.json({ success: true, message: "Password has been successfully reset."});
});

// Change Password (after first login)
app.post("/change-password", async (req, res) => {
  const { username, currentPassword, newPassword } = req.body;

  const user = await collection.findOne({ name: username });
  if (!user) {
    return res.json({ success: false, message: "User not found."});
  }

  // Check if the current password is correct
  const isCurrentPasswordMatch = await bcrypt.compare(currentPassword, user.password);
  if (!isCurrentPasswordMatch) {
    return res.json({ success: false, message: "Current password is incorrect."});
  }

  // Check if the new password is the same as the current password
  const isNewPasswordSame = await bcrypt.compare(newPassword, user.password);
  if (isNewPasswordSame) {
    return res.json({ success: false, message: "Please enter a different password."});
  }

  const saltRounds = 10;
  const hashedNewPassword = await bcrypt.hash(newPassword, saltRounds);

  await collection.updateOne({ name: username }, { $set: { password: hashedNewPassword } });

  return res.json({ success: true, message: "Password successfully updated."});
});


const PORT = 5000;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
  console.log("Swagger docs available at /api-docs");
});
