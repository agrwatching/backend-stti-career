// routes/userManagement.js
const express = require("express");
const { adminResetPassword, userChangeOwnPassword } = require("../controllers/userManagementController");
const { authenticateToken, isAdmin } = require("../middleware/auth");

const router = express.Router();

/**
 * 🔒 Route untuk Admin mengganti password user (HR / Pelamar)
 * Method: PATCH /api/users/:user_id/reset-password
 * Body: { new_password: "passwordbaru123" }
 */
router.patch("/:user_id/reset-password", authenticateToken, isAdmin, adminResetPassword);

/**
 * 🔑 Route untuk user ganti password sendiri
 * Method: PATCH /api/users/change-password
 * Body: { current_password: "lama", new_password: "baru" }
 */
router.patch("/change-password", authenticateToken, userChangeOwnPassword);

module.exports = router;
