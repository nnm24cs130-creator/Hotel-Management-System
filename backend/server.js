// Import the necessary modules
// 'express' is a web framework for Node.js. It makes building APIs much easier.
const express = require("express");

// 'cors' stands for Cross-Origin Resource Sharing. It allows our frontend (HTML files)
// to securely talk to our backend (this file) even if they run on different ports.
const cors = require("cors");

// Import our database connection file so we can talk to MySQL
const db = require("./db");

// Run the express function to start our application
const app = express();

// Tell our app to use CORS so the frontend doesn't get blocked
app.use(cors());

// Tell our app to automatically understand JSON data sent from the frontend
app.use(express.json());

// A simple helper function to handle database errors so we don't write this code 50 times
function handleDbError(res, err) {
  console.error(err); // Print the error to the console for the developer to see
  return res
    .status(500) // 500 means "Internal Server Error"
    .send(err && err.message ? err.message : "Server error");
}

// A dictionary object holding the prices for different room types
const typePrices = {
  1: 5000,  // Type 1 is 5000 / night
  2: 8000,  // Type 2 is 8000 / night
  3: 10000, // Type 3 is 10000 / night
};

/* ========================================================================= */
/* ===================== USERS (REGISTER & LOGIN) ========================== */
/* ========================================================================= */

// POST requests are used when you want to SEND data to the server (like a signup form)
app.post("/register", (req, res) => {
  // Extract name, email, and password from the data (body) the frontend sent us
  const { name, email, password } = req.body;

  // Make sure they filled out all three fields!
  if (!name || !email || !password) {
    return res.status(400).send("All fields required"); // 400 means "Bad Request"
  }

  // First, check how many users currently exist in our database
  db.query("SELECT COUNT(*) AS total FROM users", (countErr, result) => {
    if (countErr) return handleDbError(res, countErr);

    // If there are exactly 0 users, this new person becomes the admin!
    const role = result[0].total === 0 ? "admin" : "guest";

    // The SQL command to INSERT a new user into our 'users' table, now including the role
    const sql = "INSERT INTO users (name, email, password, role) VALUES (?, ?, ?, ?)";

    // Run the query! Pass the variables in an array
    db.query(sql, [name, email, password, role], (err) => {
      if (err) return handleDbError(res, err);
      res.send("User registered successfully"); // Tell the frontend it worked
    });
  });
});

app.post("/login", (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).send("Email and password are required");
  }

  // Find a user in the database who has this exact email and password
  const sql = "SELECT * FROM users WHERE email=? AND password=?";

  db.query(sql, [email, password], (err, result) => {
    if (err) return handleDbError(res, err);

    // An array length greater than 0 means we found a match!
    if (result.length > 0) {
      const user = result[0]; // Get the first (and only) matching user
      // Send the user's data back to the frontend (excluding their password for safety)
      return res.json({
        user_id: user.user_id,
        name: user.name,
        email: user.email,
        role: user.role, // Pass database role back to frontend
      });
    }
    // 401 means "Unauthorized" (wrong username/password)
    res.status(401).send("Invalid credentials");
  });
});

// GET requests are used when you want to RECEIVE data from the server
app.get("/users", (req, res) => {
  const sql = "SELECT user_id, name, email FROM users";
  db.query(sql, (err, result) => {
    if (err) return handleDbError(res, err);
    res.json(result); // Send the list of all users back as JSON
  });
});

/* ========================================================================= */
/* ===================== ROOM TYPE ========================================= */
/* ========================================================================= */

app.post("/room-type", (req, res) => {
  const { type_name, description } = req.body;

  if (!type_name || !description) {
    return res.status(400).send("All fields required");
  }

  const sql = "INSERT INTO room_type (type_name, description) VALUES (?, ?)";

  db.query(sql, [type_name, description], (err) => {
    if (err) return handleDbError(res, err);
    res.send("Room type added successfully");
  });
});

app.get("/room-type", (req, res) => {
  db.query("SELECT * FROM room_type", (err, result) => {
    if (err) return handleDbError(res, err);
    res.json(result);
  });
});

/* ========================================================================= */
/* ===================== ROOMS ============================================= */
/* ========================================================================= */

app.post("/add-room", (req, res) => {
  const { room_number, status, type_id } = req.body;

  // Convert type_id to a number, just in case it was sent as a string
  const selectedType = Number(type_id);
  // Look up the price locally using our typePrices dictionary defined at the top
  const price = typePrices[selectedType];

  if (!room_number || !status || !type_id) {
    return res.status(400).send("All fields required");
  }

  // If the type ID wasn't 1, 2, or 3, price will be undefined.
  if (!price) {
    return res.status(400).send("Invalid room type ID. Use 1, 2, or 3.");
  }

  const sql = "INSERT INTO rooms (room_number, price, status, type_id) VALUES (?, ?, ?, ?)";
  db.query(sql, [room_number, price, status, selectedType], (err) => {
    if (err) return handleDbError(res, err);
    res.send("Room added successfully");
  });
});

// Get the list of all rooms
app.get("/rooms", (req, res) => {
  // We use a "JOIN" here. This merges the "rooms" table with the "room_type" table,
  // so we know that type "1" actually means "Single", for example!
  const sql = `
    SELECT r.*, rt.type_name 
    FROM rooms r 
    JOIN room_type rt ON r.type_id = rt.type_id`;

  db.query(sql, (err, result) => {
    if (err) return handleDbError(res, err);
    res.json(result); // Sends an array of all rooms to the frontend
  });
});

// app.put is used when you want to UPDATE perfectly existing data
// The ":id" part of the URL is a variable we can grab!
app.put("/rooms/:id", (req, res) => {
  const { room_number, status, type_id } = req.body;
  const selectedType = Number(type_id);
  const price = typePrices[selectedType];

  if (!room_number || !status || !type_id) {
    return res.status(400).send("All fields required");
  }

  if (!price) {
    return res.status(400).send("Invalid room type ID. Use 1, 2, or 3.");
  }

  const sql = "UPDATE rooms SET room_number=?, price=?, status=?, type_id=? WHERE room_id=?";

  // req.params.id grabs the ":id" from the URL path!
  db.query(sql, [room_number, price, status, selectedType, req.params.id], (err) => {
    if (err) return handleDbError(res, err);
    res.send("Room updated successfully");
  });
});

// app.delete is used to permanently REMOVE data
app.delete("/rooms/:id", (req, res) => {
  const roomId = req.params.id;

  // You cannot delete a room if someone is currently booked in it!
  // First, we check if there are any bookings tied to this room_id.
  db.query(
    "SELECT COUNT(*) AS count FROM bookings WHERE room_id=?",
    [roomId],
    (err, result) => {
      if (err) return handleDbError(res, err);

      // If count > 0, it means a booking exists. Block the deletion!
      if (result[0].count > 0) {
        return res
          .status(409) // 409 means "Conflict"
          .send("Cannot delete room: there are existing bookings for this room. Delete those bookings first.");
      }

      // Safe to delete! Run the DELETE command.
      db.query("DELETE FROM rooms WHERE room_id=?", [roomId], (deleteErr) => {
        if (deleteErr) return handleDbError(res, deleteErr);
        res.send("Room deleted successfully");
      });
    }
  );
});

/* ========================================================================= */
/* ===================== BOOKING =========================================== */
/* ========================================================================= */

app.post("/booking", (req, res) => {
  const { user_id, room_id, check_in, check_out } = req.body;

  if (!user_id || !room_id || !check_in || !check_out) {
    return res.status(400).send("All fields required");
  }

  // Before booking, we MUST check if the room is actually available.
  const checkSql = "SELECT status, type_id FROM rooms WHERE room_id=?";

  db.query(checkSql, [room_id], (err, result) => {
    if (err) return handleDbError(res, err);
    if (!result.length) return res.status(404).send("Room not found");

    // If the status is "Booked", block the request!
    if (result[0].status === "Booked") {
      return res.status(409).send("Room already booked");
    }

    const typeId = Number(result[0].type_id);
    const price = typePrices[typeId];
    if (!price) {
      return res.status(400).send("Invalid room type. Cannot calculate price");
    }

    // Convert their text dates into pure JavaScript Date objects
    const start = new Date(check_in);
    const end = new Date(check_out);

    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
      return res.status(400).send("Invalid check-in or check-out date");
    }

    // Calculate how many nights they are staying based on dates
    const nights = Math.round((end - start) / (1000 * 60 * 60 * 24));
    if (nights <= 0) {
      return res.status(400).send("Check-out must be after check-in");
    }

    const total_price = price * nights;
    if (Number.isNaN(total_price) || total_price < 0) {
      return res.status(400).send("Unable to calculate total price");
    }

    const sql = `
      INSERT INTO bookings (user_id, room_id, check_in_date, check_out_date, total_price)
      VALUES (?, ?, ?, ?, ?)`;

    // Step 1: Create the new booking
    db.query(sql, [user_id, room_id, check_in, check_out, total_price], (err) => {
      if (err) return handleDbError(res, err);

      // Step 2: Now that it's booked, update the room's status so no one else can book it!
      db.query(
        "UPDATE rooms SET status='Booked' WHERE room_id=?",
        [room_id],
        (updateErr) => {
          if (updateErr) return handleDbError(res, updateErr);
          res.send("Room booked successfully");
        }
      );
    }
    );
  });
});

app.delete("/booking/:id", (req, res) => {
  const bookingId = req.params.id;

  // Before deleting the booking, we need to know WHICH room they had,
  // so we can mark that room as "available" again!
  const findSql = "SELECT room_id FROM bookings WHERE booking_id=?";
  db.query(findSql, [bookingId], (err, result) => {
    if (err) return handleDbError(res, err);
    if (!result.length) return res.status(404).send("Booking not found");

    const roomId = result[0].room_id; // Save the room ID

    // Step 1: Delete the booking
    db.query("DELETE FROM bookings WHERE booking_id=?", [bookingId], (deleteErr) => {
      if (deleteErr) return handleDbError(res, deleteErr);

      // Step 2: Free up the room!
      db.query(
        "UPDATE rooms SET status='available' WHERE room_id=?",
        [roomId],
        (updateErr) => {
          if (updateErr) return handleDbError(res, updateErr);
          res.send("Booking deleted and room released");
        }
      );
    }
    );
  });
});

app.get("/booking", (req, res) => {
  const { user_id, role } = req.query;

  let sql = `
    SELECT b.*, u.name AS user_name, r.room_number, r.price AS room_price
    FROM bookings b
    JOIN users u ON b.user_id = u.user_id
    JOIN rooms r ON b.room_id = r.room_id`;

  let params = [];

  if (role !== "admin" && user_id) {
    sql += ` WHERE b.user_id = ?`;
    params.push(user_id);
  }

  db.query(sql, params, (err, result) => {
    if (err) return handleDbError(res, err);
    res.json(result);
  });
});

/* ========================================================================= */
/* ===================== PAYMENT =========================================== */
/* ========================================================================= */

app.post("/payment", (req, res) => {
  const { booking_id, amount, payment_method, payment_status } = req.body;

  if (!booking_id || !amount || !payment_method || !payment_status) {
    return res.status(400).send("All fields required");
  }

  // Prevent double charging! Check if a payment for this booking already exists.
  db.query(
    "SELECT COUNT(*) AS count FROM payments WHERE booking_id=?",
    [booking_id],
    (err, result) => {
      if (err) return handleDbError(res, err);
      if (result[0].count > 0) {
        return res.status(409).send("Payment already exists for this booking");
      }

      const sql = `
        INSERT INTO payments (booking_id, amount, payment_method, payment_status)
        VALUES (?, ?, ?, ?)`;

      db.query(sql, [booking_id, amount, payment_method, payment_status], (insertErr) => {
        if (insertErr) return handleDbError(res, insertErr);
        res.send("Payment completed successfully");
      });
    }
  );
});

app.get("/payment", (req, res) => {
  const sql = `
    SELECT p.*, b.check_in_date, b.check_out_date,
           u.name AS user_name, r.room_number
    FROM payments p
    JOIN bookings b ON p.booking_id = b.booking_id
    JOIN users u ON b.user_id = u.user_id
    JOIN rooms r ON b.room_id = r.room_id
    ORDER BY p.payment_id DESC`;

  db.query(sql, (err, result) => {
    if (err) return handleDbError(res, err);
    res.json(result);
  });
});

/* ========================================================================= */
/* ===================== SERVICE & REQUESTS ================================ */
/* ========================================================================= */

app.post("/service", (req, res) => {
  const { service_name, price } = req.body;

  if (!service_name || !price) {
    return res.status(400).send("All fields required");
  }

  db.query("INSERT INTO services (service_name, price) VALUES (?, ?)", [service_name, price], (err) => {
    if (err) return handleDbError(res, err);
    res.send("Service added successfully");
  });
});

app.get("/service", (req, res) => {
  db.query("SELECT * FROM services", (err, result) => {
    if (err) return handleDbError(res, err);
    res.json(result);
  });
});

app.post("/service-request", (req, res) => {
  const { booking_id, service_id, status } = req.body;

  if (!booking_id || !service_id || !status) {
    return res.status(400).send("All fields required");
  }

  const sql = "INSERT INTO service_requests (booking_id, service_id, status) VALUES (?, ?, ?)";
  db.query(sql, [booking_id, service_id, status], (err) => {
    if (err) return handleDbError(res, err);
    res.send("Service requested successfully");
  });
});

app.get("/service-request", (req, res) => {
  db.query("SELECT * FROM service_requests", (err, result) => {
    if (err) return handleDbError(res, err);
    res.json(result);
  });
});

/* ========================================================================= */
/* ===================== STAFF MANAGEMENT ================================== */
/* ========================================================================= */

app.post("/staff", (req, res) => {
  const { name, role, phone, salary } = req.body;

  if (!name || !role || !phone || !salary) {
    return res.status(400).send("All fields required");
  }

  db.query("INSERT INTO staff (name, role, phone, salary) VALUES (?, ?, ?, ?)", [name, role, phone, salary], (err) => {
    if (err) return handleDbError(res, err);
    res.send("Staff added successfully");
  });
});

app.get("/staff", (req, res) => {
  db.query("SELECT * FROM staff", (err, result) => {
    if (err) return handleDbError(res, err);
    res.json(result);
  });
});

app.post("/assign-staff", (req, res) => {
  const { staff_id, room_id } = req.body;

  if (!staff_id || !room_id) {
    return res.status(400).send("All fields required");
  }

  db.query("INSERT INTO staff_assignment (staff_id, room_id) VALUES (?, ?)", [staff_id, room_id], (err) => {
    if (err) return handleDbError(res, err);
    res.send("Staff assigned successfully");
  });
});

app.get("/assign-staff", (req, res) => {
  db.query("SELECT * FROM staff_assignment", (err, result) => {
    if (err) return handleDbError(res, err);
    res.json(result);
  });
});

/* ========================================================================= */
/* ===================== REVIEWS =========================================== */
/* ========================================================================= */

app.post("/review", (req, res) => {
  const { user_id, room_id, review_text } = req.body;
  const userId = Number(user_id);
  const roomId = Number(room_id);

  if (!userId || !roomId || !review_text) {
    return res.status(400).send("All fields required");
  }

  // To prevent bad data, we first verify that the User actually exists!
  db.query("SELECT user_id FROM users WHERE user_id = ?", [userId], (userErr, userResult) => {
    if (userErr) return handleDbError(res, userErr);
    if (userResult.length === 0) return res.status(400).send("User not found");

    // Next, verify that the Room actually exists!
    db.query("SELECT room_id FROM rooms WHERE room_id = ?", [roomId], (roomErr, roomResult) => {
      if (roomErr) return handleDbError(res, roomErr);
      if (roomResult.length === 0) return res.status(400).send("Room not found");

      // Both exist, run the insertion
      const sql = "INSERT INTO reviews (user_id, room_id, review_text) VALUES (?, ?, ?)";
      db.query(sql, [userId, roomId, review_text], (err) => {
        if (err) return handleDbError(res, err);
        res.send("Review added successfully");
      });
    });
  });
});

app.get("/review", (req, res) => {
  db.query("SELECT * FROM reviews", (err, result) => {
    if (err) return handleDbError(res, err);
    res.json(result);
  });
});

// A special route combining the review with the User's name and Room number
app.get("/reviews", (req, res) => {
  const sql = `
    SELECT rv.review_id, u.user_id, u.name AS user_name, r.room_number, rv.review_text
    FROM reviews rv
    JOIN users u ON rv.user_id = u.user_id
    JOIN rooms r ON rv.room_id = r.room_id
    ORDER BY rv.review_id DESC`;

  db.query(sql, (err, result) => {
    if (err) return handleDbError(res, err);
    res.json(result);
  });
});

app.delete("/reviews/:id", (req, res) => {
  const reviewId = Number(req.params.id);
  if (!reviewId) { return res.status(400).send("Invalid review ID"); }

  db.query("DELETE FROM reviews WHERE review_id = ?", [reviewId], (err, result) => {
    if (err) return handleDbError(res, err);
    // 'affectedRows' tells us if anything actually got deleted
    if (result.affectedRows === 0) {
      return res.status(404).send("Review not found");
    }
    res.send("Review deleted successfully");
  });
});

/* ========================================================================= */
/* ===================== START SERVER ====================================== */
/* ========================================================================= */

// Finally, start fighting traffic on port 3000!
app.listen(3000, () => {
  console.log("Server running on port 3000");
});
