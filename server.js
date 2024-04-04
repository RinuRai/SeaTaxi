const express = require("express");
const bodyParser = require("body-parser");
const mysql = require("mysql2");
const cors = require("cors");
const axios = require("axios");
const fs = require("fs");
const path = require('path');
const multer = require("multer");
const crypto = require('crypto');
const app = express();
const port = 5000;
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(cors());

app.use('/uploads', express.static('uploads'));


const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    let uploadPath = "";
    if (file.fieldname === "driver_pic") {
      uploadPath = "uploads/driver_image/";
    } else if (file.fieldname === "lic_pic") {
      uploadPath = "uploads/license_image/";
    } else if (file.fieldname === "bus_pic") {
      uploadPath = "uploads/bus_image/";
    } else if (file.fieldname === "gallery_images") { 
      uploadPath = "uploads/gallery_images/";
    }
    cb(null, uploadPath); // Save uploaded files to the appropriate directory
  },

  filename: function (req, file, cb) {
    // Generate a unique filename using current timestamp and a random string
    const uniqueFilename = Date.now() + '-' + Math.random().toString(36).substring(7) + '-' + file.originalname;
    cb(null, uniqueFilename); // Use unique filename
  },
});
const upload = multer({
  storage: storage,
  fileFilter: function (req, file, cb) {
    if (
      file.fieldname === "bus_pic" ||
      file.fieldname === "driver_pic" ||
      file.fieldname === "lic_pic" ||
      file.fieldname === "gallery_images" 
      
    ) {
      cb(null, true);
    } else {
      cb(new Error("Invalid file field"));
    }
  },
});
const connection = mysql.createConnection({
  host: "b8s1vhjc96jdaztkviqo-mysql.services.clever-cloud.com",
  user: "unl5bwnlb3j3bvvt",
  password: "NJpVLHj2rEJOYU7Jp7Fw",
  database: "b8s1vhjc96jdaztkviqo",
});
connection.connect((err) => {
  if (err) {
    console.error("Error connecting to MySQL database:", err);
    return;
  }
  console.log("Connected to MySQL database");
});


app.get("/getTaxiEntries", (req, res) => {
  const sql = "SELECT * FROM taxi ORDER BY id DESC";
  connection.query(sql, (err, results) => {
    if (err) {
      console.error("Error fetching taxi entries: ", err);
      res.status(500).send("Error fetching taxi entries");
      return;
    }
    res.json(results);
  });
});

app.post("/Register_Taxi", upload.fields([
  { name: "bus_pic", maxCount: 1 },
  { name: "driver_pic", maxCount: 1 },
  { name: "lic_pic", maxCount: 1 },
]), async (req, res) => {
  try {
    const { veh_type, veh_cate, veh_nm, veh_num, rent, cost_km, driv_nm, driv_num, driv_exp, verify } = req.body;
    const busImage = req.files["bus_pic"] ? req.files["bus_pic"][0] : null;
    const driverImage = req.files["driver_pic"] ? req.files["driver_pic"][0] : null;
    const licImage = req.files["lic_pic"] ? req.files["lic_pic"][0] : null;
    if (!busImage || !driverImage || !licImage) {
      console.error("Incomplete data provided");
      return res.status(400).send("Bad Request: Incomplete data provided");
    }
    const token = generateToken(10);
    const today = new Date().toISOString().split("T")[0];

    const sql = `INSERT INTO taxi (vehicle_type, car_type, car_name, car_number, car_photo, one_day_rent, price_per_km, driver_name, driver_number, driver_photo_path, license_path, experience, verified_id, apply_date, token)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;
    const values = [
      veh_type,
      veh_cate,
      veh_nm,
      veh_num,
      busImage.path,
      rent,
      cost_km,
      driv_nm,
      driv_num,
      driverImage.path,
      licImage.path,
      driv_exp,
      verify,
      today,
      token,
    ];
    connection.query(sql, values, (err, result) => {
      if (err) {
        console.error("Error inserting data:", err);
        return res.status(500).send("Error inserting data");
      }
      console.log("Data inserted successfully");
      return res.send("Data inserted successfully");
    });
  } catch (error) {
    console.error("Error occurred:", error);
    return res.status(500).send("Error occurred");
  }
});

// Route to update a taxi entry
app.put(
  "/api/updateTaxi/:id",
  upload.fields([
    { name: "driver_pic", maxCount: 1 },
    { name: "bus_pic", maxCount: 1 },
    { name: "lic_pic", maxCount: 1 },
  ]),
  (req, res) => {
    const formData = req.body;
    let sql =
      "UPDATE taxi SET one_day_rent = COALESCE(?, one_day_rent), price_per_km = COALESCE(?, price_per_km), driver_name = COALESCE(?, driver_name), driver_number = COALESCE(?, driver_number), experience = COALESCE(?, experience)";

    const values = [
      formData.rent || null,
      formData.cost_km || null,
      formData.driv_nm || null,
      formData.driv_num || null,
      formData.driv_exp || null,
    ];

    if (req.files && req.files.driver_pic) {
      sql += ", driver_photo_path = ?";
      values.push(req.files.driver_pic[0].path);
    }
    if (req.files && req.files.bus_pic) {
      sql += ", car_photo = ?";
      values.push(req.files.bus_pic[0].path);
    }
    if (req.files && req.files.lic_pic) {
      sql += ", license_path = ?";
      values.push(req.files.lic_pic[0].path);
    }

    sql += " WHERE id = ?";
    values.push(req.params.id);

    connection.query(sql, values, (err, result) => {
      if (err) {
        console.error("Error updating taxi:", err);
        res.status(500).send("Error updating taxi");
        return;
      }
      console.log("Taxi updated successfully");
      res.send("Taxi updated successfully");
    });
  }
);
/////////////////////////////////////////////////////////////
app.post("/api/getTaxiEntry", (req, res) => {
  const id = req.body.id;
  const token = req.body.token;
  const sql = "SELECT * FROM taxi WHERE (token = ? AND id = ?)";
  connection.query(sql, [token,id], (err, result) => {
    if (err) {
      console.error("Error fetching taxi entry by token: ", err);
      res.status(500).send("Error fetching taxi entry");
      return;
    }
    if (result.length === 0) {
      res.status(404).send("Taxi entry not found");
      return;
    }
    res.json(result[0]); // Assuming token is unique, so only one row will be fetched
  });
});

/////////////////////////////////////////////////////////////////////

/////////////////////////////////////////////////////////////////////////////////////


// Route to add multiple images to taxi_gallery with a common token and save them to the gallery folder
app.post("/api/addTaxiGallery", upload.array("gallery_images", 10), (req, res) => {
  const token = req.body.Car_token; // Common token for all images
  const images = req.files; // Corrected variable name to avoid conflicts
  
  if (!images || images.length === 0) {
      console.error("Bad Request: No images provided");
      res.status(400).send("Bad Request: No images provided");
      return;
  }
  
  // Insert each image into the taxi_gallery table and copy to the gallery folder
  images.forEach((image) => {
      const sql = "INSERT INTO taxi_gallery (car_photo, token, date) VALUES (?, ?, ?)";
      const values = [
          image.path, // Store the file path in the car_photo field
          token,
          new Date().toISOString().split("T")[0], // Current date
      ];

      connection.query(sql, values, (err, result) => {
          if (err) {
              console.error("Error inserting image into taxi_gallery:", err);
              // If an error occurs, delete the uploaded image
              fs.unlinkSync(image.path);
              return;
          }
          console.log("Image inserted into taxi_gallery successfully");
          
          // Construct destination path for copying image to gallery folder
          const fileName = image.filename; // Assuming filename is unique
          const destination = path.join(__dirname, 'uploads', 'gallery_images', fileName);
          
          // Copy image to gallery folder
          fs.copyFile(image.path, destination, (err) => {
              if (err) {
                  console.error("Error copying image to gallery folder:", err);
                  return;
              }
              console.log("Image copied to gallery folder successfully");
          });
      });
  });
  
  res.send("Images added to taxi_gallery and copied to gallery folder successfully with token " + token);
});


// Route to delete a taxi entry
app.delete("/api/deleteTaxi", (req, res) => {
  const  id  = req.body.car_id; // Retrieve id and token from the request body
  const sql = "DELETE FROM taxi WHERE id = ?";
  connection.query(sql, [id], (err, result) => {
    if (err) {
      console.error("Error deleting taxi:", err);
      res.status(500).send("Error deleting taxi");
      return;
    }
    console.log("Taxi entry deleted successfully");
    res.send("Taxi entry deleted successfully");
  });
}); 

////////////////////////////////////////////////////////////////////////////////////

app.get("/getGalleryImg/:token", (req, res) => {
  const token = req.params.token;
  const sql = "SELECT * FROM taxi_gallery WHERE token = ? ORDER BY id DESC";
  connection.query(sql, [token] ,(err, results) => {
    if (err) {
      console.error("Error fetching taxi entries: ", err);
      res.status(500).send("Error fetching taxi entries");
      return;
    }
    res.json(results);
  });
});
///////////////////////////////////////////////////////////////////////////////////

// Route to delete a taxi entry
// app.delete("/api/deleteGalImg", (req, res) => {
//   const  Imgid  = req.body.img_Id; // Retrieve id and token from the request body
//   const sql = "DELETE FROM taxi_gallery WHERE id = ?";
//   connection.query(sql, [Imgid], (err, result) => {
//     if (err) {
//       console.error("Error deleting Image:", err);
//       res.status(500).send("Error deleting Image");
//       return;
//     }
//     console.log("Image deleted successfully");
//     res.send("Image deleted successfully");
//   });
// });

app.delete("/api/deleteGalImg", (req, res) => {
  const Imgid = req.body.img_Id; // Retrieve id from the request body
  const imagePath = `${req.body.filename}`; // Construct the file 
  console.log('imagepath',imagePath)
  const sql = "DELETE FROM taxi_gallery WHERE id = ?";
  // Delete the image file
  fs.unlink(imagePath, (err) => {
    if (err && err.code === 'ENOENT') {
      // If the file doesn't exist, it's already deleted, so just proceed with the database deletion
      console.warn("Image file not found:", err);
    } else if (err) {
      // If there's an error other than file not found, log and send an error response
      console.error("Error deleting image file:", err);
      res.status(500).send("Error deleting image file");
      return;
    } else {
      // Log that the image file was successfully deleted
      console.log("Image file deleted successfully:", imagePath);
    }
    // Now delete the record from the database
    connection.query(sql, [Imgid], (err, result) => {
      if (err) {
        console.error("Error deleting image record:", err);
        res.status(500).send("Error deleting image record");
        return;
      }
      console.log("Image record deleted successfully");
      res.send("Image record deleted successfully");
    });
  });
});
//////////////////////////////////////////////////////////////////////////////////////

// Route to check if a token exists between start date and end date with verify condition
app.post("/api/checkBookingAvailability", (req, res) => {
  const { cartoken, srt_dt, end_dt } = req.body;
  const sql = "SELECT COUNT(*) AS count FROM booking WHERE car_token = ? AND start_date <= ? AND end_date >= ? AND verify IN (0,1)";
  connection.query(sql, [cartoken, srt_dt, end_dt], (err, result) => {
    if (err) {
      console.error("Error checking token availability:", err);
      res.status(500).send("Error checking token availability");
      return;
    }
    const count = result[0].count;
    const available = count === 0 ? "Yes" : "No";
    res.json(available);
  });
});




////////////////////////////////////////////////////////////////////////////////////////

// Function to insert notification after booking
const insertNotification = (logName, carName, logId, connection) => {
  // Generate the message
  const msg = `${carName} was booked by ${logName}`;
  // Get the current timestamp
  const timestamp = new Date().toISOString().slice(0, 19).replace('T', ' ');
  // SQL query to insert the notification
  const sql = "INSERT INTO taxi_notific (send, recv, msg, visible, time) VALUES (?, ?, ?, ?, ?)";
  const values = [logId, 'ADMIN', msg, false, timestamp];
  // Execute the query
  connection.query(sql, values, (err, result) => {
    if (err) {
      console.error("Error inserting notification:", err);
    } else {
      console.log("Notification inserted successfully");
    }
  });
};
// Route to handle form submission
app.post("/api/booking", (req, res) => {
  const {
    logName,
    LogNum,
    Logid,
    carid,
    cartoken,
    srt_dt,
    end_dt,
    srt_plc,
    end_plc,
    enq_nmb,
    kms,
    amt,
    verify
  } = req.body;
  const sql =
    "INSERT INTO booking (log_name, log_number, log_id, car_id, car_token, start_date, end_date, start_place, end_place, enquiry_number, kms, amt, verify) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)";
  const values = [
    logName,
    LogNum,
    Logid,
    carid,
    cartoken,
    srt_dt,
    end_dt,
    srt_plc,
    end_plc,
    enq_nmb,
    kms,
    amt,
    verify
  ];
  connection.query(sql, values, (err, result) => {
    if (err) {
      console.error("Error inserting booking:", err);
      res.status(500).send("Error inserting booking");
      return;
    }
    console.log("Booking inserted successfully");
    // Insert notification after successful booking
    insertNotification(logName, cartoken, Logid, connection);
    res.send("Booking inserted successfully");
  });
});
///////////////////////////////////////////////////////////////////////////////////////

// Route to fetch a single user's details by logId and logNum
app.post("/api/BookingDtls", (req, res) => {
  const { logId, logNum } = req.body;
  const sql = "SELECT * FROM booking WHERE log_id = ? AND log_number = ?  ORDER BY id DESC";
  connection.query(sql, [logId, logNum], (err, result) => {
    if (err) {
      console.error("Error fetching user details:", err);
      res.status(500).send("Error fetching user details");
      return;
    }
    if (result.length === 0) {
      res.status(404).send("User not found");
      return;
    }
    res.json(result); // Assuming you want to return the first matching user
  });
});
////////////////////////////////////////////////////////////////////////////////////

// Route to check if a user has liked a car based on carId and carToken
app.get("/api/checkLiked/:logid/:carId/:carToken", (req, res) => {
  const { logid, carId, carToken } = req.params;
  const sql = "SELECT COUNT(*) AS rowCount FROM wishlist WHERE cli_id = ? AND car_id = ? AND car_token = ?";
  connection.query(sql, [logid, carId, carToken], (err, result) => {
    if (err) {
      console.error("Error checking liked car:", err);
      res.status(500).send("Error checking liked car");
      return;
    }
    const rowCount = result[0].rowCount;
    res.json(rowCount)
  });
});


// Route to add or remove a car from the user's wishlist
app.post("/api/addRemoveWishlist", (req, res) => {
  const { logid, carId, carToken } = req.body;
  // Check if the entry exists
  const checkSql = "SELECT COUNT(*) AS rowCount FROM wishlist WHERE cli_id = ? AND car_id = ? AND car_token = ?";
  connection.query(checkSql, [logid, carId, carToken], (err, result) => {
    if (err) {
      console.error("Error checking liked car:", err);
      res.status(500).send("Error checking liked car");
      return;
    }
    const rowCount = result[0].rowCount;
    // If rowCount is 1, delete the row
    if (rowCount === 1) {
      const deleteSql = "DELETE FROM wishlist WHERE cli_id = ? AND car_id = ? AND car_token = ?";
      connection.query(deleteSql, [logid, carId, carToken], (err, result) => {
        if (err) {
          console.error("Error removing car from wishlist:", err);
          res.status(500).send("Error removing car from wishlist");
          return;
        }
        res.send("Car removed from wishlist successfully");
      });
    } else {
      // If rowCount is not 1, insert the row
      const insertSql = "INSERT INTO wishlist (cli_id, car_id, car_token) VALUES (?, ?, ?)";
      connection.query(insertSql, [logid, carId, carToken], (err, result) => {
        if (err) {
          console.error("Error adding car to wishlist:", err);
          res.status(500).send("Error adding car to wishlist");
          return;
        }
        res.send("Car added to wishlist successfully");
      });
    }
  });
});

///////////////////////////////////////////////////////////////////////////////
// Route to fetch wishlist data based on logid

app.post("/api/wishlistData", (req, res) => {
  const logid = req.body.logid;
  const sql = "SELECT * FROM wishlist WHERE cli_id = ? ORDER BY id DESC";
  connection.query(sql, [logid], (err, results) => {
    if (err) {
      console.error("Error fetching wishlist data:", err);
      res.status(500).send("Error fetching wishlist data");
      return;
    }
    res.json(results);
  });
});

/////////////////////////////////////////////////////////////////////////////

app.get("/api/AllBookingDetails", (req, res) => {
  const sql = "SELECT * FROM booking ORDER BY id DESC";
  connection.query(sql, (err, results) => {
    if (err) {
      console.error("Error fetching taxi entries: ", err);
      res.status(500).send("Error fetching taxi entries");
      return;
    }
    res.json(results);
  });
});

//////////////////////////////////////////////////////////////////////////////////////

// Function to insert notification after booking approval
const insertNotification2 = (send, recv, msg, visible, connection) => {
  // Get the current timestamp
  const timestamp = new Date().toISOString().slice(0, 19).replace('T', ' ');
  // SQL query to insert the notification
  const sql = "INSERT INTO taxi_notific (send, recv, msg, visible, time) VALUES (?, ?, ?, ?, ?)";
  const values = [send, recv, msg, visible, timestamp];
  // Execute the query
  connection.query(sql, values, (err, result) => {
    if (err) {
      console.error("Error inserting notification:", err);
    } else {
      console.log("Notification inserted successfully");
    }
  });
};
// Route to handle booking approval
app.post("/api/bookingApproved", (req, res) => {
  const { id, carid, verify, cl_id } = req.body;
  const sql = "UPDATE booking SET verify = ? WHERE id = ? AND car_id = ?";
  connection.query(sql, [verify, id, carid], (err, result) => {
    if (err) {
      console.error("Error approving booking:", err);
      res.status(500).send("Error approving booking");
      return;
    }
    console.log("Booking approved successfully");
    // Determine message based on verification status
    let msg;
    if (verify == '200') {
      msg = "Your booking was accepted by ADMIN";
    } else if (verify == '404') {
      msg = "Your booking was cancelled by ADMIN";
    }
    // Insert notification
    insertNotification2('ADMIN', cl_id, msg, false, connection);
    res.status(200).json({ message: "Booking approved successfully" });
  });
});



///////////////////////////////////////////////////////////////////////////////

app.get("/api/getOngoingDetails", (req, res) => {
  const todayDate = new Date();
  const todayDateString = todayDate.toISOString().split("T")[0];
  const sql = "SELECT * FROM booking WHERE ? BETWEEN start_date AND end_date AND verify = '200'";
  connection.query(sql, [todayDateString], (err, results) => {
    if (err) {
      console.error("Error fetching ongoing details:", err);
      res.status(500).send("Error fetching ongoing details");
      return;
    }
    res.status(200).json(results);
  });
});

app.get("/api/getUpComingDetails", (req, res) => {
  const todayDate = new Date().toISOString().split("T")[0]; // Get today's date in ISO format
  const sql = "SELECT * FROM booking WHERE start_date > ? AND verify = '200'";
  connection.query(sql, [todayDate], (err, results) => {
    if (err) {
      console.error("Error fetching upcoming details:", err);
      res.status(500).send("Error fetching upcoming details");
      return;
    }
    console.log('Fetched dates from database:', results.map(entry => ({ start_date: entry.start_date, end_date: entry.end_date })));
    res.status(200).json(results);
  });
});

////////////////////////////////////////////////////////////

// Generate a random 6-digit OTP
const generateOTP = () => {
  return Math.floor(1000 + Math.random() * 9000);
};
// Store OTPs and their corresponding phone numbers
const otpMap = new Map();
app.post('/api/sendOtp', async (req, res) => {
  try {
    const { us_nm, number } = req.body;
    // Use promise-based query by calling con.promise().query() instead of connection.query()
    const [existingUser] = await connection.promise().query('SELECT * FROM taxi_auth WHERE usr_num = ?', [ number]);
    if (existingUser && existingUser.length > 0) {
      const otp = generateOTP();
      await connection.promise().query('UPDATE taxi_auth SET otp = ? , usr_name = ? WHERE usr_num = ?', [otp, us_nm, number]);
      console.log(`OTP ${otp} updated in the database for user ${us_nm} with mobile number ${number}.`);
      // Send OTP to the provided number
      const response = await axios.get(`http://login.smsgatewayhub.com/api/mt/SendSMS?user=Seasensesoftwares&password=Stripl@1&senderid=SEASEN&channel=Trans&DCS=0&flashsms=0&number=${number}&text=Dear ${otp}, Many more happy returns of the day. With regards Sea Sense Group.&route=47&DLTTemplateId=1707161044624969443&PEID=1701159125640974053`);
      console.log(`OTP ${otp} sent to ${number} successfully.`);
      res.status(200).send('OTP sent successfully');
      console.log(`Response sent to client: OTP sent successfully`);
    } else {
      const otp = generateOTP();
      await connection.promise().query('INSERT INTO taxi_auth (whoislogin, usr_name, usr_num, otp,verified) VALUES (?,?, ?, ?,?)', ['Guest',us_nm, number, otp,'0']);
      console.log(`New user ${us_nm} with mobile number ${number} registered in the database with OTP ${otp}.`);
      const response = await axios.get(`http://login.smsgatewayhub.com/api/mt/SendSMS?user=Seasensesoftwares&password=Stripl@1&senderid=SEASEN&channel=Trans&DCS=0&flashsms=0&number=${number}&text=Dear ${otp}, Many more happy returns of the day. With regards Sea Sense Group.&route=47&DLTTemplateId=1707161044624969443&PEID=1701159125640974053`);
      console.log(`OTP ${otp} sent to ${number} successfully.`);
      res.status(200).send('OTP sent successfully');
      console.log(`Response sent to client: OTP sent successfully`);
    }
  } catch (error) {
    console.error(error);
    res.status(500).send('Failed to send OTP');
    console.log(`Response sent to client: Failed to send OTP`);
  }
});


app.post('/api/verifyOtp', async (req, res) => {
  try {
    const { number, otp } = req.body;
    // Retrieve the matching row from the database
    const [matchingUser] = await connection.promise().query('SELECT * FROM taxi_auth WHERE usr_num = ?', [number]);
    // Check if there is a matching row
    if (matchingUser && matchingUser.length > 0) {
      const user = matchingUser[0];
      // Check if the provided OTP matches the stored OTP and if the user is not already verified
      if (user.otp === otp) {
        // If OTP is verified successfully, update the 'verified' field to 1
        await connection.promise().query('UPDATE taxi_auth SET verified = 1 WHERE id = ?', [user.id]);
        console.log(`OTP verified successfully for user ${user.usr_name} with mobile number ${user.usr_num}.`);
        res.status(200).send('OTP verified successfully');
      } else if(user.usr_num=== number && user.verified=== 0 ) {
        // If OTP verification is invalid or user is already verified, delete the row
        await connection.promise().query('DELETE FROM taxi_auth WHERE id = ?', [user.id]);
        console.log(`Invalid OTP or user already verified. Row deleted for user ${user.usr_name} with mobile number ${user.usr_num}.`);
        res.status(400).send('Invalid OTP or user already verified');
      }
      else{
        res.status(400).send('Invalid OTP');
      }
    } else {
      res.status(400).send('No matching records for the provided number');
    }
  } catch (error) {
    console.error('Failed to verify OTP:', error);
    res.status(500).send('Failed to verify OTP');
  }
});

/////////////////////////////////////////////////////////////////////////////////////
app.post('/api/fetchUserByNumberAndOTP', async (req, res) => {
  try {
    const { number, otp } = req.body;
    // Retrieve the matching row from the database
    const [matchingUser] = await connection.promise().query('SELECT * FROM taxi_auth WHERE usr_num = ? AND otp = ?', [number, otp]);
    // Check if there is a matching row
    if (matchingUser && matchingUser.length > 0) {
      const user = matchingUser[0];
      res.status(200).json(user); // Send the matched user details as response
    } else {
      res.status(400).send('No matching records for the provided number and OTP');
    }
  } catch (error) {
    console.error('Failed to fetch user by number and OTP:', error);
    res.status(500).send('Failed to fetch user by number and OTP');
  }
});
////////////////////////////////////////////////////////////////////////////

// Route to handle fetching notifications
app.post("/api/getNotific", (req, res) => {
  const { who, lgid } = req.body;
  let sql;
  let values;
  if (who === 'ADMIN') {
    // Fetch notifications where recv field is ADMIN
    sql = "SELECT * FROM taxi_notific WHERE recv = ? ORDER BY id DESC";
    values = ['ADMIN'];
  } else {
    // Fetch notifications where recv field is the provided lgid
    sql = "SELECT * FROM taxi_notific WHERE recv = ? ORDER BY id DESC";
    values = [lgid];
  }
  // Execute the query
  connection.query(sql, values, (err, result) => {
    if (err) {
      console.error("Error fetching notifications:", err);
      res.status(500).send("Error fetching notifications");
      return;
    }
    console.log("Notifications fetched successfully");
    res.status(200).json(result);
  });
});
/////////////////////////////////////////////////////////////////////////////////


// Route to handle marking a notification as read
app.post("/api/MarkasRead", (req, res) => {
  const { notific_id } = req.body;
  const sql = "UPDATE taxi_notific SET visible = 1 WHERE id = ?";
  connection.query(sql, [notific_id], (err, result) => {
    if (err) {
      console.error("Error marking notification as read:", err);
      res.status(500).send("Error marking notification as read");
      return;
    }
    console.log("Notification marked as read successfully");
    res.status(200).send("Notification marked as read successfully");
  });
});

///////////////////////////////////////////////////////////

// Route to handle fetching notification counts
app.post("/api/getNotificCOUNT", (req, res) => {
  const { who, lgid } = req.body;
  let sql;
  let values;
  if (who === 'ADMIN') {
    // Count notifications where recv field is ADMIN and visible is 0
    sql = "SELECT COUNT(*) AS count FROM taxi_notific WHERE recv = ? AND visible = 0";
    values = ['ADMIN'];
  } else {
    // Count notifications where recv field is the provided lgid and visible is 0
    sql = "SELECT COUNT(*) AS count FROM taxi_notific WHERE recv = ? AND visible = 0";
    values = [lgid];
  }
  // Execute the query
  connection.query(sql, values, (err, result) => {
    if (err) {
      console.error("Error fetching notification count:", err);
      res.status(500).send("Error fetching notification count");
      return;
    }
    console.log("Notification count fetched successfully");
    res.status(200).json(result[0].count); // Return the count of notifications
  });
});

//////////////////////////////////////////////////////////////////////////////////////

app.get("/api/getDriverDtls", (req, res) => {
  const sql = "SELECT driver_name, MAX(driver_number) as driver_number, MAX(driver_photo_path) as driver_photo_path, MAX(experience) as experience FROM taxi GROUP BY driver_name ORDER BY id DESC";
  connection.query(sql, (err, results) => {
    if (err) {
      console.error("Error fetching taxi entries: ", err);
      res.status(500).send("Error fetching taxi entries");
      return;
    }
    res.json(results);
  });
});


///////////////////////////////////////////////////////////////////////////////////////
app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});
function generateToken(length) {
  return crypto.randomBytes(Math.ceil(length / 2))
    .toString('hex') // convert to hexadecimal format
    .slice(0, length); // return required number of characters
}
